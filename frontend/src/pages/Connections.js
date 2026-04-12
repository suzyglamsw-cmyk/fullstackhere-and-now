import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth, API } from "@/App";
import { toast } from "sonner";
import axios from "axios";
import Layout from "../components/Layout";
import { UserCard } from "../components/UserCard";
import { NotForNowSheet } from "../components/NotForNowSheet";
import { MessageCircle, MapPin, Loader2, Users, Sparkles, Eye, Heart, Snowflake, UserPlus, Check, X, Clock, UserCheck, ArrowUpRight, ArrowDownLeft, MessageSquare, Trash2, Ban, UserMinus, MoreVertical, Wine, Archive, CheckSquare, Square, Crown, User } from "lucide-react";
import { getErrorMessage } from "../utils/errorUtils";
import { obscureBioText } from "../utils/bioObscure";
import BlurredImage from "../components/BlurredImage";
import SilhouetteAvatar from "../components/SilhouetteAvatar";
import { ConfirmHint, useConfirmHintGlobal } from "../components/ConfirmHint";
import { dispatchBlockEvent, onUserBlocked } from "../utils/blockEvents";

/**
 * Helper: Determine photo blur state using 3-stage system
 * @param {Object} item - The connection/glance/icebreaker/request object
 * @returns {'blocked' | 'revealed' | 'connection_accepted' | 'unmatched'}
 */
const getPhotoState = (item) => {
  if (item.is_blocked) return 'blocked';
  if (item.reveal_state?.is_revealed) return 'revealed';
  if (item.is_connection_accepted) return 'connection_accepted';
  return 'unmatched';
};

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
  const [hiddenMatches, setHiddenMatches] = useState([]); // Hidden from Mutual Matches
  const [showHiddenMatchesSection, setShowHiddenMatchesSection] = useState(() => {
    // Load preference from localStorage, default to true (show)
    const saved = localStorage.getItem('showHiddenMatchesSection');
    return saved !== null ? JSON.parse(saved) : true;
  });
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
  const [hideConfirmUser, setHideConfirmUser] = useState(null); // For hide from mutual matches confirmation
  const [hideFriendConfirm, setHideFriendConfirm] = useState(null); // For hide friend confirmation
  const [removeFriendConfirm, setRemoveFriendConfirm] = useState(null); // For remove friend confirmation
  const [tab, setTab] = useState(searchParams.get("tab") || "messages"); // "messages" | "glances" | "icebreakers" | "chats" | "requests" | "friends" | "connections"
  
  // Selection state for bulk delete
  const [selectedGlances, setSelectedGlances] = useState(new Set());
  const [selectedIcebreakers, setSelectedIcebreakers] = useState(new Set());
  const [selectedChatRequests, setSelectedChatRequests] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  
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

  // Listen for block events and refresh data
  useEffect(() => {
    const cleanup = onUserBlocked((blockedUserId) => {
      // Immediately remove blocked user from all local state
      setGlances(prev => ({
        incoming: prev.incoming.filter(g => g.from_user_id !== blockedUserId),
        outgoing: prev.outgoing.filter(g => g.to_user_id !== blockedUserId)
      }));
      setIcebreakers(prev => ({
        incoming: prev.incoming.filter(i => i.from_user_id !== blockedUserId),
        outgoing: prev.outgoing.filter(i => i.to_user_id !== blockedUserId)
      }));
      setChatRequests(prev => ({
        incoming: prev.incoming.filter(r => r.from_user_id !== blockedUserId),
        outgoing: prev.outgoing.filter(r => r.to_user_id !== blockedUserId)
      }));
      setFriendRequests(prev => ({
        incoming: prev.incoming.filter(r => r.from_user_id !== blockedUserId),
        outgoing: prev.outgoing.filter(r => r.to_user_id !== blockedUserId)
      }));
      setFriends(prev => prev.filter(f => f.id !== blockedUserId));
      setConnections(prev => prev.filter(c => c.user_id !== blockedUserId));
      setMutualGlances(prev => prev.filter(m => m.user_id !== blockedUserId));
      setMessageThreads(prev => prev.filter(t => t.other_user_id !== blockedUserId));
      
      // Clear any open action sheets for the blocked user
      setActionSheet(prev => (prev?.from_user_id === blockedUserId ? null : prev));
      setChatActionSheet(prev => (prev?.from_user_id === blockedUserId ? null : prev));
      setClearConfirmUser(prev => (prev?.id === blockedUserId ? null : prev));
      
      // Also refresh from server to ensure complete sync
      fetchAllData();
    });
    return cleanup;
  }, []);

  const fetchAllData = async () => {
    try {
      const [connectionsRes, hiddenRes, mutualRes, threadsRes, requestsRes, friendsRes, glancesRes, icebreakersRes, chatRequestsRes] = await Promise.all([
        axios.get(`${API}/connections`),
        axios.get(`${API}/connections/hidden-from-matches`),
        axios.get(`${API}/connections/mutual-glances`),
        axios.get(`${API}/messages/threads`),
        axios.get(`${API}/friends/requests`),
        axios.get(`${API}/friends/list`),
        axios.get(`${API}/connections/glances`),
        axios.get(`${API}/connections/icebreakers`),
        axios.get(`${API}/connections/chat-requests`)
      ]);
      setConnections(connectionsRes.data);
      setHiddenMatches(hiddenRes.data);
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
  const handleIcebreakerAction = async (icebreakerId, action, fromUserId = null) => {
    try {
      await axios.post(`${API}/icebreaker/${icebreakerId}/respond`, { action });
      if (action === "accept") {
        toast.success("Icebreaker accepted! You can now chat.");
      } else if (action === "block_user") {
        toast.success("User blocked");
        // Dispatch block event to refresh all lists
        if (fromUserId) {
          dispatchBlockEvent(fromUserId);
        }
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
      // Update local state to remove "New" status
      setIcebreakers(prev => ({
        ...prev,
        incoming: prev.incoming.map(ib => 
          ib.id === icebreaker.id ? { ...ib, is_new: false } : ib
        )
      }));
    } catch (error) {
      // Silently fail - viewing is not critical
      console.log("Failed to mark as viewed:", error);
    }
    setActionSheet({ ...icebreaker, from_user_id: icebreaker.user_id });
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

  // ============================================================================
  // BULK DELETE HANDLERS (Non-destructive - hides items for current user only)
  // ============================================================================
  
  const handleBulkDeleteGlances = async () => {
    if (selectedGlances.size === 0) return;
    
    setBulkDeleting(true);
    try {
      const response = await axios.post(`${API}/glances/bulk-delete`, {
        glance_ids: Array.from(selectedGlances)
      });
      toast.success(`Removed ${response.data.count} glances from your list`);
      setSelectedGlances(new Set());
      fetchAllData();
    } catch (error) {
      toast.error("Failed to remove glances");
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleBulkDeleteIcebreakers = async () => {
    if (selectedIcebreakers.size === 0) return;
    
    setBulkDeleting(true);
    try {
      const response = await axios.post(`${API}/icebreakers/bulk-delete`, {
        icebreaker_ids: Array.from(selectedIcebreakers)
      });
      toast.success(`Removed ${response.data.count} icebreakers from your list`);
      setSelectedIcebreakers(new Set());
      fetchAllData();
    } catch (error) {
      toast.error("Failed to remove icebreakers");
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleBulkDeleteChatRequests = async () => {
    if (selectedChatRequests.size === 0) return;
    
    setBulkDeleting(true);
    try {
      const response = await axios.post(`${API}/chat-requests/bulk-delete`, {
        request_ids: Array.from(selectedChatRequests)
      });
      toast.success(`Removed ${response.data.count} chat requests from your list`);
      setSelectedChatRequests(new Set());
      fetchAllData();
    } catch (error) {
      toast.error("Failed to remove chat requests");
    } finally {
      setBulkDeleting(false);
    }
  };

  // Selection toggle helpers
  const toggleGlanceSelection = (glanceId) => {
    setSelectedGlances(prev => {
      const newSet = new Set(prev);
      if (newSet.has(glanceId)) {
        newSet.delete(glanceId);
      } else {
        newSet.add(glanceId);
      }
      return newSet;
    });
  };

  const toggleIcebreakerSelection = (icebreakerId) => {
    setSelectedIcebreakers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(icebreakerId)) {
        newSet.delete(icebreakerId);
      } else {
        newSet.add(icebreakerId);
      }
      return newSet;
    });
  };

  const toggleChatRequestSelection = (requestId) => {
    setSelectedChatRequests(prev => {
      const newSet = new Set(prev);
      if (newSet.has(requestId)) {
        newSet.delete(requestId);
      } else {
        newSet.add(requestId);
      }
      return newSet;
    });
  };

  // Select All helpers
  const selectAllGlances = () => {
    const allIds = [
      ...(glances.incoming || []).map(g => g.id),
      ...(glances.outgoing || []).map(g => g.id)
    ];
    setSelectedGlances(new Set(allIds));
  };

  const selectAllIcebreakers = () => {
    const allIds = [
      ...(icebreakers.incoming || []).map(ib => ib.id),
      ...(icebreakers.outgoing || []).map(ib => ib.id)
    ];
    setSelectedIcebreakers(new Set(allIds));
  };

  const selectAllChatRequests = () => {
    const allIds = [
      ...(chatRequests.incoming || []).map(r => r.id),
      ...(chatRequests.outgoing || []).map(r => r.id)
    ];
    setSelectedChatRequests(new Set(allIds));
  };

  // Check if all are selected
  const allGlancesSelected = totalGlances > 0 && selectedGlances.size === totalGlances;
  const allIcebreakersSelected = totalIcebreakers > 0 && selectedIcebreakers.size === totalIcebreakers;
  const allChatRequestsSelected = totalChatRequests > 0 && selectedChatRequests.size === totalChatRequests;

  // Clear a user from mutual matches without breaking chat
  const handleClearFromMatches = async (userId, displayName) => {
    try {
      await axios.delete(`${API}/connections/${userId}/clear`);
      toast.success(`${displayName} cleared from mutual connections`);
      setClearConfirmUser(null);
      fetchAllData();
    } catch (error) {
      toast.error("Failed to clear from matches");
    }
  };

  // Hide a user from Mutual Matches (personal-view cleanup only)
  const handleHideFromMatches = async (userId, displayName) => {
    try {
      await axios.post(`${API}/connections/${userId}/hide-from-matches`);
      toast.success(`${displayName} hidden from Mutual Matches`);
      setHideConfirmUser(null);
      fetchAllData();
    } catch (error) {
      toast.error("Failed to hide from matches");
    }
  };

  // Unhide a user from Mutual Matches (restore them to the list)
  const handleUnhideFromMatches = async (userId, displayName) => {
    try {
      await axios.delete(`${API}/connections/${userId}/unhide-from-matches`);
      toast.success(`${displayName} restored to Mutual Matches`);
      fetchAllData();
    } catch (error) {
      toast.error("Failed to unhide from matches");
    }
  };

  // Bin a hidden match (quiet unmatch - removes mutual connection silently)
  const [binConfirmUser, setBinConfirmUser] = useState(null);
  
  const handleBinHiddenMatch = async (userId, displayName) => {
    try {
      await axios.delete(`${API}/connections/${userId}/bin`);
      toast.success(`${displayName} removed from matches. They can still find you as a new person.`);
      setBinConfirmUser(null);
      fetchAllData();
    } catch (error) {
      toast.error("Failed to remove from matches");
    }
  };

  // Toggle visibility of Hidden Matches section (UI-only, no backend changes)
  const toggleShowHiddenMatches = () => {
    const newValue = !showHiddenMatchesSection;
    setShowHiddenMatchesSection(newValue);
    localStorage.setItem('showHiddenMatchesSection', JSON.stringify(newValue));
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
            Mutual Connections
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
                  className="bg-slate-800/40 backdrop-blur-sm rounded-2xl p-4 flex items-center gap-4 border border-white/10 shadow-md transition-all hover:bg-slate-800/60"
                >
                  {/* Avatar - tappable to profile */}
                  <div 
                    className="relative cursor-pointer"
                    onClick={() => navigate(`/profile/${thread.user_id}`)}
                  >
                    <div className="w-14 h-14 rounded-2xl overflow-hidden hover:ring-2 hover:ring-indigo-500 transition-all">
                      <BlurredImage
                        src={thread.photo_url || thread.avatar_url}
                        alt={thread.display_name}
                        blurState={getPhotoState(thread)}
                        isThumbnail={true}
                        fallbackInitial={thread.display_name?.charAt(0) || "?"}
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
              {/* Bulk Actions Header */}
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-4 flex items-center justify-between border border-white/10 shadow-lg" data-testid="glances-bulk-header">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="select-all-glances"
                    checked={allGlancesSelected}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        selectAllGlances();
                      } else {
                        setSelectedGlances(new Set());
                      }
                    }}
                    data-testid="select-all-glances-checkbox"
                  />
                  <label 
                    htmlFor="select-all-glances" 
                    className="text-sm text-slate-300 cursor-pointer select-none"
                  >
                    Select All ({totalGlances})
                  </label>
                </div>
                {selectedGlances.size > 0 && (
                  <Button
                    data-testid="bulk-delete-glances-btn"
                    onClick={handleBulkDeleteGlances}
                    disabled={bulkDeleting}
                    size="sm"
                    className="rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30"
                  >
                    {bulkDeleting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4 mr-2" />
                    )}
                    Delete Selected ({selectedGlances.size})
                  </Button>
                )}
              </div>

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
                        className={`bg-slate-800/40 backdrop-blur-sm rounded-2xl p-4 flex items-center gap-4 border border-white/10 shadow-md transition-all ${selectedGlances.has(glance.id) ? 'ring-2 ring-indigo-500/50 bg-indigo-500/10 border-indigo-500/30' : 'hover:bg-slate-800/60'}`}
                      >
                        {/* Selection Checkbox */}
                        <Checkbox
                          checked={selectedGlances.has(glance.id)}
                          onCheckedChange={() => toggleGlanceSelection(glance.id)}
                          data-testid={`select-glance-${glance.id}`}
                          className="flex-shrink-0"
                        />
                        <div 
                          className="relative cursor-pointer"
                          onClick={() => navigate(`/profile/${glance.user_id}`)}
                        >
                          <div className="w-14 h-14 rounded-2xl overflow-hidden hover:ring-2 hover:ring-indigo-500 transition-all">
                            <BlurredImage
                              src={glance.photo_url || glance.avatar_url}
                              alt={glance.display_name}
                              blurState={getPhotoState(glance)}
                              isThumbnail={true}
                              fallbackInitial={glance.display_name?.charAt(0) || "?"}
                            />
                          </div>
                          {glance.is_connection_accepted && (
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-pink-500 flex items-center justify-center">
                              <Heart className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-white truncate">{glance.display_name}</h4>
                          <p className="text-slate-500 text-xs">
                            {glance.is_connection_accepted ? "Mutual glance" : "Glanced at you"} • {formatDate(glance.created_at)}
                          </p>
                        </div>
                        {!glance.is_connection_accepted && (
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
                        className={`bg-slate-800/40 backdrop-blur-sm rounded-2xl p-4 flex items-center gap-4 border border-white/10 shadow-md transition-all ${selectedGlances.has(glance.id) ? 'ring-2 ring-indigo-500/50 bg-indigo-500/10 border-indigo-500/30' : 'hover:bg-slate-800/60'}`}
                      >
                        {/* Selection Checkbox */}
                        <Checkbox
                          checked={selectedGlances.has(glance.id)}
                          onCheckedChange={() => toggleGlanceSelection(glance.id)}
                          data-testid={`select-sent-glance-${glance.id}`}
                          className="flex-shrink-0"
                        />
                        <div 
                          className="relative cursor-pointer"
                          onClick={() => navigate(`/profile/${glance.user_id}`)}
                        >
                          <div className="w-14 h-14 rounded-2xl overflow-hidden hover:ring-2 hover:ring-indigo-500 transition-all">
                            <BlurredImage
                              src={glance.photo_url || glance.avatar_url}
                              alt={glance.display_name}
                              blurState={getPhotoState(glance)}
                              isThumbnail={true}
                              fallbackInitial={glance.display_name?.charAt(0) || "?"}
                            />
                          </div>
                          {glance.is_connection_accepted && (
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-pink-500 flex items-center justify-center">
                              <Heart className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-white truncate">{glance.display_name}</h4>
                          <p className="text-slate-500 text-xs">
                            {glance.is_connection_accepted ? "Mutual glance" : "Waiting for them to glance back"} • {formatDate(glance.created_at)}
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
              {/* Bulk Actions Header */}
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-4 flex items-center justify-between border border-white/10 shadow-lg" data-testid="icebreakers-bulk-header">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="select-all-icebreakers"
                    checked={allIcebreakersSelected}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        selectAllIcebreakers();
                      } else {
                        setSelectedIcebreakers(new Set());
                      }
                    }}
                    data-testid="select-all-icebreakers-checkbox"
                  />
                  <label 
                    htmlFor="select-all-icebreakers" 
                    className="text-sm text-slate-300 cursor-pointer select-none"
                  >
                    Select All ({totalIcebreakers})
                  </label>
                </div>
                {selectedIcebreakers.size > 0 && (
                  <Button
                    data-testid="bulk-delete-icebreakers-btn"
                    onClick={handleBulkDeleteIcebreakers}
                    disabled={bulkDeleting}
                    size="sm"
                    className="rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30"
                  >
                    {bulkDeleting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4 mr-2" />
                    )}
                    Delete Selected ({selectedIcebreakers.size})
                  </Button>
                )}
              </div>

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
                        className={`bg-slate-800/40 backdrop-blur-sm rounded-2xl p-4 flex items-center gap-4 border shadow-md transition-all ${ib.is_new ? 'border-cyan-500/30 bg-cyan-500/5' : 'border-white/10'} ${selectedIcebreakers.has(ib.id) ? 'ring-2 ring-cyan-500/50 bg-cyan-500/10 border-cyan-500/30' : 'hover:bg-slate-800/60'}`}
                      >
                        {/* Selection Checkbox */}
                        <Checkbox
                          checked={selectedIcebreakers.has(ib.id)}
                          onCheckedChange={() => toggleIcebreakerSelection(ib.id)}
                          data-testid={`select-icebreaker-${ib.id}`}
                          className="flex-shrink-0"
                        />
                        <div 
                          className="cursor-pointer relative"
                          onClick={() => navigate(`/profile/${ib.user_id}`)}
                        >
                          <div className="w-14 h-14 rounded-2xl overflow-hidden hover:ring-2 hover:ring-cyan-500 transition-all">
                            <BlurredImage
                              src={ib.photo_url || ib.avatar_url}
                              alt={ib.display_name}
                              blurState={getPhotoState(ib)}
                              isThumbnail={true}
                              fallbackInitial={ib.display_name?.charAt(0) || "?"}
                            />
                          </div>
                          {/* New badge for unopened icebreakers */}
                          {ib.is_new && ib.status === "pending" && (
                            <span className="absolute -top-1 -right-1 bg-cyan-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                              New
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className={`font-semibold text-white truncate ${ib.is_new ? 'font-bold' : ''}`}>{ib.display_name}</h4>
                          <p className="text-slate-400 text-sm truncate">"{ib.message || ICEBREAKER_MESSAGES[ib.message_type || 0]}"</p>
                          <p className="text-slate-500 text-xs mt-1">
                            {ib.status === "pending" ? (
                              ib.is_new ? (
                                <span className="text-cyan-400">❄️ New icebreaker</span>
                              ) : (
                                <span>❄️ Icebreaker</span>
                              )
                            ) : ib.status === "accepted" ? (
                              <span className="text-emerald-400">✅ Accepted</span>
                            ) : null}
                            {" · "}{formatDate(ib.created_at)}
                          </p>
                        </div>
                        {ib.status === "pending" ? (
                          <Button
                            data-testid={`respond-icebreaker-${ib.id}`}
                            onClick={() => openIcebreakerActionSheet(ib)}
                            size="sm"
                            className={`rounded-xl ${ib.is_new ? 'bg-cyan-500 hover:bg-cyan-600' : 'bg-slate-600 hover:bg-slate-500'} text-white`}
                          >
                            {ib.is_new ? 'Open' : 'Respond'}
                          </Button>
                        ) : ib.status === "accepted" ? (
                          <Button
                            data-testid={`message-icebreaker-${ib.id}`}
                            onClick={() => navigate(`/chat/${ib.user_id}`)}
                            size="sm"
                            className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white"
                          >
                            <MessageSquare className="w-4 h-4 mr-1" />
                            Chat
                          </Button>
                        ) : null}
                        <Button
                          data-testid={`delete-icebreaker-${ib.id}`}
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
                        className={`bg-slate-800/40 backdrop-blur-sm rounded-2xl p-4 flex items-center gap-4 border border-white/10 shadow-md transition-all ${selectedIcebreakers.has(ib.id) ? 'ring-2 ring-cyan-500/50 bg-cyan-500/10 border-cyan-500/30' : 'hover:bg-slate-800/60'}`}
                      >
                        {/* Selection Checkbox */}
                        <Checkbox
                          checked={selectedIcebreakers.has(ib.id)}
                          onCheckedChange={() => toggleIcebreakerSelection(ib.id)}
                          data-testid={`select-sent-icebreaker-${ib.id}`}
                          className="flex-shrink-0"
                        />
                        <div 
                          className="cursor-pointer"
                          onClick={() => navigate(`/profile/${ib.user_id}`)}
                        >
                          <div className="w-14 h-14 rounded-2xl overflow-hidden hover:ring-2 hover:ring-cyan-500 transition-all">
                            <BlurredImage
                              src={ib.photo_url || ib.avatar_url}
                              alt={ib.display_name}
                              blurState={getPhotoState(ib)}
                              isThumbnail={true}
                              fallbackInitial={ib.display_name?.charAt(0) || "?"}
                            />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-white truncate">{ib.display_name}</h4>
                          <p className="text-slate-400 text-sm truncate">"{ib.message || ICEBREAKER_MESSAGES[ib.message_type || 0]}"</p>
                          <p className="text-slate-500 text-xs mt-1">
                            {/* Status display based on premium and state */}
                            {ib.status === "accepted" ? (
                              <span className="text-emerald-400">✅ Accepted</span>
                            ) : user?.is_premium && ib.viewed_at ? (
                              <span className="text-emerald-400">Viewed · {formatViewedTime(ib.viewed_at)}</span>
                            ) : (
                              <span>Sent</span>
                            )}
                            {" · "}{formatDate(ib.created_at)}
                          </p>
                        </div>
                        {ib.status === "accepted" ? (
                          <Button
                            data-testid={`message-sent-icebreaker-${ib.id}`}
                            onClick={() => navigate(`/chat/${ib.user_id}`)}
                            size="sm"
                            className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white"
                          >
                            <MessageSquare className="w-4 h-4 mr-1" />
                            Chat
                          </Button>
                        ) : (
                          <span className="text-slate-500 text-xs">
                            {user?.is_premium && ib.viewed_at ? "👁" : "⏳"}
                          </span>
                        )}
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
              {/* Bulk Actions Header */}
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-4 flex items-center justify-between border border-white/10 shadow-lg" data-testid="chat-requests-bulk-header">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="select-all-chat-requests"
                    checked={allChatRequestsSelected}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        selectAllChatRequests();
                      } else {
                        setSelectedChatRequests(new Set());
                      }
                    }}
                    data-testid="select-all-chat-requests-checkbox"
                  />
                  <label 
                    htmlFor="select-all-chat-requests" 
                    className="text-sm text-slate-300 cursor-pointer select-none"
                  >
                    Select All ({totalChatRequests})
                  </label>
                </div>
                {selectedChatRequests.size > 0 && (
                  <Button
                    data-testid="bulk-delete-chat-requests-btn"
                    onClick={handleBulkDeleteChatRequests}
                    disabled={bulkDeleting}
                    size="sm"
                    className="rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30"
                  >
                    {bulkDeleting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4 mr-2" />
                    )}
                    Delete Selected ({selectedChatRequests.size})
                  </Button>
                )}
              </div>

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
                        className={`bg-slate-800/40 backdrop-blur-sm rounded-2xl p-4 flex items-center gap-4 border border-white/10 shadow-md transition-all ${selectedChatRequests.has(request.id) ? 'ring-2 ring-pink-500/50 bg-pink-500/10 border-pink-500/30' : 'hover:bg-slate-800/60'}`}
                      >
                        {/* Selection Checkbox */}
                        <Checkbox
                          checked={selectedChatRequests.has(request.id)}
                          onCheckedChange={() => toggleChatRequestSelection(request.id)}
                          data-testid={`select-chat-request-${request.id}`}
                          className="flex-shrink-0"
                        />
                        <div 
                          className="cursor-pointer"
                          onClick={() => navigate(`/profile/${request.user_id}`)}
                        >
                          <div className="w-14 h-14 rounded-2xl overflow-hidden hover:ring-2 hover:ring-pink-500 transition-all">
                            <BlurredImage
                              src={request.photo_url || request.avatar_url}
                              alt={request.display_name}
                              blurState={getPhotoState(request)}
                              isThumbnail={true}
                              fallbackInitial={request.display_name?.charAt(0) || "?"}
                            />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-white truncate">{request.display_name}</h4>
                          {request.bio && (
                            <p className="text-slate-400 text-sm truncate">
                              {obscureBioText(request.bio, request.is_connection_accepted)}
                            </p>
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
                          <Button
                            data-testid={`message-${request.id}`}
                            onClick={() => navigate(`/chat/${request.user_id}`)}
                            size="sm"
                            className="rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white"
                          >
                            <MessageCircle className="w-4 h-4 mr-1" />
                            Chat
                          </Button>
                        ) : null}
                        <Button
                          data-testid={`delete-chat-${request.id}`}
                          onClick={(e) => { e.stopPropagation(); handleDeleteChatRequest(request.id); }}
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
                        className={`bg-slate-800/40 backdrop-blur-sm rounded-2xl p-4 flex items-center gap-4 border border-white/10 shadow-md transition-all ${selectedChatRequests.has(request.id) ? 'ring-2 ring-pink-500/50 bg-pink-500/10 border-pink-500/30' : 'hover:bg-slate-800/60'}`}
                      >
                        {/* Selection Checkbox */}
                        <Checkbox
                          checked={selectedChatRequests.has(request.id)}
                          onCheckedChange={() => toggleChatRequestSelection(request.id)}
                          data-testid={`select-sent-chat-request-${request.id}`}
                          className="flex-shrink-0"
                        />
                        <div 
                          className="cursor-pointer"
                          onClick={() => navigate(`/profile/${request.user_id}`)}
                        >
                          <div className="w-14 h-14 rounded-2xl overflow-hidden hover:ring-2 hover:ring-pink-500 transition-all">
                            <BlurredImage
                              src={request.photo_url || request.avatar_url}
                              alt={request.display_name}
                              blurState={getPhotoState(request)}
                              isThumbnail={true}
                              fallbackInitial={request.display_name?.charAt(0) || "?"}
                            />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-white truncate">{request.display_name}</h4>
                          {request.bio && (
                            <p className="text-slate-400 text-sm truncate">
                              {obscureBioText(request.bio, request.is_connection_accepted)}
                            </p>
                          )}
                          <p className="text-slate-500 text-xs mt-1">
                            {request.status === "pending" ? "⏳ Waiting for response" : request.status === "accepted" ? "✅ Accepted" : "❌ Declined"} • {formatDate(request.created_at)}
                          </p>
                          {request.decline_message && (
                            <p className="text-slate-500 text-xs italic mt-1">"{request.decline_message}"</p>
                          )}
                        </div>
                        {request.status === "accepted" ? (
                          <Button
                            data-testid={`message-out-${request.id}`}
                            onClick={(e) => { e.stopPropagation(); navigate(`/chat/${request.user_id}`); }}
                            size="sm"
                            className="rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white"
                          >
                            <MessageCircle className="w-4 h-4 mr-1" />
                            Chat
                          </Button>
                        ) : (
                          <span className="text-slate-500 text-xs">
                            {request.status === "pending" ? "⏳" : ""}
                          </span>
                        )}
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
                        className="bg-slate-800/40 backdrop-blur-sm rounded-2xl p-4 flex items-center gap-4 border border-white/10 shadow-md transition-all hover:bg-slate-800/60"
                      >
                        <div 
                          className="cursor-pointer"
                          onClick={() => navigate(`/profile/${request.from_user_id}`)}
                        >
                          <div className="w-14 h-14 rounded-2xl overflow-hidden hover:ring-2 hover:ring-amber-500 transition-all">
                            <BlurredImage
                              src={request.photo_url || request.avatar_url}
                              alt={request.display_name}
                              blurState={getPhotoState(request)}
                              isThumbnail={true}
                              fallbackInitial={request.display_name?.charAt(0) || "?"}
                            />
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
                        className="bg-slate-800/40 backdrop-blur-sm rounded-2xl p-4 flex items-center gap-4 border border-white/10 shadow-md transition-all hover:bg-slate-800/60"
                      >
                        <div 
                          className="cursor-pointer"
                          onClick={() => navigate(`/profile/${request.to_user_id}`)}
                        >
                          <div className="w-14 h-14 rounded-2xl overflow-hidden hover:ring-2 hover:ring-amber-500 transition-all">
                            <BlurredImage
                              src={request.photo_url || request.avatar_url}
                              alt={request.display_name}
                              blurState={getPhotoState(request)}
                              isThumbnail={true}
                              fallbackInitial={request.display_name?.charAt(0) || "?"}
                            />
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
          (() => {
            // Separate visible friends from hidden friends
            const hiddenFriendIds = new Set(hiddenMatches.map(h => h.user_id));
            const visibleFriends = friends.filter(f => !hiddenFriendIds.has(f.id));
            const hiddenFriends = friends.filter(f => hiddenFriendIds.has(f.id));
            
            return friends.length === 0 ? (
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
              <div className="space-y-8" data-testid="friends-list">
                {/* Visible Friends - Grid Layout matching Mutual Matches */}
                {visibleFriends.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {visibleFriends.map((friend) => (
                      <div 
                        key={friend.id}
                        data-testid={`friend-${friend.id}`}
                        className="bg-white/5 rounded-xl overflow-hidden border border-white/10 hover:border-emerald-500/50 transition-all cursor-pointer group"
                      >
                        {/* Photo - Square */}
                        <div 
                          className="relative aspect-square"
                          onClick={() => navigate(`/profile/${friend.id}`)}
                        >
                          <BlurredImage
                            src={friend.photo_url || friend.avatar_url}
                            alt={friend.display_name}
                            blurState={getPhotoState(friend)}
                            isThumbnail={true}
                            fallbackInitial={friend.display_name?.charAt(0) || "?"}
                          />
                          
                          {/* Name overlay */}
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-2">
                            <p className="text-white text-xs font-medium truncate">
                              {friend.display_name}
                            </p>
                          </div>
                          
                          {/* Friend badge */}
                          <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-emerald-500/90 flex items-center justify-center">
                            <UserCheck className="w-2.5 h-2.5 text-white" />
                          </div>
                        </div>
                        
                        {/* Actions */}
                        <div className="p-1.5 flex gap-1">
                          <Button
                            data-testid={`message-friend-${friend.id}`}
                            size="sm"
                            className="flex-1 h-7 text-xs bg-emerald-500/80 hover:bg-emerald-600 text-white px-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/chat/${friend.id}`);
                            }}
                          >
                            <MessageCircle className="w-3 h-3 mr-1" />
                            Chat
                          </Button>
                          <Button
                            data-testid={`hide-friend-btn-${friend.id}`}
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              setHideFriendConfirm({ id: friend.id, display_name: friend.display_name });
                            }}
                            title="Hide Friend"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Hidden Friends Section - Row Layout matching Hidden Matches */}
                {hiddenFriends.length > 0 && showHiddenMatchesSection && (
                  <div data-testid="hidden-friends-section">
                    <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      Hidden Friends ({hiddenFriends.length})
                    </h3>
                    <div className="space-y-2">
                      {hiddenFriends.map((friend) => (
                        <div 
                          key={friend.id}
                          className="bg-white/5 rounded-xl p-3 border border-white/10 flex items-center gap-3"
                          data-testid={`hidden-friend-${friend.id}`}
                        >
                          {/* Profile Photo */}
                          <div 
                            className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all"
                            onClick={() => navigate(`/profile/${friend.id}`)}
                          >
                            <BlurredImage
                              src={friend.photo_url || friend.avatar_url}
                              alt={friend.display_name}
                              blurState={getPhotoState(friend)}
                              isThumbnail={true}
                              fallbackInitial={friend.display_name?.charAt(0) || "?"}
                            />
                          </div>
                          
                          {/* Name, Age */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-white font-medium truncate">
                                {friend.display_name}
                              </p>
                            </div>
                            <p className="text-slate-500 text-xs">
                              Hidden {friend.hidden_at ? formatDate(friend.hidden_at) : ""}
                            </p>
                          </div>
                          
                          {/* Action Buttons */}
                          <div className="flex gap-2 flex-shrink-0">
                            {/* Unhide Button */}
                            <Button
                              data-testid={`unhide-friend-btn-${friend.id}`}
                              size="sm"
                              className="h-8 text-xs bg-indigo-500/80 hover:bg-indigo-600 text-white px-3"
                              onClick={() => handleUnhideFromMatches(friend.id, friend.display_name)}
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              Unhide
                            </Button>
                            
                            {/* Remove Friend Button */}
                            <Button
                              data-testid={`remove-friend-btn-${friend.id}`}
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                              onClick={() => setRemoveFriendConfirm({ id: friend.id, display_name: friend.display_name })}
                              title="Remove Friend"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty state when all friends are hidden */}
                {visibleFriends.length === 0 && hiddenFriends.length > 0 && (
                  <div className="text-center py-10">
                    <p className="text-slate-400">All your friends are currently hidden.</p>
                    <p className="text-slate-500 text-sm mt-1">Check the Hidden Friends section below.</p>
                  </div>
                )}
              </div>
            );
          })()
        ) : (
          /* All Connections Tab - Mutual Matches */
          connections.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <Users className="w-10 h-10 text-slate-600" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">No mutual connections yet</h2>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3" data-testid="connections-list">
              {connections.map((connection) => (
                <div 
                  key={connection.id}
                  className="bg-white/5 rounded-xl overflow-hidden border border-white/10 hover:border-emerald-500/50 transition-all cursor-pointer group"
                  data-testid={`match-card-${connection.user_id}`}
                >
                  {/* Compact Photo - Square */}
                  <div 
                    className="relative aspect-square"
                    onClick={() => navigate(`/profile/${connection.user_id}`)}
                  >
                    <BlurredImage
                      src={connection.photo_url || connection.avatar_url}
                      alt={connection.display_name}
                      blurState={getPhotoState(connection)}
                      isThumbnail={true}
                      fallbackInitial={connection.display_name?.charAt(0) || "?"}
                    />
                    
                    {/* Name overlay */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-2">
                      <p className="text-white text-xs font-medium truncate">
                        {connection.reveal_state?.is_revealed 
                          ? connection.display_name 
                          : connection.display_name?.charAt(0)}
                        {connection.age ? `, ${connection.age}` : ""}
                      </p>
                    </div>
                    
                    {/* Premium badge */}
                    {connection.is_premium && (
                      <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-amber-500/90 flex items-center justify-center">
                        <Crown className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                  </div>
                  
                  {/* Compact Actions */}
                  <div className="p-1.5 flex gap-1">
                    <Button
                      data-testid={`message-btn-${connection.user_id}`}
                      size="sm"
                      className="flex-1 h-7 text-xs bg-emerald-500/80 hover:bg-emerald-600 text-white px-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/chat/${connection.user_id}`);
                      }}
                    >
                      <MessageCircle className="w-3 h-3 mr-1" />
                      Chat
                    </Button>
                    <Button
                      data-testid={`hide-match-btn-${connection.user_id}`}
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        setHideConfirmUser({ user_id: connection.user_id, display_name: connection.display_name });
                      }}
                      title="Hide from Mutual Matches"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* ============================================
            HIDDEN MATCHES SECTION
            Shows users hidden from Mutual Matches
            Includes toggle to show/hide the section (UI-only)
            ============================================ */}
        {tab === "connections" && (
          <div className="mt-8" data-testid="hidden-matches-section">
            {/* Header with toggle */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-400 flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Hidden Matches
                {hiddenMatches.length > 0 && (
                  <span className="text-sm text-slate-500">({hiddenMatches.length})</span>
                )}
              </h3>
              
              {/* Visibility Toggle */}
              <button
                data-testid="toggle-hidden-matches-visibility"
                onClick={toggleShowHiddenMatches}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  showHiddenMatchesSection 
                    ? 'bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30' 
                    : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700/70'
                }`}
              >
                <Eye className={`w-3.5 h-3.5 ${showHiddenMatchesSection ? '' : 'opacity-50'}`} />
                {showHiddenMatchesSection ? 'Showing' : 'Hidden'}
              </button>
            </div>
            
            {/* Content - only show if toggle is ON */}
            {showHiddenMatchesSection ? (
              hiddenMatches.length === 0 ? (
                <div className="text-center py-10 bg-white/5 rounded-2xl border border-white/10">
                  <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-3">
                    <Eye className="w-7 h-7 text-slate-600" />
                  </div>
                  <p className="text-slate-500 text-sm">
                    You haven't hidden anyone.
                  </p>
                  <p className="text-slate-600 text-xs mt-1">
                    Mutual matches you hide will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {hiddenMatches.map((hidden) => (
                    <div 
                      key={hidden.user_id}
                      className="bg-white/5 rounded-xl p-3 border border-white/10 flex items-center gap-3"
                      data-testid={`hidden-match-${hidden.user_id}`}
                    >
                      {/* Profile Photo */}
                      <div 
                        className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all"
                        onClick={() => navigate(`/profile/${hidden.user_id}`)}
                      >
                        <BlurredImage
                          src={hidden.photo_url || hidden.avatar_url}
                          alt={hidden.display_name}
                          blurState={getPhotoState(hidden)}
                          isThumbnail={true}
                          fallbackInitial={hidden.display_name?.charAt(0) || "?"}
                        />
                      </div>
                      
                      {/* Name, Age, Presence */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-white font-medium truncate">
                            {hidden.display_name}
                            {hidden.age ? `, ${hidden.age}` : ""}
                          </p>
                          {/* Presence dot */}
                          {hidden.presence_status === "here" ? (
                            <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" title="Here Now" />
                          ) : hidden.presence_status === "not_here" ? (
                            <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" title="Not Here" />
                          ) : null}
                          {hidden.is_premium && (
                            <Crown className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-slate-500 text-xs">
                          Hidden {hidden.hidden_at ? formatDate(hidden.hidden_at) : ""}
                        </p>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex gap-2 flex-shrink-0">
                        {/* Unhide Button */}
                        <Button
                          data-testid={`unhide-btn-${hidden.user_id}`}
                          size="sm"
                          className="h-8 text-xs bg-indigo-500/80 hover:bg-indigo-600 text-white px-3"
                          onClick={() => handleUnhideFromMatches(hidden.user_id, hidden.display_name)}
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          Unhide
                        </Button>
                        
                        {/* Bin Button (Quiet Unmatch) */}
                        <Button
                          data-testid={`bin-btn-${hidden.user_id}`}
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                          onClick={() => setBinConfirmUser({ user_id: hidden.user_id, display_name: hidden.display_name })}
                          title="Remove match (quiet unmatch)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              /* Toggle is OFF - show minimal info */
              <div className="text-center py-6 bg-white/5 rounded-2xl border border-white/10 border-dashed">
                <p className="text-slate-500 text-sm">
                  Hidden matches section is turned off.
                </p>
                <p className="text-slate-600 text-xs mt-1">
                  Tap "Hidden" above to show your {hiddenMatches.length > 0 ? `${hiddenMatches.length} hidden match${hiddenMatches.length > 1 ? 'es' : ''}` : 'hidden matches'}.
                </p>
              </div>
            )}
          </div>
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
              {/* Stay mutual & clear (soft archive) */}
              <Button
                data-testid="stay-matched-clear-btn"
                onClick={() => handleClearFromMatches(clearConfirmUser.user_id, clearConfirmUser.display_name)}
                className="w-full h-12 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold"
              >
                <Archive className="w-4 h-4 mr-2" />
                Stay mutual & clear
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

      {/* Hide from Mutual Matches Confirmation Modal */}
      {hideConfirmUser && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200" 
          onClick={() => setHideConfirmUser(null)}
          data-testid="hide-confirm-modal"
        >
          <div 
            className="w-full max-w-sm bg-slate-900 rounded-2xl p-6 mx-4 border border-white/10 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-slate-700/50 flex items-center justify-center mx-auto mb-4">
                <Eye className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Hide from Matches?</h3>
              <p className="text-slate-400 text-sm">
                Hide <span className="text-white font-medium">{hideConfirmUser.display_name}</span> from your Mutual Matches list?
              </p>
            </div>

            <div className="space-y-3">
              {/* What this does */}
              <div className="bg-slate-800/50 rounded-xl p-3 text-xs text-slate-400">
                <p className="font-medium text-slate-300 mb-1">This will:</p>
                <p>• Remove them from your Mutual Matches view</p>
                <p className="mt-2 font-medium text-slate-300 mb-1">This will NOT:</p>
                <p>• Unmatch or block them</p>
                <p>• Delete your messages</p>
                <p>• Affect any other interactions</p>
              </div>
              
              {/* Hide button */}
              <Button
                data-testid="confirm-hide-btn"
                onClick={() => handleHideFromMatches(hideConfirmUser.user_id, hideConfirmUser.display_name)}
                className="w-full h-12 rounded-xl bg-slate-600 hover:bg-slate-500 text-white font-semibold"
              >
                <X className="w-4 h-4 mr-2" />
                Hide from Matches
              </Button>
              
              {/* Cancel */}
              <Button
                data-testid="cancel-hide-btn"
                onClick={() => setHideConfirmUser(null)}
                variant="ghost"
                className="w-full h-12 rounded-xl text-slate-300 hover:bg-white/5"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Hide Friend Confirmation Modal */}
      {hideFriendConfirm && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200" 
          onClick={() => setHideFriendConfirm(null)}
          data-testid="hide-friend-confirm-modal"
        >
          <div 
            className="w-full max-w-sm bg-slate-900 rounded-2xl p-6 mx-4 border border-white/10 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-slate-700/50 flex items-center justify-center mx-auto mb-4">
                <Eye className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Hide Friend?</h3>
              <p className="text-slate-400 text-sm">
                Hide <span className="text-white font-medium">{hideFriendConfirm.display_name}</span> from your Friends list?
              </p>
            </div>

            <div className="space-y-3">
              {/* What this does */}
              <div className="bg-slate-800/50 rounded-xl p-3 text-xs text-slate-400">
                <p className="font-medium text-slate-300 mb-1">This will:</p>
                <p>• Move them to your Hidden Friends section</p>
                <p>• Remove them from Venues and Discovery</p>
                <p className="mt-2 font-medium text-slate-300 mb-1">This will NOT:</p>
                <p>• Unfriend them</p>
                <p>• Delete your messages</p>
                <p>• Notify them</p>
                <p>• Block them</p>
              </div>
              
              {/* Hide button */}
              <Button
                data-testid="confirm-hide-friend-btn"
                onClick={() => {
                  handleHideFromMatches(hideFriendConfirm.id, hideFriendConfirm.display_name);
                  setHideFriendConfirm(null);
                }}
                className="w-full h-12 rounded-xl bg-slate-600 hover:bg-slate-500 text-white font-semibold"
              >
                <X className="w-4 h-4 mr-2" />
                Hide Friend
              </Button>
              
              {/* Cancel */}
              <Button
                data-testid="cancel-hide-friend-btn"
                onClick={() => setHideFriendConfirm(null)}
                variant="ghost"
                className="w-full h-12 rounded-xl text-slate-300 hover:bg-white/5"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bin Confirmation Modal (Quiet Unmatch) */}
      {binConfirmUser && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200" 
          onClick={() => setBinConfirmUser(null)}
          data-testid="bin-confirm-modal"
        >
          <div 
            className="w-full max-w-sm bg-slate-900 rounded-2xl p-6 mx-4 border border-white/10 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Remove Match?</h3>
              <p className="text-slate-400 text-sm">
                Remove <span className="text-white font-medium">{binConfirmUser.display_name}</span> from your matches?
              </p>
            </div>

            <div className="space-y-3">
              {/* What this does */}
              <div className="bg-slate-800/50 rounded-xl p-3 text-xs text-slate-400">
                <p className="font-medium text-slate-300 mb-1">This will:</p>
                <p>• Remove the mutual connection</p>
                <p>• They become a normal unmatched person</p>
                <p>• You can match again in the future</p>
                <p className="mt-2 font-medium text-slate-300 mb-1">This will NOT:</p>
                <p>• Delete your chat messages</p>
                <p>• Notify them in any way</p>
                <p>• Block them</p>
              </div>
              
              {/* Bin button */}
              <Button
                data-testid="confirm-bin-btn"
                onClick={() => handleBinHiddenMatch(binConfirmUser.user_id, binConfirmUser.display_name)}
                className="w-full h-12 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Remove Match
              </Button>
              
              {/* Cancel */}
              <Button
                data-testid="cancel-bin-btn"
                onClick={() => setBinConfirmUser(null)}
                variant="ghost"
                className="w-full h-12 rounded-xl text-slate-300 hover:bg-white/5"
              >
                Cancel
              </Button>
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
                  src={actionSheet.thumbnail_url || actionSheet.avatar_url}
                  alt={actionSheet.display_name}
                  blurState={getPhotoState(actionSheet)}
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
                Accept
              </Button>
              <Button
                data-testid="decline-icebreaker-btn"
                onClick={() => handleIcebreakerAction(actionSheet.id, "decline")}
                variant="ghost"
                className="w-full h-12 rounded-xl text-slate-300 hover:bg-white/5"
              >
                <X className="w-5 h-5 mr-2" />
                Decline
              </Button>
              <Button
                data-testid="block-user-btn"
                onClick={() => handleIcebreakerAction(actionSheet.id, "block_user", actionSheet.from_user_id)}
                variant="ghost"
                className="w-full h-12 rounded-xl text-red-400 hover:bg-red-500/10"
              >
                <Ban className="w-5 h-5 mr-2" />
                Block User
              </Button>
              {/* Delete option - only shown after response has been recorded */}
              {actionSheet.status && actionSheet.status !== "pending" && (
                <Button
                  data-testid="delete-icebreaker-btn"
                  onClick={() => {
                    handleDeleteIcebreaker(actionSheet.id);
                    setActionSheet(null);
                  }}
                  variant="ghost"
                  className="w-full h-12 rounded-xl text-slate-400 hover:bg-white/5"
                >
                  <Trash2 className="w-5 h-5 mr-2" />
                  Delete
                </Button>
              )}
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
                  src={chatActionSheet.thumbnail_url || chatActionSheet.avatar_url}
                  alt={chatActionSheet.display_name}
                  blurState={getPhotoState(chatActionSheet)}
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

      {/* Remove Friend Confirmation Modal */}
      {removeFriendConfirm && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200" 
          onClick={() => setRemoveFriendConfirm(null)}
          data-testid="remove-friend-confirm-modal"
        >
          <div 
            className="w-full max-w-sm bg-slate-900 rounded-2xl p-6 mx-4 border border-white/10 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                <UserMinus className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Remove Friend?</h3>
              <p className="text-slate-400 text-sm">
                Remove <span className="text-white font-medium">{removeFriendConfirm.display_name}</span> from your Friends?
              </p>
            </div>

            <div className="space-y-3">
              {/* What this does */}
              <div className="bg-slate-800/50 rounded-xl p-3 text-xs text-slate-400">
                <p className="font-medium text-slate-300 mb-1">This will:</p>
                <p>• Remove them from your Friends list</p>
                <p>• Turn them into a normal unmatched person</p>
                <p>• Allow you to friend them again in the future</p>
                <p className="mt-2 font-medium text-slate-300 mb-1">This will NOT:</p>
                <p>• Delete your chat messages</p>
                <p>• Notify them</p>
                <p>• Block them</p>
              </div>
              
              {/* Remove button */}
              <Button
                data-testid="confirm-remove-friend-btn"
                onClick={() => {
                  handleRemoveFriend(removeFriendConfirm.id);
                  setRemoveFriendConfirm(null);
                }}
                className="w-full h-12 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold"
              >
                Remove Friend
              </Button>
              
              {/* Cancel */}
              <Button
                data-testid="cancel-remove-friend-btn"
                onClick={() => setRemoveFriendConfirm(null)}
                variant="ghost"
                className="w-full h-12 rounded-xl text-slate-300 hover:bg-white/5"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Connections;
