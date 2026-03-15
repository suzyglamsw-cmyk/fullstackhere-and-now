import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth, API } from "@/App";
import { toast } from "sonner";
import axios from "axios";
import Layout from "../components/Layout";
import { Eye, MessageCircle, Loader2, ArrowLeft, Heart, Wine, Crown, Coins, X, UserPlus } from "lucide-react";

const UserProfile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [glancing, setGlancing] = useState(false);
  const [addingFriend, setAddingFriend] = useState(false);

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
        toast.error(error.response?.data?.detail || "Failed to send glance");
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

  const mainPhoto = profile.avatar_url || (profile.photos && profile.photos[0]) || null;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6 pb-32" data-testid="user-profile-page">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors"
          data-testid="back-btn"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        {/* Profile Card */}
        <div className="glass rounded-3xl overflow-hidden">
          {/* Main Photo - blurred if not revealed */}
          {mainPhoto ? (
            <div className="aspect-square w-full max-h-96 overflow-hidden">
              <img
                src={mainPhoto}
                alt={profile.display_name}
                className={`w-full h-full object-cover transition-all duration-300 ${
                  profile.is_revealed ? "" : "blur-[4px]"
                }`}
              />
            </div>
          ) : (
            <div className="aspect-square w-full max-h-96 bg-slate-800 flex items-center justify-center">
              <span className="text-6xl text-slate-600">
                {profile.display_name?.charAt(0) || "?"}
              </span>
            </div>
          )}

          {/* Profile Info */}
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {profile.display_name}
                  {profile.age && <span className="text-slate-400 ml-2">{profile.age}</span>}
                </h1>
                {profile.bio && (
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

            {/* Profile Details (gender, orientation, relationship, seeking) */}
            {(profile.gender || profile.orientation || profile.relationship_status || profile.seeking) && (
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

            {/* Interests */}
            {profile.interests && profile.interests.length > 0 && (
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

            {/* Additional Photos */}
            {profile.photos && profile.photos.filter((p, i) => i > 0 && p).length > 0 && (
              <div className="mb-6">
                <p className="text-slate-500 text-xs mb-2">More Photos</p>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {profile.photos.slice(1).filter(p => p).map((photo, index) => (
                    <div key={index} className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
                      <img
                        src={photo}
                        alt={`Photo ${index + 2}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-4">
              {/* Glance Buttons */}
              <div className="flex gap-3">
                {profile.can_glance_back ? (
                  <Button
                    data-testid="glance-back-btn"
                    onClick={handleGlance}
                    disabled={glancing}
                    className="flex-1 rounded-xl bg-gradient-to-r from-pink-500 to-indigo-500 text-white font-semibold hover:opacity-90"
                  >
                    {glancing ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Eye className="w-4 h-4 mr-2" />
                    )}
                    Glance Back
                  </Button>
                ) : !profile.i_glanced_at_them ? (
                  <Button
                    data-testid="glance-btn"
                    onClick={handleGlance}
                    disabled={glancing}
                    className="flex-1 rounded-xl bg-gradient-to-r from-indigo-500 to-pink-500 text-white font-semibold hover:opacity-90"
                  >
                    {glancing ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Eye className="w-4 h-4 mr-2" />
                    )}
                    Glance
                  </Button>
                ) : null}
              </div>
              
              {/* Message & Add Friend Buttons */}
              <div className="flex gap-3">
                {profile.can_message ? (
                  <Button
                    data-testid="message-btn"
                    onClick={() => navigate(`/chat/${userId}`)}
                    className="flex-1 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white"
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Message
                  </Button>
                ) : (
                  <Button
                    data-testid="message-locked-btn"
                    disabled
                    className="flex-1 rounded-xl bg-slate-700/50 text-slate-500 cursor-not-allowed"
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Message
                  </Button>
                )}
                
                {profile.is_friend ? (
                  <Button
                    data-testid="friends-btn"
                    disabled
                    className="flex-1 rounded-xl bg-emerald-500/20 text-emerald-400 cursor-default"
                  >
                    <Heart className="w-4 h-4 mr-2" />
                    Friends
                  </Button>
                ) : profile.friend_request_sent ? (
                  <Button
                    data-testid="request-sent-btn"
                    disabled
                    className="flex-1 rounded-xl bg-amber-500/20 text-amber-400 cursor-default"
                  >
                    <Heart className="w-4 h-4 mr-2" />
                    Request Sent
                  </Button>
                ) : profile.friend_request_received ? (
                  <Button
                    data-testid="accept-friend-btn"
                    onClick={handleAcceptFriendRequest}
                    className="flex-1 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white"
                  >
                    <Heart className="w-4 h-4 mr-2" />
                    Accept Request
                  </Button>
                ) : profile.can_add_friend ? (
                  <Button
                    data-testid="add-friend-btn"
                    onClick={handleAddFriend}
                    disabled={addingFriend}
                    className="flex-1 rounded-xl bg-pink-500 hover:bg-pink-600 text-white"
                  >
                    {addingFriend ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Heart className="w-4 h-4 mr-2" />
                    )}
                    {addingFriend ? "Sending..." : "Send Friend Request"}
                  </Button>
                ) : (
                  <Button
                    data-testid="add-friend-locked-btn"
                    disabled
                    className="flex-1 rounded-xl bg-slate-700/50 text-slate-500 cursor-not-allowed"
                  >
                    <Heart className="w-4 h-4 mr-2" />
                    Add Friend
                  </Button>
                )}
              </div>
              
              {/* Locked Features Info */}
              {!profile.can_message && !profile.can_add_friend && (
                <p className="text-center text-slate-500 text-xs">
                  Messaging and adding friends unlock after an icebreaker or chat request is accepted.
                </p>
              )}
            </div>

            {profile.i_glanced_at_them && !profile.is_mutual && (
              <p className="text-center text-slate-500 text-sm mt-4">
                You've glanced at {profile.display_name}. Waiting for them to glance back...
              </p>
            )}
          </div>
        </div>
      </div>

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
    </Layout>
  );
};

export default UserProfile;
