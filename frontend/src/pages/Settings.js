import { useState } from "react";
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
import { Loader2, LogOut, Trash2, Eye, EyeOff, User, Shield, Crown, Coins, ChevronRight, FileText, Camera } from "lucide-react";

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

  const handlePhotoUpload = (index, event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const newPhotos = [...formData.photos];
      newPhotos[index] = e.target.result;
      setFormData({ ...formData, photos: newPhotos });
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = (index) => {
    const newPhotos = [...formData.photos];
    newPhotos[index] = "";
    setFormData({ ...formData, photos: newPhotos });
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
                {[0, 1, 2].map((index) => (
                  <div key={index} className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      id={`photo-upload-${index}`}
                      className="hidden"
                      onChange={(e) => handlePhotoUpload(index, e)}
                      data-testid={`photo-upload-${index}`}
                    />
                    {formData.photos[index] ? (
                      <div className="relative w-24 h-24 rounded-2xl overflow-hidden group">
                        <img
                          src={formData.photos[index]}
                          alt={`Photo ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removePhoto(index)}
                          className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                          data-testid={`remove-photo-${index}`}
                        >
                          <span className="text-white text-xs">Remove</span>
                        </button>
                      </div>
                    ) : (
                      <label
                        htmlFor={`photo-upload-${index}`}
                        className="w-24 h-24 rounded-2xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 hover:bg-white/5 transition-all"
                      >
                        <Camera className="w-6 h-6 text-slate-400 mb-1" />
                        <span className="text-xs text-slate-400">Add</span>
                      </label>
                    )}
                    {index === 0 && formData.photos[0] && (
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-[10px] px-2 py-0.5 rounded-full">
                        Main
                      </div>
                    )}
                  </div>
                ))}
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
      </div>
    </Layout>
  );
};

export default Settings;
