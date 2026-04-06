import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth, API } from "@/App";
import { toast } from "sonner";
import axios from "axios";
import Layout from "../components/Layout";
import PageHeader from "../components/PageHeader";
import { Eye, MessageCircle, Loader2, Heart, Crown, Coins, X, UserPlus, Snowflake, MessageSquare, Lock, ShieldOff, AlertTriangle } from "lucide-react";
import { getErrorMessage } from "../utils/errorUtils";
import BlurredImage from "../components/BlurredImage";
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

  useEffect(() => {
    fetchProfile();
  }, [userId]);

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

  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  const handleGlance = async () => {
    setGlancing(true);
    try {
      // We need a venue_id for glancing - use a generic one for now
      const response = await axios.post(`${API}/glance`, {
        to_user_id: userId,
        venue_id: "profile_view"
      });
      
      toast.success(response.data.is_mutual ? "It's a match!" : "Glance sent!");
      
      // Refresh profile to update glance status
      await fetchProfile();
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
      await fetchProfile();
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
        await fetchProfile();
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
      await axios.post(`${API}/icebreaker`, {
        to_user_id: userId,
        message_type: messageType,
        venue_id: "profile_view"
      });
      toast.success("Icebreaker sent!");
      setShowIcebreakerModal(false);
      setSelectedIcebreaker(null);
      await fetchProfile();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to send icebreaker"));
    } finally {
      setSendingIcebreaker(false);
    }
  };

  const handleSendChatRequest = async () => {
    setSendingChatRequest(true);
    try {
      await axios.post(`${API}/chat-request`, {
        to_user_id: userId,
        venue_id: "profile_view",
        request_type: "chat"
      });
      toast.success("Chat request sent!");
      setShowChatRequestModal(false);
      await fetchProfile();
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
      <div className="max-w-2xl mx-auto px-4 py-6 pb-32" data-testid="user-profile-page">
        {/* Page Header with Back Button */}
        <PageHeader title="Profile" />

        {/* Profile Card */}
        <div className="glass rounded-3xl overflow-hidden">
          {/* Main Photo - dynamic blur based on image characteristics */}
          <div className="aspect-square w-full max-h-96 overflow-hidden">
            <BlurredImage
              src={mainPhoto}
              alt={profile.display_name}
              isRevealed={profile.is_revealed}
              isThumbnail={false}
              fallbackInitial={profile.display_name?.charAt(0) || "?"}
            />
          </div>

          {/* Profile Info */}
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {profile.is_revealed ? profile.display_name : (profile.display_name || "?").charAt(0)}
                  {profile.age && <span className="text-slate-400 ml-2">{profile.age}</span>}
                </h1>
                {profile.is_revealed && profile.bio && (
                  <p className="text-slate-400 mt-1">{profile.bio}</p>
                )}
              </div>
              
              {/* Glance Status Badge */}
              {profile.is_mutual && (
                <div className="flex items-center gap-1 bg-pink-500/20 text-pink-400 px-3 py-1 rounded-full text-sm">
                  <Heart className="w-4 h-4" />
                  Mutual
                </div>
              )}
              {profile.they_glanced_at_me && !profile.i_glanced_at_them && (
                <div className="flex items-center gap-1 bg-indigo-500/20 text-indigo-400 px-3 py-1 rounded-full text-sm">
                  <Eye className="w-4 h-4" />
                  Glanced at you
                </div>
              )}
            </div>

            {/* Profile Details (gender, orientation, relationship, seeking) - Only shown after reveal */}
            {profile.is_revealed && (profile.gender || profile.orientation || profile.relationship_status || profile.seeking) && (
              <div className="grid grid-cols-2 gap-3 mb-6">
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
            )}

            {/* Interests - Only shown after reveal */}
            {profile.is_revealed && profile.interests && profile.interests.length > 0 && (
              <div className="mb-6">
                <p className="text-slate-500 text-xs mb-2">Interests</p>
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

            {/* Additional Photos - Only shown after reveal, otherwise blurred */}
            {profile.photos && profile.photos.filter((p, i) => i > 0 && p).length > 0 && (
              <div className="mb-6">
                <p className="text-slate-500 text-xs mb-2">More Photos</p>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {profile.photos.slice(1).filter(p => p).map((photo, index) => (
                    <div key={index} className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
                      <BlurredImage
                        src={photo}
                        alt={`Photo ${index + 2}`}
                        isRevealed={profile.is_revealed}
                        isThumbnail={true}
                        fallbackInitial={profile.display_name?.charAt(0) || "?"}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3">
              {/* Primary Actions - Always Available Pre-Reveal */}
              <div className="grid grid-cols-3 gap-2">
                {/* Glance Button */}
                {profile.can_glance_back ? (
                  <Button
                    data-testid="glance-back-btn"
                    onClick={handleGlance}
                    disabled={glancing}
                    className="rounded-xl bg-gradient-to-r from-pink-500 to-indigo-500 text-white font-medium hover:opacity-90 h-12"
                  >
                    {glancing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Eye className="w-4 h-4 mr-1" />
                        <span className="text-xs">Glance Back</span>
                      </>
                    )}
                  </Button>
                ) : !profile.i_glanced_at_them ? (
                  <Button
                    data-testid="glance-btn"
                    onClick={handleGlance}
                    disabled={glancing}
                    className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium hover:opacity-90 h-12"
                  >
                    {glancing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Eye className="w-4 h-4 mr-1" />
                        <span className="text-xs">Glance</span>
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    disabled
                    className="rounded-xl bg-indigo-500/20 text-indigo-300 h-12 cursor-default"
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    <span className="text-xs">Glanced</span>
                  </Button>
                )}

                {/* Icebreaker Button */}
                {profile.icebreaker_sent ? (
                  <Button
                    disabled
                    className="rounded-xl bg-amber-500/20 text-amber-300 h-12 cursor-default"
                  >
                    <Snowflake className="w-4 h-4 mr-1" />
                    <span className="text-xs">Sent</span>
                  </Button>
                ) : (
                  <Button
                    data-testid="icebreaker-btn"
                    onClick={() => setShowIcebreakerModal(true)}
                    className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium hover:opacity-90 h-12"
                  >
                    <Snowflake className="w-4 h-4 mr-1" />
                    <span className="text-xs">Icebreaker</span>
                  </Button>
                )}

                {/* Chat Request Button */}
                {profile.chat_request_sent ? (
                  <Button
                    disabled
                    className="rounded-xl bg-emerald-500/20 text-emerald-300 h-12 cursor-default"
                  >
                    <MessageSquare className="w-4 h-4 mr-1" />
                    <span className="text-xs">Requested</span>
                  </Button>
                ) : (
                  <Button
                    data-testid="chat-request-btn"
                    onClick={() => setShowChatRequestModal(true)}
                    className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium hover:opacity-90 h-12"
                  >
                    <MessageSquare className="w-4 h-4 mr-1" />
                    <span className="text-xs">Chat Request</span>
                  </Button>
                )}
              </div>

              {/* Locked Actions - Unlock after icebreaker/chat accepted */}
              <div className="flex gap-2">
                {/* Message Button */}
                {profile.can_message ? (
                  <Button
                    data-testid="message-btn"
                    onClick={() => navigate(`/chat/${userId}`)}
                    className="flex-1 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white h-12"
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Message
                  </Button>
                ) : (
                  <Button
                    data-testid="message-locked-btn"
                    disabled
                    className="flex-1 rounded-xl bg-slate-800/50 text-slate-500 cursor-not-allowed h-12"
                  >
                    <Lock className="w-3 h-3 mr-1" />
                    <MessageCircle className="w-4 h-4 mr-1" />
                    Message
                  </Button>
                )}
                
                {/* Add Friend Button */}
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
                  <Button
                    data-testid="accept-friend-btn"
                    onClick={handleAcceptFriendRequest}
                    className="flex-1 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white h-12"
                  >
                    <Heart className="w-4 h-4 mr-2" />
                    Accept
                  </Button>
                ) : profile.can_add_friend ? (
                  <Button
                    data-testid="add-friend-btn"
                    onClick={handleAddFriend}
                    disabled={addingFriend}
                    className="flex-1 rounded-xl bg-pink-500 hover:bg-pink-600 text-white h-12"
                  >
                    {addingFriend ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <UserPlus className="w-4 h-4 mr-2" />
                    )}
                    Add Friend
                  </Button>
                ) : (
                  <Button
                    data-testid="add-friend-locked-btn"
                    disabled
                    className="flex-1 rounded-xl bg-slate-800/50 text-slate-500 cursor-not-allowed h-12"
                  >
                    <Lock className="w-3 h-3 mr-1" />
                    <UserPlus className="w-4 h-4 mr-1" />
                    Add Friend
                  </Button>
                )}
              </div>
              
              {/* Locked Features Info */}
              {(!profile.can_message || !profile.can_add_friend) && !profile.is_friend && (
                <p className="text-center text-slate-500 text-xs px-4">
                  {!profile.is_revealed 
                    ? "Reveal via mutual glance or responded icebreaker to unlock messaging."
                    : "Unlocks after an icebreaker or chat request is accepted."
                  }
                </p>
              )}
            </div>

            {profile.i_glanced_at_them && !profile.is_mutual && (
              <p className="text-center text-slate-500 text-sm mt-4">
                You've glanced at {profile.display_name}. Waiting for them to glance back...
              </p>
            )}
            
            {/* Block User Button - Available both pre-reveal and post-reveal */}
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
          </div>
        </div>
      </div>

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
                You've used all your daily glances. Get more to keep connecting!
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
                Upgrade to Premium
                <span className="ml-2 text-xs opacity-80">20 glances/day</span>
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
