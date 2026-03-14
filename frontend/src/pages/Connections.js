import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth, API } from "@/App";
import { toast } from "sonner";
import axios from "axios";
import Layout from "../components/Layout";
import { MessageCircle, MapPin, Loader2, Users, Sparkles, Eye, Heart, Wine } from "lucide-react";

const Connections = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [connections, setConnections] = useState([]);
  const [mutualGlances, setMutualGlances] = useState([]);
  const [messageThreads, setMessageThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("messages"); // "messages" | "mutual" | "connections"

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      const [connectionsRes, mutualRes, threadsRes] = await Promise.all([
        axios.get(`${API}/connections`),
        axios.get(`${API}/connections/mutual-glances`),
        axios.get(`${API}/messages/threads`)
      ]);
      setConnections(connectionsRes.data);
      setMutualGlances(mutualRes.data);
      setMessageThreads(threadsRes.data);
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

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-6 pb-32" data-testid="connections-page">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Connections</h1>
          <p className="text-slate-400">Your matches and conversations</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <Button
            data-testid="messages-tab"
            variant={tab === "messages" ? "default" : "ghost"}
            onClick={() => setTab("messages")}
            className={`rounded-xl ${tab === "messages" ? "bg-white/10" : "text-slate-400"}`}
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
            data-testid="mutual-tab"
            variant={tab === "mutual" ? "default" : "ghost"}
            onClick={() => setTab("mutual")}
            className={`rounded-xl ${tab === "mutual" ? "bg-white/10" : "text-slate-400"}`}
          >
            <Heart className="w-4 h-4 mr-2" />
            Mutual
            {mutualGlances.length > 0 && (
              <span className="ml-2 text-xs bg-indigo-500 px-2 py-0.5 rounded-full">
                {mutualGlances.length}
              </span>
            )}
          </Button>
          <Button
            data-testid="connections-tab"
            variant={tab === "connections" ? "default" : "ghost"}
            onClick={() => setTab("connections")}
            className={`rounded-xl ${tab === "connections" ? "bg-white/10" : "text-slate-400"}`}
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
        ) : tab === "mutual" ? (
          /* Mutual Glances Tab */
          mutualGlances.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <Heart className="w-10 h-10 text-slate-600" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">No mutual glances yet</h2>
              <p className="text-slate-400 mb-6">
                When you and someone else both glance at each other, they'll appear here
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
            <div className="space-y-3" data-testid="mutual-glances-list">
              {mutualGlances.map((glance) => (
                <div
                  key={glance.user_id}
                  data-testid={`mutual-glance-${glance.user_id}`}
                  onClick={() => navigate(`/profile/${glance.user_id}`)}
                  className="glass rounded-2xl p-4 flex items-center gap-4 hover:bg-white/5 transition-colors cursor-pointer"
                >
                  {/* Avatar - tappable to profile */}
                  <div className="relative">
                    <div className="w-14 h-14 rounded-2xl overflow-hidden hover:ring-2 hover:ring-pink-500 transition-all">
                      <img
                        src={glance.avatar_url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200"}
                        alt={glance.display_name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-pink-500 flex items-center justify-center">
                      <Heart className="w-3 h-3 text-white" />
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white truncate">{glance.display_name}</h3>
                    {glance.bio && (
                      <p className="text-slate-400 text-sm truncate">{glance.bio}</p>
                    )}
                    <p className="text-slate-500 text-xs mt-1">
                      Mutual glance • {formatDate(glance.glanced_at)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      data-testid={`view-profile-${glance.user_id}`}
                      onClick={() => navigate(`/profile/${glance.user_id}`)}
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                    <Button
                      data-testid={`chat-btn-${glance.user_id}`}
                      onClick={() => navigate(`/chat/${glance.user_id}`)}
                      size="sm"
                      className="rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white"
                    >
                      <MessageCircle className="w-4 h-4 mr-1" />
                      Chat
                    </Button>
                  </div>
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
    </Layout>
  );
};

export default Connections;
