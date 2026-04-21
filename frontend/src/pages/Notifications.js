import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth, API } from "@/App";
import { toast } from "sonner";
import axios from "axios";
import Layout from "../components/Layout";
import PageHeader from "../components/PageHeader";
import { 
  Eye, Snowflake, Sparkles, Bell, Loader2, 
  MessageCircle, Trash2
} from "lucide-react";

const Notifications = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await axios.get(`${API}/notifications`);
      console.log("[Notifications] Raw backend response:", JSON.stringify(response.data, null, 2));
      
      // Filter out malformed notifications and log any issues
      const validNotifications = response.data.filter((notification, index) => {
        try {
          // Check for required fields
          if (!notification.type) {
            console.warn(`[Notifications] Skipping notification at index ${index}: missing 'type'`, notification);
            return false;
          }
          if (!notification.created_at) {
            console.warn(`[Notifications] Skipping notification at index ${index}: missing 'created_at'`, notification);
            return false;
          }
          return true;
        } catch (err) {
          console.error(`[Notifications] Error validating notification at index ${index}:`, err, notification);
          return false;
        }
      });
      
      setNotifications(validNotifications);
    } catch (error) {
      console.error("[Notifications] Failed to fetch notifications:", error);
      toast.error("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  const handleClearAll = async () => {
    setClearing(true);
    try {
      await axios.delete(`${API}/notifications/clear`);
      setNotifications([]);
      toast.success("Notifications cleared");
    } catch (error) {
      toast.error("Failed to clear notifications");
    } finally {
      setClearing(false);
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
      case "icebreaker":
      case "drink_token":
        return <Snowflake className="w-5 h-5 text-cyan-400" />;
      case "chat_request":
        return <MessageCircle className="w-5 h-5 text-indigo-400" />;
      default:
        return <Bell className="w-5 h-5 text-slate-400" />;
    }
  };

  const getViewButton = (notification) => {
    switch (notification.type) {
      case "mutual_glance":
        return (
          <Button
            data-testid={`view-glances-${notification.id}`}
            onClick={() => navigate("/connections?tab=glances")}
            size="sm"
            className="rounded-full bg-emerald-500 hover:bg-emerald-600 text-white text-xs"
          >
            <Sparkles className="w-3 h-3 mr-1" />
            View in Glances
          </Button>
        );
      case "glance":
      case "new_glance":
        return (
          <Button
            data-testid={`view-glances-${notification.id}`}
            onClick={() => navigate("/connections?tab=glances")}
            size="sm"
            className="rounded-full bg-pink-500 hover:bg-pink-600 text-white text-xs"
          >
            <Eye className="w-3 h-3 mr-1" />
            View in Glances
          </Button>
        );
      case "icebreaker":
      case "drink_token":
        return (
          <Button
            data-testid={`view-icebreakers-${notification.icebreaker_id || notification.token_id || notification.id}`}
            onClick={() => navigate("/connections?tab=icebreakers")}
            size="sm"
            className="rounded-full bg-cyan-500 hover:bg-cyan-600 text-white text-xs"
          >
            <Snowflake className="w-3 h-3 mr-1" />
            View in Icebreakers
          </Button>
        );
      case "chat_request":
        return (
          <Button
            data-testid={`view-chats-${notification.id}`}
            onClick={() => navigate("/connections?tab=chats")}
            size="sm"
            className="rounded-full bg-indigo-500 hover:bg-indigo-600 text-white text-xs"
          >
            <MessageCircle className="w-3 h-3 mr-1" />
            View in Chat Requests
          </Button>
        );
      case "new_message":
        const messageUserId = notification.data?.from_user_id || notification.from_user_id;
        return messageUserId ? (
          <Button
            data-testid={`view-message-${notification.id}`}
            onClick={() => navigate(`/chat/${messageUserId}`)}
            size="sm"
            className="rounded-full bg-purple-500 hover:bg-purple-600 text-white text-xs"
          >
            <MessageCircle className="w-3 h-3 mr-1" />
            View Message
          </Button>
        ) : (
          <Button
            data-testid={`view-messages-${notification.id}`}
            onClick={() => navigate("/connections?tab=messages")}
            size="sm"
            className="rounded-full bg-purple-500 hover:bg-purple-600 text-white text-xs"
          >
            <MessageCircle className="w-3 h-3 mr-1" />
            View Messages
          </Button>
        );
      case "mutual_reveal":
      case "reveal_received":
        const revealUserId = notification.data?.from_user_id || notification.from_user_id;
        return revealUserId ? (
          <Button
            data-testid={`view-profile-${notification.id}`}
            onClick={() => navigate(`/profile/${revealUserId}`)}
            size="sm"
            className="rounded-full bg-amber-500 hover:bg-amber-600 text-white text-xs"
          >
            <Eye className="w-3 h-3 mr-1" />
            View Profile
          </Button>
        ) : null;
      default:
        return null;
    }
  };

  const getNotificationMessage = (notification) => {
    const userName = notification.from_user?.display_name || notification.from_user_name || notification.data?.from_user_name || "Someone";
    
    switch (notification.type) {
      case "mutual_glance":
        return {
          title: `You're mutual with ${userName}!`,
          subtitle: "You can now chat with them"
        };
      case "glance":
      case "new_glance":
        return {
          title: notification.title || `${userName} glanced at you`,
          subtitle: notification.body || "They noticed you at the venue"
        };
      case "icebreaker":
      case "drink_token":
        return {
          title: `${userName} sent you an icebreaker`,
          subtitle: "Tap to respond"
        };
      case "chat_request":
        return {
          title: `${userName} wants to chat`,
          subtitle: "They sent you a chat request"
        };
      case "new_message":
        return {
          title: notification.title || `New message from ${userName}`,
          subtitle: notification.body || "Tap to view"
        };
      case "mutual_reveal":
        return {
          title: notification.title || `Mutual reveal with ${userName}!`,
          subtitle: notification.body || "You can now see each other clearly"
        };
      case "reveal_received":
        return {
          title: notification.title || `${userName} revealed to you`,
          subtitle: notification.body || "You can reveal back if you'd like"
        };
      default:
        return {
          title: notification.title || notification.message || "New notification",
          subtitle: notification.body || null
        };
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6 pb-32" data-testid="notifications-page">
        {/* Page Header with Back Button */}
        <PageHeader 
          title="Notifications" 
          subtitle="Recent activity"
          rightAction={notifications.length > 0 ? (
            <Button
              data-testid="clear-all-btn"
              onClick={handleClearAll}
              disabled={clearing}
              variant="ghost"
              size="sm"
              className="text-slate-400 hover:text-red-400 hover:bg-red-500/10"
            >
              {clearing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <Trash2 className="w-4 h-4 mr-1" />
              )}
              Clear
            </Button>
          ) : null}
        />

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
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
            {notifications.map((notification, index) => {
              try {
                const { title, subtitle } = getNotificationMessage(notification);
                
                return (
                  <div
                    key={notification.id || index}
                    data-testid={`notification-${index}`}
                    className="glass rounded-2xl p-4 flex items-start gap-4"
                  >
                    {/* Icon */}
                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                      {getNotificationIcon(notification.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium">{title}</p>
                      {subtitle && (
                        <p className="text-slate-400 text-sm mt-1">{subtitle}</p>
                      )}
                      <div className="mt-2 flex gap-2">
                        {getViewButton(notification)}
                      </div>
                      <p className="text-slate-500 text-xs mt-2">
                        {notification.created_at ? formatTime(notification.created_at) : "Unknown time"}
                      </p>
                    </div>
                  </div>
                );
              } catch (renderError) {
                console.error(`[Notifications] Error rendering notification at index ${index}:`, renderError, notification);
                return null; // Skip malformed notifications
              }
            })}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Notifications;
