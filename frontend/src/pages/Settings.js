import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Loader2, LogOut, Trash2, Eye, EyeOff, User, Shield, Crown, Coins, ChevronRight, FileText, Camera, Users, Wrench, AlertTriangle, Bell, Share2, QrCode, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { subscribeToPush, unsubscribeFromPush, isPushSupported, isSubscribedToPush } from "../utils/pushNotifications";

const INTERESTS = [
  "Music", "Fitness", "Food", "Travel", "Art", 
  "Outdoors", "Gaming", "Nightlife", "Coffee", "Reading"
];

const GENDER_OPTIONS = [
  "Woman", "Man", "Non-binary", "Trans woman", "Trans man", "Prefer not to say", "Other"
];

const ORIENTATION_OPTIONS = [
  "Straight", "Gay", "Lesbian", "Bisexual", "Pansexual", "Queer", "Asexual", "Prefer not to say"
];

const RELATIONSHIP_STATUS_OPTIONS = [
  "Single", "Seeing someone", "In a relationship", "It's complicated", "Prefer not to say"
];

const SEEKING_OPTIONS = [
  "Friends only", "Dating", "Both", "Prefer not to say"
];

const Settings = () => {
  const navigate = useNavigate();
  const { user, logout, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState({
    display_name: user?.display_name || "",
    bio: user?.bio || "",
    photos: user?.photos || ["", "", ""],
    age: user?.age || "",
    gender: user?.gender || "",
    orientation: user?.orientation || "",
    relationship_status: user?.relationship_status || "",
    seeking: user?.seeking || "",
    interests: user?.interests || [],
  });

  const [uploadingSlot, setUploadingSlot] = useState(null);
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

  // App download link - update this when iOS version is released
  const APP_DOWNLOAD_URL = "https://hereandnow.app/download";
  const SHARE_MESSAGE = "I'm using Here & Now — join me on it.";

  useEffect(() => {
    // Check if push notifications are supported
    setPushSupported(isPushSupported());
    fetchPushSettings();
    checkPushSubscription();
    if (user?.is_premium) {
      fetchProfileViewers();
    }
  }, [user?.is_premium]);

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

  const handlePhotoUpload = async (index, event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    // Check file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Please upload a JPEG, PNG, WebP, or GIF image");
      return;
    }

    setUploadingSlot(index);

    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);
      formDataUpload.append("slot", index.toString());

      const response = await axios.post(`${API}/photos/upload`, formDataUpload, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      // Update local state with the new photo URL
      const newPhotos = [...formData.photos];
      newPhotos[index] = response.data.url;
      setFormData({ ...formData, photos: newPhotos });

      // Update user context (include avatar_url if slot 0)
      const userUpdate = { photos: newPhotos };
      if (index === 0) {
        userUpdate.avatar_url = response.data.url;
      }
      updateUser(userUpdate);

      toast.success("Photo uploaded!");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to upload photo");
    } finally {
      setUploadingSlot(null);
    }
  };

  const removePhoto = async (index) => {
    setUploadingSlot(index);
    try {
      await axios.delete(`${API}/photos/${index}`);
      
      const newPhotos = [...formData.photos];
      newPhotos[index] = "";
      setFormData({ ...formData, photos: newPhotos });
      
      // Update user context (clear avatar_url if slot 0)
      const userUpdate = { photos: newPhotos };
      if (index === 0) {
        userUpdate.avatar_url = "";
      }
      updateUser(userUpdate);
      
      toast.success("Photo removed");
    } catch (error) {
      toast.error("Failed to remove photo");
    } finally {
      setUploadingSlot(null);
    }
  };

  const makeMainPhoto = async (index) => {
    if (index === 0) return; // Already main
    setUploadingSlot(index);
    try {
      const response = await axios.post(`${API}/photos/make-main/${index}`);
      const newPhotos = response.data.photos;
      setFormData({ ...formData, photos: newPhotos });
      
      // Update user context with new photos and avatar
      updateUser({ photos: newPhotos, avatar_url: newPhotos[0] });
      
      toast.success("Photo set as main!");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to set main photo");
    } finally {
      setUploadingSlot(null);
    }
  };

  const toggleInterest = (interest) => {
    setFormData((prev) => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter((i) => i !== interest)
        : [...prev.interests, interest].slice(0, 5),
    }));
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.put(`${API}/auth/profile`, formData);
      updateUser(response.data);
      toast.success("Profile updated!");
    } catch (error) {
      toast.error("Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleVisibility = async () => {
    try {
      const response = await axios.put(`${API}/auth/visibility`);
      updateUser({ is_visible: response.data.is_visible });
      toast.success(
        response.data.is_visible
          ? "You're now visible to others"
          : "You're now hidden from others"
      );
    } catch (error) {
      toast.error("Failed to update visibility");
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

        {/* Profile Section */}
        <div className="glass rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
              <User className="w-5 h-5 text-indigo-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">Profile</h2>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-6">
            {/* Photo Upload Section */}
            <div className="space-y-4">
              <Label className="text-slate-300">Photos (up to 3)</Label>
              <div className="flex gap-3">
                {[0, 1, 2].map((index) => {
                  const photoUrl = formData.photos[index];
                  // Handle both API URLs and full URLs
                  const displayUrl = photoUrl?.startsWith("/api/") 
                    ? `${API.replace("/api", "")}${photoUrl}` 
                    : photoUrl;
                  
                  return (
                    <div key={index} className="relative">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        id={`photo-upload-${index}`}
                        className="hidden"
                        onChange={(e) => handlePhotoUpload(index, e)}
                        data-testid={`photo-upload-${index}`}
                        disabled={uploadingSlot !== null}
                      />
                      {uploadingSlot === index ? (
                        <div className="w-24 h-24 rounded-2xl bg-white/10 flex items-center justify-center">
                          <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                        </div>
                      ) : photoUrl ? (
                        <div className="relative w-24 h-24 rounded-2xl overflow-hidden group">
                          <img
                            src={displayUrl}
                            alt={`Photo ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                            {index !== 0 && (
                              <button
                                type="button"
                                onClick={() => makeMainPhoto(index)}
                                disabled={uploadingSlot !== null}
                                className="text-white text-xs bg-indigo-500 hover:bg-indigo-600 px-2 py-1 rounded-full"
                                data-testid={`make-main-photo-${index}`}
                              >
                                Make Main
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => removePhoto(index)}
                              disabled={uploadingSlot !== null}
                              className="text-white text-xs bg-red-500/80 hover:bg-red-600 px-2 py-1 rounded-full"
                              data-testid={`remove-photo-${index}`}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label
                          htmlFor={`photo-upload-${index}`}
                          className={`w-24 h-24 rounded-2xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 hover:bg-white/5 transition-all ${uploadingSlot !== null ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <Camera className="w-6 h-6 text-slate-400 mb-1" />
                          <span className="text-xs text-slate-400">Add</span>
                        </label>
                      )}
                      {index === 0 && photoUrl && uploadingSlot !== index && (
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-[10px] px-2 py-0.5 rounded-full">
                          Main
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500">First photo will be your main profile picture</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="display_name" className="text-slate-300">
                Display Name
              </Label>
              <Input
                data-testid="display-name-input"
                id="display_name"
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                className="h-12 bg-white/5 border-transparent focus:border-indigo-500 rounded-xl text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio" className="text-slate-300">
                Bio
              </Label>
              <Textarea
                data-testid="bio-input"
                id="bio"
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                maxLength={150}
                className="bg-white/5 border-transparent focus:border-indigo-500 rounded-xl text-white resize-none"
                rows={3}
              />
              <p className="text-xs text-slate-500 text-right">{formData.bio.length}/150</p>
            </div>

            {/* Age */}
            <div className="space-y-2">
              <Label htmlFor="age" className="text-slate-300">Age</Label>
              <Input
                data-testid="age-input"
                id="age"
                type="number"
                min="18"
                max="99"
                placeholder="Your age"
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                className="h-12 bg-white/5 border-transparent focus:border-indigo-500 rounded-xl text-white placeholder:text-slate-500"
              />
            </div>

            {/* Gender */}
            <div className="space-y-2">
              <Label className="text-slate-300">Gender</Label>
              <Select
                value={formData.gender}
                onValueChange={(value) => setFormData({ ...formData, gender: value })}
              >
                <SelectTrigger className="h-12 bg-white/5 border-transparent focus:border-indigo-500 rounded-xl text-white" data-testid="gender-select">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-white/10">
                  {GENDER_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option} className="text-white focus:bg-white/10">
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Orientation */}
            <div className="space-y-2">
              <Label className="text-slate-300">Orientation</Label>
              <Select
                value={formData.orientation}
                onValueChange={(value) => setFormData({ ...formData, orientation: value })}
              >
                <SelectTrigger className="h-12 bg-white/5 border-transparent focus:border-indigo-500 rounded-xl text-white" data-testid="orientation-select">
                  <SelectValue placeholder="Select orientation" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-white/10">
                  {ORIENTATION_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option} className="text-white focus:bg-white/10">
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Relationship Status */}
            <div className="space-y-2">
              <Label className="text-slate-300">Relationship Status</Label>
              <Select
                value={formData.relationship_status}
                onValueChange={(value) => setFormData({ ...formData, relationship_status: value })}
              >
                <SelectTrigger className="h-12 bg-white/5 border-transparent focus:border-indigo-500 rounded-xl text-white" data-testid="relationship-select">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-white/10">
                  {RELATIONSHIP_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option} className="text-white focus:bg-white/10">
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Seeking */}
            <div className="space-y-2">
              <Label className="text-slate-300">Seeking</Label>
              <Select
                value={formData.seeking}
                onValueChange={(value) => setFormData({ ...formData, seeking: value })}
              >
                <SelectTrigger className="h-12 bg-white/5 border-transparent focus:border-indigo-500 rounded-xl text-white" data-testid="seeking-select">
                  <SelectValue placeholder="What are you looking for?" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-white/10">
                  {SEEKING_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option} className="text-white focus:bg-white/10">
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Interests */}
            <div className="space-y-3">
              <Label className="text-slate-300">Interests (up to 5)</Label>
              <div className="flex flex-wrap gap-2">
                {INTERESTS.map((interest) => (
                  <button
                    key={interest}
                    type="button"
                    data-testid={`interest-${interest.toLowerCase()}`}
                    onClick={() => toggleInterest(interest)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                      formData.interests.includes(interest)
                        ? "bg-indigo-500 text-white"
                        : "bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    {interest}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500">{formData.interests.length}/5 selected</p>
            </div>

            <Button
              data-testid="save-profile-btn"
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-white text-slate-900 font-bold hover:bg-slate-100"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </form>
        </div>

        {/* Privacy Section */}
        <div className="glass rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-emerald-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">Privacy</h2>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {user?.is_visible ? (
                <Eye className="w-5 h-5 text-emerald-400" />
              ) : (
                <EyeOff className="w-5 h-5 text-slate-400" />
              )}
              <div>
                <p className="text-white font-medium">Visibility</p>
                <p className="text-slate-400 text-sm">
                  {user?.is_visible
                    ? "You're visible to others at venues"
                    : "You're hidden from others"}
                </p>
              </div>
            </div>
            <Switch
              data-testid="visibility-toggle"
              checked={user?.is_visible}
              onCheckedChange={handleToggleVisibility}
            />
          </div>
        </div>

        {/* Spread the Word Section */}
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

        {/* Push Notifications Section */}
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

        {/* Premium & Tokens Section */}
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

        {/* Profile Viewers Section (Premium Only) */}
        {user?.is_premium && (
          <div className="glass rounded-2xl p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Eye className="w-5 h-5 text-indigo-400" />
              <h2 className="text-xl font-semibold text-white">Who Viewed Your Profile</h2>
            </div>
            <p className="text-slate-400 text-sm mb-4">Last 48 hours</p>
            
            {viewersLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
              </div>
            ) : profileViewers.length === 0 ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-3">
                  <Eye className="w-6 h-6 text-slate-600" />
                </div>
                <p className="text-slate-400 text-sm">No profile views yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {profileViewers.map((viewer, index) => (
                  <button
                    key={viewer.id || index}
                    data-testid={`viewer-${viewer.id}`}
                    onClick={() => navigate(`/profile/${viewer.id}`)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                      {viewer.avatar_url ? (
                        <img src={viewer.avatar_url} alt={viewer.display_name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white text-sm font-medium">{viewer.display_name?.charAt(0) || "?"}</span>
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-white font-medium">{viewer.display_name}</p>
                      <p className="text-slate-400 text-xs">
                        {new Date(viewer.viewed_at).toLocaleString([], { 
                          month: 'short', 
                          day: 'numeric',
                          hour: '2-digit', 
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Legal Section */}
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

        {/* Developer & Admin Section */}
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

        {/* Account Actions */}
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
