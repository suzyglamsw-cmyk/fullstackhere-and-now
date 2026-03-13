import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth, API } from "@/App";
import { toast } from "sonner";
import axios from "axios";
import { ArrowLeft, Send, Loader2, Check, CheckCheck } from "lucide-react";

const Chat = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [otherUser, setOtherUser] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    fetchMessages();
    connectWebSocket();
    const interval = setInterval(fetchMessages, 5000);
    return () => {
      clearInterval(interval);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [userId]);

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
      setMessages(response.data);
      if (response.data.length > 0) {
        const otherMsg = response.data.find((m) => m.from_user_id === userId);
        if (otherMsg) {
          setOtherUser({
            id: userId,
            display_name: otherMsg.from_user_name,
            avatar_url: otherMsg.from_user_avatar,
          });
        }
      }
      // Also fetch from connections if no messages
      if (!otherUser) {
        const connResponse = await axios.get(`${API}/connections`);
        const conn = connResponse.data.find((c) => c.user_id === userId);
        if (conn) {
          setOtherUser({
            id: conn.user_id,
            display_name: conn.display_name,
            avatar_url: conn.avatar_url,
          });
        }
      }
    } catch (error) {
      if (error.response?.status === 403) {
        toast.error("You're not connected with this person");
        navigate("/connections");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setSending(true);
    try {
      await axios.post(`${API}/messages`, {
        to_user_id: userId,
        content: newMessage.trim(),
      });
      setNewMessage("");
      fetchMessages();
      inputRef.current?.focus();
    } catch (error) {
      toast.error("Failed to send message");
    } finally {
      setSending(false);
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

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col" data-testid="chat-page">
      {/* Header */}
      <div className="sticky top-0 z-40 glass border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              data-testid="back-btn"
              variant="ghost"
              size="icon"
              onClick={() => navigate("/connections")}
              className="text-slate-400 hover:text-white hover:bg-white/10"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            {otherUser && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden">
                  <img
                    src={otherUser.avatar_url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200"}
                    alt={otherUser.display_name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <h1 className="text-lg font-semibold text-white">{otherUser.display_name}</h1>
              </div>
            )}
          </div>
        </div>
      </div>

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
            messages.map((message, index) => {
              const isOwn = message.from_user_id === user?.id;
              const isLastMessage = index === messages.length - 1;
              const showReadReceipt = isOwn && message.is_read && user?.is_premium;
              const isLastRead = lastReadMessage?.id === message.id;
              
              return (
                <div key={message.id}>
                  <div
                    data-testid={`message-${message.id}`}
                    className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                        isOwn
                          ? "message-sent text-white"
                          : "message-received text-white"
                      }`}
                    >
                      <p className="text-sm leading-relaxed">{message.content}</p>
                      <div className={`flex items-center gap-1 mt-1 ${isOwn ? "justify-end" : ""}`}>
                        <p
                          className={`text-xs ${
                            isOwn ? "text-white/60" : "text-slate-500"
                          }`}
                        >
                          {formatTime(message.created_at)}
                        </p>
                        {/* Read receipt indicators for own messages */}
                        {isOwn && (
                          <span className="text-white/60">
                            {message.is_read ? (
                              <CheckCheck className="w-3.5 h-3.5 text-indigo-400" data-testid={`read-receipt-${message.id}`} />
                            ) : (
                              <Check className="w-3.5 h-3.5" data-testid={`sent-receipt-${message.id}`} />
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Show "Read" text for the last read message (premium feature) */}
                  {showReadReceipt && isLastRead && (
                    <div className="flex justify-end mt-1 mr-2">
                      <span className="text-xs text-indigo-400" data-testid="read-timestamp">
                        Read {formatReadTime(message.read_at)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="sticky bottom-0 glass border-t border-white/5 px-4 py-4">
        <form onSubmit={handleSend} className="max-w-2xl mx-auto flex gap-3">
          <Input
            ref={inputRef}
            data-testid="message-input"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 h-12 bg-white/5 border-transparent focus:border-indigo-500 rounded-xl text-white placeholder:text-slate-500"
          />
          <Button
            data-testid="send-btn"
            type="submit"
            disabled={sending || !newMessage.trim()}
            className="h-12 w-12 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white"
          >
            {sending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Chat;
