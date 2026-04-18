import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth, API } from "@/App";
import { toast } from "sonner";
import axios from "axios";
import { ArrowLeft, Send, Loader2, Check, CheckCheck, Lock, Unlock, Shield } from "lucide-react";
import BlurredImage, { BLUR_STATES } from "../components/BlurredImage";
import SilhouetteAvatar from "../components/SilhouetteAvatar";

const Chat = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [otherUser, setOtherUser] = useState(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);  // Mutual reveal state
  const [isBlocked, setIsBlocked] = useState(false);    // Blocked state
  const [unlockReason, setUnlockReason] = useState(null);
  const [accepting, setAccepting] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    fetchMessages();
    // Note: fetchUserProfile is called AFTER fetchMessages sets isBlocked
    // We'll handle the profile fetch in a separate effect to avoid overwriting blocked user data
    connectWebSocket();
    const interval = setInterval(fetchMessages, 5000);
    return () => {
      clearInterval(interval);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [userId]);

  // Only fetch user profile if NOT blocked - blocked users get their data from messages endpoint
  // This prevents the profile endpoint from overwriting the real name with "Unavailable"
  useEffect(() => {
    if (!isBlocked && !loading) {
      fetchUserProfile();
    }
  }, [isBlocked, loading, userId]);

  // Direct profile fetch - only called for non-blocked users
  const fetchUserProfile = async () => {
    // Skip if we already have user data from messages endpoint or if blocked
    if (isBlocked) return;
    
    try {
      const response = await axios.get(`${API}/users/${userId}/profile`);
      // Don't overwrite if response indicates blocked/unavailable
      if (!response.data.is_blocked && !response.data.is_unavailable) {
        setOtherUser(response.data);
      }
    } catch (error) {
      console.error("Failed to fetch user profile:", error);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const connectWebSocket = () => {
    if (!user?.id) return;
    
    const wsUrl = API.replace('/api', '').replace('https://', 'wss://').replace('http://', 'ws://');
    const ws = new WebSocket(`${wsUrl}/api/ws/${user.id}`);
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle read receipts
        if (data.type === 'messages_read' && data.by_user_id === userId) {
          setMessages(prev => prev.map(msg => {
            if (data.message_ids.includes(msg.id)) {
              return { ...msg, is_read: true, read_at: data.read_at };
            }
            return msg;
          }));
        }
        
        // Handle new messages
        if (data.type === 'new_message' && data.message.from_user_id === userId) {
          fetchMessages();
        }
        
        // Handle chat request accepted
        if (data.type === 'chat_request_accepted' && data.by_user_id === userId) {
          setIsUnlocked(true);
          setUnlockReason('chat_accepted');
          toast.success("Chat unlocked!");
          fetchMessages();
        }
        
        // Handle mutual match created (unified event)
        if (data.type === 'mutual_match_created') {
          const matchUserId = data.by_user?.id || data.from_user?.id;
          if (matchUserId === userId) {
            setIsUnlocked(true);
            setUnlockReason(data.source || 'mutual_match');
            toast.success("You made a mutual connection!");
            fetchMessages();
          }
        }
        
        // Handle user unblocked - refresh chat state to clear blocked status
        if (data.type === 'user_unblocked') {
          const unblockUserId = data.unblocked_by || data.unblocked_user;
          if (unblockUserId === userId) {
            // This chat's user was unblocked - refresh to clear blocked state
            setIsBlocked(false);
            fetchMessages();
          }
        }
      } catch (e) {
        console.error('WebSocket message error:', e);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    wsRef.current = ws;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchMessages = async () => {
    try {
      const response = await axios.get(`${API}/messages/${userId}`);
      const data = response.data;
      
      // Handle new response format with unlock status, reveal state, and block state
      if (data.messages !== undefined) {
        setMessages(data.messages);
        setIsUnlocked(data.is_unlocked);
        setIsRevealed(data.is_revealed || false);  // Mutual reveal state
        setIsBlocked(data.is_blocked || false);    // Blocked state
        setUnlockReason(data.unlock_reason);
        // Always use other_user from messages endpoint - it has the real name even for blocked users
        if (data.other_user) {
          setOtherUser(data.other_user);
        }
      } else {
        // Old format fallback
        setMessages(data);
        setIsUnlocked(true);
        setIsRevealed(false);
        setIsBlocked(false);
      }
    } catch (error) {
      if (error.response?.status === 403) {
        toast.error("You're not connected with this person");
        navigate("/matches");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    
    // Prevent sending if blocked
    if (isBlocked) {
      return; // Silently ignore - input should be disabled anyway
    }

    setSending(true);
    try {
      const response = await axios.post(`${API}/messages`, {
        to_user_id: userId,
        content: newMessage.trim(),
      });
      
      if (response.data.is_request) {
        toast.info("Message request sent");
      }
      
      setNewMessage("");
      fetchMessages();
      inputRef.current?.focus();
    } catch (error) {
      // Don't show raw "Failed to send" for blocked users
      if (!isBlocked) {
        toast.error("Failed to send message");
      }
    } finally {
      setSending(false);
    }
  };

  const handleAcceptRequest = async () => {
    setAccepting(true);
    try {
      await axios.post(`${API}/messages/accept-request/${userId}`);
      toast.success("Chat unlocked!");
      setIsUnlocked(true);
      fetchMessages();
    } catch (error) {
      toast.error("Failed to accept request");
    } finally {
      setAccepting(false);
    }
  };

  const handleDeclineRequest = async () => {
    try {
      await axios.post(`${API}/messages/decline-request/${userId}`);
      toast.success("Request declined");
      navigate("/connections");
    } catch (error) {
      toast.error("Failed to decline request");
    }
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatReadTime = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return formatTime(dateString);
    return date.toLocaleDateString();
  };

  // Get the last sent message that was read (for showing "Read" indicator)
  const lastReadMessage = messages
    .filter(m => m.from_user_id === user?.id && m.is_read)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

  // Check if there are pending requests from the other user
  const hasIncomingRequest = !isUnlocked && messages.some(m => m.from_user_id === userId && m.is_request);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col" data-testid="chat-page">
      {/* Header - Always visible with user identity */}
      <div className="sticky top-0 z-40 glass border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              data-testid="back-btn"
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="text-slate-400 hover:text-white hover:bg-white/10 shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            
            {/* User identity section - clickable to view profile (disabled when blocked) */}
            {otherUser ? (
              <div 
                className={`flex items-center gap-3 flex-1 min-w-0 ${!isBlocked ? 'cursor-pointer hover:opacity-80' : ''} transition-opacity`}
                onClick={() => !isBlocked && navigate(`/profile/${userId}`)}
                data-testid="chat-user-header"
              >
                {/* Profile photo - blurred with dark overlay and gradient initial */}
                <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-800 shrink-0 ring-2 ring-white/10 relative">
                  {otherUser.photos && otherUser.photos[0] ? (
                    <>
                      {/* Base photo with blur */}
                      <img
                        src={otherUser.photos[0]}
                        alt=""
                        className="w-full h-full object-cover"
                        style={{ filter: 'blur(5px)', transform: 'scale(1.1)' }}
                      />
                      {/* Dark overlay */}
                      <div 
                        className="absolute inset-0"
                        style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
                      />
                      {/* Gradient initial */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span 
                          className="text-xl font-bold"
                          style={{
                            background: 'linear-gradient(90deg, #FF4F9A 0%, #A259FF 100%)',
                            WebkitBackgroundClip: 'text',
                            backgroundClip: 'text',
                            color: 'transparent'
                          }}
                        >
                          {otherUser.display_name?.charAt(0)?.toUpperCase() || "?"}
                        </span>
                      </div>
                    </>
                  ) : (
                    <SilhouetteAvatar />
                  )}
                </div>
                
                {/* Name and status */}
                <div className="flex-1 min-w-0">
                  <h1 className="text-base font-semibold text-white truncate">
                    {otherUser.display_name}
                  </h1>
                  {isBlocked ? (
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      Not available
                    </span>
                  ) : isUnlocked ? (
                    <span className="text-xs text-emerald-400 flex items-center gap-1">
                      <Unlock className="w-3 h-3" />
                      Connected
                    </span>
                  ) : (
                    <span className="text-xs text-amber-400 flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      Chat locked
                    </span>
                  )}
                </div>
              </div>
            ) : (
              /* Loading placeholder with silhouette */
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 rounded-full overflow-hidden shrink-0">
                  <SilhouetteAvatar />
                </div>
                <div className="flex-1">
                  <div className="h-4 w-24 bg-slate-800 rounded animate-pulse mb-1" />
                  <div className="h-3 w-16 bg-slate-800 rounded animate-pulse" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chat Locked Banner */}
      {!isUnlocked && hasIncomingRequest && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-3">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-amber-400" />
              <div>
                <p className="text-white text-sm font-medium">{otherUser?.display_name} wants to chat</p>
                <p className="text-slate-400/70 text-xs">Accept to unlock full messages and profile</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                data-testid="decline-request-btn"
                variant="ghost"
                size="sm"
                onClick={handleDeclineRequest}
                className="text-slate-400 hover:text-red-400"
              >
                Decline
              </Button>
              <Button
                data-testid="accept-request-btn"
                size="sm"
                onClick={handleAcceptRequest}
                disabled={accepting}
                className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl"
              >
                {accepting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Accept"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Blocked User Banner - Inline, NOT full-screen */}
      {isBlocked && (
        <div className="bg-slate-800/50 border-b border-slate-700/50 px-4 py-2">
          <div className="max-w-2xl mx-auto flex items-center justify-center gap-2">
            <Shield className="w-4 h-4 text-slate-400" />
            <p className="text-slate-400 text-sm">This user is not available.</p>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-slate-400">No messages yet. Say hello!</p>
            </div>
          ) : (
            <>
              {messages.map((msg, index) => {
                const isMe = msg.from_user_id === user?.id;
                const showReadReceipt = isMe && msg.is_read && msg.id === lastReadMessage?.id && user?.is_premium;
                
                return (
                  <div
                    key={msg.id}
                    data-testid={`message-${index}`}
                    className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                        isMe
                          ? "bg-indigo-500 text-white"
                          : msg.is_masked 
                            ? "bg-amber-500/20 text-amber-200 border border-amber-500/30"
                            : "bg-white/10 text-white"
                      }`}
                    >
                      {msg.is_masked && (
                        <div className="flex items-center gap-1 text-amber-400 text-xs mb-1">
                          <Lock className="w-3 h-3" />
                          Preview only
                        </div>
                      )}
                      <p className="text-sm">{msg.content}</p>
                      <div className={`flex items-center gap-2 mt-1 ${isMe ? "justify-end" : "justify-start"}`}>
                        <span className="text-xs opacity-70">
                          {formatTime(msg.created_at)}
                        </span>
                        {isMe && (
                          <span className="text-xs">
                            {msg.is_read ? (
                              <CheckCheck className="w-4 h-4 text-blue-300" />
                            ) : (
                              <Check className="w-4 h-4 opacity-70" />
                            )}
                          </span>
                        )}
                      </div>
                      {showReadReceipt && msg.read_at && (
                        <p className="text-xs text-blue-200 mt-1">
                          Read {formatReadTime(msg.read_at)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="sticky bottom-0 glass border-t border-white/5 px-4 py-4">
        <form onSubmit={handleSend} className="max-w-2xl mx-auto flex gap-3">
          <Input
            ref={inputRef}
            data-testid="message-input"
            value={newMessage}
            onChange={(e) => !isBlocked && setNewMessage(e.target.value)}
            placeholder={
              isBlocked 
                ? "You can't message this user." 
                : isUnlocked 
                  ? "Type a message..." 
                  : "Send a message request..."
            }
            disabled={isBlocked}
            className={`flex-1 h-12 bg-white/5 border-transparent focus:border-indigo-500 rounded-xl text-white ${
              isBlocked ? "opacity-50 cursor-not-allowed" : ""
            }`}
          />
          <Button
            data-testid="send-btn"
            type="submit"
            disabled={sending || !newMessage.trim() || isBlocked}
            className={`h-12 px-6 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white ${
              isBlocked ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            {sending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </form>
        {!isUnlocked && !isBlocked && (
          <p className="text-center text-amber-400 text-xs mt-2 flex items-center justify-center gap-1">
            <Shield className="w-3 h-3" />
            Contact details are hidden until chat is unlocked
          </p>
        )}
      </div>
    </div>
  );
};

export default Chat;
