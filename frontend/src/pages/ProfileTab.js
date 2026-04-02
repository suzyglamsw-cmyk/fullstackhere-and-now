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
  Play,
  Pause,
  Volume2,
  Eye,
  EyeOff,
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
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewMode, setPreviewMode] = useState("before"); // "before" or "after"
  const [previewAudioPlaying, setPreviewAudioPlaying] = useState(false);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const streamRef = useRef(null);
  const recordingTimeRef = useRef(0); // Track time in ref for accurate access in callbacks
  const audioPlayerRef = useRef(null); // Audio element for playback
  const isMountedRef = useRef(true); // Track if component is mounted
  const previewAudioRef = useRef(null); // Audio element for preview playback

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

  // Reset all voice recording state completely
  const resetVoiceRecordingState = () => {
    // Stop any playing audio
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.src = '';
      setIsPlayingVoice(false);
    }
    
    // Stop any existing recording
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state === "recording") {
        try {
          mediaRecorderRef.current.stop();
        } catch (e) {
          console.log("MediaRecorder already stopped");
        }
      }
      mediaRecorderRef.current = null;
    }
    
    // Clear timer
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    
    // Stop and release microphone stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }
    
    // Clear audio data
    audioChunksRef.current = [];
    
    // Reset time
    recordingTimeRef.current = 0;
    setRecordingTime(0);
    
    // Reset recording state
    setRecordingVoice(false);
    setUploadingVoice(false);
  };

  const startVoiceRecording = async () => {
    // First, completely reset all state
    resetVoiceRecordingState();
    
    // Small delay to ensure state is cleared
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });
      streamRef.current = stream;
      setMicPermissionDenied(false);
      
      // Use best available audio format
      const mimeType = MediaRecorder.isTypeSupported('audio/mp4') 
        ? 'audio/mp4' 
        : MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm';
      
      console.log("Starting new recording with mimeType:", mimeType);
      
      // Create fresh MediaRecorder instance
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      
      // Fresh audio chunks array for this recording - using closure to capture
      const thisRecordingChunks = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          thisRecordingChunks.push(event.data);
          console.log(`Audio chunk received: ${event.data.size} bytes, total chunks: ${thisRecordingChunks.length}`);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log("Recording stopped, processing...");
        
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
        
        // Get the actual recorded time from ref
        const recordedTime = recordingTimeRef.current;
        console.log(`Recorded time: ${recordedTime}s, chunks: ${thisRecordingChunks.length}`);
        
        // Reset time tracking
        const finalTime = recordedTime;
        setRecordingTime(0);
        recordingTimeRef.current = 0;
        
        // Check minimum recording time (5 seconds)
        if (finalTime < 5) {
          toast.error(`Please record at least 5 seconds (recorded ${finalTime}s)`);
          return;
        }
        
        // Create audio blob from THIS recording's chunks
        if (thisRecordingChunks.length === 0) {
          toast.error("No audio data recorded. Please try again.");
          return;
        }
        
        const audioBlob = new Blob(thisRecordingChunks, { type: mimeType });
        console.log(`Audio blob created: ${audioBlob.size} bytes`);
        
        // Check if blob is valid
        if (audioBlob.size < 1000) {
          toast.error("Recording too small. Please try again.");
          return;
        }
        
        // Upload voice intro with duration metadata
        await uploadVoiceIntro(audioBlob, mimeType, finalTime);
      };
      
      mediaRecorder.onerror = (event) => {
        console.error("MediaRecorder error:", event.error);
        toast.error("Recording error. Please try again.");
        resetVoiceRecordingState();
      };

      // Initialize time tracking
      recordingTimeRef.current = 0;
      setRecordingTime(0);
      
      // Start recording - collect data every 500ms for more granular chunks
      mediaRecorder.start(500);
      setRecordingVoice(true);
      
      console.log("Recording started");
      
      // Start fresh timer
      recordingTimerRef.current = setInterval(() => {
        recordingTimeRef.current += 1;
        const currentTime = recordingTimeRef.current;
        setRecordingTime(currentTime);
        
        // Auto-stop at 10 seconds
        if (currentTime >= 10) {
          console.log("Auto-stopping at 10 seconds");
          if (mediaRecorderRef.current?.state === "recording") {
            mediaRecorderRef.current.stop();
            setRecordingVoice(false);
          }
        }
      }, 1000);
      
    } catch (error) {
      console.error("Microphone access error:", error);
      resetVoiceRecordingState();
      
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
    // Full reset of recorder state
    resetVoiceRecordingState();
    
    try {
      await axios.delete(`${API}/profile/voice-intro`);
      setFormData(prev => ({ ...prev, voice_intro_url: "" }));
      updateUser({ voice_intro_url: "" });
      toast.success("Voice intro removed");
    } catch (error) {
      toast.error("Failed to remove voice intro");
    }
  };

  // Get the full URL for voice intro playback
  const getVoiceIntroFullUrl = () => {
    if (!formData.voice_intro_url) return null;
    // If it's already a full URL, return as-is
    if (formData.voice_intro_url.startsWith('http')) {
      return formData.voice_intro_url;
    }
    // If it's an API path, prepend the API base URL
    if (formData.voice_intro_url.startsWith('/api/')) {
      // Remove /api prefix since API already includes it
      const path = formData.voice_intro_url.replace('/api/', '/');
      return `${API}${path}`;
    }
    // Otherwise prepend API
    return `${API}${formData.voice_intro_url}`;
  };

  const playVoiceIntro = () => {
    const audioUrl = getVoiceIntroFullUrl();
    if (!audioUrl) {
      toast.error("No voice intro to play");
      return;
    }

    // Create audio element if it doesn't exist
    if (!audioPlayerRef.current) {
      audioPlayerRef.current = new Audio();
      audioPlayerRef.current.onended = () => {
        if (isMountedRef.current) {
          setIsPlayingVoice(false);
        }
      };
      audioPlayerRef.current.onerror = (e) => {
        // Only show error if component is still mounted AND audio has a valid src
        // This prevents errors when navigating away or during cleanup
        if (isMountedRef.current && audioPlayerRef.current?.src && audioPlayerRef.current.src !== '') {
          const errorCode = e?.target?.error?.code;
          // Only show toast for actual playback errors, not for aborted loads
          // MediaError codes: 1=ABORTED, 2=NETWORK, 3=DECODE, 4=SRC_NOT_SUPPORTED
          if (errorCode && errorCode !== 1) {
            console.error("Audio playback error:", e);
            toast.error("Failed to play voice intro");
          }
        }
        if (isMountedRef.current) {
          setIsPlayingVoice(false);
        }
      };
    }

    if (isPlayingVoice) {
      // Pause
      audioPlayerRef.current.pause();
      setIsPlayingVoice(false);
    } else {
      // Play
      audioPlayerRef.current.src = audioUrl;
      audioPlayerRef.current.play()
        .then(() => {
          if (isMountedRef.current) {
            setIsPlayingVoice(true);
          }
        })
        .catch((error) => {
          // Don't show error for AbortError (happens when navigating away)
          if (error.name !== 'AbortError' && isMountedRef.current) {
            console.error("Playback failed:", error);
            toast.error("Failed to play voice intro");
          }
        });
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      // Mark as unmounted first to prevent error toasts
      isMountedRef.current = false;
      
      // Stop audio playback gracefully
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.src = ''; // Clear src to prevent error events
        audioPlayerRef.current = null;
      }
      
      // Full cleanup of recording state
      resetVoiceRecordingState();
    };
  }, []);

  const mainPhoto = formData.photos[0] || user?.avatar_url;
  const hasSafetyHalo = user?.reports_count === 0 && user?.blocks_received_count === 0;

  return (
    <Layout>
      {/* Redesigned Profile Edit Screen */}
      <div className="min-h-screen pb-24" style={{ background: 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)' }}>
        {/* Header with gradient underline */}
        <div className="sticky top-0 z-40 backdrop-blur-xl bg-slate-950/80 border-b border-purple-500/20">
          <div className="max-w-lg mx-auto px-5 py-5 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-white tracking-tight">Edit Your Profile</h1>
              <div className="h-0.5 w-24 mt-1.5 rounded-full bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400" />
            </div>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="px-6 h-11 rounded-full font-medium shadow-lg shadow-purple-500/20 transition-all hover:shadow-purple-500/30 hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)' }}
              data-testid="save-profile-btn"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
            </Button>
          </div>
        </div>

        <div className="max-w-lg mx-auto px-5 py-8 space-y-10">
          
          {/* Photos Section */}
          <section className="space-y-5">
            <div>
              <h2 className="text-lg font-medium text-white/90">Your Photos</h2>
              <p className="text-sm mt-1" style={{ color: '#E7D9FF' }}>Choose photos that feel like you today</p>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              {/* Main Photo */}
              <div className="col-span-2 row-span-2">
                <div
                  className="aspect-[3/4] rounded-3xl overflow-hidden relative cursor-pointer transition-all duration-300 hover:scale-[1.02]"
                  style={{ 
                    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%)',
                    border: '2px dashed rgba(168, 85, 247, 0.3)',
                    boxShadow: '0 4px 20px rgba(139, 92, 246, 0.1)'
                  }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {mainPhoto ? (
                    <img src={mainPhoto} alt="Main" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mb-3">
                        <Camera className="w-7 h-7 text-purple-400" />
                      </div>
                      <span className="text-sm" style={{ color: '#E7D9FF' }}>Add main photo</span>
                    </div>
                  )}
                  {uploadingPhoto === 0 && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center">
                      <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
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
                  className="aspect-square rounded-2xl overflow-hidden relative cursor-pointer transition-all duration-300 hover:scale-105"
                  style={{ 
                    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%)',
                    border: '2px dashed rgba(168, 85, 247, 0.25)',
                  }}
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
                    <div className="w-full h-full flex items-center justify-center">
                      <Plus className="w-6 h-6 text-purple-400/60" />
                    </div>
                  )}
                  {uploadingPhoto === index && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Preview Button */}
          <Button
            onClick={() => setShowPreview(true)}
            variant="outline"
            className="w-full h-14 rounded-2xl bg-white/5 hover:bg-white/10 border-purple-400/20 text-white/90 font-medium transition-all hover:border-purple-400/40"
            data-testid="preview-profile-btn"
          >
            <Eye className="w-5 h-5 mr-2.5 text-purple-400" />
            Preview My Profile
          </Button>

          {/* Display Name (locked) */}
          <section className="space-y-3">
            <Label className="text-white/70 text-sm font-medium">Display Name</Label>
            <div 
              className="h-16 px-6 rounded-[20px] flex items-center cursor-not-allowed"
              style={{ 
                background: 'rgba(231, 217, 255, 0.08)',
                border: '2px solid rgba(231, 217, 255, 0.2)',
                boxShadow: '0 0 20px rgba(231, 217, 255, 0.06), inset 0 1px 2px rgba(0, 0, 0, 0.1)',
                color: 'rgba(231, 217, 255, 0.5)'
              }}
            >
              {formData.display_name}
            </div>
            <p className="text-xs pl-1" style={{ color: '#E7D9FF', opacity: 0.7 }}>Set during registration • cannot be changed</p>
          </section>

          {/* Bio Section */}
          <section className="space-y-3">
            <Label className="text-white/70 text-sm font-medium">About You</Label>
            <Textarea
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              placeholder="Share a little about yourself..."
              maxLength={MAX_BIO_LENGTH}
              className="profile-input min-h-32 px-6 py-5 rounded-[20px] text-white resize-none transition-all duration-300"
              style={{ 
                background: 'rgba(231, 217, 255, 0.12)',
                border: '2px solid rgba(243, 232, 255, 0.25)',
                boxShadow: '0 0 24px rgba(231, 217, 255, 0.08), inset 0 1px 2px rgba(0, 0, 0, 0.08)',
              }}
            />
            <div className="flex justify-between text-xs px-1" style={{ color: '#E7D9FF', opacity: 0.7 }}>
              <span>Minimum {MIN_BIO_LENGTH} characters</span>
              <span>{formData.bio.length}/{MAX_BIO_LENGTH}</span>
            </div>
          </section>

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />

          {/* Your Vibe Today Section */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-pink-400" />
              </div>
              <div>
                <h2 className="text-lg font-medium text-white/90">Your vibe today</h2>
                <p className="text-sm" style={{ color: '#E7D9FF', opacity: 0.8 }}>Help others feel your energy</p>
              </div>
            </div>

            {/* Presence Note */}
            <div className="space-y-2.5">
              <Label className="text-white/60 text-sm">Presence Note</Label>
              <p className="text-xs pl-1" style={{ color: '#E7D9FF' }}>A tiny hint of who you are — even while blurred.</p>
              <Input
                value={formData.presence_note}
                onChange={(e) => setFormData({ ...formData, presence_note: e.target.value })}
                placeholder="e.g., Here for good vibes..."
                maxLength={MAX_PRESENCE_NOTE_LENGTH}
                className="profile-input h-16 px-6 rounded-[20px] text-white transition-all duration-300"
                style={{ 
                  background: 'rgba(231, 217, 255, 0.12)',
                  border: '2px solid rgba(243, 232, 255, 0.25)',
                  boxShadow: '0 0 24px rgba(231, 217, 255, 0.08), inset 0 1px 2px rgba(0, 0, 0, 0.08)',
                }}
              />
              <div className="text-right text-xs pr-1" style={{ color: '#E7D9FF', opacity: 0.7 }}>
                {formData.presence_note.length}/{MAX_PRESENCE_NOTE_LENGTH}
              </div>
            </div>

            {/* Shy Indicator - Pill Style Toggle */}
            <div 
              className="p-6 rounded-[20px] transition-all duration-300"
              style={{ 
                background: formData.shy_indicator 
                  ? 'rgba(236, 72, 153, 0.15)'
                  : 'rgba(231, 217, 255, 0.1)',
                border: formData.shy_indicator 
                  ? '2px solid rgba(236, 72, 153, 0.35)'
                  : '2px solid rgba(243, 232, 255, 0.2)',
                boxShadow: formData.shy_indicator
                  ? '0 0 24px rgba(236, 72, 153, 0.12)'
                  : '0 0 20px rgba(231, 217, 255, 0.06)',
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                    formData.shy_indicator ? 'bg-pink-500/30' : 'bg-white/5'
                  }`}>
                    <Heart className={`w-4 h-4 transition-colors ${formData.shy_indicator ? 'text-pink-400' : 'text-purple-400/50'}`} />
                  </div>
                  <div>
                    <p className={`font-medium transition-colors ${formData.shy_indicator ? 'text-pink-200' : 'text-white/70'}`}>
                      Shy to start
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: '#E7D9FF', opacity: 0.7 }}>
                      Show "May be shy to start" on your profile.
                    </p>
                  </div>
                </div>
                
                {/* Pill Toggle */}
                <button
                  onClick={() => setFormData({ ...formData, shy_indicator: !formData.shy_indicator })}
                  className={`relative w-14 h-8 rounded-full transition-all duration-300 ${
                    formData.shy_indicator 
                      ? 'bg-gradient-to-r from-pink-500 to-purple-500 shadow-lg shadow-pink-500/30' 
                      : 'bg-white/10'
                  }`}
                >
                  <div 
                    className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300 ${
                      formData.shy_indicator ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </section>

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />

          {/* A Little Personality Section */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                <Heart className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h2 className="text-lg font-medium text-white/90">A little personality</h2>
                <p className="text-sm" style={{ color: '#E7D9FF', opacity: 0.8 }}>Fun details that spark conversation</p>
              </div>
            </div>

            {/* Celebrity Crush */}
            <div className="space-y-2.5">
              <Label className="text-white/60 text-sm">Celebrity Crush</Label>
              <p className="text-xs pl-1" style={{ color: '#E7D9FF' }}>Just for fun — who's your screen crush?</p>
              <Input
                value={formData.celebrity_crush}
                onChange={(e) => setFormData({ ...formData, celebrity_crush: e.target.value })}
                placeholder="e.g., Timothée Chalamet"
                maxLength={MAX_CELEBRITY_CRUSH_LENGTH}
                className="profile-input h-16 px-6 rounded-[20px] text-white transition-all duration-300"
                style={{ 
                  background: 'rgba(231, 217, 255, 0.12)',
                  border: '2px solid rgba(243, 232, 255, 0.25)',
                  boxShadow: '0 0 24px rgba(231, 217, 255, 0.08), inset 0 1px 2px rgba(0, 0, 0, 0.08)',
                }}
              />
            </div>
          </section>

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />

          {/* Your Voice Section */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center">
                <Volume2 className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h2 className="text-lg font-medium text-white/90">Say hello in your own voice</h2>
                <p className="text-sm" style={{ color: '#E7D9FF', opacity: 0.8 }}>Your voice plays only after mutual curiosity.</p>
              </div>
            </div>
            
            {/* Mic Permission Denied Warning */}
            {micPermissionDenied && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-400/20">
                <p className="text-amber-200/80 text-sm">
                  Microphone access was denied. Please enable it in your browser settings.
                </p>
              </div>
            )}
            
            {/* Voice Intro States */}
            {uploadingVoice ? (
              <div 
                className="flex items-center gap-4 p-5 rounded-2xl"
                style={{ 
                  background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%)',
                  border: '1px solid rgba(168, 85, 247, 0.2)'
                }}
              >
                <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                <span className="text-purple-200">Saving your voice intro...</span>
              </div>
            ) : formData.voice_intro_url ? (
              /* Voice Intro Recorded */
              <div 
                className="p-5 rounded-2xl"
                style={{ 
                  background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(168, 85, 247, 0.15) 100%)',
                  border: '1px solid rgba(168, 85, 247, 0.25)'
                }}
              >
                <div className="flex items-center gap-4">
                  {/* Play Button with Glow */}
                  <button
                    onClick={playVoiceIntro}
                    className={`relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isPlayingVoice 
                        ? 'bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg shadow-purple-500/40' 
                        : 'bg-purple-500/20 hover:bg-purple-500/30'
                    }`}
                  >
                    {/* Glow ring when playing */}
                    {isPlayingVoice && (
                      <div className="absolute inset-0 rounded-full animate-ping bg-purple-500/30" />
                    )}
                    {isPlayingVoice ? (
                      <Pause className="w-6 h-6 text-white relative z-10" />
                    ) : (
                      <Play className="w-6 h-6 text-purple-300 ml-0.5 relative z-10" />
                    )}
                  </button>
                  
                  <div className="flex-1">
                    <span className={`font-medium ${isPlayingVoice ? 'text-purple-200' : 'text-white/80'}`}>
                      {isPlayingVoice ? "Playing..." : "Voice intro ready"}
                    </span>
                    <p className="text-xs mt-0.5" style={{ color: '#E7D9FF', opacity: 0.7 }}>
                      {isPlayingVoice ? "Tap to pause" : "Tap to preview"}
                    </p>
                  </div>
                  
                  {/* Remove Button */}
                  <button
                    onClick={removeVoiceIntro}
                    disabled={isPlayingVoice}
                    className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all disabled:opacity-50"
                  >
                    <X className="w-4 h-4 text-white/50" />
                  </button>
                </div>
              </div>
            ) : recordingVoice ? (
              /* Recording in Progress - Soft Purple/Pink Style */
              <div className="space-y-4">
                <div 
                  className="p-5 rounded-2xl"
                  style={{ 
                    background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.15) 0%, rgba(168, 85, 247, 0.15) 100%)',
                    border: '1px solid rgba(236, 72, 153, 0.3)'
                  }}
                >
                  <div className="flex items-center gap-4">
                    {/* Animated Recording Ring */}
                    <div className="relative w-14 h-14">
                      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-pink-500/30 to-purple-500/30 animate-pulse" />
                      <div className="absolute inset-2 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center">
                        <div className="w-3 h-3 rounded-full bg-white animate-pulse" />
                      </div>
                      {/* Outer glow rings */}
                      <div className="absolute -inset-1 rounded-full border border-pink-400/20 animate-ping" style={{ animationDuration: '2s' }} />
                    </div>
                    
                    <div className="flex-1">
                      <span className="text-pink-200 font-medium">Recording...</span>
                      <p className="text-xs mt-0.5" style={{ color: '#E7D9FF', opacity: 0.7 }}>
                        {recordingTime < 5 ? `${5 - recordingTime}s more for minimum` : 'Ready to save'}
                      </p>
                    </div>
                    
                    <span className="text-3xl font-light text-pink-300/80 tabular-nums">{recordingTime}s</span>
                  </div>
                  
                  {/* Minimal Waveform Bar */}
                  <div className="mt-4 flex items-center justify-center gap-1 h-8">
                    {[...Array(20)].map((_, i) => (
                      <div
                        key={i}
                        className="w-1 rounded-full bg-gradient-to-t from-pink-500 to-purple-400 transition-all duration-150"
                        style={{ 
                          height: `${Math.random() * 24 + 8}px`,
                          opacity: 0.6 + Math.random() * 0.4,
                          animation: `pulse ${0.3 + Math.random() * 0.4}s ease-in-out infinite alternate`
                        }}
                      />
                    ))}
                  </div>
                </div>
                
                {/* Stop Button */}
                <Button
                  onClick={stopVoiceRecording}
                  disabled={recordingTime < 5}
                  className={`w-full h-14 rounded-2xl font-medium transition-all ${
                    recordingTime < 5
                      ? 'bg-white/5 text-white/30 cursor-not-allowed'
                      : 'shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30'
                  }`}
                  style={recordingTime >= 5 ? { 
                    background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)' 
                  } : {}}
                >
                  <MicOff className="w-5 h-5 mr-2" />
                  {recordingTime < 5 ? `Wait ${5 - recordingTime}s more...` : "Stop & Save"}
                </Button>
              </div>
            ) : (
              /* Start Recording Button */
              <button
                onClick={startVoiceRecording}
                disabled={micPermissionDenied}
                className="w-full h-16 rounded-2xl font-medium transition-all duration-300 flex items-center justify-center gap-3 group disabled:opacity-50"
                style={{ 
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '2px dashed rgba(168, 85, 247, 0.3)',
                }}
              >
                <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center group-hover:bg-purple-500/30 transition-all">
                  <Mic className="w-5 h-5 text-purple-400" />
                </div>
                <span className="text-white/70 group-hover:text-white/90 transition-colors">
                  Record Voice Intro
                </span>
              </button>
            )}
          </section>

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />

          {/* Safety Halo */}
          {hasSafetyHalo && (
            <section 
              className="p-5 rounded-2xl"
              style={{ 
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(45, 212, 191, 0.1) 100%)',
                border: '1px solid rgba(16, 185, 129, 0.2)'
              }}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <p className="text-emerald-200 font-medium">Safety Halo Active</p>
                  <p className="text-xs mt-0.5" style={{ color: '#E7D9FF', opacity: 0.7 }}>
                    Visible after mutual curiosity • Based on respectful behavior
                  </p>
                </div>
              </div>
            </section>
          )}
          
          {/* Bottom padding for save button area */}
          <div className="h-4" />
        </div>
      </div>

      {/* Profile Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 bg-slate-950" data-testid="profile-preview-modal">
          {/* Header */}
          <div className="sticky top-0 z-50 bg-slate-950/95 backdrop-blur border-b border-white/10">
            <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
              <h1 className="text-lg font-bold text-white">Profile Preview</h1>
              <button
                onClick={() => {
                  setShowPreview(false);
                  setPreviewAudioPlaying(false);
                  if (previewAudioRef.current) {
                    previewAudioRef.current.pause();
                  }
                }}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                data-testid="close-preview-btn"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            
            {/* Mode Toggle */}
            <div className="max-w-lg mx-auto px-4 pb-4">
              <div className="flex bg-white/5 rounded-xl p-1">
                <button
                  onClick={() => setPreviewMode("before")}
                  className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                    previewMode === "before"
                      ? "bg-indigo-500 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                  data-testid="preview-before-tab"
                >
                  <EyeOff className="w-4 h-4" />
                  Before Reveal
                </button>
                <button
                  onClick={() => setPreviewMode("after")}
                  className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                    previewMode === "after"
                      ? "bg-indigo-500 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                  data-testid="preview-after-tab"
                >
                  <Eye className="w-4 h-4" />
                  After Reveal
                </button>
              </div>
            </div>
          </div>

          {/* Preview Content */}
          <div className="max-w-lg mx-auto px-4 py-6 pb-24 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 140px)' }}>
            {previewMode === "before" ? (
              /* Before Reveal - Blurred view */
              <div className="space-y-6">
                <p className="text-sm text-slate-400 text-center mb-6">
                  This is how others see you before mutual curiosity
                </p>
                
                {/* Blurred Photo */}
                <div className="relative aspect-[3/4] max-w-xs mx-auto rounded-2xl overflow-hidden bg-white/5">
                  {mainPhoto ? (
                    <img 
                      src={mainPhoto} 
                      alt="Profile" 
                      className="w-full h-full object-cover"
                      style={{ filter: 'blur(8px)' }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500">
                      <User className="w-16 h-16" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  
                  {/* Limited Info Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="text-xl font-bold text-white">{formData.display_name || "Your Name"}</h3>
                    {formData.presence_note && (
                      <p className="text-sm text-white/80 mt-1">{formData.presence_note}</p>
                    )}
                    {formData.shy_indicator && (
                      <span className="inline-flex items-center gap-1 mt-2 px-2 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs">
                        <Sparkles className="w-3 h-3" />
                        May be shy to start
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Hidden fields indicator */}
                <div className="text-center space-y-3">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 text-slate-400 text-sm">
                    <EyeOff className="w-4 h-4" />
                    Bio hidden until reveal
                  </div>
                  {formData.voice_intro_url && (
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 text-slate-400 text-sm">
                      <Volume2 className="w-4 h-4" />
                      Voice intro unlocks after reveal
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* After Reveal - Full profile view */
              <div className="space-y-6">
                <p className="text-sm text-slate-400 text-center mb-6">
                  This is how others see you after mutual curiosity
                </p>
                
                {/* Full Photo */}
                <div className="relative aspect-[3/4] max-w-xs mx-auto rounded-2xl overflow-hidden bg-white/5">
                  {mainPhoto ? (
                    <img 
                      src={mainPhoto} 
                      alt="Profile" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500">
                      <User className="w-16 h-16" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  
                  {/* Full Info Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="text-xl font-bold text-white">{formData.display_name || "Your Name"}</h3>
                    {formData.presence_note && (
                      <p className="text-sm text-white/80 mt-1">{formData.presence_note}</p>
                    )}
                    
                    {/* Safety Halo */}
                    {hasSafetyHalo && (
                      <span className="inline-flex items-center gap-1 mt-2 px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs">
                        <Shield className="w-3 h-3" />
                        Safety Halo
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Bio */}
                {formData.bio && (
                  <div className="bg-white/5 rounded-xl p-4">
                    <h4 className="text-sm font-medium text-slate-400 mb-2">About</h4>
                    <p className="text-white">{formData.bio}</p>
                  </div>
                )}
                
                {/* Celebrity Crush */}
                {formData.celebrity_crush && (
                  <div className="bg-white/5 rounded-xl p-4">
                    <h4 className="text-sm font-medium text-slate-400 mb-2">Celebrity Crush</h4>
                    <p className="text-white">{formData.celebrity_crush}</p>
                  </div>
                )}
                
                {/* Voice Intro */}
                {formData.voice_intro_url && (
                  <div className="bg-white/5 rounded-xl p-4">
                    <h4 className="text-sm font-medium text-slate-400 mb-3">Voice Intro</h4>
                    <button
                      onClick={() => {
                        if (!previewAudioRef.current) {
                          previewAudioRef.current = new Audio();
                          previewAudioRef.current.onended = () => setPreviewAudioPlaying(false);
                        }
                        
                        if (previewAudioPlaying) {
                          previewAudioRef.current.pause();
                          setPreviewAudioPlaying(false);
                        } else {
                          const audioUrl = formData.voice_intro_url.startsWith('http') 
                            ? formData.voice_intro_url 
                            : `${API}${formData.voice_intro_url.replace('/api/', '/')}`;
                          previewAudioRef.current.src = audioUrl;
                          previewAudioRef.current.play()
                            .then(() => setPreviewAudioPlaying(true))
                            .catch(() => toast.error("Failed to play voice intro"));
                        }
                      }}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                        previewAudioPlaying 
                          ? "bg-indigo-500 text-white" 
                          : "bg-white/5 text-white hover:bg-white/10"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        previewAudioPlaying ? "bg-white/20" : "bg-indigo-500/20"
                      }`}>
                        {previewAudioPlaying ? (
                          <Pause className="w-5 h-5" />
                        ) : (
                          <Play className="w-5 h-5 ml-0.5" />
                        )}
                      </div>
                      <span className="font-medium">
                        {previewAudioPlaying ? "Playing..." : "Play Voice Intro"}
                      </span>
                    </button>
                  </div>
                )}
                
                {/* Shy Indicator */}
                {formData.shy_indicator && (
                  <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    <span className="text-amber-300">May be shy to start</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Profile;
