import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { API } from "@/App";
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
      setNotifications(response.data);
    } catch (error) {
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
      default:
        return null;
    }
  };

  const getNotificationMessage = (notification) => {
    const userName = notification.from_user?.display_name || notification.from_user_name || "Someone";
    
    switch (notification.type) {
      case "mutual_glance":
        return {
          title: `You're mutual with ${userName}!`,
          subtitle: "You can now chat with them"
        };
      case "glance":
        return {
          title: `${userName} glanced at you`,
          subtitle: "They noticed you at the venue"
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
      default:
        return {
          title: notification.message || "New notification",
          subtitle: null
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
                      {formatTime(notification.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Notifications;
