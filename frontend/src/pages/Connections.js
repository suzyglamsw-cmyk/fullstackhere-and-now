import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth, API } from "@/App";
import { toast } from "sonner";
import axios from "axios";
import Layout from "../components/Layout";
import { MessageCircle, MapPin, Loader2, Users, Sparkles, Eye, Heart, Wine, UserPlus, Check, X, Clock, UserCheck, ArrowUpRight, ArrowDownLeft, MessageSquare, Trash2 } from "lucide-react";

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
  const [drinks, setDrinks] = useState({ incoming: [], outgoing: [] });
  const [chatRequests, setChatRequests] = useState({ incoming: [], outgoing: [] });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(searchParams.get("tab") || "messages"); // "messages" | "glances" | "drinks" | "chats" | "requests" | "friends" | "connections"

  useEffect(() => {
    fetchAllData();
  }, []);

  // Handle tab parameter from URL
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && ["messages", "glances", "drinks", "chats", "requests", "friends", "connections"].includes(tabParam)) {
      setTab(tabParam);
    }
  }, [searchParams]);

  const fetchAllData = async () => {
    try {
      const [connectionsRes, mutualRes, threadsRes, requestsRes, friendsRes, glancesRes, drinksRes, chatRequestsRes] = await Promise.all([
        axios.get(`${API}/connections`),
        axios.get(`${API}/connections/mutual-glances`),
        axios.get(`${API}/messages/threads`),
        axios.get(`${API}/friends/requests`),
        axios.get(`${API}/friends/list`),
        axios.get(`${API}/connections/glances`),
        axios.get(`${API}/connections/drinks`),
        axios.get(`${API}/connections/chat-requests`)
      ]);
      setConnections(connectionsRes.data);
      setMutualGlances(mutualRes.data);
      setMessageThreads(threadsRes.data);
      setFriendRequests(requestsRes.data);
      setFriends(friendsRes.data);
      setGlances(glancesRes.data);
      setDrinks(drinksRes.data);
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

  const totalUnread = messageThreads.reduce((sum, t) => sum + t.unread_count, 0);
  const totalRequests = (friendRequests.incoming?.length || 0) + (friendRequests.outgoing?.length || 0);
  const totalGlances = (glances.incoming?.length || 0) + (glances.outgoing?.length || 0);
  const totalDrinks = (drinks.incoming?.length || 0) + (drinks.outgoing?.length || 0);
  const pendingDrinks = drinks.incoming?.filter(d => d.status === "pending").length || 0;
  const totalChatRequests = (chatRequests.incoming?.length || 0) + (chatRequests.outgoing?.length || 0);
  const pendingChatRequests = chatRequests.incoming?.filter(c => c.status === "pending").length || 0;
  const [declineModalOpen, setDeclineModalOpen] = useState(false);
  const [selectedDeclineItem, setSelectedDeclineItem] = useState(null);
  const [declineType, setDeclineType] = useState(null); // "drink" or "chat"

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

  const handleAcceptDrink = async (drinkId) => {
    try {
      await axios.post(`${API}/drink-token/${drinkId}/accept`);
      toast.success("Drink offer accepted! 🍸");
      fetchAllData();
    } catch (error) {
      toast.error("Failed to accept drink offer");
    }
  };

  const handleDeleteDrink = async (drinkId) => {
    try {
      await axios.delete(`${API}/drink-token/${drinkId}`);
      toast.success("Drink offer removed");
      fetchAllData();
    } catch (error) {
      toast.error("Failed to remove drink offer");
    }
  };

  const handleDeclineDrink = async (drinkId) => {
    setSelectedDeclineItem(drinkId);
    setDeclineType("drink");
    setDeclineModalOpen(true);
  };

  const handlePoliteDeclineDrink = async (reason) => {
    try {
      await axios.post(`${API}/drinks/decline/${selectedDeclineItem}`, { decline_reason: reason });
      toast.success("Drink offer politely declined");
      setDeclineModalOpen(false);
      setSelectedDeclineItem(null);
      fetchAllData();
    } catch (error) {
      toast.error("Failed to decline drink offer");
    }
  };

  const handleAcceptChatRequest = async (requestId) => {
    try {
      await axios.post(`${API}/chat-request/${requestId}/respond`, { accept: true });
      toast.success("Chat request accepted! 💬");
      fetchAllData();
    } catch (error) {
      toast.error("Failed to accept chat request");
    }
  };

  const handleDeclineChatRequest = async (requestId) => {
    setSelectedDeclineItem(requestId);
    setDeclineType("chat");
    setDeclineModalOpen(true);
  };

  const handlePoliteDeclineChatRequest = async (reason) => {
    try {
      await axios.post(`${API}/chat-request/${selectedDeclineItem}/polite-decline?decline_reason=${reason}`);
      toast.success("Chat request politely declined");
      setDeclineModalOpen(false);
      setSelectedDeclineItem(null);
      fetchAllData();
    } catch (error) {
      toast.error("Failed to decline chat request");
    }
  };

  const drinkDeclineOptions = [
    { key: "not_right_now", label: "Not right now, maybe later" },
    { key: "leaving_soon", label: "I'm about to head out" },
    { key: "already_have_one", label: "I already have a drink" },
    { key: "thanks_but_no", label: "Thanks, but no thanks" }
  ];

  const chatDeclineOptions = [
    { key: "not_looking", label: "Not looking to chat right now" },
    { key: "just_arrived", label: "Just got here, settling in" },
    { key: "with_friends", label: "Here with friends tonight" },
    { key: "not_feeling_it", label: "Going to pass, thanks" }
  ];

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-6 pb-32" data-testid="connections-page">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Connections</h1>
          <p className="text-slate-400">Your matches and conversations</p>
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
            data-testid="drinks-tab"
            variant={tab === "drinks" ? "default" : "ghost"}
            onClick={() => setTab("drinks")}
            className={`rounded-xl flex-shrink-0 ${tab === "drinks" ? "bg-white/10" : "text-slate-400"}`}
          >
            <Wine className="w-4 h-4 mr-2" />
            Drinks
            {pendingDrinks > 0 && (
              <span className="ml-2 text-xs bg-amber-500 px-2 py-0.5 rounded-full">
                {pendingDrinks}
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
            All
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
                Start a conversation after a mutual glance or drink offer
              </p>
            </div>
          ) : (
            <div className="space-y-3" data-testid="messages-list">
              {messageThreads.map((thread) => (
                <div
                  key={thread.user_id}
                  data-testid={`thread-${thread.user_id}`}
                  onClick={() => navigate(`/chat/${thread.user_id}`)}
                  className="glass rounded-2xl p-4 flex items-center gap-4 hover:bg-white/5 transition-colors cursor-pointer"
                >
                  {/* Avatar - tappable to profile */}
                  <div 
                    className="relative cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/profile/${thread.user_id}`);
                    }}
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

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white truncate">{thread.display_name}</h3>
                    <p className={`text-sm truncate ${thread.unread_count > 0 ? "text-white font-medium" : "text-slate-400"}`}>
                      {thread.is_from_me && <span className="text-slate-500">You: </span>}
                      {thread.last_message}
                    </p>
                  </div>

                  {/* Time */}
                  <div className="text-slate-500 text-xs">
                    {formatDate(thread.last_message_at)}
                  </div>
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
                    {glances.incoming.map((glance) => (
                      <div
                        key={glance.id}
                        data-testid={`received-glance-${glance.id}`}
                        onClick={() => navigate(`/profile/${glance.user_id}`)}
                        className="glass rounded-2xl p-4 flex items-center gap-4 hover:bg-white/5 transition-colors cursor-pointer"
                      >
                        <div className="relative">
                          <div className="w-14 h-14 rounded-2xl overflow-hidden">
                            {glance.avatar_url ? (
                              <img src={glance.avatar_url} alt={glance.display_name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center">
                                <span className="text-xl text-white">{glance.display_name?.charAt(0) || "?"}</span>
                              </div>
                            )}
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
                    {glances.outgoing.map((glance) => (
                      <div
                        key={glance.id}
                        data-testid={`sent-glance-${glance.id}`}
                        onClick={() => navigate(`/profile/${glance.user_id}`)}
                        className="glass rounded-2xl p-4 flex items-center gap-4 hover:bg-white/5 transition-colors cursor-pointer"
                      >
                        <div className="relative">
                          <div className="w-14 h-14 rounded-2xl overflow-hidden">
                            {glance.avatar_url ? (
                              <img src={glance.avatar_url} alt={glance.display_name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center">
                                <span className="text-xl text-slate-400">{glance.display_name?.charAt(0) || "?"}</span>
                              </div>
                            )}
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
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        ) : tab === "drinks" ? (
          /* Drinks Tab */
          totalDrinks === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <Wine className="w-10 h-10 text-slate-600" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">No drink offers yet</h2>
              <p className="text-slate-400 mb-6">
                Send a drink offer to someone or receive one to see them here
              </p>
            </div>
          ) : (
            <div className="space-y-6" data-testid="drinks-list">
              {/* Received Drinks */}
              {drinks.incoming?.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                    <ArrowDownLeft className="w-4 h-4" />
                    Received ({drinks.incoming.length})
                  </h3>
                  <div className="space-y-3">
                    {drinks.incoming.map((drink) => (
                      <div
                        key={drink.id}
                        data-testid={`received-drink-${drink.id}`}
                        className="glass rounded-2xl p-4 flex items-center gap-4"
                      >
                        <div 
                          className="cursor-pointer"
                          onClick={() => navigate(`/profile/${drink.user_id}`)}
                        >
                          <div className="w-14 h-14 rounded-2xl overflow-hidden hover:ring-2 hover:ring-amber-500 transition-all">
                            {drink.avatar_url ? (
                              <img src={drink.avatar_url} alt={drink.display_name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                                <span className="text-xl text-white">{drink.display_name?.charAt(0) || "?"}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-white truncate">{drink.display_name}</h4>
                          {drink.message && (
                            <p className="text-slate-400 text-sm truncate">"{drink.message}"</p>
                          )}
                          <p className="text-slate-500 text-xs mt-1">
                            {drink.status === "pending" ? "🍸 Offered you a drink" : drink.status === "accepted" ? "✅ Accepted" : "❌ Declined"} • {formatDate(drink.created_at)}
                          </p>
                          {drink.decline_message && (
                            <p className="text-slate-500 text-xs italic mt-1">"{drink.decline_message}"</p>
                          )}
                        </div>
                        {drink.status === "pending" ? (
                          <div className="flex gap-2">
                            <Button
                              data-testid={`accept-drink-${drink.id}`}
                              onClick={() => handleAcceptDrink(drink.id)}
                              size="sm"
                              className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white"
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button
                              data-testid={`decline-drink-${drink.id}`}
                              onClick={() => handleDeclineDrink(drink.id)}
                              size="sm"
                              variant="ghost"
                              className="rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            data-testid={`delete-drink-${drink.id}`}
                            onClick={() => handleDeleteDrink(drink.id)}
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
              
              {/* Sent Drinks */}
              {drinks.outgoing?.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                    <ArrowUpRight className="w-4 h-4" />
                    Sent ({drinks.outgoing.length})
                  </h3>
                  <div className="space-y-3">
                    {drinks.outgoing.map((drink) => (
                      <div
                        key={drink.id}
                        data-testid={`sent-drink-${drink.id}`}
                        className="glass rounded-2xl p-4 flex items-center gap-4"
                      >
                        <div 
                          className="cursor-pointer"
                          onClick={() => navigate(`/profile/${drink.user_id}`)}
                        >
                          <div className="w-14 h-14 rounded-2xl overflow-hidden hover:ring-2 hover:ring-amber-500 transition-all">
                            {drink.avatar_url ? (
                              <img src={drink.avatar_url} alt={drink.display_name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center">
                                <span className="text-xl text-slate-400">{drink.display_name?.charAt(0) || "?"}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-white truncate">{drink.display_name}</h4>
                          {drink.message && (
                            <p className="text-slate-400 text-sm truncate">"{drink.message}"</p>
                          )}
                          <p className="text-slate-500 text-xs mt-1">
                            {drink.status === "pending" ? "⏳ Pending" : drink.status === "accepted" ? "✅ Accepted" : "❌ Declined"} • {formatDate(drink.created_at)}
                          </p>
                          {drink.decline_message && (
                            <p className="text-slate-500 text-xs italic mt-1">"{drink.decline_message}"</p>
                          )}
                        </div>
                        <Button
                          data-testid={`delete-sent-drink-${drink.id}`}
                          onClick={(e) => { e.stopPropagation(); handleDeleteDrink(drink.id); }}
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
                    {chatRequests.incoming.map((request) => (
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
                            {request.avatar_url ? (
                              <img src={request.avatar_url} alt={request.display_name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-pink-500 to-indigo-500 flex items-center justify-center">
                                <span className="text-xl text-white">{request.display_name?.charAt(0) || "?"}</span>
                              </div>
                            )}
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
                        </div>
                        {request.status === "pending" && (
                          <div className="flex gap-2">
                            <Button
                              data-testid={`accept-chat-${request.id}`}
                              onClick={() => handleAcceptChatRequest(request.id)}
                              size="sm"
                              className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white"
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button
                              data-testid={`decline-chat-${request.id}`}
                              onClick={() => handleDeclineChatRequest(request.id)}
                              size="sm"
                              variant="ghost"
                              className="rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                        {request.status === "accepted" && (
                          <Button
                            data-testid={`message-${request.id}`}
                            onClick={() => navigate(`/chat/${request.user_id}`)}
                            size="sm"
                            className="rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white"
                          >
                            <MessageCircle className="w-4 h-4 mr-1" />
                            Chat
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
                    {chatRequests.outgoing.map((request) => (
                      <div
                        key={request.id}
                        data-testid={`sent-chat-${request.id}`}
                        onClick={() => navigate(`/profile/${request.user_id}`)}
                        className="glass rounded-2xl p-4 flex items-center gap-4 hover:bg-white/5 transition-colors cursor-pointer"
                      >
                        <div className="w-14 h-14 rounded-2xl overflow-hidden">
                          {request.avatar_url ? (
                            <img src={request.avatar_url} alt={request.display_name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center">
                              <span className="text-xl text-slate-400">{request.display_name?.charAt(0) || "?"}</span>
                            </div>
                          )}
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
                        {request.status === "accepted" && (
                          <Button
                            data-testid={`message-out-${request.id}`}
                            onClick={(e) => { e.stopPropagation(); navigate(`/chat/${request.user_id}`); }}
                            size="sm"
                            className="rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white"
                          >
                            <MessageCircle className="w-4 h-4 mr-1" />
                            Chat
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
                Send or receive friend requests after accepting a drink or chat
              </p>
            </div>
          ) : (
            <div className="space-y-6" data-testid="requests-list">
              {/* Incoming Requests */}
              {friendRequests.incoming?.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-slate-400 mb-3">Incoming Requests</h3>
                  <div className="space-y-3">
                    {friendRequests.incoming.map((request) => (
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
                          <Button
                            data-testid={`accept-${request.id}`}
                            onClick={() => handleAcceptRequest(request.id)}
                            size="sm"
                            className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white"
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            data-testid={`decline-${request.id}`}
                            onClick={() => handleDeclineRequest(request.id)}
                            size="sm"
                            variant="ghost"
                            className="rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                          >
                            <X className="w-4 h-4" />
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
                    {friendRequests.outgoing.map((request) => (
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
                          data-testid={`cancel-${request.id}`}
                          onClick={() => handleCancelRequest(request.id)}
                          size="sm"
                          variant="ghost"
                          className="rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                        >
                          Cancel
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
                  onClick={() => navigate(`/chat/${friend.id}`)}
                  className="glass rounded-2xl p-4 flex items-center gap-4 hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <div 
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/profile/${friend.id}`);
                    }}
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
                  <div className="flex-1 min-w-0">
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
              <h2 className="text-xl font-semibold text-white mb-2">No connections yet</h2>
              <p className="text-slate-400 mb-6">
                Check in to a venue and start glancing at people to make connections!
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
                      connection.connection_type === "drink_accepted" ? "bg-amber-500" :
                      "bg-emerald-500"
                    }`}>
                      {connection.connection_type === "mutual_glance" ? (
                        <Heart className="w-3 h-3 text-white" />
                      ) : connection.connection_type === "drink_accepted" ? (
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
                      ) : connection.connection_type === "drink_accepted" ? (
                        <Wine className="w-3 h-3" />
                      ) : (
                        <MapPin className="w-3 h-3" />
                      )}
                      <span>{connection.venue_name}</span>
                      <span>•</span>
                      <span>{formatDate(connection.connected_at)}</span>
                    </div>
                  </div>

                  {/* Action */}
                  <Button
                    data-testid={`chat-btn-${connection.user_id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/chat/${connection.user_id}`);
                    }}
                    className="rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white"
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Chat
                  </Button>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Polite Decline Modal */}
      {declineModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="glass rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold text-white mb-4">
              {declineType === "drink" ? "Politely Decline Drink" : "Politely Decline Chat"}
            </h3>
            <p className="text-slate-400 text-sm mb-4">
              Choose a polite way to decline. They'll receive a friendly message.
            </p>
            <div className="space-y-2">
              {(declineType === "drink" ? drinkDeclineOptions : chatDeclineOptions).map((option) => (
                <button
                  key={option.key}
                  onClick={() => declineType === "drink" 
                    ? handlePoliteDeclineDrink(option.key) 
                    : handlePoliteDeclineChatRequest(option.key)
                  }
                  className="w-full p-3 text-left rounded-xl bg-white/5 hover:bg-white/10 text-white transition-colors"
                >
                  {option.label}
                </button>
              ))}
            </div>
            <Button
              onClick={() => {
                setDeclineModalOpen(false);
                setSelectedDeclineItem(null);
              }}
              variant="ghost"
              className="w-full mt-4 text-slate-400"
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
