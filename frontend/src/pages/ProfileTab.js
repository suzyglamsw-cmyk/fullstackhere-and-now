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
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(null);
  const [recordingVoice, setRecordingVoice] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const streamRef = useRef(null);
  const recordingTimeRef = useRef(0); // Track time in ref for accurate access in callbacks

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
      
      // Update user context with new photo
      updateUser({ photos: newPhotos, avatar_url: index === 0 ? response.data.url : user?.avatar_url });
      
      // Show photo age reminder
      toast.success("Photo uploaded! Try to choose photos that feel like you today.");
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
      const response = await axios.put(`${API}/auth/profile`, {
        display_name: formData.display_name,
        bio: formData.bio,
        photos: formData.photos,
        presence_note: formData.presence_note,
        celebrity_crush: formData.celebrity_crush,
        shy_indicator: formData.shy_indicator,
        voice_intro_url: formData.voice_intro_url,
      });
      
      // Update user context with saved data
      updateUser(response.data);
      toast.success("Profile saved!");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to save profile"));
    } finally {
      setSaving(false);
    }
  };

  const startVoiceRecording = async () => {
    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setMicPermissionDenied(false);
      
      // Use mp4 container with AAC codec for better compatibility
      const mimeType = MediaRecorder.isTypeSupported('audio/mp4') 
        ? 'audio/mp4' 
        : MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm';
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        
        // Clear timer
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        
        // Get the actual recorded time from ref (not stale state)
        const recordedTime = recordingTimeRef.current;
        
        // Reset states
        setRecordingTime(0);
        recordingTimeRef.current = 0;
        
        // Check minimum recording time (5 seconds)
        if (recordedTime < 5) {
          toast.error("Please record at least 5 seconds");
          return;
        }
        
        // Create audio blob
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        
        // Check if blob is valid
        if (audioBlob.size < 1000) {
          toast.error("Recording failed. Please try again.");
          return;
        }
        
        // Upload voice intro with duration metadata
        await uploadVoiceIntro(audioBlob, mimeType, recordedTime);
      };

      // Reset time tracking
      recordingTimeRef.current = 0;
      setRecordingTime(0);
      
      // Start recording
      mediaRecorder.start(1000); // Collect data every second
      setRecordingVoice(true);
      
      // Start timer - update both ref and state
      recordingTimerRef.current = setInterval(() => {
        recordingTimeRef.current += 1;
        const currentTime = recordingTimeRef.current;
        setRecordingTime(currentTime);
        
        // Auto-stop at 10 seconds
        if (currentTime >= 10) {
          if (mediaRecorderRef.current?.state === "recording") {
            mediaRecorderRef.current.stop();
            setRecordingVoice(false);
          }
        }
      }, 1000);
      
    } catch (error) {
      console.error("Microphone access error:", error);
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setMicPermissionDenied(true);
        toast.error("Microphone access denied. Please enable microphone permissions in your browser settings.");
      } else if (error.name === 'NotFoundError') {
        toast.error("No microphone found. Please connect a microphone and try again.");
      } else {
        toast.error("Could not access microphone. Please check your permissions.");
      }
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      setRecordingVoice(false);
    }
    
    // Cleanup timer
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const uploadVoiceIntro = async (audioBlob, mimeType, durationSeconds) => {
    setUploadingVoice(true);
    
    try {
      // Determine file extension based on mime type
      let fileExt = '.webm'; // Use actual format
      if (mimeType.includes('mp4') || mimeType.includes('m4a')) {
        fileExt = '.m4a';
      } else if (mimeType.includes('wav')) {
        fileExt = '.wav';
      } else if (mimeType.includes('webm')) {
        fileExt = '.webm';
      } else if (mimeType.includes('ogg')) {
        fileExt = '.ogg';
      }
      
      const formDataUpload = new FormData();
      formDataUpload.append("file", audioBlob, `voice_intro${fileExt}`);
      
      // Log for debugging
      console.log(`Uploading voice intro: ${durationSeconds}s, ${audioBlob.size} bytes, ${mimeType}`);
      
      const response = await axios.post(`${API}/profile/voice-intro`, formDataUpload, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      
      // Update local form state
      setFormData(prev => ({ ...prev, voice_intro_url: response.data.url }));
      
      // Update user context
      updateUser({ voice_intro_url: response.data.url });
      
      toast.success(`Voice intro saved! (${durationSeconds}s)`);
    } catch (error) {
      const errorMsg = error.response?.data?.detail || "Failed to save voice intro";
      toast.error(errorMsg);
    } finally {
      setUploadingVoice(false);
    }
  };

  const removeVoiceIntro = async () => {
    try {
      await axios.delete(`${API}/profile/voice-intro`);
      setFormData(prev => ({ ...prev, voice_intro_url: "" }));
      updateUser({ voice_intro_url: "" });
      toast.success("Voice intro removed");
    } catch (error) {
      toast.error("Failed to remove voice intro");
    }
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
              
              {/* Mic Permission Denied Warning */}
              {micPermissionDenied && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                  <p className="text-amber-300 text-sm">
                    Microphone access was denied. Please enable it in your browser settings and refresh the page.
                  </p>
                </div>
              )}
              
              {/* Uploading State */}
              {uploadingVoice ? (
                <div className="flex items-center gap-3 p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-xl">
                  <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                  <span className="text-indigo-300">Uploading voice intro...</span>
                </div>
              ) : formData.voice_intro_url ? (
                /* Voice Intro Recorded */
                <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Check className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <span className="text-emerald-300 font-medium">Voice intro recorded</span>
                    <p className="text-xs text-emerald-400/70">Tap to play or remove</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={removeVoiceIntro}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : recordingVoice ? (
                /* Recording in Progress */
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center relative">
                      <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                    </div>
                    <div className="flex-1">
                      <span className="text-red-300 font-medium">Recording...</span>
                      <p className="text-xs text-red-400/70">
                        {recordingTime}s / 10s {recordingTime < 5 && "(min 5s)"}
                      </p>
                    </div>
                    <span className="text-2xl font-mono text-red-400">{recordingTime}s</span>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-red-500 to-red-400 transition-all duration-1000"
                      style={{ width: `${(recordingTime / 10) * 100}%` }}
                    />
                  </div>
                  
                  <Button
                    onClick={stopVoiceRecording}
                    disabled={recordingTime < 5}
                    className={`w-full h-12 rounded-xl ${
                      recordingTime < 5
                        ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                        : "bg-red-500 hover:bg-red-600 text-white"
                    }`}
                  >
                    <MicOff className="w-5 h-5 mr-2" />
                    {recordingTime < 5 ? `Wait ${5 - recordingTime}s more...` : "Stop & Save Recording"}
                  </Button>
                </div>
              ) : (
                /* Start Recording Button */
                <Button
                  onClick={startVoiceRecording}
                  disabled={micPermissionDenied}
                  className="w-full h-12 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10"
                >
                  <Mic className="w-5 h-5 mr-2" />
                  Record Voice Intro
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
