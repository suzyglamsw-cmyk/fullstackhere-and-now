import { useNavigate, useLocation } from "react-router-dom";
import { Compass, Users, Bell, Settings, User } from "lucide-react";
import { useAuth, API } from "@/App";
import { useState, useEffect } from "react";
import axios from "axios";
import { Logo, LogoIcon } from "./Logo";

const Layout = ({ children, hideNav = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user) {
      fetchUnreadCount();
      const interval = setInterval(fetchUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const fetchUnreadCount = async () => {
    try {
      const response = await axios.get(`${API}/messages/unread/count`);
      setUnreadCount(response.data.unread_count);
    } catch (error) {
      console.error("Failed to fetch unread count");
    }
  };

  const navItems = [
    { path: "/discover/select", icon: Compass, label: "Discover" },
    { path: "/connections", icon: Users, label: "Matches" },
    { path: "/profile-tab", icon: User, label: "Profile" },
    { path: "/notifications", icon: Bell, label: "Alerts", badge: unreadCount },
    { path: "/settings", icon: Settings, label: "Settings" },
  ];

  const isActive = (path) => {
    const currentPath = location.pathname;
    // For discover, check if we're on any discover/discovery route
    if (path === "/discover/select") {
      return currentPath.startsWith("/discover") || currentPath.startsWith("/discovery");
    }
    // Exact match or match with sub-routes (path followed by /)
    return currentPath === path || currentPath.startsWith(path + '/');
  };

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => navigate("/discovery")}
            data-testid="logo-btn"
          >
            <LogoIcon className="w-8 h-8" />
            <div className="hidden sm:block">
              <Logo size="default" />
            </div>
          </div>

          {user && (
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-white text-sm font-medium">{user.display_name}</p>
                <p className="text-slate-500 text-xs">{user.email}</p>
              </div>
              <div
                className="w-10 h-10 rounded-xl overflow-hidden cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all"
                onClick={() => navigate("/settings")}
                data-testid="user-avatar-btn"
              >
                <img
                  src={user.avatar_url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200"}
                  alt={user.display_name}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <main>{children}</main>

      {/* Bottom Navigation Dock */}
      {!hideNav && (
        <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 nav-dock rounded-full px-6 py-3 flex items-center gap-6 shadow-2xl shadow-black/50 z-50 border border-white/10">
          {navItems.map((item) => (
            <button
              key={item.path}
              data-testid={`nav-${item.label.toLowerCase()}`}
              onClick={() => navigate(item.path)}
              className={`relative flex flex-col items-center gap-1 transition-all ${
                isActive(item.path)
                  ? "text-white"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <div className="relative">
                <item.icon
                  className={`w-6 h-6 ${
                    isActive(item.path) ? "text-indigo-400" : ""
                  }`}
                />
                {item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full notification-badge text-[10px] font-bold text-white flex items-center justify-center">
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
              {isActive(item.path) && (
                <div className="absolute -bottom-1 w-1 h-1 rounded-full bg-indigo-400" />
              )}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
};

export default Layout;
