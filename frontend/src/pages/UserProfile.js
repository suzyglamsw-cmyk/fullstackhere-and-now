import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth, API } from "@/App";
import { toast } from "sonner";
import axios from "axios";
import Layout from "../components/Layout";
import { Eye, MessageCircle, Loader2, Heart, Crown, Coins, X, UserPlus, Snowflake, MessageSquare, Lock, ShieldOff, AlertTriangle, ArrowLeft, MapPin } from "lucide-react";
import { getErrorMessage } from "../utils/errorUtils";
import { obscureBioText } from "../utils/bioObscure";
import BlurredImage from "../components/BlurredImage";
import SilhouetteAvatar from "../components/SilhouetteAvatar";
import { ConfirmHint, useConfirmHintGlobal } from "../components/ConfirmHint";
import { dispatchBlockEvent } from "../utils/blockEvents";
import { onMutualMatch } from "../utils/matchEvents";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Preset icebreaker options - NO free text allowed
const ICEBREAKER_MESSAGES = [
  { id: 0, name: "Hello", icon: "👋" },
  { id: 1, name: "You seem interesting", icon: "✨" },
  { id: 2, name: "Fancy a chat?", icon: "💬" },
  { id: 3, name: "Can I buy you a drink?", icon: "🍸" },
];

const UserProfile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [glancing, setGlancing] = useState(false);
  const [addingFriend, setAddingFriend] = useState(false);
  const [sendingIcebreaker, setSendingIcebreaker] = useState(false);
  const [sendingChatRequest, setSendingChatRequest] = useState(false);
  const [showIcebreakerModal, setShowIcebreakerModal] = useState(false);
  const [showChatRequestModal, setShowChatRequestModal] = useState(false);
  const [selectedIcebreaker, setSelectedIcebreaker] = useState(null);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [revealing, setRevealing] = useState(false);
  
  // Global ref for confirmation hints (only one visible at a time)
  const confirmHintRef = useConfirmHintGlobal();

  // Unified refresh function to get fresh is_connection_accepted state from backend
  const refreshConnectionState = async () => {
    try {
      const response = await axios.get(`${API}/users/${userId}/profile`);
      setProfile(response.data);
    } catch (error) {
      console.error("Failed to refresh connection state:", error);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [userId]);

  // Re-fetch connection state when user returns to this profile (visibility change)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && userId) {
        // User returned to the tab - refresh to catch any mutual matches
        refreshConnectionState();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [userId]);

  // Re-fetch when navigating back to this profile (focus event)
  useEffect(() => {
    const handleFocus = () => {
      if (userId) {
        refreshConnectionState();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [userId]);

  // Listen for mutual match events - refresh if this profile is involved
  useEffect(() => {
    const cleanup = onMutualMatch((matchData) => {
      const matchUserId = matchData.by_user?.id || matchData.from_user?.id;
      if (matchUserId === userId) {
        // This profile just became a mutual match - refresh to update UI
        toast.success("You made a mutual connection!");
        refreshConnectionState();
        fetchProfile();
      }
    });
    return cleanup;
  }, [userId]);

  // WebSocket connection for real-time match updates
  useEffect(() => {
    if (!user?.id) return;
    
    const wsUrl = API.replace('/api', '').replace('https://', 'wss://').replace('http://', 'ws://');
    const ws = new WebSocket(`${wsUrl}/api/ws/${user.id}`);
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle unified mutual match event
        if (data.type === 'mutual_match_created') {
          const matchUserId = data.by_user?.id || data.from_user?.id;
          if (matchUserId === userId) {
            // This profile just became a mutual match - refresh to update UI
            toast.success("You made a mutual connection!");
            refreshConnectionState();
            fetchProfile();
          }
        }
      } catch (e) {
        console.error('WebSocket message error:', e);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [user?.id, userId]);

  const fetchProfile = async () => {
    try {
      const response = await axios.get(`${API}/users/${userId}/profile`);
      setProfile(response.data);
    } catch (error) {
      toast.error("Failed to load profile");
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const handleRevealPhoto = async () => {
    setRevealing(true);
    try {
      await axios.post(`${API}/reveal/${userId}`);
      toast.success("Photo revealed!");
      // Refresh both match status and profile for latest state
      await refreshConnectionState();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to reveal photo"));
    } finally {
      setRevealing(false);
    }
  };

  // ============================================================================
  // SINGLE SOURCE OF TRUTH: is_connection_accepted from backend
  // ============================================================================
  // When is_connection_accepted = true:
  // - Messaging is unlocked
  // - Glance/icebreaker prompts are hidden
  // - Mutual match UI is shown
  // ============================================================================
  const isMutualMatch = profile?.is_connection_accepted === true;
  
  // Photo reveal state (for blur level only - separate from match state)
  const isRevealed = profile?.is_revealed === true;
  
  // Blocked state
  const isBlocked = profile?.is_blocked === true;
  
  // Get photo blur state (12px / 6px / 0px)
  const getPhotoState = () => {
    if (isBlocked) return 'blocked';
    if (isRevealed) return 'revealed';           // 0px - ONLY when both pressed Reveal
    if (isMutualMatch) return 'connection_accepted'; // 6px - mutual match
    return 'unmatched';                          // 12px - no connection
  };

  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  const handleGlance = async () => {
    setGlancing(true);
    try {
      const response = await axios.post(`${API}/glance`, {
        to_user_id: userId,
        venue_id: "profile_view"
      });
      
      // Check if this created a mutual match
      const nowMutual = response.data.is_connection_accepted === true;
      toast.success(nowMutual ? "It's mutual! You can now message each other." : "Glance sent!");
      
      // Refresh to get latest is_connection_accepted state
      await refreshConnectionState();
    } catch (error) {
      if (error.response?.status === 429 || error.response?.data?.detail === "no_glances_remaining") {
        setShowUpgradePrompt(true);
      } else {
        toast.error(getErrorMessage(error, "Failed to send glance"));
      }
    } finally {
      setGlancing(false);
    }
  };

  const handleAddFriend = async () => {
    // Double-check if friend can be added
    if (!profile.can_add_friend) {
      toast.error("You can only add friends after an icebreaker or chat request is accepted.");
      return;
    }
    
    setAddingFriend(true);
    try {
      const response = await axios.post(`${API}/friends/add`, { user_id: userId });
      // Show the backend's response message
      toast.success(response.data?.message || "Friend request sent!");
      await refreshConnectionState();
    } catch (error) {
      // Handle various error formats
      const errorData = error.response?.data;
      let errorMessage = "Failed to add friend";
      
      if (typeof errorData === "string") {
        errorMessage = errorData;
      } else if (errorData?.detail) {
        errorMessage = typeof errorData.detail === "string" 
          ? errorData.detail 
          : "You can only add friends after an icebreaker or chat request is accepted.";
      } else if (errorData?.msg) {
        errorMessage = errorData.msg;
      }
      
      toast.error(errorMessage);
    } finally {
      setAddingFriend(false);
    }
  };

  const handleAcceptFriendRequest = async () => {
    try {
      // Find the friend request ID
      const friendsResponse = await axios.get(`${API}/friends/requests`);
      const request = friendsResponse.data?.find(r => r.from_user_id === userId);
      if (request) {
        await axios.post(`${API}/friends/respond/${request.id}?accept=true`);
        toast.success(`You are now friends with ${profile.display_name}!`);
        await refreshConnectionState();
      } else {
        toast.error("Friend request not found");
      }
    } catch (error) {
      toast.error("Failed to accept friend request");
    }
  };

  const handleSendIcebreaker = async (messageType) => {
    setSendingIcebreaker(true);
    try {
      const response = await axios.post(`${API}/icebreaker`, {
        to_user_id: userId,
        message_type: messageType,
        venue_id: "profile_view"
      });
      
      // Check if this created an accepted connection (they already sent one to us)
      const isAccepted = response.data?.status === "accepted" || response.data?.is_connection_accepted;
      toast.success(isAccepted ? "It's mutual! You can now message each other." : "Icebreaker sent!");
      
      setShowIcebreakerModal(false);
      setSelectedIcebreaker(null);
      await refreshConnectionState();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to send icebreaker"));
    } finally {
      setSendingIcebreaker(false);
    }
  };

  const handleSendChatRequest = async () => {
    setSendingChatRequest(true);
    try {
      const response = await axios.post(`${API}/chat-request`, {
        to_user_id: userId,
        venue_id: "profile_view",
        request_type: "chat"
      });
      
      // Check if this created an accepted connection
      const isAccepted = response.data?.status === "accepted" || response.data?.is_connection_accepted;
      toast.success(isAccepted ? "It's mutual! You can now message each other." : "Chat request sent!");
      
      setShowChatRequestModal(false);
      await refreshConnectionState();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to send chat request"));
    } finally {
      setSendingChatRequest(false);
    }
  };

  const handleBlockUser = async () => {
    setBlocking(true);
    try {
      await axios.post(`${API}/users/block`, { user_id: userId });
      toast.success("User blocked. They won't be able to see or contact you.");
      setShowBlockModal(false);
      // Dispatch block event to refresh all lists
      dispatchBlockEvent(userId);
      navigate(-1); // Go back to previous page
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to block user"));
    } finally {
      setBlocking(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        </div>
      </Layout>
    );
  }

  if (!profile) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-slate-400">Profile not found</p>
        </div>
      </Layout>
    );
  }

  // Handle unavailable/blocked user
  if (profile.is_unavailable) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 py-6">
          <PageHeader title="Profile" />
          <div className="glass rounded-3xl p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <ShieldOff className="w-10 h-10 text-slate-500" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">User Unavailable</h2>
            <p className="text-slate-400">{profile.unavailable_message || "Sorry, this user is unavailable right now."}</p>
            <Button
              onClick={() => navigate(-1)}
              className="mt-6 bg-slate-700 hover:bg-slate-600 text-white"
            >
              Go Back
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  const mainPhoto = profile.avatar_url || (profile.photos && profile.photos[0]) || null;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto h-[calc(100vh-80px)] flex flex-col" data-testid="user-profile-page">
        {/* Close (X) Button - Top-right, isolated container - shows for ALL profile views */}
        <div className="flex-shrink-0 absolute top-20 right-4 z-50">
          <button
            data-testid="close-profile-btn"
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-slate-800/80 hover:bg-slate-700 flex items-center justify-center transition-colors shadow-lg"
            aria-label="Close profile"
          >
            <X className="w-5 h-5 text-slate-300" />
          </button>
        </div>

        {/* Header Section - TWO separate containers */}
        <div className="flex-shrink-0 px-4 pt-2">
          {/* Container A: Return link - Left aligned */}
          <div className="flex justify-start">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors p-2 -ml-2 rounded-xl hover:bg-white/5"
              data-testid="page-back-btn"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-medium">Return</span>
            </button>
          </div>
          
          {/* Container B: Page Title - Only show for self-profile view */}
          {userId === user?.id && (
            <div className="text-center py-2">
              <h1 className="text-xl font-bold text-white">Profile</h1>
            </div>
          )}
        </div>

        {/* Scrollable Profile Content - starts immediately after header, no gap */}
        <div className="flex-1 overflow-y-auto px-4 pb-32">
          {/* Profile Card */}
          <div className="glass rounded-3xl overflow-hidden shadow-xl">
            {/* Main Photo - 3-stage blur based on match/reveal status */}
            {/* Show silhouette when hide_photo_in_venues is enabled and photo is null (not connected) */}
            <div className="aspect-square w-full max-h-96 overflow-hidden">
              {!mainPhoto && profile.hide_photo_in_venues && !isMutualMatch ? (
                <SilhouetteAvatar />
              ) : (
                <BlurredImage
                  src={mainPhoto}
                  alt={profile.display_name}
                  blurState={getPhotoState()}
                  isThumbnail={false}
                  fallbackInitial={profile.display_name?.charAt(0) || "?"}
                />
              )}
            </div>

            {/* Profile Info - Inner Scroll Container */}
            <div className="p-4">
              {/* Name + Age row with icons right-aligned */}
              <div className="flex justify-between items-center flex-nowrap mb-4">
                {/* Left: Name + Age */}
                <div className="min-w-0 flex-shrink">
                  <h1 className="text-2xl font-bold text-white truncate">
                    {getPhotoState() === 'revealed' ? profile.display_name : (profile.display_name || "?").charAt(0)}
                    {profile.age && <span className="text-slate-400 ml-2">{profile.age}</span>}
                  </h1>
                </div>
                
                {/* Right: Icon group (gender, rainbow, open_to_all) */}
                <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
                  {/* Gender indicator */}
                  {profile.show_as && (
                    <div 
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-lg ${
                        profile.show_as === "male" 
                          ? "bg-blue-400/90 text-white" 
                          : "bg-pink-400/90 text-white"
                      }`}
                    >
                      {profile.show_as === "male" ? "M" : "F"}
                    </div>
                  )}
                  
                  {/* Rainbow indicator */}
                  {profile.rainbow && (
                    <div 
                      className="w-6 h-6 rounded-full flex items-center justify-center shadow-lg overflow-hidden"
                      style={{ 
                        background: 'linear-gradient(135deg, #ef4444 0%, #f97316 20%, #eab308 40%, #22c55e 60%, #3b82f6 80%, #8b5cf6 100%)'
                      }}
                    >
                      <div className="w-4 h-4 rounded-full bg-slate-900/50" />
                    </div>
                  )}
                  
                  {/* Open to all indicator */}
                  {profile.open_to_all && (
                    <div className="w-6 h-6 rounded-full flex items-center justify-center shadow-lg bg-amber-400/90">
                      <span className="text-xs">🤗</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Inner Scrollable Sections Container */}
              <div className="space-y-4">
                {/* Presence Note - ALWAYS visible, NEVER obscured */}
                {profile.presence_note && (
                  <div className="bg-slate-700/30 rounded-2xl p-4 border border-white/10">
                    <p className="text-white text-sm">{profile.presence_note}</p>
                  </div>
                )}
                
                {/* Glance Status Badge */}
                <div>
                  {profile.is_connection_accepted && (
                    <div className="inline-flex items-center gap-1 bg-pink-500/20 text-pink-400 px-3 py-1 rounded-full text-sm">
                      <Heart className="w-4 h-4" />
                      Mutual
                    </div>
                  )}
                  {profile.they_glanced_at_me && !profile.i_glanced_at_them && (
                    <div className="inline-flex items-center gap-1 bg-indigo-500/20 text-indigo-400 px-3 py-1 rounded-full text-sm">
                      <Eye className="w-4 h-4" />
                      Glanced at you
                    </div>
                  )}
                </div>

                {/* LIFESTYLE SECTION FRAME - Visible in ALL profile states */}
                {(profile.lifestyle_vibe || profile.lifestyle_travel || profile.lifestyle_going_out) && (
                  <div className="bg-purple-500/10 rounded-2xl p-4 border border-purple-500/15 shadow-sm">
                    <h3 className="text-xs font-medium text-purple-300/70 mb-3 uppercase tracking-wide">Lifestyle</h3>
                    <div className="space-y-2">
                      {profile.lifestyle_vibe && (
                        <div>
                          <p className="text-purple-300/70 text-xs">Lively or laid-back?</p>
                          <p className="text-purple-100 text-sm">{profile.lifestyle_vibe}</p>
                        </div>
                      )}
                      {profile.lifestyle_travel && (
                        <div>
                          <p className="text-purple-300/70 text-xs">Explorer or sunbed-snoozer?</p>
                          <p className="text-purple-100 text-sm">{profile.lifestyle_travel}</p>
                        </div>
                      )}
                      {profile.lifestyle_going_out && (
                        <div>
                          <p className="text-purple-300/70 text-xs">Going out or staying in?</p>
                          <p className="text-purple-100 text-sm">{profile.lifestyle_going_out}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* FOOD MOOD SECTION FRAME - Visible in ALL profile states */}
                {profile.food_mood && (
                  <div className="bg-purple-500/10 rounded-2xl p-4 border border-purple-500/15 shadow-sm">
                    <h3 className="text-xs font-medium text-purple-300/70 mb-2 uppercase tracking-wide">Food Mood</h3>
                    <div>
                      <p className="text-purple-300/70 text-xs">In the kitchen?</p>
                      <p className="text-purple-100 text-sm">{profile.food_mood}</p>
                    </div>
                  </div>
                )}

                {/* About You (Bio) - obscured until is_connection_accepted === true */}
                {profile.bio && (
                  <div className="bg-slate-800/40 rounded-2xl p-4 border border-white/10 shadow-sm">
                    <h3 className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">About You</h3>
                    <p className="text-slate-300 text-sm leading-relaxed">
                      {obscureBioText(profile.bio, profile.is_connection_accepted)}
                    </p>
                  </div>
                )}

                {/* Based in - Town, Country (shown on all profile states) */}
                {(profile.home_area || profile.home_country) && (
                  <div className="bg-slate-800/40 rounded-2xl p-4 border border-white/10 shadow-sm">
                    <h3 className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">Based in</h3>
                    <p className="text-slate-300 text-sm flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-teal-400" />
                      {profile.home_area && profile.home_country 
                        ? `${profile.home_area}, ${profile.home_country}` 
                        : profile.home_area || profile.home_country}
                    </p>
                  </div>
                )}

                {/* What are you here for - Intent (shown on all profile states) */}
                {profile.intent && (
                  <div className="bg-slate-800/40 rounded-2xl p-4 border border-white/10 shadow-sm">
                    <h3 className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">Here for</h3>
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                      profile.intent === "dating" ? "bg-pink-500/30 text-pink-300" :
                      profile.intent === "friends" ? "bg-emerald-500/30 text-emerald-300" :
                      "bg-purple-500/30 text-purple-300"
                    }`}>
                      {profile.intent === "dating" ? "Dating" : 
                       profile.intent === "friends" ? "Friends" : 
                       profile.intent === "open_to_both" ? "Open to both" : ""}
                    </span>
                  </div>
                )}

                {/* Profile Details Section Frame (gender, orientation, relationship, seeking) - Only shown after reveal */}
                {profile.is_revealed && (profile.gender || profile.orientation || profile.relationship_status || profile.seeking) && (
                  <div className="bg-slate-800/40 rounded-2xl p-4 border border-white/10 shadow-sm">
                    <h3 className="text-xs font-medium text-slate-400 mb-3 uppercase tracking-wide">About</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {profile.gender && (
                        <div className="bg-white/5 rounded-xl px-3 py-2">
                          <p className="text-slate-500 text-xs">Gender</p>
                          <p className="text-white text-sm capitalize">{profile.gender}</p>
                        </div>
                      )}
                      {profile.orientation && (
                        <div className="bg-white/5 rounded-xl px-3 py-2">
                          <p className="text-slate-500 text-xs">Orientation</p>
                          <p className="text-white text-sm capitalize">{profile.orientation}</p>
                        </div>
                      )}
                      {profile.relationship_status && (
                        <div className="bg-white/5 rounded-xl px-3 py-2">
                          <p className="text-slate-500 text-xs">Status</p>
                          <p className="text-white text-sm capitalize">{profile.relationship_status}</p>
                        </div>
                      )}
                      {profile.seeking && (
                        <div className="bg-white/5 rounded-xl px-3 py-2">
                          <p className="text-slate-500 text-xs">Looking for</p>
                          <p className="text-white text-sm capitalize">{profile.seeking}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Interests Section Frame - Only shown after reveal */}
                {profile.is_revealed && profile.interests && profile.interests.length > 0 && (
                  <div className="bg-slate-800/40 rounded-2xl p-4 border border-white/10 shadow-sm">
                    <h3 className="text-xs font-medium text-slate-400 mb-3 uppercase tracking-wide">Interests</h3>
                    <div className="flex flex-wrap gap-2">
                      {profile.interests.map((interest) => (
                        <span
                          key={interest}
                          className="bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full text-sm"
                        >
                          {interest}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Additional Photos Section Frame - Uses same 3-stage blur logic */}
                {profile.photos && profile.photos.filter((p, i) => i > 0 && p).length > 0 && (
                  <div className="bg-slate-800/40 rounded-2xl p-4 border border-white/10 shadow-sm">
                    <h3 className="text-xs font-medium text-slate-400 mb-3 uppercase tracking-wide">More Photos</h3>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {profile.photos.slice(1).filter(p => p).map((photo, index) => (
                        <div key={index} className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
                          <BlurredImage
                            src={photo}
                            alt={`Photo ${index + 2}`}
                            blurState={getPhotoState()}
                            isThumbnail={true}
                            fallbackInitial={profile.display_name?.charAt(0) || "?"}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons Section Frame */}
                <div className="bg-slate-800/30 rounded-2xl p-4 border border-white/10 shadow-sm space-y-3">
              
              {/* ================================================================
                  SINGLE CONDITION: is_connection_accepted
                  When TRUE  → Show mutual match UI (messaging unlocked)
                  When FALSE → Show pre-match prompts (glance/icebreaker/chat request)
                  ================================================================ */}
              
              {isMutualMatch ? (
                /* ============================================
                   MUTUAL MATCH UI (is_connection_accepted === true)
                   - Messaging UNLOCKED
                   - NO glance/icebreaker/chat request prompts
                   - NO "waiting" messages
                   ============================================ */
                <>
                  {/* Matched Banner */}
                  <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-xl p-4 mb-4">
                    <p className="text-emerald-300 text-center font-medium">
                      You're mutual. Start a conversation
                    </p>
                  </div>
                  
                  {/* Primary: Message Button - ALWAYS AVAILABLE when mutual */}
                  <Button
                    data-testid="message-btn"
                    onClick={() => navigate(`/chat/${userId}`)}
                    className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white h-12"
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Message
                  </Button>
                  
                  {/* Reveal Button (optional - for photo clarity) */}
                  {!profile.i_revealed && (
                    <Button
                      data-testid="reveal-btn"
                      onClick={handleRevealPhoto}
                      disabled={revealing}
                      className="w-full rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white h-12"
                    >
                      {revealing ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Eye className="w-4 h-4 mr-2" />
                      )}
                      Reveal My Photo
                    </Button>
                  )}
                  
                  {/* Add Friend */}
                  <div className="flex gap-2">
                    {profile.is_friend ? (
                      <Button
                        data-testid="friends-btn"
                        disabled
                        className="flex-1 rounded-xl bg-emerald-500/20 text-emerald-400 cursor-default h-12"
                      >
                        <Heart className="w-4 h-4 mr-2" />
                        Friends
                      </Button>
                    ) : profile.friend_request_sent ? (
                      <Button
                        data-testid="request-sent-btn"
                        disabled
                        className="flex-1 rounded-xl bg-amber-500/20 text-amber-400 cursor-default h-12"
                      >
                        <Heart className="w-4 h-4 mr-2" />
                        Requested
                      </Button>
                    ) : profile.friend_request_received ? (
                      <ConfirmHint
                        hint="Accept friend request?"
                        onConfirm={handleAcceptFriendRequest}
                        globalPendingRef={confirmHintRef}
                        className="flex-1"
                      >
                        <Button
                          data-testid="accept-friend-btn"
                          className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white h-12"
                        >
                          <Heart className="w-4 h-4 mr-2" />
                          Accept Friend
                        </Button>
                      </ConfirmHint>
                    ) : (
                      <Button
                        data-testid="add-friend-btn"
                        onClick={handleAddFriend}
                        disabled={addingFriend}
                        className="flex-1 rounded-xl bg-white/5 hover:bg-white/10 text-white h-12 border border-white/10"
                      >
                        {addingFriend ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <UserPlus className="w-4 h-4 mr-2" />
                        )}
                        Add Friend
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                /* ============================================
                   PRE-MATCH UI (is_connection_accepted === false)
                   - Messaging LOCKED
                   - Show glance/icebreaker/chat request prompts
                   ============================================ */
                <>
                  {/* Pre-match action buttons */}
                  <div className="flex gap-2 justify-start flex-wrap">
                    {/* Glance Button */}
                    {profile.i_glanced_at_them ? (
                      <Button
                        disabled
                        className="rounded-full bg-indigo-500/20 text-indigo-300 h-10 px-4 cursor-default inline-flex items-center gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        <span className="text-xs">Glanced</span>
                      </Button>
                    ) : (
                      <ConfirmHint
                        hint={profile.they_glanced_at_me ? "Glance back?" : "Send a glance?"}
                        onConfirm={handleGlance}
                        disabled={glancing}
                        globalPendingRef={confirmHintRef}
                        compact
                      >
                        <Button
                          data-testid={profile.they_glanced_at_me ? "glance-back-btn" : "glance-btn"}
                          disabled={glancing}
                          className="rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium hover:opacity-90 h-10 px-4 inline-flex items-center gap-2"
                        >
                          {glancing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Eye className="w-4 h-4" />
                              <span className="text-xs">{profile.they_glanced_at_me ? "Glance Back" : "Glance"}</span>
                            </>
                          )}
                        </Button>
                      </ConfirmHint>
                    )}

                    {/* Icebreaker Button */}
                    {profile.icebreaker_sent ? (
                      <Button
                        disabled
                        className="rounded-full bg-amber-500/20 text-amber-300 h-10 px-4 cursor-default inline-flex items-center gap-2"
                      >
                        <Snowflake className="w-4 h-4" />
                        <span className="text-xs">Sent</span>
                      </Button>
                    ) : (
                      <ConfirmHint
                        hint="Send an icebreaker?"
                        onConfirm={() => setShowIcebreakerModal(true)}
                        globalPendingRef={confirmHintRef}
                        compact
                      >
                        <Button
                          data-testid="icebreaker-btn"
                          className="rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium hover:opacity-90 h-10 px-4 inline-flex items-center gap-2"
                        >
                          <Snowflake className="w-4 h-4" />
                          <span className="text-xs">Icebreaker</span>
                        </Button>
                      </ConfirmHint>
                    )}

                    {/* Chat Request Button */}
                    {profile.chat_request_sent ? (
                      <Button
                        disabled
                        className="rounded-full bg-emerald-500/20 text-emerald-300 h-10 px-4 cursor-default inline-flex items-center gap-2"
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span className="text-xs">Requested</span>
                      </Button>
                    ) : (
                      <ConfirmHint
                        hint="Send a chat request?"
                        onConfirm={() => setShowChatRequestModal(true)}
                        globalPendingRef={confirmHintRef}
                        compact
                      >
                        <Button
                          data-testid="chat-request-btn"
                          className="rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium hover:opacity-90 h-10 px-4 inline-flex items-center gap-2"
                        >
                          <MessageSquare className="w-4 h-4" />
                          <span className="text-xs">Chat Request</span>
                        </Button>
                      </ConfirmHint>
                    )}
                  </div>

                  {/* Locked Message/Add Friend - Pre-match */}
                  <div className="flex gap-2">
                    <Button
                      data-testid="message-locked-btn"
                      disabled
                      className="flex-1 rounded-xl bg-slate-800/50 text-slate-500 cursor-not-allowed h-12"
                    >
                      <Lock className="w-3 h-3 mr-1" />
                      <MessageCircle className="w-4 h-4 mr-1" />
                      Message
                    </Button>
                    
                    <Button
                      data-testid="add-friend-locked-btn"
                      disabled
                      className="flex-1 rounded-xl bg-slate-800/50 text-slate-500 cursor-not-allowed h-12"
                    >
                      <Lock className="w-3 h-3 mr-1" />
                      <UserPlus className="w-4 h-4 mr-1" />
                      Add Friend
                    </Button>
                  </div>
                  
                  {/* Info text */}
                  <p className="text-center text-slate-500 text-xs px-4">
                    Send a glance, icebreaker, or chat request to connect. Messaging unlocks when they respond.
                  </p>
                </>
              )}
            
            {/* Block User Button - Always available */}
            <div className="mt-6 pt-4 border-t border-white/10">
              <Button
                data-testid="block-user-btn"
                onClick={() => setShowBlockModal(true)}
                variant="ghost"
                className="w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                <ShieldOff className="w-4 h-4 mr-2" />
                Block User
              </Button>
              <p className="text-center text-slate-600 text-xs mt-2">
                Blocking removes all visibility and messaging between you.
              </p>
            </div>
                </div>{/* End Action Buttons Section Frame */}
              </div>{/* End Inner Scrollable Sections Container */}
            </div>{/* End Profile Info */}
          </div>{/* End Profile Card */}
        </div>{/* End Scrollable Content */}
      </div>{/* End user-profile-page */}

      {/* Block Confirmation Modal */}
      <AlertDialog open={showBlockModal} onOpenChange={setShowBlockModal}>
        <AlertDialogContent className="bg-slate-900 border border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              Block {profile?.display_name || 'this user'}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              This will:
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li>Remove them from your discovery, matches, and chats</li>
                <li>Prevent future messaging and visibility between you</li>
                <li>Clear all notifications and chat history</li>
              </ul>
              <p className="mt-3 text-xs text-slate-500">
                You can unblock them later from Settings → Safety → Blocked Users.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 text-white hover:bg-slate-700 border-0">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBlockUser}
              disabled={blocking}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {blocking ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <ShieldOff className="w-4 h-4 mr-2" />
              )}
              Block
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* No Glances Remaining Prompt */}
      {showUpgradePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="glass rounded-3xl p-6 max-w-sm w-full relative">
            <button
              onClick={() => setShowUpgradePrompt(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
                <Eye className="w-8 h-8 text-amber-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">No Glances Left</h3>
              <p className="text-slate-400 text-sm">
                You're all out of glances for today. Come back after 5am, or go Premium if you fancy a bit more freedom.
              </p>
            </div>

            <div className="space-y-3">
              <Button
                data-testid="upgrade-premium-btn"
                onClick={() => {
                  setShowUpgradePrompt(false);
                  navigate("/premium");
                }}
                className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-pink-500 text-white font-semibold h-12"
              >
                <Crown className="w-4 h-4 mr-2" />
                Go Premium
                <span className="ml-2 text-xs opacity-80">15 glances/day</span>
              </Button>
              
              <Button
                data-testid="buy-tokens-btn"
                onClick={() => {
                  setShowUpgradePrompt(false);
                  navigate("/tokens");
                }}
                variant="outline"
                className="w-full rounded-xl h-12"
              >
                <Coins className="w-4 h-4 mr-2" />
                Buy Glance Tokens
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Icebreaker Modal - Preset Options Only */}
      {showIcebreakerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="glass rounded-3xl p-6 max-w-sm w-full relative">
            <button
              onClick={() => {
                setShowIcebreakerModal(false);
                setSelectedIcebreaker(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="text-center mb-4">
              <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center mx-auto mb-3">
                <Snowflake className="w-6 h-6 text-cyan-400" />
              </div>
              <h3 className="text-lg font-bold text-white">Send Icebreaker</h3>
              <p className="text-slate-400 text-sm mt-1">
                Choose a message to send to {profile.is_revealed ? profile.display_name : (profile.display_name || "?").charAt(0)}
              </p>
            </div>

            {/* Preset Icebreaker Options */}
            <div className="space-y-2 mb-4">
              {ICEBREAKER_MESSAGES.map((msg) => (
                <button
                  key={msg.id}
                  data-testid={`icebreaker-option-${msg.id}`}
                  onClick={() => setSelectedIcebreaker(msg.id)}
                  className={`w-full p-3 rounded-xl text-left transition-all flex items-center gap-3 ${
                    selectedIcebreaker === msg.id
                      ? "bg-cyan-500/20 border-2 border-cyan-400"
                      : "bg-slate-800/50 border-2 border-transparent hover:border-slate-600"
                  }`}
                >
                  <span className="text-xl">{msg.icon}</span>
                  <span className="text-white font-medium">{msg.name}</span>
                </button>
              ))}
            </div>
            
            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setShowIcebreakerModal(false);
                  setSelectedIcebreaker(null);
                }}
                variant="outline"
                className="flex-1 rounded-xl"
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleSendIcebreaker(selectedIcebreaker)}
                disabled={sendingIcebreaker || selectedIcebreaker === null}
                className="flex-1 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white"
              >
                {sendingIcebreaker ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Snowflake className="w-4 h-4 mr-2" />
                )}
                Send
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Request Confirmation Modal */}
      {showChatRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="glass rounded-3xl p-6 max-w-sm w-full relative">
            <button
              onClick={() => setShowChatRequestModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                <MessageSquare className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold text-white">Send Chat Request</h3>
              <p className="text-slate-400 text-sm mt-2">
                Send a request to chat with {profile.is_revealed ? profile.display_name : (profile.display_name || "?").charAt(0)}?
              </p>
              <p className="text-slate-500 text-xs mt-2">
                They will be notified and can accept or decline.
              </p>
            </div>
            
            <div className="flex gap-3">
              <Button
                onClick={() => setShowChatRequestModal(false)}
                variant="outline"
                className="flex-1 rounded-xl"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSendChatRequest}
                disabled={sendingChatRequest}
                className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white"
              >
                {sendingChatRequest ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <MessageSquare className="w-4 h-4 mr-2" />
                )}
                Send
              </Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default UserProfile;
