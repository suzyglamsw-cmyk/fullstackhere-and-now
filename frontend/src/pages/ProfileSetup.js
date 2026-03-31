import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth, API } from "@/App";
import { toast } from "sonner";
import axios from "axios";
import { Loader2, Check } from "lucide-react";

const AVATAR_OPTIONS = [
  "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop",
  "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=200&h=200&fit=crop",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop",
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop",
];

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

const ProfileSetup = () => {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    display_name: user?.display_name || "",
    bio: user?.bio || "",
    avatar_url: user?.avatar_url || "",
    interests: user?.interests || [],
    age: user?.age || "",
    gender: user?.gender || "",
    orientation: user?.orientation || "",
    relationship_status: user?.relationship_status || "",
    seeking: user?.seeking || "",
  });

  const toggleInterest = (interest) => {
    setFormData((prev) => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter((i) => i !== interest)
        : [...prev.interests, interest].slice(0, 5),
    }));
  };

  const handleSubmit = async () => {
    setLoading(true);

    try {
      const response = await axios.put(`${API}/auth/profile`, formData);
      updateUser(response.data);
      toast.success("Profile updated!");
      navigate("/discover/select");
    } catch (error) {
      toast.error("Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const canContinue = () => {
    if (step === 1) return formData.display_name && formData.avatar_url;
    if (step === 2) return formData.interests.length > 0;
    return true;
  };

  return (
    <div className="min-h-screen hero-gradient flex flex-col pb-8">
      {/* Progress */}
      <div className="p-4">
        <div className="flex items-center gap-2 max-w-md mx-auto">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`flex-1 h-1 rounded-full transition-colors ${
                s <= step ? "bg-indigo-500" : "bg-slate-700"
              }`}
            />
          ))}
        </div>
        <p className="text-center text-slate-400 text-sm mt-2">Step {step} of 3</p>
      </div>

      <div className="flex-1 flex items-start justify-center px-4 pt-8">
        <div className="w-full max-w-md">
          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-8">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-white mb-2">Let's set up your profile</h1>
                <p className="text-slate-400">Choose how you want to appear to others</p>
              </div>

              {/* Avatar Selection */}
              <div className="space-y-4">
                <Label className="text-slate-300">Choose an avatar</Label>
                <div className="grid grid-cols-3 gap-3">
                  {AVATAR_OPTIONS.map((url, index) => (
                    <button
                      key={index}
                      data-testid={`avatar-option-${index}`}
                      onClick={() => setFormData({ ...formData, avatar_url: url })}
                      className={`relative aspect-square rounded-2xl overflow-hidden border-2 transition-all ${
                        formData.avatar_url === url
                          ? "border-indigo-500 ring-4 ring-indigo-500/20"
                          : "border-transparent hover:border-white/20"
                      }`}
                    >
                      <img src={url} alt={`Avatar ${index + 1}`} className="w-full h-full object-cover" />
                      {formData.avatar_url === url && (
                        <div className="absolute inset-0 bg-indigo-500/20 flex items-center justify-center">
                          <Check className="w-8 h-8 text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Display Name */}
              <div className="space-y-2">
                <Label htmlFor="display_name" className="text-slate-300">
                  Display Name
                </Label>
                <Input
                  data-testid="display-name-input"
                  id="display_name"
                  type="text"
                  placeholder="Your name or nickname"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  className="h-12 bg-white/5 border-transparent focus:border-indigo-500 rounded-xl text-white placeholder:text-slate-500"
                />
              </div>

              {/* Bio */}
              <div className="space-y-2">
                <Label htmlFor="bio" className="text-slate-300">
                  Short Bio (optional)
                </Label>
                <Textarea
                  data-testid="bio-input"
                  id="bio"
                  placeholder="A few words about yourself..."
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  maxLength={150}
                  className="bg-white/5 border-transparent focus:border-indigo-500 rounded-xl text-white placeholder:text-slate-500 resize-none"
                  rows={3}
                />
                <p className="text-xs text-slate-500 text-right">{formData.bio.length}/150</p>
              </div>
            </div>
          )}

          {/* Step 2: About You */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-white mb-2">About You</h1>
                <p className="text-slate-400">Help others get to know you</p>
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
            </div>
          )}

          {/* Step 3: Interests */}
          {step === 3 && (
            <div className="space-y-8">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-white mb-2">Your Interests</h1>
                <p className="text-slate-400">Select up to 5 interests</p>
              </div>

              <div className="flex flex-wrap gap-2 justify-center">
                {INTERESTS.map((interest) => (
                  <button
                    key={interest}
                    data-testid={`interest-${interest.toLowerCase()}`}
                    onClick={() => toggleInterest(interest)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      formData.interests.includes(interest)
                        ? "bg-indigo-500 text-white"
                        : "bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    {interest}
                  </button>
                ))}
              </div>

              <p className="text-center text-slate-400 text-sm">
                {formData.interests.length}/5 selected
              </p>
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 mt-10">
            {step > 1 && (
              <Button
                data-testid="back-step-btn"
                variant="ghost"
                onClick={() => setStep(step - 1)}
                className="flex-1 h-12 rounded-xl text-slate-300 hover:bg-white/10"
              >
                Back
              </Button>
            )}
            {step < 3 ? (
              <Button
                data-testid="next-step-btn"
                onClick={() => setStep(step + 1)}
                disabled={!canContinue()}
                className="flex-1 h-12 rounded-xl bg-white text-slate-900 font-bold hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
              </Button>
            ) : (
              <Button
                data-testid="complete-profile-btn"
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 h-12 rounded-xl bg-gradient-to-r from-indigo-500 to-pink-500 text-white font-bold hover:opacity-90 transition-all"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Complete Setup"
                )}
              </Button>
            )}
          </div>

          {step === 3 && (
            <button
              data-testid="skip-btn"
              onClick={() => navigate("/venues")}
              className="w-full text-center text-slate-400 hover:text-white mt-4 text-sm"
            >
              Skip for now
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileSetup;
