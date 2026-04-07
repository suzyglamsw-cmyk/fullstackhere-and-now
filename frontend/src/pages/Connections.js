import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth, API } from "@/App";
import { toast } from "sonner";
import axios from "axios";
import Layout from "../components/Layout";
import { MessageCircle, MapPin, Loader2, Users, Sparkles, Eye, Heart, Snowflake, UserPlus, Check, X, Clock, UserCheck, ArrowUpRight, ArrowDownLeft, MessageSquare, Trash2, Ban, UserMinus, MoreVertical, Wine, Archive } from "lucide-react";
import { getErrorMessage } from "../utils/errorUtils";
import BlurredImage from "../components/BlurredImage";
import { ConfirmHint, useConfirmHintGlobal } from "../components/ConfirmHint";

const ICEBREAKER_MESSAGES = [
  "Hello",
  "You seem interesting",
  "Fancy a chat?",
  "Can I buy you a drink?"
];

const Connections = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [connections, setConnections] = useState([]);
  const [mutualGlances, setMutualGlances] = useState([]);
  const [messageThreads, setMessageThreads] = useState([]);
  const [friendRequests, setFriendRequests] = useState({ incoming: [], outgoing: [] });
  const [friends, setFriends] = useState([]);
  const [glances, setGlances] = useState({ incoming: [], outgoing: [] });
  const [icebreakers, setIcebreakers] = useState({ incoming: [], outgoing: [] });
  const [chatRequests, setChatRequests] = useState({ incoming: [], outgoing: [] });
  const [loading, setLoading] = useState(true);
  const [actionSheet, setActionSheet] = useState(null); // For icebreaker actions
  const [chatActionSheet, setChatActionSheet] = useState(null); // For chat request actions
  const [clearConfirmUser, setClearConfirmUser] = useState(null); // For clear from matches confirmation
  const [tab, setTab] = useState(searchParams.get("tab") || "messages"); // "messages" | "glances" | "icebreakers" | "chats" | "requests" | "friends" | "connections"
  
  // Global ref for confirmation hints (only one visible at a time)
  const confirmHintRef = useConfirmHintGlobal();

  useEffect(() => {
    fetchAllData();
  }, []);

  // Handle tab parameter from URL
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && ["messages", "glances", "icebreakers", "drinks", "chats", "requests", "friends", "connections"].includes(tabParam)) {
      // Map legacy "drinks" to "icebreakers"
      setTab(tabParam === "drinks" ? "icebreakers" : tabParam);
    }
  }, [searchParams]);

  const fetchAllData = async () => {
    try {
      const [connectionsRes, mutualRes, threadsRes, requestsRes, friendsRes, glancesRes, icebreakersRes, chatRequestsRes] = await Promise.all([
        axios.get(`${API}/connections`),
        axios.get(`${API}/connections/mutual-glances`),
        axios.get(`${API}/messages/threads`),
        axios.get(`${API}/friends/requests`),
        axios.get(`${API}/friends/list`),
        axios.get(`${API}/connections/glances`),
        axios.get(`${API}/connections/icebreakers`),
        axios.get(`${API}/connections/chat-requests`)
      ]);
      setConnections(connectionsRes.data);
      setMutualGlances(mutualRes.data);
      setMessageThreads(threadsRes.data);
      setFriendRequests(requestsRes.data);
      setFriends(friendsRes.data);
      setGlances(glancesRes.data);
      setIcebreakers(icebreakersRes.data);
      setChatRequests(chatRequestsRes.data);
    } catch (error) {
      console.error("Failed to load data:", error);
      toast.error("Failed to load connections");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  // Format viewed timestamp for premium users
  // Same-day: "h:mm a" (e.g., 9:42pm)
  // Yesterday: "Yesterday · h:mm a"
  // Older: "DD MMM · h:mm a"
  const formatViewedTime = (dateString) => {
    if (!dateString) return null;
    
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const viewedDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    // Format time as h:mm a (e.g., 9:42pm)
    const timeStr = date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    }).toLowerCase();
    
    if (viewedDay.getTime() === today.getTime()) {
      // Same day: just show time
      return timeStr;
    } else if (viewedDay.getTime() === yesterday.getTime()) {
      // Yesterday
      return `Yesterday · ${timeStr}`;
    } else {
      // Older: DD MMM · h:mm a
      const dateStr = date.toLocaleDateString('en-GB', { 
        day: 'numeric', 
        month: 'short' 
      });
      return `${dateStr} · ${timeStr}`;
    }
  };

  const totalUnread = messageThreads.reduce((sum, t) => sum + t.unread_count, 0);
  const totalRequests = (friendRequests.incoming?.length || 0) + (friendRequests.outgoing?.length || 0);
  const totalGlances = (glances.incoming?.length || 0) + (glances.outgoing?.length || 0);
  const totalIcebreakers = (icebreakers.incoming?.length || 0) + (icebreakers.outgoing?.length || 0);
  const pendingIcebreakers = icebreakers.incoming?.filter(d => d.status === "pending").length || 0;
  const totalChatRequests = (chatRequests.incoming?.length || 0) + (chatRequests.outgoing?.length || 0);
  const pendingChatRequests = chatRequests.incoming?.filter(c => c.status === "pending").length || 0;

  const handleAcceptRequest = async (requestId) => {
    try {
      await axios.post(`${API}/friends/respond/${requestId}?accept=true`);
      toast.success("Friend request accepted!");
      fetchAllData();
    } catch (error) {
      toast.error("Failed to accept request");
    }
  };

  const handleDeclineRequest = async (requestId) => {
    try {
      await axios.post(`${API}/friends/respond/${requestId}?accept=false`);
      toast.success("Friend request declined");
      fetchAllData();
    } catch (error) {
      toast.error("Failed to decline request");
    }
  };

  const handleCancelRequest = async (requestId) => {
    try {
      await axios.delete(`${API}/friends/request/${requestId}`);
      toast.success("Friend request cancelled");
      fetchAllData();
    } catch (error) {
      toast.error("Failed to cancel request");
    }
  };

  // Icebreaker handlers
  const handleIcebreakerAction = async (icebreakerId, action) => {
    try {
      await axios.post(`${API}/icebreaker/${icebreakerId}/respond`, { action });
      if (action === "accept") {
        toast.success("Icebreaker accepted! You can now chat.");
      } else if (action === "block_icebreakers") {
        toast.success("User blocked from sending icebreakers");
      } else if (action === "block_user") {
        toast.success("User blocked");
      } else if (action === "not_right_now") {
        toast.success("Response sent");
      } else if (action === "decline") {
        toast.success("Icebreaker declined");
      } else {
        toast.success("Response recorded");
      }
      setActionSheet(null);
      fetchAllData();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to respond"));
    }
  };

  const handleDeleteIcebreaker = async (icebreakerId) => {
    try {
      await axios.delete(`${API}/icebreaker/${icebreakerId}`);
      toast.success("Icebreaker removed");
      fetchAllData();
    } catch (error) {
      toast.error("Failed to remove icebreaker");
    }
  };

  // Mark icebreaker as viewed when recipient opens the action sheet
  const openIcebreakerActionSheet = async (icebreaker) => {
    // Mark as viewed (only the first view is recorded by backend)
    try {
      await axios.post(`${API}/icebreaker/${icebreaker.id}/view`);
    } catch (error) {
      // Silently fail - viewing is not critical
      console.log("Failed to mark as viewed:", error);
    }
    setActionSheet(icebreaker);
  };

  const handleAcceptChatRequest = async (requestId) => {
    try {
      await axios.post(`${API}/chat-request/${requestId}/respond`, { accept: true });
      toast.success("Chat request accepted! 💬");
      setChatActionSheet(null);
      fetchAllData();
    } catch (error) {
      toast.error("Failed to accept chat request");
    }
  };

  const handleChatRequestAction = async (requestId, action, declineReason = null) => {
    try {
      if (action === "accept") {
        await axios.post(`${API}/chat-request/${requestId}/respond`, { accept: true });
        toast.success("Chat request accepted! 💬");
      } else if (action === "decline") {
        if (declineReason) {
          await axios.post(`${API}/chat-request/${requestId}/polite-decline?decline_reason=${declineReason}`);
          toast.success("Chat request politely declined");
        } else {
          await axios.post(`${API}/chat-request/${requestId}/respond`, { accept: false });
          toast.success("Chat request declined");
        }
      }
      setChatActionSheet(null);
      fetchAllData();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to respond"));
    }
  };

  const handleDeleteChatRequest = async (requestId) => {
    try {
      await axios.delete(`${API}/chat-request/${requestId}`);
      toast.success("Chat request removed");
      fetchAllData();
    } catch (error) {
      toast.error("Failed to remove chat request");
    }
  };

  const handleDeleteFriendRequest = async (requestId) => {
    try {
      await axios.delete(`${API}/friends/request/${requestId}`);
      toast.success("Friend request removed");
      fetchAllData();
    } catch (error) {
      toast.error("Failed to remove friend request");
    }
  };

  const handleRemoveFriend = async (friendId) => {
    try {
      await axios.delete(`${API}/friends/${friendId}`);
      toast.success("Friend removed");
      fetchAllData();
    } catch (error) {
      toast.error("Failed to remove friend");
    }
  };

  const handleDeleteConversation = async (otherUserId) => {
    try {
      await axios.delete(`${API}/messages/conversation/${otherUserId}`);
      toast.success("Conversation deleted");
      fetchAllData();
    } catch (error) {
      toast.error("Failed to delete conversation");
    }
  };

  const handleDeleteGlance = async (glanceId) => {
    try {
      await axios.delete(`${API}/glances/${glanceId}`);
      toast.success("Glance removed");
      fetchAllData();
    } catch (error) {
      toast.error("Failed to remove glance");
    }
  };

  // Clear a user from mutual matches without breaking chat
  const handleClearFromMatches = async (userId, displayName) => {
    try {
      await axios.delete(`${API}/connections/${userId}/clear`);
      toast.success(`${displayName} cleared from mutual matches`);
      setClearConfirmUser(null);
      fetchAllData();
    } catch (error) {
      toast.error("Failed to clear from matches");
    }
  };

  // Sort helper - most recent first
  const sortByDate = (items, dateField = "created_at") => {
    return [...items].sort((a, b) => {
      const dateA = new Date(a[dateField] || a.last_message_at || a.created_at || 0);
      const dateB = new Date(b[dateField] || b.last_message_at || b.created_at || 0);
      return dateB - dateA;
    });
  };

  // Polite decline options for chat requests
  const chatDeclineOptions = [
    { key: "not_looking", label: "Not looking to chat right now", icon: "🙏" },
    { key: "just_arrived", label: "Just got here, settling in", icon: "🏠" },
    { key: "with_friends", label: "Here with friends tonight", icon: "👥" },
    { key: "not_feeling_it", label: "Going to pass, thanks", icon: "✌️" }
  ];

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-6 pb-32" data-testid="connections-page">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Match List</h1>
          <p className="text-slate-400">People you've connected with</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <Button
            data-testid="messages-tab"
            variant={tab === "messages" ? "default" : "ghost"}
            onClick={() => setTab("messages")}
            className={`rounded-xl flex-shrink-0 ${tab === "messages" ? "bg-white/10" : "text-slate-400"}`}
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            Messages
            {totalUnread > 0 && (
              <span className="ml-2 text-xs bg-pink-500 px-2 py-0.5 rounded-full">
                {totalUnread}
              </span>
            )}
          </Button>
          <Button
            data-testid="glances-tab"
            variant={tab === "glances" ? "default" : "ghost"}
            onClick={() => setTab("glances")}
            className={`rounded-xl flex-shrink-0 ${tab === "glances" ? "bg-white/10" : "text-slate-400"}`}
          >
            <Eye className="w-4 h-4 mr-2" />
            Glances
            {totalGlances > 0 && (
              <span className="ml-2 text-xs bg-indigo-500 px-2 py-0.5 rounded-full">
                {totalGlances}
              </span>
            )}
          </Button>
          <Button
            data-testid="icebreakers-tab"
            variant={tab === "icebreakers" ? "default" : "ghost"}
            onClick={() => setTab("icebreakers")}
            className={`rounded-xl flex-shrink-0 ${tab === "icebreakers" ? "bg-white/10" : "text-slate-400"}`}
          >
            <Snowflake className="w-4 h-4 mr-2" />
            Icebreakers
            {pendingIcebreakers > 0 && (
              <span className="ml-2 text-xs bg-cyan-500 px-2 py-0.5 rounded-full">
                {pendingIcebreakers}
              </span>
            )}
          </Button>
          <Button
            data-testid="chats-tab"
            variant={tab === "chats" ? "default" : "ghost"}
            onClick={() => setTab("chats")}
            className={`rounded-xl flex-shrink-0 ${tab === "chats" ? "bg-white/10" : "text-slate-400"}`}
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Chat Requests
            {pendingChatRequests > 0 && (
              <span className="ml-2 text-xs bg-pink-500 px-2 py-0.5 rounded-full">
                {pendingChatRequests}
              </span>
            )}
          </Button>
          <Button
            data-testid="requests-tab"
            variant={tab === "requests" ? "default" : "ghost"}
            onClick={() => setTab("requests")}
            className={`rounded-xl flex-shrink-0 ${tab === "requests" ? "bg-white/10" : "text-slate-400"}`}
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Requests
            {totalRequests > 0 && (
              <span className="ml-2 text-xs bg-amber-500 px-2 py-0.5 rounded-full">
                {totalRequests}
              </span>
            )}
          </Button>
          <Button
            data-testid="friends-tab"
            variant={tab === "friends" ? "default" : "ghost"}
            onClick={() => setTab("friends")}
            className={`rounded-xl flex-shrink-0 ${tab === "friends" ? "bg-white/10" : "text-slate-400"}`}
          >
            <UserCheck className="w-4 h-4 mr-2" />
            Friends
            {friends.length > 0 && (
              <span className="ml-2 text-xs bg-emerald-500 px-2 py-0.5 rounded-full">
                {friends.length}
              </span>
            )}
          </Button>
          <Button
            data-testid="connections-tab"
            variant={tab === "connections" ? "default" : "ghost"}
            onClick={() => setTab("connections")}
            className={`rounded-xl flex-shrink-0 ${tab === "connections" ? "bg-white/10" : "text-slate-400"}`}
          >
            <Users className="w-4 h-4 mr-2" />
            Mutual Matches
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        ) : tab === "messages" ? (
          /* Messages Tab */
          messageThreads.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-10 h-10 text-slate-600" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">No messages yet</h2>
              <p className="text-slate-400 mb-6">
                Start a conversation after a mutual glance or icebreaker
              </p>
            </div>
          ) : (
            <div className="space-y-3" data-testid="messages-list">
              {sortByDate(messageThreads, "last_message_at").map((thread) => (
                <div
                  key={thread.user_id}
                  data-testid={`thread-${thread.user_id}`}
                  className="glass rounded-2xl p-4 flex items-center gap-4"
                >
                  {/* Avatar - tappable to profile */}
                  <div 
                    className="relative cursor-pointer"
                    onClick={() => navigate(`/profile/${thread.user_id}`)}
                  >
                    <div className="w-14 h-14 rounded-2xl overflow-hidden hover:ring-2 hover:ring-indigo-500 transition-all">
                      <img
                        src={thread.avatar_url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200"}
                        alt={thread.display_name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {thread.unread_count > 0 && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-pink-500 flex items-center justify-center text-white text-xs font-bold">
                        {thread.unread_count}
                      </div>
                    )}
                  </div>

                  {/* Info - tappable to chat */}
                  <div 
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => navigate(`/chat/${thread.user_id}`)}
                  >
                    <h3 className="font-semibold text-white truncate">{thread.display_name}</h3>
                    <p className={`text-sm truncate ${thread.unread_count > 0 ? "text-white font-medium" : "text-slate-400"}`}>
                      {thread.is_from_me && <span className="text-slate-500">You: </span>}
                      {thread.last_message}
                    </p>
                  </div>

                  {/* Time */}
                  <div className="text-slate-500 text-xs mr-2">
                    {formatDate(thread.last_message_at)}
                  </div>

                  {/* Delete button */}
                  <Button
                    data-testid={`delete-thread-${thread.user_id}`}
                    onClick={(e) => { e.stopPropagation(); handleDeleteConversation(thread.user_id); }}
                    size="sm"
                    variant="ghost"
                    className="rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )
        ) : tab === "glances" ? (
          /* Glances Tab */
          totalGlances === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <Eye className="w-10 h-10 text-slate-600" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">No glances yet</h2>
              <p className="text-slate-400 mb-6">
                Glance at someone in a venue or receive glances to see them here
              </p>
              <Button
                data-testid="find-venues-btn"
                onClick={() => navigate("/venues")}
                className="rounded-full bg-gradient-to-r from-indigo-500 to-pink-500 text-white font-semibold hover:opacity-90"
              >
                Find Venues
              </Button>
            </div>
          ) : (
            <div className="space-y-6" data-testid="glances-list">
              {/* Received Glances */}
              {glances.incoming?.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                    <ArrowDownLeft className="w-4 h-4" />
                    Received ({glances.incoming.length})
                  </h3>
                  <div className="space-y-3">
                    {sortByDate(glances.incoming).map((glance) => (
                      <div
                        key={glance.id}
                        data-testid={`received-glance-${glance.id}`}
                        className="glass rounded-2xl p-4 flex items-center gap-4"
                      >
                        <div 
                          className="relative cursor-pointer"
                          onClick={() => navigate(`/profile/${glance.user_id}`)}
                        >
                          <div className="w-14 h-14 rounded-2xl overflow-hidden hover:ring-2 hover:ring-indigo-500 transition-all">
                            <BlurredImage
                              src={glance.avatar_url}
                              alt={glance.display_name}
                              isRevealed={glance.is_mutual}
                              isThumbnail={true}
                              fallbackInitial={glance.display_name?.charAt(0) || "?"}
                            />
                          </div>
                          {glance.is_mutual && (
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-pink-500 flex items-center justify-center">
                              <Heart className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-white truncate">{glance.display_name}</h4>
                          <p className="text-slate-500 text-xs">
                            {glance.is_mutual ? "Mutual glance" : "Glanced at you"} • {formatDate(glance.created_at)}
                          </p>
                        </div>
                        {!glance.is_mutual && (
                          <Button
                            data-testid={`glance-back-${glance.id}`}
                            onClick={(e) => { e.stopPropagation(); navigate(`/profile/${glance.user_id}`); }}
                            size="sm"
                            className="rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Glance Back
                          </Button>
                        )}
                        <Button
                          data-testid={`delete-glance-${glance.id}`}
                          onClick={(e) => { e.stopPropagation(); handleDeleteGlance(glance.id); }}
                          size="sm"
                          variant="ghost"
                          className="rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Sent Glances */}
              {glances.outgoing?.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                    <ArrowUpRight className="w-4 h-4" />
                    Sent ({glances.outgoing.length})
                  </h3>
                  <div className="space-y-3">
                    {sortByDate(glances.outgoing).map((glance) => (
                      <div
                        key={glance.id}
                        data-testid={`sent-glance-${glance.id}`}
                        className="glass rounded-2xl p-4 flex items-center gap-4"
                      >
                        <div 
                          className="relative cursor-pointer"
                          onClick={() => navigate(`/profile/${glance.user_id}`)}
                        >
                          <div className="w-14 h-14 rounded-2xl overflow-hidden hover:ring-2 hover:ring-indigo-500 transition-all">
                            <BlurredImage
                              src={glance.avatar_url}
                              alt={glance.display_name}
                              isRevealed={glance.is_mutual}
                              isThumbnail={true}
                              fallbackInitial={glance.display_name?.charAt(0) || "?"}
                            />
                          </div>
                          {glance.is_mutual && (
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-pink-500 flex items-center justify-center">
                              <Heart className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-white truncate">{glance.display_name}</h4>
                          <p className="text-slate-500 text-xs">
                            {glance.is_mutual ? "Mutual glance" : "Waiting for them to glance back"} • {formatDate(glance.created_at)}
                          </p>
                        </div>
                        <Button
                          data-testid={`delete-sent-glance-${glance.id}`}
                          onClick={(e) => { e.stopPropagation(); handleDeleteGlance(glance.id); }}
                          size="sm"
                          variant="ghost"
                          className="rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        ) : tab === "icebreakers" ? (
          /* Icebreakers Tab */
          totalIcebreakers === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <Snowflake className="w-10 h-10 text-slate-600" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">No icebreakers yet</h2>
              <p className="text-slate-400 mb-6">
                Send an icebreaker to someone or receive one to see them here
              </p>
            </div>
          ) : (
            <div className="space-y-6" data-testid="icebreakers-list">
              {/* Received Icebreakers */}
              {icebreakers.incoming?.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                    <ArrowDownLeft className="w-4 h-4" />
                    Received ({icebreakers.incoming.length})
                  </h3>
                  <div className="space-y-3">
                    {sortByDate(icebreakers.incoming).map((ib) => (
                      <div
                        key={ib.id}
                        data-testid={`received-icebreaker-${ib.id}`}
                        className="glass rounded-2xl p-4 flex items-center gap-4"
                      >
                        <div 
                          className="cursor-pointer"
                          onClick={() => navigate(`/profile/${ib.user_id}`)}
                        >
                          <div className="w-14 h-14 rounded-2xl overflow-hidden hover:ring-2 hover:ring-cyan-500 transition-all">
                            <BlurredImage
                              src={ib.avatar_url}
                              alt={ib.display_name}
                              isRevealed={ib.status === "accepted"}
                              isThumbnail={true}
                              fallbackInitial={ib.display_name?.charAt(0) || "?"}
                            />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-white truncate">{ib.display_name}</h4>
                          <p className="text-slate-400 text-sm truncate">"{ib.message || ICEBREAKER_MESSAGES[ib.message_type || 0]}"</p>
                          <p className="text-slate-500 text-xs mt-1">
                            {ib.status === "pending" ? "❄️ Sent you an icebreaker" : ib.status === "accepted" ? "✅ Accepted" : "Response recorded"} • {formatDate(ib.created_at)}
                          </p>
                        </div>
                        {ib.status === "pending" ? (
                          <Button
                            data-testid={`respond-icebreaker-${ib.id}`}
                            onClick={() => openIcebreakerActionSheet(ib)}
                            size="sm"
                            className="rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white"
                          >
                            Respond
                          </Button>
                        ) : (
                          <Button
                            data-testid={`delete-icebreaker-${ib.id}`}
                            onClick={() => handleDeleteIcebreaker(ib.id)}
                            size="sm"
                            variant="ghost"
                            className="rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Sent Icebreakers */}
              {icebreakers.outgoing?.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                    <ArrowUpRight className="w-4 h-4" />
                    Sent ({icebreakers.outgoing.length})
                  </h3>
                  <div className="space-y-3">
                    {sortByDate(icebreakers.outgoing).map((ib) => (
                      <div
                        key={ib.id}
                        data-testid={`sent-icebreaker-${ib.id}`}
                        className="glass rounded-2xl p-4 flex items-center gap-4"
                      >
                        <div 
                          className="cursor-pointer"
                          onClick={() => navigate(`/profile/${ib.user_id}`)}
                        >
                          <div className="w-14 h-14 rounded-2xl overflow-hidden hover:ring-2 hover:ring-cyan-500 transition-all">
                            <BlurredImage
                              src={ib.avatar_url}
                              alt={ib.display_name}
                              isRevealed={ib.status === "accepted"}
                              isThumbnail={true}
                              fallbackInitial={ib.display_name?.charAt(0) || "?"}
                            />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-white truncate">{ib.display_name}</h4>
                          <p className="text-slate-400 text-sm truncate">"{ib.message || ICEBREAKER_MESSAGES[ib.message_type || 0]}"</p>
                          <p className="text-slate-500 text-xs mt-1">
                            {/* Premium users see "Viewed · timestamp" if viewed */}
                            {user?.is_premium && ib.viewed_at ? (
                              <span className="text-emerald-400">Viewed · {formatViewedTime(ib.viewed_at)}</span>
                            ) : user?.is_premium && ib.status === "pending" ? (
                              <span>Sent</span>
                            ) : ib.status === "accepted" ? (
                              <span className="text-emerald-400">✅ Accepted</span>
                            ) : ib.status === "declined" || ib.status === "not_right_now" ? (
                              <span className="text-slate-400">Response received</span>
                            ) : null}
                            {/* Show sent time for non-premium or add separator */}
                            {(user?.is_premium || ib.status !== "pending") && " · "}
                            {formatDate(ib.created_at)}
                          </p>
                        </div>
                        <Button
                          data-testid={`delete-sent-icebreaker-${ib.id}`}
                          onClick={(e) => { e.stopPropagation(); handleDeleteIcebreaker(ib.id); }}
                          size="sm"
                          variant="ghost"
                          className="rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        ) : tab === "chats" ? (
          /* Chat Requests Tab */
          totalChatRequests === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-10 h-10 text-slate-600" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">No chat requests yet</h2>
              <p className="text-slate-400 mb-6">
                Use a token to ask someone if they'd like to chat
              </p>
            </div>
          ) : (
            <div className="space-y-6" data-testid="chat-requests-list">
              {/* Received Chat Requests */}
              {chatRequests.incoming?.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                    <ArrowDownLeft className="w-4 h-4" />
                    Received ({chatRequests.incoming.length})
                  </h3>
                  <div className="space-y-3">
                    {sortByDate(chatRequests.incoming).map((request) => (
                      <div
                        key={request.id}
                        data-testid={`received-chat-${request.id}`}
                        className="glass rounded-2xl p-4 flex items-center gap-4"
                      >
                        <div 
                          className="cursor-pointer"
                          onClick={() => navigate(`/profile/${request.user_id}`)}
                        >
                          <div className="w-14 h-14 rounded-2xl overflow-hidden hover:ring-2 hover:ring-pink-500 transition-all">
                            <BlurredImage
                              src={request.avatar_url}
                              alt={request.display_name}
                              isRevealed={request.status === "accepted"}
                              isThumbnail={true}
                              fallbackInitial={request.display_name?.charAt(0) || "?"}
                            />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-white truncate">{request.display_name}</h4>
                          {request.bio && (
                            <p className="text-slate-400 text-sm truncate">{request.bio}</p>
                          )}
                          <p className="text-slate-500 text-xs mt-1">
                            {request.status === "pending" ? "💬 Wants to chat" : request.status === "accepted" ? "✅ Accepted" : "❌ Declined"} • {formatDate(request.created_at)}
                          </p>
                          {request.decline_message && (
                            <p className="text-slate-500 text-xs italic mt-1">"{request.decline_message}"</p>
                          )}
                        </div>
                        {request.status === "pending" ? (
                          <Button
                            data-testid={`respond-chat-${request.id}`}
                            onClick={() => setChatActionSheet(request)}
                            size="sm"
                            className="rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white"
                          >
                            Respond
                          </Button>
                        ) : request.status === "accepted" ? (
                          <div className="flex gap-2">
                            <Button
                              data-testid={`message-${request.id}`}
                              onClick={() => navigate(`/chat/${request.user_id}`)}
                              size="sm"
                              className="rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white"
                            >
                              <MessageCircle className="w-4 h-4 mr-1" />
                              Chat
                            </Button>
                            <Button
                              data-testid={`delete-chat-${request.id}`}
                              onClick={() => handleDeleteChatRequest(request.id)}
                              size="sm"
                              variant="ghost"
                              className="rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            data-testid={`delete-chat-${request.id}`}
                            onClick={() => handleDeleteChatRequest(request.id)}
                            size="sm"
                            variant="ghost"
                            className="rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Sent Chat Requests */}
              {chatRequests.outgoing?.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                    <ArrowUpRight className="w-4 h-4" />
                    Sent ({chatRequests.outgoing.length})
                  </h3>
                  <div className="space-y-3">
                    {sortByDate(chatRequests.outgoing).map((request) => (
                      <div
                        key={request.id}
                        data-testid={`sent-chat-${request.id}`}
                        className="glass rounded-2xl p-4 flex items-center gap-4"
                      >
                        <div 
                          className="cursor-pointer"
                          onClick={() => navigate(`/profile/${request.user_id}`)}
                        >
                          <div className="w-14 h-14 rounded-2xl overflow-hidden hover:ring-2 hover:ring-pink-500 transition-all">
                            <BlurredImage
                              src={request.avatar_url}
                              alt={request.display_name}
                              isRevealed={request.status === "accepted"}
                              isThumbnail={true}
                              fallbackInitial={request.display_name?.charAt(0) || "?"}
                            />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-white truncate">{request.display_name}</h4>
                          {request.bio && (
                            <p className="text-slate-400 text-sm truncate">{request.bio}</p>
                          )}
                          <p className="text-slate-500 text-xs mt-1">
                            {request.status === "pending" ? "⏳ Waiting for response" : request.status === "accepted" ? "✅ Accepted" : "❌ Declined"} • {formatDate(request.created_at)}
                          </p>
                          {request.decline_message && (
                            <p className="text-slate-500 text-xs italic mt-1">"{request.decline_message}"</p>
                          )}
                        </div>
                        {request.status === "accepted" ? (
                          <div className="flex gap-2">
                            <Button
                              data-testid={`message-out-${request.id}`}
                              onClick={(e) => { e.stopPropagation(); navigate(`/chat/${request.user_id}`); }}
                              size="sm"
                              className="rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white"
                            >
                              <MessageCircle className="w-4 h-4 mr-1" />
                              Chat
                            </Button>
                            <Button
                              data-testid={`delete-sent-chat-${request.id}`}
                              onClick={(e) => { e.stopPropagation(); handleDeleteChatRequest(request.id); }}
                              size="sm"
                              variant="ghost"
                              className="rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            data-testid={`delete-sent-chat-${request.id}`}
                            onClick={(e) => { e.stopPropagation(); handleDeleteChatRequest(request.id); }}
                            size="sm"
                            variant="ghost"
                            className="rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        ) : tab === "requests" ? (
          /* Friend Requests Tab */
          totalRequests === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <UserPlus className="w-10 h-10 text-slate-600" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">No friend requests</h2>
              <p className="text-slate-400 mb-6">
                Send or receive friend requests after accepting an icebreaker or chat
              </p>
            </div>
          ) : (
            <div className="space-y-6" data-testid="requests-list">
              {/* Incoming Requests */}
              {friendRequests.incoming?.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-slate-400 mb-3">Incoming Requests</h3>
                  <div className="space-y-3">
                    {sortByDate(friendRequests.incoming).map((request) => (
                      <div
                        key={request.id}
                        data-testid={`incoming-request-${request.id}`}
                        className="glass rounded-2xl p-4 flex items-center gap-4"
                      >
                        <div 
                          className="cursor-pointer"
                          onClick={() => navigate(`/profile/${request.from_user_id}`)}
                        >
                          <div className="w-14 h-14 rounded-2xl overflow-hidden hover:ring-2 hover:ring-amber-500 transition-all">
                            {request.avatar_url ? (
                              <img
                                src={request.avatar_url}
                                alt={request.display_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center">
                                <span className="text-xl text-slate-400">
                                  {request.display_name?.charAt(0) || "?"}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-white truncate">{request.display_name}</h4>
                          <p className="text-slate-500 text-xs">
                            Wants to be friends • {formatDate(request.created_at)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <ConfirmHint
                            hint="Add as a friend?"
                            onConfirm={() => handleAcceptRequest(request.id)}
                            globalPendingRef={confirmHintRef}
                          >
                            <Button
                              data-testid={`accept-${request.id}`}
                              size="sm"
                              className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white"
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                          </ConfirmHint>
                          <Button
                            data-testid={`delete-incoming-request-${request.id}`}
                            onClick={() => handleDeleteFriendRequest(request.id)}
                            size="sm"
                            variant="ghost"
                            className="rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Outgoing Requests */}
              {friendRequests.outgoing?.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-slate-400 mb-3">Sent Requests</h3>
                  <div className="space-y-3">
                    {sortByDate(friendRequests.outgoing).map((request) => (
                      <div
                        key={request.id}
                        data-testid={`outgoing-request-${request.id}`}
                        className="glass rounded-2xl p-4 flex items-center gap-4"
                      >
                        <div 
                          className="cursor-pointer"
                          onClick={() => navigate(`/profile/${request.to_user_id}`)}
                        >
                          <div className="w-14 h-14 rounded-2xl overflow-hidden hover:ring-2 hover:ring-amber-500 transition-all">
                            {request.avatar_url ? (
                              <img
                                src={request.avatar_url}
                                alt={request.display_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center">
                                <span className="text-xl text-slate-400">
                                  {request.display_name?.charAt(0) || "?"}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-white truncate">{request.display_name}</h4>
                          <p className="text-slate-500 text-xs flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Pending • {formatDate(request.created_at)}
                          </p>
                        </div>
                        <Button
                          data-testid={`delete-outgoing-request-${request.id}`}
                          onClick={() => handleDeleteFriendRequest(request.id)}
                          size="sm"
                          variant="ghost"
                          className="rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        ) : tab === "friends" ? (
          /* Friends Tab */
          friends.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <UserCheck className="w-10 h-10 text-slate-600" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">No friends yet</h2>
              <p className="text-slate-400 mb-6">
                Accept or send friend requests to add people here
              </p>
            </div>
          ) : (
            <div className="space-y-3" data-testid="friends-list">
              {friends.map((friend) => (
                <div
                  key={friend.id}
                  data-testid={`friend-${friend.id}`}
                  className="glass rounded-2xl p-4 flex items-center gap-4"
                >
                  <div 
                    className="cursor-pointer"
                    onClick={() => navigate(`/profile/${friend.id}`)}
                  >
                    <div className="w-14 h-14 rounded-2xl overflow-hidden hover:ring-2 hover:ring-emerald-500 transition-all">
                      {friend.avatar_url ? (
                        <img
                          src={friend.avatar_url}
                          alt={friend.display_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center">
                          <span className="text-xl text-slate-400">
                            {friend.display_name?.charAt(0) || "?"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div 
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => navigate(`/chat/${friend.id}`)}
                  >
                    <h4 className="font-semibold text-white truncate">{friend.display_name}</h4>
                    {friend.bio && (
                      <p className="text-slate-400 text-sm truncate">{friend.bio}</p>
                    )}
                    <p className="text-slate-500 text-xs mt-1">
                      Friends since {formatDate(friend.friends_since)}
                    </p>
                  </div>
                  <Button
                    data-testid={`message-friend-${friend.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/chat/${friend.id}`);
                    }}
                    className="rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white"
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Chat
                  </Button>
                  <Button
                    data-testid={`remove-friend-${friend.id}`}
                    onClick={(e) => { e.stopPropagation(); handleRemoveFriend(friend.id); }}
                    size="sm"
                    variant="ghost"
                    className="rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )
        ) : (
          /* All Connections Tab */
          connections.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <Users className="w-10 h-10 text-slate-600" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">No mutual matches yet</h2>
              <p className="text-slate-400 mb-6">
                Mutual matches appear when you have a mutual glance, accepted icebreaker, or accepted chat request.
              </p>
              <Button
                data-testid="find-venues-btn"
                onClick={() => navigate("/venues")}
                className="rounded-full bg-gradient-to-r from-indigo-500 to-pink-500 text-white font-semibold hover:opacity-90"
              >
                Find Venues
              </Button>
            </div>
          ) : (
            <div className="space-y-4" data-testid="connections-list">
              {connections.map((connection) => (
                <div
                  key={connection.id}
                  data-testid={`connection-card-${connection.id}`}
                  onClick={() => navigate(`/chat/${connection.user_id}`)}
                  className="glass rounded-2xl p-4 flex items-center gap-4 hover:bg-white/5 transition-colors cursor-pointer"
                >
                  {/* Avatar - tappable to profile */}
                  <div 
                    className="relative cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/profile/${connection.user_id}`);
                    }}
                  >
                    <div className="w-16 h-16 rounded-2xl overflow-hidden hover:ring-2 hover:ring-indigo-500 transition-all">
                      {connection.avatar_url ? (
                        <img
                          src={connection.avatar_url}
                          alt={connection.display_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center">
                          <span className="text-2xl text-slate-400">
                            {connection.display_name?.charAt(0) || "?"}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center ${
                      connection.connection_type === "mutual_glance" ? "bg-pink-500" :
                      connection.connection_type === "icebreaker_accepted" ? "bg-cyan-500" :
                      "bg-emerald-500"
                    }`}>
                      {connection.connection_type === "mutual_glance" ? (
                        <Heart className="w-3 h-3 text-white" />
                      ) : connection.connection_type === "icebreaker_accepted" ? (
                        <Wine className="w-3 h-3 text-white" />
                      ) : (
                        <Sparkles className="w-3 h-3 text-white" />
                      )}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white truncate">{connection.display_name}</h3>
                    {connection.bio && (
                      <p className="text-slate-400 text-sm truncate">{connection.bio}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1 text-slate-500 text-xs">
                      {connection.connection_type === "mutual_glance" ? (
                        <Heart className="w-3 h-3" />
                      ) : connection.connection_type === "icebreaker_accepted" ? (
                        <Wine className="w-3 h-3" />
                      ) : (
                        <MapPin className="w-3 h-3" />
                      )}
                      <span>{connection.venue_name}</span>
                      <span>•</span>
                      <span>{formatDate(connection.connected_at)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      data-testid={`chat-btn-${connection.user_id}`}
                      onClick={() => navigate(`/chat/${connection.user_id}`)}
                      className="rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white"
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Chat
                    </Button>
                    <Button
                      data-testid={`clear-match-btn-${connection.user_id}`}
                      onClick={() => setClearConfirmUser(connection)}
                      size="icon"
                      variant="ghost"
                      className="rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                    >
                      <UserMinus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Clear from Matches Confirmation Modal */}
      {clearConfirmUser && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200" 
          onClick={() => setClearConfirmUser(null)}
          data-testid="clear-confirm-modal"
        >
          <div 
            className="w-full max-w-sm bg-slate-900 rounded-2xl p-6 mx-4 border border-white/10 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center mx-auto mb-4">
                <UserMinus className="w-8 h-8 text-orange-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Manage Match</h3>
              <p className="text-slate-400 text-sm">
                What would you like to do with <span className="text-white font-medium">{clearConfirmUser.display_name}</span>?
              </p>
            </div>

            <div className="space-y-2">
              {/* Stay Matched & Clear (soft archive) */}
              <Button
                data-testid="stay-matched-clear-btn"
                onClick={() => handleClearFromMatches(clearConfirmUser.user_id, clearConfirmUser.display_name)}
                className="w-full h-12 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold"
              >
                <Archive className="w-4 h-4 mr-2" />
                Stay Matched & Clear
              </Button>
              <p className="text-slate-500 text-xs text-center px-2">
                Removes from list but preserves match. You can re-match easily.
              </p>
              
              {/* Unmatch & Clear (hard reset) */}
              <Button
                data-testid="unmatch-clear-btn"
                onClick={() => {
                  handleClearFromMatches(clearConfirmUser.user_id, clearConfirmUser.display_name);
                  // Also delete glances and connections
                  axios.post(`${API}/connections/unmatch`, { user_id: clearConfirmUser.user_id }).catch(() => {});
                }}
                variant="ghost"
                className="w-full h-12 rounded-xl text-red-400 hover:bg-red-500/10 font-semibold"
              >
                <UserMinus className="w-4 h-4 mr-2" />
                Unmatch & Clear
              </Button>
              <p className="text-slate-500 text-xs text-center px-2">
                Removes match completely. You'll need to re-glance to match again.
              </p>
              
              {/* Cancel */}
              <Button
                data-testid="cancel-clear-btn"
                onClick={() => setClearConfirmUser(null)}
                variant="ghost"
                className="w-full h-12 rounded-xl text-slate-300 hover:bg-white/5 mt-2"
              >
                Cancel
              </Button>
            </div>
            
            {/* Note about blocking */}
            <div className="mt-4 pt-4 border-t border-white/10">
              <p className="text-slate-600 text-xs text-center">
                Unmatching does not block. To block a user, visit their profile.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Icebreaker Action Sheet */}
      {actionSheet && (
        <div 
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200" 
          onClick={() => setActionSheet(null)}
          data-testid="icebreaker-action-sheet"
        >
          <div 
            className="w-full max-w-md bg-slate-900 rounded-t-3xl p-6 pb-10 border-t border-white/10 animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle bar */}
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-6" />
            
            {/* User info */}
            <div className="text-center mb-6">
              <div className="w-20 h-20 rounded-full overflow-hidden mx-auto mb-3 ring-2 ring-cyan-500/50">
                <BlurredImage
                  src={actionSheet.avatar_url}
                  alt={actionSheet.display_name}
                  isRevealed={false}
                  isThumbnail={true}
                  fallbackInitial={actionSheet.display_name?.charAt(0)}
                />
              </div>
              <h3 className="text-xl font-bold text-white">{actionSheet.display_name}</h3>
              <div className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20">
                <Snowflake className="w-4 h-4 text-cyan-400" />
                <p className="text-cyan-300 text-sm">"{actionSheet.message || ICEBREAKER_MESSAGES[actionSheet.message_type || 0]}"</p>
              </div>
            </div>

            {/* Primary Actions */}
            <div className="space-y-2">
              <Button
                data-testid="accept-icebreaker-btn"
                onClick={() => handleIcebreakerAction(actionSheet.id, "accept")}
                className="w-full h-14 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-base"
              >
                <Check className="w-5 h-5 mr-2" />
                Accept & Start Chat
              </Button>
              <Button
                data-testid="not-right-now-btn"
                onClick={() => handleIcebreakerAction(actionSheet.id, "not_right_now")}
                variant="ghost"
                className="w-full h-12 rounded-xl text-slate-300 hover:bg-white/5 font-medium"
              >
                <Clock className="w-5 h-5 mr-2" />
                Not right now
              </Button>
              <Button
                data-testid="decline-icebreaker-btn"
                onClick={() => handleIcebreakerAction(actionSheet.id, "decline")}
                variant="ghost"
                className="w-full h-12 rounded-xl text-slate-400 hover:bg-white/5"
              >
                <X className="w-5 h-5 mr-2" />
                Decline
              </Button>
            </div>

            {/* Block Options */}
            <div className="border-t border-white/10 pt-3 mt-3 space-y-2">
              <Button
                data-testid="block-icebreakers-btn"
                onClick={() => handleIcebreakerAction(actionSheet.id, "block_icebreakers")}
                variant="ghost"
                className="w-full h-12 rounded-xl text-orange-400 hover:bg-orange-500/10"
              >
                <Snowflake className="w-5 h-5 mr-2" />
                Block icebreakers from this user
              </Button>
              <Button
                data-testid="block-user-btn"
                onClick={() => handleIcebreakerAction(actionSheet.id, "block_user")}
                variant="ghost"
                className="w-full h-12 rounded-xl text-red-400 hover:bg-red-500/10"
              >
                <Ban className="w-5 h-5 mr-2" />
                Block user completely
              </Button>
            </div>

            <Button
              onClick={() => setActionSheet(null)}
              variant="ghost"
              className="w-full mt-4 h-12 rounded-xl text-slate-500 hover:bg-white/5"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Chat Request Action Sheet */}
      {chatActionSheet && (
        <div 
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200" 
          onClick={() => setChatActionSheet(null)}
          data-testid="chat-action-sheet"
        >
          <div 
            className="w-full max-w-md bg-slate-900 rounded-t-3xl p-6 pb-10 border-t border-white/10 animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle bar */}
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-6" />
            
            {/* User info */}
            <div className="text-center mb-6">
              <div className="w-20 h-20 rounded-full overflow-hidden mx-auto mb-3 ring-2 ring-indigo-500/50">
                <BlurredImage
                  src={chatActionSheet.avatar_url}
                  alt={chatActionSheet.display_name}
                  isRevealed={false}
                  isThumbnail={true}
                  fallbackInitial={chatActionSheet.display_name?.charAt(0)}
                />
              </div>
              <h3 className="text-xl font-bold text-white">{chatActionSheet.display_name}</h3>
              <div className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                <MessageSquare className="w-4 h-4 text-indigo-400" />
                <p className="text-indigo-300 text-sm">Wants to chat with you</p>
              </div>
            </div>

            {/* Primary Actions */}
            <div className="space-y-2">
              <Button
                data-testid="accept-chat-btn"
                onClick={() => handleChatRequestAction(chatActionSheet.id, "accept")}
                className="w-full h-14 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-base"
              >
                <Check className="w-5 h-5 mr-2" />
                Accept & Start Chat
              </Button>
            </div>

            {/* Polite Decline Options */}
            <div className="border-t border-white/10 pt-3 mt-3">
              <p className="text-slate-400 text-xs uppercase tracking-wider mb-3 text-center">Politely Decline</p>
              <div className="space-y-2">
                {chatDeclineOptions.map((option) => (
                  <Button
                    key={option.key}
                    data-testid={`decline-${option.key}`}
                    onClick={() => handleChatRequestAction(chatActionSheet.id, "decline", option.key)}
                    variant="ghost"
                    className="w-full h-12 rounded-xl text-slate-300 hover:bg-white/5 justify-start"
                  >
                    <span className="mr-3">{option.icon}</span>
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <Button
              onClick={() => setChatActionSheet(null)}
              variant="ghost"
              className="w-full mt-4 h-12 rounded-xl text-slate-500 hover:bg-white/5"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Connections;
