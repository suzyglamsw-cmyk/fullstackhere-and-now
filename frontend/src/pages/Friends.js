import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth, API } from "@/App";
import { toast } from "sonner";
import axios from "axios";
import Layout from "../components/Layout";
import PageHeader from "../components/PageHeader";
import { Users, UserPlus, UserMinus, MessageCircle, Loader2, Check, X } from "lucide-react";

const Friends = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("friends"); // "friends" | "requests"
  const [processing, setProcessing] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [friendsRes, requestsRes] = await Promise.all([
        axios.get(`${API}/friends`),
        axios.get(`${API}/friends/requests`)
      ]);
      setFriends(friendsRes.data);
      setRequests(requestsRes.data);
    } catch (error) {
      toast.error("Failed to load friends");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFriend = async (userId) => {
    setProcessing(userId);
    try {
      await axios.delete(`${API}/friends/${userId}`);
      setFriends(friends.filter(f => f.user_id !== userId));
      toast.success("Friend removed");
    } catch (error) {
      toast.error("Failed to remove friend");
    } finally {
      setProcessing(null);
    }
  };

  const handleRespondToRequest = async (friendId, accept) => {
    setProcessing(friendId);
    try {
      await axios.post(`${API}/friends/respond/${friendId}?accept=${accept}`);
      setRequests(requests.filter(r => r.friend_id !== friendId));
      if (accept) {
        toast.success("Friend added!");
        fetchData(); // Refresh to get the new friend
      } else {
        toast.success("Request declined");
      }
    } catch (error) {
      toast.error("Failed to respond to request");
    } finally {
      setProcessing(null);
    }
  };

  const handleStartChat = (userId) => {
    navigate(`/chat/${userId}`);
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6 pb-32" data-testid="friends-page">
        {/* Page Header with Back Button */}
        <PageHeader 
          title="Friends" 
          subtitle={`${friends.length} friend${friends.length !== 1 ? 's' : ''}`}
          backTo="/connections" 
        />

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <Button
            data-testid="tab-friends"
            variant={tab === "friends" ? "default" : "ghost"}
            onClick={() => setTab("friends")}
            className={`rounded-xl ${tab === "friends" ? "bg-white/10" : "text-slate-400"}`}
          >
            Friends
            {friends.length > 0 && (
              <span className="ml-2 text-xs bg-white/20 px-2 py-0.5 rounded-full">{friends.length}</span>
            )}
          </Button>
          <Button
            data-testid="tab-requests"
            variant={tab === "requests" ? "default" : "ghost"}
            onClick={() => setTab("requests")}
            className={`rounded-xl ${tab === "requests" ? "bg-white/10" : "text-slate-400"}`}
          >
            Requests
            {requests.length > 0 && (
              <span className="ml-2 text-xs bg-pink-500 px-2 py-0.5 rounded-full">{requests.length}</span>
            )}
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        ) : tab === "friends" ? (
          <div className="space-y-3" data-testid="friends-list">
            {friends.length === 0 ? (
              <div className="glass rounded-2xl p-8 text-center">
                <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">No friends yet</p>
                <p className="text-slate-500 text-sm mt-2">
                  Connect with people at venues to add friends
                </p>
              </div>
            ) : (
              friends.map((friend) => (
                <div
                  key={friend.user_id}
                  data-testid={`friend-${friend.user_id}`}
                  className="glass rounded-2xl p-4 flex items-center gap-4"
                >
                  {/* Avatar */}
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {friend.avatar_url ? (
                      <img src={friend.avatar_url} alt={friend.display_name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xl font-bold text-white">
                        {friend.display_name?.charAt(0) || "?"}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white truncate">{friend.display_name}</h3>
                    <p className="text-slate-400 text-sm">
                      Added {new Date(friend.added_at).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      data-testid={`chat-${friend.user_id}`}
                      size="icon"
                      onClick={() => handleStartChat(friend.user_id)}
                      className="rounded-xl bg-indigo-500 hover:bg-indigo-600"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </Button>
                    <Button
                      data-testid={`remove-${friend.user_id}`}
                      size="icon"
                      variant="ghost"
                      onClick={() => handleRemoveFriend(friend.user_id)}
                      disabled={processing === friend.user_id}
                      className="rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                    >
                      {processing === friend.user_id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <UserMinus className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-3" data-testid="requests-list">
            {requests.length === 0 ? (
              <div className="glass rounded-2xl p-8 text-center">
                <UserPlus className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">No pending requests</p>
              </div>
            ) : (
              requests.map((request) => (
                <div
                  key={request.friend_id}
                  data-testid={`request-${request.friend_id}`}
                  className="glass rounded-2xl p-4 flex items-center gap-4"
                >
                  {/* Avatar */}
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-pink-500 to-orange-500 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {request.avatar_url ? (
                      <img src={request.avatar_url} alt={request.display_name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xl font-bold text-white">
                        {request.display_name?.charAt(0) || "?"}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white truncate">{request.display_name}</h3>
                    <p className="text-slate-400 text-sm">Wants to be friends</p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      data-testid={`accept-${request.friend_id}`}
                      size="icon"
                      onClick={() => handleRespondToRequest(request.friend_id, true)}
                      disabled={processing === request.friend_id}
                      className="rounded-xl bg-emerald-500 hover:bg-emerald-600"
                    >
                      {processing === request.friend_id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      data-testid={`decline-${request.friend_id}`}
                      size="icon"
                      variant="ghost"
                      onClick={() => handleRespondToRequest(request.friend_id, false)}
                      disabled={processing === request.friend_id}
                      className="rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Friends;
