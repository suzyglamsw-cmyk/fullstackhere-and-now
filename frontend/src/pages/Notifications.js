import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth, API } from "@/App";
import { toast } from "sonner";
import axios from "axios";
import Layout from "../components/Layout";
import { 
  Eye, Wine, Sparkles, Bell, Loader2, Check, X, 
  MessageCircle, ChevronRight 
} from "lucide-react";

const Notifications = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [chatRequests, setChatRequests] = useState([]);
  const [declineMessages, setDeclineMessages] = useState([]);
  const [acceptMessages, setAcceptMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(null);
  const [tab, setTab] = useState("notifications"); // "notifications" | "requests"
  const [showDeclineOptions, setShowDeclineOptions] = useState(null);
  const [showAcceptOptions, setShowAcceptOptions] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [notifRes, requestsRes, declineRes, acceptRes] = await Promise.all([
        axios.get(`${API}/notifications`),
        axios.get(`${API}/chat-requests/inbox`),
        axios.get(`${API}/chat-requests/decline-messages`),
        axios.get(`${API}/chat-requests/accept-messages`)
      ]);
      setNotifications(notifRes.data);
      setChatRequests(requestsRes.data);
      setDeclineMessages(declineRes.data);
      setAcceptMessages(acceptRes.data);
    } catch (error) {
      toast.error("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  const handleRespondToRequest = async (requestId, accept, message = null) => {
    setResponding(requestId);
    try {
      await axios.post(`${API}/chat-request/${requestId}/respond`, {
        request_id: requestId,
        accept,
        message
      });
      if (accept) {
        toast.success("Accepted! Chat unlocked.");
      } else {
        toast.success("Declined.");
      }
      setChatRequests(chatRequests.filter(r => r.id !== requestId));
      setShowDeclineOptions(null);
      setShowAcceptOptions(null);
    } catch (error) {
      toast.error("Failed to respond");
    } finally {
      setResponding(null);
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case "mutual_glance":
        return <Sparkles className="w-5 h-5 text-emerald-400" />;
      case "glance":
        return <Eye className="w-5 h-5 text-pink-400" />;
      case "drink_token":
        return <Wine className="w-5 h-5 text-amber-400" />;
      default:
        return <Bell className="w-5 h-5 text-slate-400" />;
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6 pb-32" data-testid="notifications-page">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Notifications</h1>
          <p className="text-slate-400">Recent activity</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <Button
            data-testid="tab-notifications"
            variant={tab === "notifications" ? "default" : "ghost"}
            onClick={() => setTab("notifications")}
            className={`rounded-xl ${tab === "notifications" ? "bg-white/10" : "text-slate-400"}`}
          >
            Activity
            {notifications.length > 0 && (
              <span className="ml-2 text-xs bg-white/20 px-2 py-0.5 rounded-full">
                {notifications.length}
              </span>
            )}
          </Button>
          <Button
            data-testid="tab-requests"
            variant={tab === "requests" ? "default" : "ghost"}
            onClick={() => setTab("requests")}
            className={`rounded-xl ${tab === "requests" ? "bg-white/10" : "text-slate-400"}`}
          >
            Requests
            {chatRequests.length > 0 && (
              <span className="ml-2 text-xs bg-pink-500 px-2 py-0.5 rounded-full">
                {chatRequests.length}
              </span>
            )}
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        ) : tab === "notifications" ? (
          /* Notifications Tab */
          notifications.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <Bell className="w-10 h-10 text-slate-600" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">No notifications yet</h2>
              <p className="text-slate-400">
                Check in to a venue to start receiving notifications
              </p>
            </div>
          ) : (
            <div className="space-y-3" data-testid="notifications-list">
              {notifications.map((notification, index) => (
                <div
                  key={index}
                  data-testid={`notification-${index}`}
                  className="glass rounded-2xl p-4 flex items-start gap-4"
                >
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                    {getNotificationIcon(notification.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {notification.type === "mutual_glance" && (
                      <>
                        <p className="text-white font-medium">
                          You matched with {notification.user?.display_name || notification.from_user?.display_name}!
                        </p>
                        <p className="text-slate-400 text-sm mt-1">
                          You can now chat with them
                        </p>
                        <div className="mt-2 flex gap-2">
                          <Button
                            data-testid={`view-profile-${notification.user?.id || notification.from_user?.id}`}
                            onClick={() => navigate(`/profile/${notification.user?.id || notification.from_user?.id}`)}
                            size="sm"
                            variant="outline"
                            className="rounded-full text-xs"
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            View
                          </Button>
                          <Button
                            data-testid={`chat-btn-${notification.user?.id || notification.from_user?.id}`}
                            onClick={() => navigate(`/chat/${notification.user?.id || notification.from_user?.id}`)}
                            size="sm"
                            className="rounded-full bg-indigo-500 hover:bg-indigo-600 text-white text-xs"
                          >
                            <MessageCircle className="w-3 h-3 mr-1" />
                            Chat
                          </Button>
                        </div>
                      </>
                    )}
                    {notification.type === "glance" && (
                      <>
                        <p className="text-white font-medium">
                          {notification.from_user?.display_name || notification.from_user_name || "Someone"} glanced at you
                        </p>
                        <div className="mt-2">
                          <Button
                            data-testid={`view-profile-${notification.from_user?.id || notification.from_user_id}`}
                            onClick={() => {
                              const userId = notification.from_user?.id || notification.from_user_id;
                              if (userId) navigate(`/profile/${userId}`);
                            }}
                            size="sm"
                            variant="outline"
                            className="rounded-full text-xs"
                            disabled={!notification.from_user?.id && !notification.from_user_id}
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            View
                          </Button>
                        </div>
                      </>
                    )}
                    {notification.type === "drink_token" && (
                      <>
                        <p className="text-white font-medium">
                          {notification.from_user?.display_name || notification.from_user_name || "Someone"} offered you a drink
                        </p>
                        <p className="text-slate-400 text-sm">
                          {notification.drink_type}
                        </p>
                        <div className="mt-2 flex gap-2">
                          <Button
                            data-testid={`view-drinks-${notification.token_id || notification.id}`}
                            onClick={() => navigate("/connections?tab=drinks")}
                            size="sm"
                            className="rounded-full bg-amber-500 hover:bg-amber-600 text-white text-xs"
                          >
                            <Wine className="w-3 h-3 mr-1" />
                            View in Drinks
                          </Button>
                        </div>
                      </>
                    )}
                    <p className="text-slate-500 text-xs mt-2">
                      {formatTime(notification.created_at)}
                    </p>
                  </div>

                  {/* Avatar for matches, glances, and drinks - tappable to profile */}
                  {(notification.type === "mutual_glance" || notification.type === "drink_token" || notification.type === "glance") &&
                    (notification.user?.avatar_url || notification.from_user?.avatar_url || notification.from_user_avatar) && (
                      <div 
                        className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all"
                        onClick={() => {
                          const userId = notification.user?.id || notification.from_user?.id || notification.from_user_id;
                          if (userId) navigate(`/profile/${userId}`);
                        }}
                      >
                        <img
                          src={
                            notification.user?.avatar_url ||
                            notification.from_user?.avatar_url ||
                            notification.from_user_avatar
                          }
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                </div>
              ))}
            </div>
          )
        ) : (
          /* Chat Requests Tab */
          chatRequests.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-10 h-10 text-slate-600" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">No pending requests</h2>
              <p className="text-slate-400">
                When someone sends you a drink or chat request, it'll appear here
              </p>
            </div>
          ) : (
            <div className="space-y-3" data-testid="requests-list">
              {chatRequests.map((request) => (
                <div
                  key={request.id}
                  data-testid={`request-${request.id}`}
                  className="glass rounded-2xl p-4"
                >
                  <div className="flex items-center gap-4 mb-4">
                    {/* Avatar */}
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {request.from_user_avatar ? (
                        <img src={request.from_user_avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl font-bold text-white">
                          {request.from_user_name?.charAt(0) || "?"}
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1">
                      <p className="text-white font-semibold">{request.from_user_name}</p>
                      <p className="text-slate-400 text-sm">
                        {request.request_type === "drink" 
                          ? "Offered you a drink" 
                          : "Wants to chat sometime"}
                      </p>
                      <p className="text-slate-500 text-xs mt-1">
                        {formatTime(request.created_at)}
                      </p>
                    </div>

                    {/* Type indicator */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      request.request_type === "drink" 
                        ? "bg-amber-500/20" 
                        : "bg-indigo-500/20"
                    }`}>
                      {request.request_type === "drink" 
                        ? <Wine className="w-5 h-5 text-amber-400" />
                        : <MessageCircle className="w-5 h-5 text-indigo-400" />
                      }
                    </div>
                  </div>

                  {/* Accept Options */}
                  {showAcceptOptions === request.id ? (
                    <div className="space-y-2">
                      <p className="text-slate-400 text-sm mb-3">Choose a response:</p>
                      {acceptMessages.map((msg, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleRespondToRequest(request.id, true, msg)}
                          disabled={responding === request.id}
                          className="w-full text-left p-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-sm transition-colors"
                        >
                          "{msg}"
                        </button>
                      ))}
                      <Button
                        variant="ghost"
                        onClick={() => setShowAcceptOptions(null)}
                        className="w-full mt-2 text-slate-400"
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : showDeclineOptions === request.id ? (
                    <div className="space-y-2">
                      <p className="text-slate-400 text-sm mb-3">Choose a response:</p>
                      {declineMessages.map((msg, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleRespondToRequest(request.id, false, msg)}
                          disabled={responding === request.id}
                          className="w-full text-left p-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-sm transition-colors"
                        >
                          "{msg}"
                        </button>
                      ))}
                      <Button
                        variant="ghost"
                        onClick={() => setShowDeclineOptions(null)}
                        className="w-full mt-2 text-slate-400"
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    /* Action Buttons */
                    <div className="flex gap-3">
                      <Button
                        data-testid={`accept-${request.id}`}
                        onClick={() => setShowAcceptOptions(request.id)}
                        disabled={responding === request.id}
                        className="flex-1 h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white"
                      >
                        {responding === request.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Check className="w-4 h-4 mr-2" />
                            Accept
                          </>
                        )}
                      </Button>
                      <Button
                        data-testid={`decline-${request.id}`}
                        onClick={() => setShowDeclineOptions(request.id)}
                        variant="ghost"
                        className="flex-1 h-11 rounded-xl text-slate-400 hover:text-white hover:bg-white/10"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Decline
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </Layout>
  );
};

export default Notifications;
