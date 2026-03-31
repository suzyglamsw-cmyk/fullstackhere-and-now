import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth, API } from "@/App";
import { toast } from "sonner";
import axios from "axios";
import Layout from "../components/Layout";
import { 
  Loader2, LogOut, Trash2, Shield, Crown, Bell, 
  ChevronRight, Eye, EyeOff, Lock, Smartphone, 
  HelpCircle, FileText, Wrench
} from "lucide-react";
import { subscribeToPush, unsubscribeFromPush, isPushSupported, isSubscribedToPush } from "../utils/pushNotifications";
import { getErrorMessage } from "../utils/errorUtils";

const SettingsNew = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // Notification settings
  const [pushEnabled, setPushEnabled] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  
  // Privacy settings
  const [isVisible, setIsVisible] = useState(true);
  const [showOnlineStatus, setShowOnlineStatus] = useState(true);
  
  useEffect(() => {
    if (user) {
      setIsVisible(user.is_visible ?? true);
      checkPushStatus();
    }
  }, [user]);

  const checkPushStatus = async () => {
    if (isPushSupported()) {
      const isSubscribed = await isSubscribedToPush();
      setPushEnabled(isSubscribed);
    }
  };

  const togglePushNotifications = async () => {
    try {
      if (pushEnabled) {
        await unsubscribeFromPush();
        setPushEnabled(false);
        toast.success("Push notifications disabled");
      } else {
        const success = await subscribeToPush();
        if (success) {
          setPushEnabled(true);
          toast.success("Push notifications enabled");
        } else {
          toast.error("Could not enable push notifications");
        }
      }
    } catch (error) {
      toast.error("Failed to update notification settings");
    }
  };

  const toggleVisibility = async () => {
    setLoading(true);
    try {
      await axios.put(`${API}/auth/profile`, { is_visible: !isVisible });
      setIsVisible(!isVisible);
      toast.success(isVisible ? "Profile hidden" : "Profile visible");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to update visibility"));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/");
    toast.success("Logged out");
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await axios.delete(`${API}/auth/account`);
      logout();
      navigate("/");
      toast.success("Account deleted");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to delete account"));
    } finally {
      setDeleting(false);
    }
  };

  const SettingRow = ({ icon: Icon, title, subtitle, onClick, rightContent, danger }) => (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all ${
        onClick ? "hover:bg-white/5" : ""
      } ${danger ? "text-red-400" : "text-white"}`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
        danger ? "bg-red-500/20" : "bg-white/10"
      }`}>
        <Icon className={`w-5 h-5 ${danger ? "text-red-400" : "text-slate-400"}`} />
      </div>
      <div className="flex-1 text-left">
        <p className="font-medium">{title}</p>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      {rightContent || (onClick && <ChevronRight className="w-5 h-5 text-slate-500" />)}
    </button>
  );

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 pb-24">
        {/* Header */}
        <div className="sticky top-0 z-40 glass border-b border-white/5">
          <div className="max-w-lg mx-auto px-4 py-4">
            <h1 className="text-xl font-bold text-white">Settings</h1>
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
          {/* Account Section */}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider px-4">Account</h2>
            <div className="bg-white/5 rounded-2xl overflow-hidden">
              <SettingRow
                icon={Crown}
                title="Subscription"
                subtitle={user?.is_premium ? "Premium Active" : "Free Plan"}
                onClick={() => navigate("/premium")}
              />
              <div className="h-px bg-white/5 mx-4" />
              <SettingRow
                icon={Lock}
                title="Change Password"
                subtitle="Update your password"
                onClick={() => navigate("/settings/password")}
              />
            </div>
          </div>

          {/* Notifications Section */}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider px-4">Notifications</h2>
            <div className="bg-white/5 rounded-2xl overflow-hidden">
              <SettingRow
                icon={Bell}
                title="Push Notifications"
                subtitle={pushEnabled ? "Enabled" : "Disabled"}
                rightContent={
                  <Switch
                    checked={pushEnabled}
                    onCheckedChange={togglePushNotifications}
                    disabled={!isPushSupported()}
                  />
                }
              />
            </div>
          </div>

          {/* Privacy Section */}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider px-4">Privacy</h2>
            <div className="bg-white/5 rounded-2xl overflow-hidden">
              <SettingRow
                icon={isVisible ? Eye : EyeOff}
                title="Profile Visibility"
                subtitle={isVisible ? "Others can see you" : "Hidden from discovery"}
                rightContent={
                  <Switch
                    checked={isVisible}
                    onCheckedChange={toggleVisibility}
                    disabled={loading}
                  />
                }
              />
              <div className="h-px bg-white/5 mx-4" />
              <SettingRow
                icon={Shield}
                title="Blocked Users"
                subtitle="Manage blocked accounts"
                onClick={() => navigate("/settings/blocked")}
              />
            </div>
          </div>

          {/* App Preferences */}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider px-4">App</h2>
            <div className="bg-white/5 rounded-2xl overflow-hidden">
              <SettingRow
                icon={Wrench}
                title="Test Tools"
                subtitle="Developer testing options"
                onClick={() => navigate("/test-tools")}
              />
              <div className="h-px bg-white/5 mx-4" />
              <SettingRow
                icon={HelpCircle}
                title="Help & Support"
                subtitle="Get help with the app"
                onClick={() => {}}
              />
              <div className="h-px bg-white/5 mx-4" />
              <SettingRow
                icon={FileText}
                title="Terms & Privacy"
                subtitle="Legal information"
                onClick={() => {}}
              />
            </div>
          </div>

          {/* Logout */}
          <div className="space-y-2">
            <div className="bg-white/5 rounded-2xl overflow-hidden">
              <SettingRow
                icon={LogOut}
                title="Log Out"
                onClick={handleLogout}
                danger
              />
            </div>
          </div>

          {/* Delete Account */}
          <div className="space-y-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <div className="bg-white/5 rounded-2xl overflow-hidden">
                  <SettingRow
                    icon={Trash2}
                    title="Delete Account"
                    subtitle="Permanently remove your account"
                    danger
                    onClick={() => {}}
                  />
                </div>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-slate-900 border-white/10">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-white">Delete Account?</AlertDialogTitle>
                  <AlertDialogDescription className="text-slate-400">
                    This action cannot be undone. All your data, matches, and messages will be permanently deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-white/10 text-white border-0 hover:bg-white/20">
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    className="bg-red-500 hover:bg-red-600"
                    disabled={deleting}
                  >
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {/* App Version */}
          <p className="text-center text-xs text-slate-600 pt-4">
            Here & Now v1.0.0
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default SettingsNew;
