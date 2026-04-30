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
import SilhouetteAvatar from "../components/SilhouetteAvatar";
import { Loader2, LogOut, Trash2, Crown, Coins, ChevronRight, FileText, Wrench, AlertTriangle, Bell, Share2, QrCode, X, Eye, MapPin, Shield, ShieldOff, UserX, HelpCircle, Heart } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { subscribeToPush, unsubscribeFromPush, isPushSupported, isSubscribedToPush } from "../utils/pushNotifications";

const Settings = () => {
  const navigate = useNavigate();
  const { user, logout, updateUser } = useAuth();
  const [deleting, setDeleting] = useState(false);

  const [pushSettings, setPushSettings] = useState({
    enabled: true,
    glances: true,
    drinks: true,
    messages: true,
    matches: true
  });
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [profileViewers, setProfileViewers] = useState([]);
  const [viewersLoading, setViewersLoading] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  
  // Privacy settings
  const [allowPeek, setAllowPeek] = useState(user?.allow_peek !== false); // Default true
  const [peekSaving, setPeekSaving] = useState(false);
  
  // Blocked users state
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [blockedLoading, setBlockedLoading] = useState(false);
  const [unblocking, setUnblocking] = useState(null);

  // App download link - update this when iOS version is released
  const APP_DOWNLOAD_URL = "https://hereandnow.app/download";
  const SHARE_MESSAGE = "I'm using Here & Now — join me on it.";

  useEffect(() => {
    // Check if push notifications are supported
    setPushSupported(isPushSupported());
    fetchPushSettings();
    checkPushSubscription();
    fetchBlockedUsers();
    if (user?.is_premium) {
      fetchProfileViewers();
    }
  }, [user?.is_premium]);

  const fetchBlockedUsers = async () => {
    setBlockedLoading(true);
    try {
      const response = await axios.get(`${API}/users/blocked`);
      setBlockedUsers(response.data || []);
    } catch (error) {
      console.error("Failed to fetch blocked users:", error);
    } finally {
      setBlockedLoading(false);
    }
  };

  const handleUnblock = async (userId) => {
    setUnblocking(userId);
    try {
      await axios.post(`${API}/users/unblock`, { user_id: userId });
      toast.success("User unblocked. You can now see each other again.");
      setBlockedUsers(prev => prev.filter(u => u.id !== userId));
    } catch (error) {
      toast.error("Failed to unblock user");
    } finally {
      setUnblocking(null);
    }
  };

  const fetchProfileViewers = async () => {
    setViewersLoading(true);
    try {
      const response = await axios.get(`${API}/profile/viewers`);
      setProfileViewers(response.data);
    } catch (error) {
      // Silently fail - premium feature
    } finally {
      setViewersLoading(false);
    }
  };

  const checkPushSubscription = async () => {
    const subscribed = await isSubscribedToPush();
    setPushSubscribed(subscribed);
  };

  const fetchPushSettings = async () => {
    try {
      const response = await axios.get(`${API}/push/settings`);
      setPushSettings(response.data);
    } catch (error) {
      console.error("Failed to fetch push settings");
    }
  };

  const handlePushSettingChange = async (key, value) => {
    const newSettings = { ...pushSettings, [key]: value };
    setPushSettings(newSettings);
    
    try {
      await axios.put(`${API}/push/settings`, newSettings);
      
      // If enabling push, subscribe to push notifications
      if (key === "enabled" && value) {
        await handleEnablePush();
      } else if (key === "enabled" && !value) {
        await handleDisablePush();
      }
    } catch (error) {
      toast.error("Failed to update notification settings");
      setPushSettings(pushSettings); // Revert
    }
  };

  const handleEnablePush = async () => {
    if (!pushSupported) {
      toast.error("Push notifications not supported in this browser");
      return;
    }

    setPushLoading(true);
    try {
      await subscribeToPush(API);
      setPushSubscribed(true);
      toast.success("Push notifications enabled!");
    } catch (error) {
      console.error("Push subscription error:", error);
      if (error.message.includes('permission denied')) {
        toast.error("Push notifications blocked. Please enable in browser settings.");
      } else {
        toast.error("Failed to enable push notifications");
      }
      // Revert the toggle
      setPushSettings(prev => ({ ...prev, enabled: false }));
    } finally {
      setPushLoading(false);
    }
  };

  const handleDisablePush = async () => {
    setPushLoading(true);
    try {
      await unsubscribeFromPush(API);
      setPushSubscribed(false);
      toast.success("Push notifications disabled");
    } catch (error) {
      console.error("Push unsubscribe error:", error);
    } finally {
      setPushLoading(false);
    }
  };

  // Handle Peek toggle
  const handleAllowPeekChange = async (checked) => {
    setPeekSaving(true);
    setAllowPeek(checked);
    try {
      await axios.put(`${API}/auth/profile`, { allow_peek: checked });
      updateUser({ ...user, allow_peek: checked });
      toast.success(checked ? "Peek enabled on your photos" : "Peek disabled on your photos");
    } catch (error) {
      console.error("Failed to update peek setting:", error);
      setAllowPeek(!checked); // Revert on error
      toast.error("Failed to update setting");
    } finally {
      setPeekSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await axios.delete(`${API}/auth/account`);
      logout();
      toast.success("Account deleted");
      navigate("/");
    } catch (error) {
      toast.error("Failed to delete account");
    } finally {
      setDeleting(false);
    }
  };

  const handleLogout = () => {
    logout();
    toast.success("Logged out");
    navigate("/");
  };

  const handleShareApp = async () => {
    const shareData = {
      title: "Here & Now",
      text: SHARE_MESSAGE,
      url: APP_DOWNLOAD_URL,
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (error) {
        // User cancelled or share failed - no need to show error
        if (error.name !== "AbortError") {
          console.error("Share failed:", error);
        }
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(`${SHARE_MESSAGE}\n${APP_DOWNLOAD_URL}`);
        toast.success("Link copied to clipboard!");
      } catch (error) {
        toast.error("Unable to share. Please copy the link manually.");
      }
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6 pb-32" data-testid="settings-page">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
          <p className="text-slate-400">Manage your account and preferences</p>
        </div>

        {/* 1. Upgrades Section (Premium & Tokens) */}
        <div className="glass rounded-2xl p-6 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">Upgrades</h2>
          <div className="space-y-3">
            <button
              data-testid="premium-link"
              onClick={() => navigate("/premium")}
              className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <Crown className="w-5 h-5 text-amber-400" />
                </div>
                <div className="text-left">
                  <p className="text-white font-medium">Premium</p>
                  <p className="text-slate-400 text-sm">
                    {user?.is_premium ? "Active" : "Unlock extra features"}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400" />
            </button>

            <button
              data-testid="tokens-link"
              onClick={() => navigate("/tokens")}
              className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                  <Coins className="w-5 h-5 text-yellow-400" />
                </div>
                <div className="text-left">
                  <p className="text-white font-medium">Tokens</p>
                  <p className="text-slate-400 text-sm">
                    Balance: {user?.token_balance || 0}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* 2. Spread the Word Section */}
        <div className="glass rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center">
              <Share2 className="w-5 h-5 text-pink-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">Spread the Word</h2>
          </div>

          <div className="space-y-3">
            <button
              data-testid="share-app-btn"
              onClick={handleShareApp}
              className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                  <Share2 className="w-5 h-5 text-indigo-400" />
                </div>
                <div className="text-left">
                  <p className="text-white font-medium">Share Here & Now</p>
                  <p className="text-slate-400 text-sm">Invite friends to join</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400" />
            </button>

            <button
              data-testid="scan-qr-btn"
              onClick={() => setShowQRModal(true)}
              className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <QrCode className="w-5 h-5 text-purple-400" />
                </div>
                <div className="text-left">
                  <p className="text-white font-medium">Scan Here & Now</p>
                  <p className="text-slate-400 text-sm">Show QR code to friends</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* 3. Help Section */}
        <div className="glass rounded-2xl p-6 mb-6">
          <button
            data-testid="how-it-works-link"
            onClick={() => navigate("/how-it-works")}
            className="w-full flex items-center justify-between mb-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <HelpCircle className="w-5 h-5 text-purple-400" />
              </div>
              <div className="text-left">
                <p className="text-white font-medium">How It Works</p>
                <p className="text-slate-400 text-sm">Quick guide to photos & reveals</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </button>
          
          <button
            data-testid="community-guidelines-link"
            onClick={() => navigate("/community-guidelines")}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center">
                <Heart className="w-5 h-5 text-pink-400" />
              </div>
              <div className="text-left">
                <p className="text-white font-medium">Community Guidelines</p>
                <p className="text-slate-400 text-sm">How we keep things warm & safe</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* 4. For Venues Section */}
        <div className="glass rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-teal-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">For Venues</h2>
          </div>
          <h3 className="text-sm font-medium text-purple-300 mb-2">Where & How</h3>
          <p className="text-slate-400 text-sm leading-relaxed">
            Add your website, menu, socials or events to your venue page.
            <br />
            Email:{' '}
            <a href="mailto:hereandnow.social.uk@gmail.com" className="text-purple-400 hover:text-purple-300 underline">
              hereandnow.social.uk@gmail.com
            </a>
          </p>
        </div>

        {/* 6. Notifications Section */}
        <div className="glass rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
              <Bell className="w-5 h-5 text-indigo-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">Notifications</h2>
          </div>

          {!pushSupported ? (
            <p className="text-slate-400 text-sm">
              Push notifications are not supported in this browser.
            </p>
          ) : (
            <div className="space-y-4">
              {/* Master Toggle */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-white/5">
                <div>
                  <p className="text-white font-medium">Enable Push Notifications</p>
                  <p className="text-slate-400 text-sm">
                    {pushSubscribed 
                      ? "You'll receive notifications when the app is closed" 
                      : "Get notified when the app is closed"}
                  </p>
                </div>
                {pushLoading ? (
                  <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                ) : (
                  <Switch
                    data-testid="push-enabled-toggle"
                    checked={pushSettings.enabled}
                    onCheckedChange={(checked) => handlePushSettingChange("enabled", checked)}
                    disabled={pushLoading}
                  />
                )}
              </div>

              {pushSettings.enabled && (
                <div className="space-y-3 pl-4 border-l-2 border-white/10">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Glances</span>
                    <Switch
                      data-testid="push-glances-toggle"
                      checked={pushSettings.glances}
                      onCheckedChange={(checked) => handlePushSettingChange("glances", checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Icebreakers</span>
                    <Switch
                      data-testid="push-drinks-toggle"
                      checked={pushSettings.drinks}
                      onCheckedChange={(checked) => handlePushSettingChange("drinks", checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Messages</span>
                    <Switch
                      data-testid="push-messages-toggle"
                      checked={pushSettings.messages}
                      onCheckedChange={(checked) => handlePushSettingChange("messages", checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Matches</span>
                    <Switch
                      data-testid="push-matches-toggle"
                      checked={pushSettings.matches}
                      onCheckedChange={(checked) => handlePushSettingChange("matches", checked)}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 7. Safety Section - Blocked Users */}
        <div className="glass rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Safety</h2>
              <p className="text-slate-400 text-sm">Manage blocked users</p>
            </div>
          </div>
          
          {/* Blocked Users List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-medium flex items-center gap-2">
                <UserX className="w-4 h-4 text-slate-400" />
                Blocked Users
              </h3>
              <span className="text-slate-500 text-sm">{blockedUsers.length}</span>
            </div>
            
            {blockedLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
              </div>
            ) : blockedUsers.length === 0 ? (
              <p className="text-slate-500 text-sm py-4 text-center">
                No blocked users. Users you block will appear here.
              </p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {blockedUsers.map((blockedUser) => (
                  <div
                    key={blockedUser.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-white/5"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden">
                        {blockedUser.avatar_url ? (
                          <img
                            src={`${API}/photos/serve/${blockedUser.avatar_url}?blur=true`}
                            alt=""
                            className="w-full h-full object-cover filter blur-sm"
                          />
                        ) : (
                          <SilhouetteAvatar />
                        )}
                      </div>
                      <span className="text-white">{blockedUser.display_name}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleUnblock(blockedUser.id)}
                      disabled={unblocking === blockedUser.id}
                      className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                    >
                      {unblocking === blockedUser.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Unblock"
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
            
            <p className="text-slate-600 text-xs mt-2">
              Unblocking restores visibility but does not restore previous matches or chat history.
            </p>
          </div>
        </div>

        {/* 8. Legal Section */}
        <div className="glass rounded-2xl p-6 mb-6">
          <button
            data-testid="legal-link"
            onClick={() => navigate("/legal")}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-500/20 flex items-center justify-center">
                <FileText className="w-5 h-5 text-slate-400" />
              </div>
              <div className="text-left">
                <p className="text-white font-medium">Legal</p>
                <p className="text-slate-400 text-sm">Terms, Privacy, Safety</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* 9. Developer Section - Only visible for suzyglam.sw@googlemail.com */}
        {user?.email === "suzyglam.sw@googlemail.com" && (
          <div className="glass rounded-2xl p-6 mb-6">
            <h2 className="text-xl font-semibold text-white mb-4">Developer</h2>
            <div className="space-y-3">
              <button
                data-testid="test-tools-link"
                onClick={() => navigate("/test-tools")}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                    <Wrench className="w-5 h-5 text-amber-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-white font-medium">Test Tools</p>
                    <p className="text-slate-400 text-sm">Generate test events</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400" />
              </button>

              {/* Admin Inbox */}
              <button
                data-testid="admin-reports-link"
                onClick={() => navigate("/admin/reports")}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-white font-medium">Admin Inbox</p>
                    <p className="text-slate-400 text-sm">View user reports</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400" />
              </button>
            </div>
          </div>
        )}

        {/* 10. Account Section */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-white mb-6">Account</h2>

          <div className="space-y-3">
            <Button
              data-testid="logout-btn"
              onClick={handleLogout}
              variant="ghost"
              className="w-full h-12 justify-start rounded-xl text-slate-300 hover:text-white hover:bg-white/5"
            >
              <LogOut className="w-5 h-5 mr-3" />
              Log Out
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  data-testid="delete-account-btn"
                  variant="ghost"
                  className="w-full h-12 justify-start rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10"
                >
                  <Trash2 className="w-5 h-5 mr-3" />
                  Delete Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-slate-900 border-white/10" data-testid="delete-confirm-dialog">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-white">Delete Account</AlertDialogTitle>
                  <AlertDialogDescription className="text-slate-400">
                    This action cannot be undone. This will permanently delete your account
                    and remove all your data including connections, messages, and profile
                    information.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-white/5 border-white/10 text-white hover:bg-white/10">
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    data-testid="confirm-delete-btn"
                    onClick={handleDeleteAccount}
                    disabled={deleting}
                    className="bg-red-500 hover:bg-red-600 text-white"
                  >
                    {deleting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      "Delete Account"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* QR Code Modal */}
        {showQRModal && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={() => setShowQRModal(false)}
            data-testid="qr-modal-overlay"
          >
            <div 
              className="relative bg-slate-900 rounded-2xl p-8 mx-4 max-w-sm w-full border border-white/10"
              onClick={(e) => e.stopPropagation()}
              data-testid="qr-modal"
            >
              <button
                onClick={() => setShowQRModal(false)}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                data-testid="qr-modal-close"
              >
                <X className="w-5 h-5 text-white" />
              </button>

              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-4">
                  <QrCode className="w-6 h-6 text-purple-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Scan Here & Now</h3>
                <p className="text-slate-400 text-sm mb-6">
                  Let your friend scan this code to download the app
                </p>

                <div className="bg-white p-4 rounded-xl inline-block mb-4">
                  <QRCodeSVG 
                    value={APP_DOWNLOAD_URL}
                    size={200}
                    level="M"
                    includeMargin={false}
                    data-testid="qr-code-svg"
                  />
                </div>

                <p className="text-slate-500 text-xs">
                  {APP_DOWNLOAD_URL}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Settings;
