import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useAuth, API } from "@/App";
import { toast } from "sonner";
import axios from "axios";
import Layout from "../components/Layout";
import { getErrorMessage } from "../utils/errorUtils";
import {
  Camera,
  Loader2,
  User,
  Mic,
  MicOff,
  Shield,
  Heart,
  Sparkles,
  X,
  Check,
  Plus,
} from "lucide-react";

const MAX_BIO_LENGTH = 500;
const MAX_PRESENCE_NOTE_LENGTH = 40;
const MAX_CELEBRITY_CRUSH_LENGTH = 50;
const MIN_BIO_LENGTH = 10;

const Profile = () => {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(null);
  const [recordingVoice, setRecordingVoice] = useState(false);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const [formData, setFormData] = useState({
    display_name: "",
    bio: "",
    photos: ["", "", ""],
    presence_note: "",
    celebrity_crush: "",
    shy_indicator: false,
    voice_intro_url: "",
  });

  useEffect(() => {
    if (user) {
      setFormData({
        display_name: user.display_name || "",
        bio: user.bio || "",
        photos: user.photos || ["", "", ""],
        presence_note: user.presence_note || "",
        celebrity_crush: user.celebrity_crush || "",
        shy_indicator: user.shy_indicator || false,
        voice_intro_url: user.voice_intro_url || "",
      });
    }
  }, [user]);

  const handlePhotoUpload = async (index, file) => {
    if (!file) return;

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Photo must be under 5MB");
      return;
    }

    setUploadingPhoto(index);
    const formDataUpload = new FormData();
    formDataUpload.append("photo", file);
    formDataUpload.append("index", index.toString());

    try {
      const response = await axios.post(`${API}/photos/upload`, formDataUpload, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const newPhotos = [...formData.photos];
      newPhotos[index] = response.data.url;
      setFormData({ ...formData, photos: newPhotos });
      
      // Show photo age reminder
      toast.success("Photo uploaded! Try to choose photos that feel like you today.");
      
      refreshUser();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to upload photo"));
    } finally {
      setUploadingPhoto(null);
    }
  };

  const handleSave = async () => {
    // Validate bio
    if (formData.bio && formData.bio.trim().length < MIN_BIO_LENGTH) {
      toast.error("Add a short line so people get a sense of your vibe.");
      return;
    }

    setSaving(true);
    try {
      await axios.put(`${API}/auth/profile`, {
        display_name: formData.display_name,
        bio: formData.bio,
        photos: formData.photos,
        presence_note: formData.presence_note,
        celebrity_crush: formData.celebrity_crush,
        shy_indicator: formData.shy_indicator,
        voice_intro_url: formData.voice_intro_url,
      });
      toast.success("Profile saved!");
      refreshUser();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to save profile"));
    } finally {
      setSaving(false);
    }
  };

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach(track => track.stop());
        
        // Upload voice intro
        const formDataUpload = new FormData();
        formDataUpload.append("audio", audioBlob, "voice_intro.webm");
        
        try {
          const response = await axios.post(`${API}/voice-intro/upload`, formDataUpload, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          setFormData({ ...formData, voice_intro_url: response.data.url });
          toast.success("Voice intro saved!");
        } catch (error) {
          toast.error("Failed to save voice intro");
        }
      };

      mediaRecorder.start();
      setRecordingVoice(true);

      // Auto-stop after 10 seconds
      setTimeout(() => {
        if (mediaRecorderRef.current?.state === "recording") {
          mediaRecorderRef.current.stop();
          setRecordingVoice(false);
        }
      }, 10000);
    } catch (error) {
      toast.error("Could not access microphone");
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      setRecordingVoice(false);
    }
  };

  const removeVoiceIntro = () => {
    setFormData({ ...formData, voice_intro_url: "" });
  };

  const mainPhoto = formData.photos[0] || user?.avatar_url;
  const hasSafetyHalo = user?.reports_count === 0 && user?.blocks_received_count === 0;

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 pb-24">
        {/* Header */}
        <div className="sticky top-0 z-40 glass border-b border-white/5">
          <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
            <h1 className="text-xl font-bold text-white">Profile</h1>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-indigo-500 hover:bg-indigo-600"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
            </Button>
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 py-6 space-y-8">
          {/* Photos Section */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Photos</h2>
            <p className="text-sm text-slate-400">Try to choose photos that feel like you today.</p>
            
            <div className="grid grid-cols-3 gap-3">
              {/* Main Photo */}
              <div className="col-span-2 row-span-2">
                <div
                  className="aspect-[3/4] rounded-2xl bg-white/5 border-2 border-dashed border-white/20 overflow-hidden relative cursor-pointer hover:border-indigo-500/50 transition-all"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {mainPhoto ? (
                    <img src={mainPhoto} alt="Main" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
                      <Camera className="w-10 h-10 mb-2" />
                      <span className="text-sm">Add main photo</span>
                    </div>
                  )}
                  {uploadingPhoto === 0 && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 animate-spin text-white" />
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handlePhotoUpload(0, e.target.files?.[0])}
                />
              </div>

              {/* Optional Photos */}
              {[1, 2].map((index) => (
                <div
                  key={index}
                  className="aspect-square rounded-xl bg-white/5 border-2 border-dashed border-white/20 overflow-hidden relative cursor-pointer hover:border-indigo-500/50 transition-all"
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = "image/*";
                    input.onchange = (e) => handlePhotoUpload(index, e.target.files?.[0]);
                    input.click();
                  }}
                >
                  {formData.photos[index] ? (
                    <img src={formData.photos[index]} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500">
                      <Plus className="w-6 h-6" />
                    </div>
                  )}
                  {uploadingPhoto === index && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-white" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Display Name */}
          <div className="space-y-2">
            <Label className="text-slate-300">Display Name</Label>
            <Input
              value={formData.display_name}
              disabled
              className="h-12 bg-white/5 border-transparent rounded-xl text-slate-400 cursor-not-allowed"
            />
            <p className="text-xs text-slate-500">Your name was set during registration and cannot be changed.</p>
          </div>

          {/* Bio */}
          <div className="space-y-2">
            <Label className="text-slate-300">Bio</Label>
            <Textarea
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              placeholder="Add a short line so people get a sense of your vibe..."
              maxLength={MAX_BIO_LENGTH}
              className="min-h-24 bg-white/5 border-transparent focus:border-indigo-500 rounded-xl text-white resize-none"
            />
            <div className="flex justify-between text-xs text-slate-500">
              <span>Minimum {MIN_BIO_LENGTH} characters</span>
              <span>{formData.bio.length}/{MAX_BIO_LENGTH}</span>
            </div>
          </div>

          {/* Connection Comfort Section */}
          <div className="space-y-6">
            <div className="border-t border-white/10 pt-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Heart className="w-5 h-5 text-pink-400" />
                Connection Comfort
              </h2>
            </div>

            {/* Presence Note */}
            <div className="space-y-2">
              <Label className="text-slate-300">Presence Note</Label>
              <p className="text-xs text-slate-500">A short note visible to others (even while blurred)</p>
              <Input
                value={formData.presence_note}
                onChange={(e) => setFormData({ ...formData, presence_note: e.target.value })}
                placeholder="e.g., Here for good vibes..."
                maxLength={MAX_PRESENCE_NOTE_LENGTH}
                className="h-12 bg-white/5 border-transparent focus:border-indigo-500 rounded-xl text-white"
              />
              <div className="text-right text-xs text-slate-500">
                {formData.presence_note.length}/{MAX_PRESENCE_NOTE_LENGTH}
              </div>
            </div>

            {/* Celebrity Crush */}
            <div className="space-y-2">
              <Label className="text-slate-300">Celebrity Crush (optional)</Label>
              <Input
                value={formData.celebrity_crush}
                onChange={(e) => setFormData({ ...formData, celebrity_crush: e.target.value })}
                placeholder="e.g., Timothée Chalamet"
                maxLength={MAX_CELEBRITY_CRUSH_LENGTH}
                className="h-12 bg-white/5 border-transparent focus:border-indigo-500 rounded-xl text-white"
              />
            </div>

            {/* Shy Indicator */}
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
              <div>
                <p className="text-white font-medium">Shy Indicator</p>
                <p className="text-xs text-slate-400">Show "May be shy to start" on your profile</p>
              </div>
              <Switch
                checked={formData.shy_indicator}
                onCheckedChange={(checked) => setFormData({ ...formData, shy_indicator: checked })}
              />
            </div>

            {/* Voice Intro */}
            <div className="space-y-3">
              <Label className="text-slate-300">Voice Intro (5-10 seconds)</Label>
              <p className="text-xs text-slate-500">Record a short voice message. Only plays after mutual curiosity.</p>
              
              {formData.voice_intro_url ? (
                <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl">
                  <Mic className="w-5 h-5 text-indigo-400" />
                  <span className="text-white flex-1">Voice intro recorded</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={removeVoiceIntro}
                    className="text-red-400 hover:text-red-300"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={recordingVoice ? stopVoiceRecording : startVoiceRecording}
                  className={`w-full h-12 rounded-xl ${
                    recordingVoice
                      ? "bg-red-500 hover:bg-red-600"
                      : "bg-white/5 hover:bg-white/10 text-white"
                  }`}
                >
                  {recordingVoice ? (
                    <>
                      <MicOff className="w-5 h-5 mr-2" />
                      Stop Recording
                    </>
                  ) : (
                    <>
                      <Mic className="w-5 h-5 mr-2" />
                      Record Voice Intro
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Safety Halo */}
          {hasSafetyHalo && (
            <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
              <Shield className="w-6 h-6 text-emerald-400" />
              <div>
                <p className="text-emerald-300 font-medium">Safety Halo Active</p>
                <p className="text-xs text-emerald-400/70">
                  Shown to others after mutual curiosity. Based on no reports and respectful behavior.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Profile;
