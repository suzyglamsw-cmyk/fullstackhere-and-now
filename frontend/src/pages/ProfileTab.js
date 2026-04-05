import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  MapPin,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Home,
  Users,
  Target,
  Crown,
} from "lucide-react";

const MAX_BIO_LENGTH = 500;
const MAX_PRESENCE_NOTE_LENGTH = 40;
const MAX_MY_TYPE_LENGTH = 40;
const MIN_MY_TYPE_LENGTH = 10;
const MIN_BIO_LENGTH = 10;

// Intent options
const INTENT_OPTIONS = [
  { value: "", label: "Select your intent..." },
  { value: "dating", label: "Dating" },
  { value: "friends", label: "Friends" },
  { value: "open_to_both", label: "Open to both" },
];

// Who I'm open to meeting options (PRIVATE - for matching only)
const OPEN_TO_MEETING_OPTIONS = [
  { value: "", label: "Select..." },
  { value: "men", label: "Men" },
  { value: "women", label: "Women" },
  { value: "everyone", label: "Everyone" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

// Country and region data
const COUNTRIES_REGIONS = {
  "United Kingdom": ["England", "Scotland", "Wales", "Northern Ireland"],
  "United States": ["Northeast", "Southeast", "Midwest", "Southwest", "West Coast"],
  "Canada": ["Ontario", "Quebec", "British Columbia", "Alberta", "Other"],
  "Australia": ["New South Wales", "Victoria", "Queensland", "Western Australia", "Other"],
  "Ireland": ["Leinster", "Munster", "Connacht", "Ulster"],
  "Germany": ["North", "South", "East", "West"],
  "France": ["North", "South", "East", "West", "Paris Region"],
  "Spain": ["North", "South", "East", "West", "Madrid Region"],
  "Italy": ["North", "Central", "South"],
  "Netherlands": ["North", "South", "Central"],
  "Other": ["Not specified"],
};

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
  const [previewMode, setPreviewMode] = useState("before");
  const [previewAudioPlaying, setPreviewAudioPlaying] = useState(false);
  const [previewPhotoIndex, setPreviewPhotoIndex] = useState(0);
  const [hidePhotoInVenues, setHidePhotoInVenues] = useState(false);
  const [privacyLoading, setPrivacyLoading] = useState(false);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const streamRef = useRef(null);
  const recordingTimeRef = useRef(0);
  const audioPlayerRef = useRef(null);
  const isMountedRef = useRef(true);
  const previewAudioRef = useRef(null);

  const [formData, setFormData] = useState({
    display_name: "",
    bio: "",
    photos: ["", "", ""],
    presence_note: "",
    my_type_of_person: "",
    intent: "",
    who_open_to_meeting: "",
    home_country: "",
    home_region: "",
    shy_indicator: false,
    voice_intro_url: "",
    // Gender/Rainbow visibility fields
    show_as: "",
    seeking: [],
    rainbow: false,
  });

  // Track if show_as is being changed (to trigger reset warning)
  const [showAsChanged, setShowAsChanged] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        display_name: user.display_name || "",
        bio: user.bio || "",
        photos: user.photos || ["", "", ""],
        presence_note: user.presence_note || "",
        my_type_of_person: user.my_type_of_person || "",
        intent: user.intent || "",
        who_open_to_meeting: user.who_open_to_meeting || "",
        home_country: user.home_country || "",
        home_region: user.home_region || "",
        shy_indicator: user.shy_indicator || false,
        voice_intro_url: user.voice_intro_url || "",
        // Gender/Rainbow visibility fields
        show_as: user.show_as || "",
        seeking: user.seeking || [],
        rainbow: user.rainbow || false,
      });
      setShowAsChanged(false);
      // Fetch privacy settings
      fetchPrivacySettings();
    }
  }, [user]);

  const fetchPrivacySettings = async () => {
    try {
      const response = await axios.get(`${API}/settings/privacy`);
      setHidePhotoInVenues(response.data.hide_photo_in_venues || false);
    } catch (error) {
      // Silently fail - use default
    }
  };

  const handleToggleHidePhotoInVenues = async () => {
    const newValue = !hidePhotoInVenues;
    setHidePhotoInVenues(newValue);
    setPrivacyLoading(true);
    
    try {
      await axios.put(`${API}/settings/privacy`, { hide_photo_in_venues: newValue });
      toast.success(newValue ? "Photo will be hidden in venues" : "Photo will be visible in venues");
    } catch (error) {
      setHidePhotoInVenues(!newValue); // Revert
      toast.error("Failed to update setting");
    } finally {
      setPrivacyLoading(false);
    }
  };

  const handlePhotoUpload = async (index, file) => {
    if (!file) return;

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Photo must be under 5MB");
      return;
    }

    setUploadingPhoto(index);
    const formDataUpload = new FormData();
    formDataUpload.append("file", file);
    formDataUpload.append("slot", index.toString());

    try {
      // Photo upload auto-saves to backend independently - no form validation needed
      const response = await axios.post(`${API}/photos/upload`, formDataUpload, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // Backend returns the complete updated photos array
      const updatedPhotos = response.data.photos || [...formData.photos];
      updatedPhotos[index] = response.data.url;
      
      // Ensure array has 3 slots
      while (updatedPhotos.length < 3) {
        updatedPhotos.push("");
      }
      
      // Update local state for UI
      setFormData(prev => ({ ...prev, photos: updatedPhotos }));
      
      // Update user context directly with complete photos array
      updateUser({ 
        photos: updatedPhotos, 
        avatar_url: index === 0 ? response.data.url : user?.avatar_url 
      });
      
      // Show success - photo auto-saved
      toast.success("Photo saved!");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to upload photo"));
    } finally {
      setUploadingPhoto(null);
    }
  };

  const handlePhotoDelete = async (index) => {
    try {
      // Delete photo from backend independently
      const response = await axios.delete(`${API}/photos/${index}`);
      
      // Backend returns the complete updated photos array
      const updatedPhotos = response.data.photos || [...formData.photos];
      updatedPhotos[index] = "";
      
      // Ensure array has 3 slots
      while (updatedPhotos.length < 3) {
        updatedPhotos.push("");
      }
      
      // Update local state
      setFormData(prev => ({ ...prev, photos: updatedPhotos }));
      
      // Update user context with complete photos array
      updateUser({ 
        photos: updatedPhotos,
        avatar_url: index === 0 ? "" : user?.avatar_url
      });
      
      toast.success("Photo removed");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to remove photo"));
    }
  };

  const handleSave = async () => {
    // Validation only runs on explicit Save button press
    // Photos are auto-saved independently, so we only validate text fields here
    
    // Required field: bio (About me)
    if (!formData.bio || formData.bio.trim().length === 0) {
      toast.error("Please add something about yourself in the 'About me' field.");
      return;
    }
    
    if (formData.bio.trim().length < MIN_BIO_LENGTH) {
      toast.error("Add a short line so people get a sense of your vibe (at least 10 characters).");
      return;
    }
    
    // Required field: my_type_of_person (Here to...)
    if (!formData.my_type_of_person || formData.my_type_of_person.trim().length === 0) {
      toast.error("Please tell us who you click with in the 'Here to...' field.");
      return;
    }
    
    if (formData.my_type_of_person.trim().length < MIN_MY_TYPE_LENGTH) {
      toast.error("Tell us a bit more about who you click with (at least 10 characters).");
      return;
    }

    // If show_as changed, require re-selection of seeking and intent
    if (showAsChanged) {
      if (!formData.seeking || formData.seeking.length === 0) {
        toast.error("Please select who you're open to meeting after changing your gender.");
        return;
      }
      if (!formData.intent) {
        toast.error("Please select your intent after changing your gender.");
        return;
      }
    }

    setSaving(true);
    try {
      // Save non-photo profile fields only
      // Photos are already auto-saved independently
      const response = await axios.put(`${API}/auth/profile`, {
        bio: formData.bio,
        presence_note: formData.presence_note,
        my_type_of_person: formData.my_type_of_person,
        intent: formData.intent,
        who_open_to_meeting: formData.who_open_to_meeting,
        home_country: formData.home_country,
        home_region: formData.home_region,
        shy_indicator: formData.shy_indicator,
        // Gender/Rainbow visibility fields
        show_as: formData.show_as,
        seeking: formData.seeking,
        rainbow: formData.rainbow,
      });
      
      updateUser(response.data);
      setShowAsChanged(false);
      toast.success("Profile saved!");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to save profile"));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleVisibility = async () => {
    try {
      const response = await axios.put(`${API}/auth/visibility`);
      updateUser({ is_visible: response.data.is_visible });
      toast.success(
        response.data.is_visible
          ? "You're now visible to others"
          : "You're now hidden from discovery"
      );
    } catch (error) {
      toast.error("Failed to update visibility");
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
  
  // Get all valid photos for carousel (filter out empty strings)
  const allPhotos = formData.photos.filter(p => p && p.trim() !== '');
  const hasMultiplePhotos = allPhotos.length > 1;
  
  // Check if user is premium
  const isPremium = user?.is_premium === true;
  
  // Carousel navigation handlers
  const handleNextPhoto = () => {
    setPreviewPhotoIndex((prev) => (prev + 1) % allPhotos.length);
  };
  
  const handlePrevPhoto = () => {
    setPreviewPhotoIndex((prev) => (prev - 1 + allPhotos.length) % allPhotos.length);
  };

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
          
          {/* Photos Section - Auto-saves independently */}
          <section className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium text-purple-100">Your Photos</h2>
                <p className="text-sm mt-1 text-purple-300/70">Choose photos that feel like you today</p>
              </div>
              <span className="text-xs text-purple-400/60 flex items-center gap-1">
                <Check className="w-3 h-3" />
                Auto-saved
              </span>
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
                  onClick={() => !mainPhoto && fileInputRef.current?.click()}
                >
                  {mainPhoto ? (
                    <>
                      <img src={mainPhoto} alt="Main" className="w-full h-full object-cover" />
                      {/* Photo actions overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity">
                        <div className="absolute bottom-4 left-4 right-4 flex gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                            className="flex-1 py-2 rounded-xl bg-white/20 backdrop-blur-sm text-white text-sm font-medium hover:bg-white/30 transition-colors"
                          >
                            Change
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handlePhotoDelete(0); }}
                            className="py-2 px-4 rounded-xl bg-red-500/20 backdrop-blur-sm text-red-300 text-sm font-medium hover:bg-red-500/30 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mb-3">
                        <Camera className="w-7 h-7 text-purple-400" />
                      </div>
                      <span className="text-sm text-purple-300/70">Add main photo</span>
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
                    if (!formData.photos[index]) {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.accept = "image/*";
                      input.onchange = (e) => handlePhotoUpload(index, e.target.files?.[0]);
                      input.click();
                    }
                  }}
                >
                  {formData.photos[index] ? (
                    <>
                      <img src={formData.photos[index]} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" />
                      {/* Photo actions overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity flex items-end justify-center pb-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handlePhotoDelete(index); }}
                          className="p-1.5 rounded-full bg-red-500/30 backdrop-blur-sm text-red-300 hover:bg-red-500/50 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
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
            onClick={() => {
              setPreviewPhotoIndex(0); // Reset to first photo when opening
              setShowPreview(true);
            }}
            variant="outline"
            className="w-full h-14 rounded-2xl bg-white/5 hover:bg-white/10 border-purple-400/20 text-white/90 font-medium transition-all hover:border-purple-400/40"
            data-testid="preview-profile-btn"
          >
            <Eye className="w-5 h-5 mr-2.5 text-purple-400" />
            Preview My Profile
          </Button>

          {/* Quick Controls - Toggles at Top for Easy Access */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h2 className="text-lg font-medium text-purple-100">Quick controls</h2>
                <p className="text-sm text-purple-300/70">Toggle these anytime</p>
              </div>
            </div>

            {/* Shy Indicator Toggle */}
            <div 
              className="p-5 rounded-[20px] transition-all duration-300"
              style={{ 
                background: 'rgba(139, 92, 246, 0.08)',
                border: '2px solid rgba(168, 85, 247, 0.3)',
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
                    <p className={`font-medium transition-colors ${formData.shy_indicator ? 'text-pink-200' : 'text-purple-200/70'}`}>
                      I'm feeling shy today
                    </p>
                    <p className="text-xs mt-0.5 text-purple-300/60">
                      Shows "May be shy to start" on your profile
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={() => setFormData({ ...formData, shy_indicator: !formData.shy_indicator })}
                  className={`relative w-14 h-8 rounded-full transition-all duration-300 ${
                    formData.shy_indicator 
                      ? 'bg-gradient-to-r from-pink-500 to-purple-500 shadow-lg shadow-pink-500/30' 
                      : 'bg-white/10'
                  }`}
                  data-testid="shy-toggle"
                >
                  <div 
                    className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300 ${
                      formData.shy_indicator ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Hide from Discovery Toggle */}
            <div 
              className="p-5 rounded-[20px] transition-all duration-300"
              style={{ 
                background: 'rgba(139, 92, 246, 0.08)',
                border: '2px solid rgba(168, 85, 247, 0.3)',
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                    !user?.is_visible ? 'bg-amber-500/30' : 'bg-white/5'
                  }`}>
                    {user?.is_visible ? (
                      <Eye className={`w-4 h-4 text-emerald-400`} />
                    ) : (
                      <EyeOff className={`w-4 h-4 text-amber-400`} />
                    )}
                  </div>
                  <div>
                    <p className={`font-medium transition-colors ${!user?.is_visible ? 'text-amber-200' : 'text-purple-200/70'}`}>
                      Hide me from discovery
                    </p>
                    <p className="text-xs mt-0.5 text-purple-300/60">
                      {user?.is_visible ? "You're visible to others" : "You won't appear in discovery"}
                    </p>
                  </div>
                </div>
                
                <button
                  data-testid="visibility-toggle"
                  onClick={handleToggleVisibility}
                  className={`relative w-14 h-8 rounded-full transition-all duration-300 ${
                    !user?.is_visible 
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 shadow-lg shadow-amber-500/30' 
                      : 'bg-white/10'
                  }`}
                >
                  <div 
                    className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300 ${
                      !user?.is_visible ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Hide Photo in Venues Toggle */}
            <div 
              className="p-5 rounded-[20px] transition-all duration-300"
              style={{ 
                background: 'rgba(139, 92, 246, 0.08)',
                border: '2px solid rgba(168, 85, 247, 0.3)',
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 mr-4">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                    hidePhotoInVenues ? 'bg-emerald-500/30' : 'bg-white/5'
                  }`}>
                    <User className={`w-4 h-4 transition-colors ${hidePhotoInVenues ? 'text-emerald-400' : 'text-purple-400/50'}`} />
                  </div>
                  <div>
                    <p className={`font-medium transition-colors ${hidePhotoInVenues ? 'text-emerald-200' : 'text-purple-200/70'}`}>
                      Hide my photo in venues
                    </p>
                    <p className="text-xs mt-0.5 text-purple-300/60">
                      Shows a silhouette instead of your photo in venue lists
                    </p>
                  </div>
                </div>
                
                <button
                  data-testid="hide-photo-venues-toggle"
                  onClick={handleToggleHidePhotoInVenues}
                  disabled={privacyLoading}
                  className={`relative w-14 h-8 rounded-full transition-all duration-300 ${
                    hidePhotoInVenues 
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/30' 
                      : 'bg-white/10'
                  } ${privacyLoading ? 'opacity-50' : ''}`}
                >
                  <div 
                    className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300 ${
                      hidePhotoInVenues ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>
              {hidePhotoInVenues && (
                <div className="mt-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <p className="text-emerald-300 text-xs flex items-center gap-2">
                    <MapPin className="w-3 h-3" />
                    Active in Here & Now mode only. No effect in Not Here, Matches, or Chats.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />

          {/* Display Name (locked) */}
          <section className="space-y-3">
            <Label className="text-purple-200/70 text-sm font-medium">Display Name</Label>
            <div 
              className="h-16 px-6 rounded-[20px] flex items-center cursor-not-allowed"
              style={{ 
                background: 'rgba(139, 92, 246, 0.08)',
                border: '2px solid rgba(168, 85, 247, 0.3)',
                color: 'rgba(231, 217, 255, 0.6)'
              }}
            >
              {formData.display_name}
            </div>
            <p className="text-xs pl-1 text-purple-300/60">Set during registration • cannot be changed</p>
          </section>

          {/* Age Display (DOB set at registration - not editable) */}
          <section className="space-y-3">
            <Label className="text-purple-200/70 text-sm font-medium">Age</Label>
            <div 
              className="h-14 px-6 rounded-[20px] flex items-center cursor-not-allowed"
              style={{ 
                background: 'rgba(139, 92, 246, 0.08)',
                border: '2px solid rgba(168, 85, 247, 0.3)',
                color: 'rgba(231, 217, 255, 0.7)'
              }}
              data-testid="age-display"
            >
              {user?.age ? `${user.age} years old` : "Age not set"}
            </div>
            <p className="text-xs pl-1 text-purple-300/60">
              Set during registration • Only your age is shown to others
            </p>
          </section>

          {/* Bio Section */}
          <section className="space-y-3">
            <Label className="text-purple-200/70 text-sm font-medium">About You</Label>
            <Textarea
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              placeholder="Share a little about yourself..."
              maxLength={MAX_BIO_LENGTH}
              className="min-h-24 px-6 py-4 rounded-[20px] text-white placeholder:text-purple-300/40"
              style={{
                background: 'rgba(139, 92, 246, 0.08)',
                border: '2px solid rgba(168, 85, 247, 0.3)',
              }}
              data-testid="bio-textarea"
            />
            <div className="flex justify-between text-xs px-1 text-purple-300/60">
              <span>Minimum {MIN_BIO_LENGTH} characters</span>
              <span>{formData.bio.length}/{MAX_BIO_LENGTH}</span>
            </div>
          </section>

          {/* Presence Note - Compact */}
          <section className="space-y-3">
            <Label className="text-purple-200/70 text-sm font-medium">Presence Note</Label>
            <p className="text-xs pl-1 text-purple-300/70">A tiny hint of who you are — visible even while blurred</p>
            <Input
              value={formData.presence_note}
              onChange={(e) => setFormData({ ...formData, presence_note: e.target.value })}
              placeholder="e.g., Here for good vibes..."
              maxLength={MAX_PRESENCE_NOTE_LENGTH}
              className="h-14 px-6 rounded-[20px] text-white placeholder:text-purple-300/40"
              style={{
                background: 'rgba(139, 92, 246, 0.08)',
                border: '2px solid rgba(168, 85, 247, 0.3)',
              }}
              data-testid="presence-note-input"
            />
            <div className="text-right text-xs pr-1 text-purple-300/60">
              {formData.presence_note.length}/{MAX_PRESENCE_NOTE_LENGTH}
            </div>
          </section>

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />

          {/* Gender & Identity Section */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-pink-500/20 flex items-center justify-center">
                <User className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h2 className="text-lg font-medium text-purple-100">Gender & Identity</h2>
                <p className="text-sm text-purple-300/70">Controls who sees you and who you see</p>
              </div>
            </div>

            {/* Show As (Gender Appearance) */}
            <div className="space-y-2.5">
              <Label className="text-purple-200/70 text-sm">I appear as</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  data-testid="show-as-male-btn"
                  onClick={() => {
                    const oldShowAs = formData.show_as;
                    if (oldShowAs && oldShowAs !== "male") {
                      // Changing gender - trigger reset
                      setFormData({ ...formData, show_as: "male", seeking: [], intent: "" });
                      setShowAsChanged(true);
                      toast.info("Gender changed. Please re-select who you're seeking and your intent.");
                    } else {
                      setFormData({ ...formData, show_as: "male" });
                    }
                  }}
                  className={`p-4 rounded-2xl border-2 transition-all flex items-center justify-center gap-3 ${
                    formData.show_as === "male"
                      ? "border-blue-400 bg-blue-500/20"
                      : "border-white/10 bg-white/5 hover:border-white/20"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
                    formData.show_as === "male" ? "bg-blue-500/30 text-blue-300" : "bg-white/10 text-slate-400"
                  }`}>
                    M
                  </div>
                  <span className={`font-medium ${formData.show_as === "male" ? "text-blue-200" : "text-slate-300"}`}>
                    Male
                  </span>
                </button>
                <button
                  type="button"
                  data-testid="show-as-female-btn"
                  onClick={() => {
                    const oldShowAs = formData.show_as;
                    if (oldShowAs && oldShowAs !== "female") {
                      // Changing gender - trigger reset
                      setFormData({ ...formData, show_as: "female", seeking: [], intent: "" });
                      setShowAsChanged(true);
                      toast.info("Gender changed. Please re-select who you're seeking and your intent.");
                    } else {
                      setFormData({ ...formData, show_as: "female" });
                    }
                  }}
                  className={`p-4 rounded-2xl border-2 transition-all flex items-center justify-center gap-3 ${
                    formData.show_as === "female"
                      ? "border-pink-400 bg-pink-500/20"
                      : "border-white/10 bg-white/5 hover:border-white/20"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
                    formData.show_as === "female" ? "bg-pink-500/30 text-pink-300" : "bg-white/10 text-slate-400"
                  }`}>
                    F
                  </div>
                  <span className={`font-medium ${formData.show_as === "female" ? "text-pink-200" : "text-slate-300"}`}>
                    Female
                  </span>
                </button>
              </div>
              {showAsChanged && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 mt-2">
                  <p className="text-amber-300 text-xs flex items-center gap-2">
                    <span className="text-amber-400">!</span>
                    You changed your gender. Please re-select your preferences below before saving.
                  </p>
                </div>
              )}
            </div>

            {/* Seeking (Multi-select) */}
            <div className="space-y-2.5">
              <Label className="text-purple-200/70 text-sm">I'm looking to meet</Label>
              <p className="text-xs pl-1 text-purple-300/70">Select one or both options</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  data-testid="seeking-male-btn"
                  onClick={() => {
                    const currentSeeking = formData.seeking || [];
                    const newSeeking = currentSeeking.includes("male")
                      ? currentSeeking.filter(s => s !== "male")
                      : [...currentSeeking, "male"];
                    setFormData({ ...formData, seeking: newSeeking });
                  }}
                  className={`p-4 rounded-2xl border-2 transition-all flex items-center justify-center gap-3 ${
                    (formData.seeking || []).includes("male")
                      ? "border-blue-400 bg-blue-500/20"
                      : "border-white/10 bg-white/5 hover:border-white/20"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    (formData.seeking || []).includes("male") ? "bg-blue-500/30 text-blue-300" : "bg-white/10 text-slate-400"
                  }`}>
                    M
                  </div>
                  <span className={`font-medium ${(formData.seeking || []).includes("male") ? "text-blue-200" : "text-slate-300"}`}>
                    Men
                  </span>
                </button>
                <button
                  type="button"
                  data-testid="seeking-female-btn"
                  onClick={() => {
                    const currentSeeking = formData.seeking || [];
                    const newSeeking = currentSeeking.includes("female")
                      ? currentSeeking.filter(s => s !== "female")
                      : [...currentSeeking, "female"];
                    setFormData({ ...formData, seeking: newSeeking });
                  }}
                  className={`p-4 rounded-2xl border-2 transition-all flex items-center justify-center gap-3 ${
                    (formData.seeking || []).includes("female")
                      ? "border-pink-400 bg-pink-500/20"
                      : "border-white/10 bg-white/5 hover:border-white/20"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    (formData.seeking || []).includes("female") ? "bg-pink-500/30 text-pink-300" : "bg-white/10 text-slate-400"
                  }`}>
                    F
                  </div>
                  <span className={`font-medium ${(formData.seeking || []).includes("female") ? "text-pink-200" : "text-slate-300"}`}>
                    Women
                  </span>
                </button>
              </div>
            </div>

            {/* Rainbow Toggle */}
            <div 
              className="p-5 rounded-[20px] transition-all duration-300"
              style={{ 
                background: formData.rainbow ? 'rgba(147, 51, 234, 0.15)' : 'rgba(139, 92, 246, 0.08)',
                border: formData.rainbow ? '2px solid rgba(167, 139, 250, 0.5)' : '2px solid rgba(168, 85, 247, 0.3)',
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 mr-4">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                    formData.rainbow ? 'bg-gradient-to-r from-red-500/30 via-yellow-500/30 to-blue-500/30' : 'bg-white/5'
                  }`}>
                    <span className="text-lg">🌈</span>
                  </div>
                  <div>
                    <p className={`font-medium transition-colors ${formData.rainbow ? 'text-purple-100' : 'text-purple-200/70'}`}>
                      Rainbow / Rainbow-friendly
                    </p>
                    <p className="text-xs mt-0.5 text-purple-300/60">
                      I'm LGBTQ+ and/or open to seeing LGBTQ+ people.
                    </p>
                  </div>
                </div>
                
                <button
                  type="button"
                  data-testid="rainbow-toggle"
                  onClick={() => setFormData({ ...formData, rainbow: !formData.rainbow })}
                  className={`relative w-14 h-8 rounded-full transition-all duration-300 ${
                    formData.rainbow 
                      ? 'bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 shadow-lg shadow-purple-500/30' 
                      : 'bg-white/10'
                  }`}
                >
                  <div 
                    className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300 ${
                      formData.rainbow ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </section>

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />

          {/* Connection Preferences Section */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                <Target className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h2 className="text-lg font-medium text-purple-100">Connection preferences</h2>
                <p className="text-sm text-purple-300/70">Help us find the right people for you</p>
              </div>
            </div>

            {/* Intent Dropdown */}
            <div className="space-y-2.5">
              <Label className="text-purple-200/70 text-sm">What are you here for?</Label>
              <div className="relative">
                <select
                  value={formData.intent}
                  onChange={(e) => setFormData({ ...formData, intent: e.target.value })}
                  className="w-full h-14 px-6 pr-12 rounded-[20px] text-white appearance-none cursor-pointer"
                  style={{ 
                    background: 'rgba(139, 92, 246, 0.08)',
                    border: showAsChanged && !formData.intent ? '2px solid rgba(251, 191, 36, 0.5)' : '2px solid rgba(168, 85, 247, 0.3)',
                  }}
                  data-testid="intent-select"
                >
                  {INTENT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-slate-900 text-white">
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400/50 pointer-events-none" />
              </div>
              {showAsChanged && !formData.intent && (
                <p className="text-amber-400 text-xs">Please select your intent</p>
              )}
            </div>

            {/* My Type of Person - Compact */}
            <div className="space-y-2.5">
              <Label className="text-purple-200/70 text-sm">My type of person is...</Label>
              <p className="text-xs pl-1 text-purple-300/70">Describe who you click with (10-40 chars)</p>
              <Input
                value={formData.my_type_of_person}
                onChange={(e) => setFormData({ ...formData, my_type_of_person: e.target.value })}
                placeholder="e.g., Curious minds who love good banter"
                maxLength={MAX_MY_TYPE_LENGTH}
                className="h-14 px-6 rounded-[20px] text-white placeholder:text-purple-300/40"
                style={{
                  background: 'rgba(139, 92, 246, 0.08)',
                  border: '2px solid rgba(168, 85, 247, 0.3)',
                }}
                data-testid="my-type-input"
              />
              <div className="flex justify-between text-xs px-1 text-purple-300/60">
                <span>{formData.my_type_of_person.length < MIN_MY_TYPE_LENGTH ? `${MIN_MY_TYPE_LENGTH - formData.my_type_of_person.length} more needed` : '✓'}</span>
                <span>{formData.my_type_of_person.length}/{MAX_MY_TYPE_LENGTH}</span>
              </div>
            </div>

            {/* Who I'm Open to Meeting (PRIVATE) */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <Label className="text-purple-200/70 text-sm">Who I'm open to meeting</Label>
                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] uppercase tracking-wide">Private</span>
              </div>
              <p className="text-xs pl-1 text-purple-300/70">Used for matching only — never shown on your profile</p>
              <div className="relative">
                <select
                  value={formData.who_open_to_meeting}
                  onChange={(e) => setFormData({ ...formData, who_open_to_meeting: e.target.value })}
                  className="w-full h-14 px-6 pr-12 rounded-[20px] text-white appearance-none cursor-pointer"
                  style={{ 
                    background: 'rgba(139, 92, 246, 0.08)',
                    border: '2px solid rgba(168, 85, 247, 0.3)',
                  }}
                  data-testid="open-to-meeting-select"
                >
                  {OPEN_TO_MEETING_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-slate-900 text-white">
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400/50 pointer-events-none" />
              </div>
            </div>
          </section>

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />

          {/* Home Area Section */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500/20 to-emerald-500/20 flex items-center justify-center">
                <Home className="w-5 h-5 text-teal-400" />
              </div>
              <div>
                <h2 className="text-lg font-medium text-purple-100">Home area</h2>
                <p className="text-sm text-purple-300/70">Where you're based (shown after reveal)</p>
              </div>
            </div>

            {/* Country Picker */}
            <div className="space-y-2.5">
              <Label className="text-purple-200/70 text-sm">Country</Label>
              <div className="relative">
                <select
                  value={formData.home_country}
                  onChange={(e) => {
                    setFormData({ 
                      ...formData, 
                      home_country: e.target.value,
                      home_region: "" // Reset region when country changes
                    });
                  }}
                  className="w-full h-14 px-6 pr-12 rounded-[20px] text-white appearance-none cursor-pointer"
                  style={{ 
                    background: 'rgba(139, 92, 246, 0.08)',
                    border: '2px solid rgba(168, 85, 247, 0.3)',
                  }}
                  data-testid="home-country-select"
                >
                  <option value="" className="bg-slate-900 text-white">Select country...</option>
                  {Object.keys(COUNTRIES_REGIONS).map((country) => (
                    <option key={country} value={country} className="bg-slate-900 text-white">
                      {country}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400/50 pointer-events-none" />
              </div>
            </div>

            {/* Region Picker (only show if country selected) */}
            {formData.home_country && (
              <div className="space-y-2.5">
                <Label className="text-purple-200/70 text-sm">Region</Label>
                <div className="relative">
                  <select
                    value={formData.home_region}
                    onChange={(e) => setFormData({ ...formData, home_region: e.target.value })}
                    className="w-full h-14 px-6 pr-12 rounded-[20px] text-white appearance-none cursor-pointer"
                    style={{ 
                      background: 'rgba(139, 92, 246, 0.08)',
                      border: '2px solid rgba(168, 85, 247, 0.3)',
                    }}
                    data-testid="home-region-select"
                  >
                    <option value="" className="bg-slate-900 text-white">Select region...</option>
                    {(COUNTRIES_REGIONS[formData.home_country] || []).map((region) => (
                      <option key={region} value={region} className="bg-slate-900 text-white">
                        {region}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400/50 pointer-events-none" />
                </div>
              </div>
            )}
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
                <h2 className="text-lg font-medium text-purple-100">Say hello in your own voice</h2>
                <p className="text-sm text-purple-300/70">Your voice plays only after mutual curiosity.</p>
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
                  background: 'rgba(139, 92, 246, 0.08)',
                  border: '2px solid rgba(168, 85, 247, 0.3)'
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
                  background: 'rgba(139, 92, 246, 0.08)',
                  border: '2px solid rgba(168, 85, 247, 0.3)'
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
                    <p className="text-xs mt-0.5 text-purple-300/60">
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
                    background: 'rgba(139, 92, 246, 0.08)',
                    border: '2px solid rgba(168, 85, 247, 0.3)'
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
                      <p className="text-xs mt-0.5 text-purple-300/60">
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
                  background: 'rgba(139, 92, 246, 0.08)',
                  border: '2px solid rgba(168, 85, 247, 0.3)',
                }}
              >
                <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center group-hover:bg-purple-500/30 transition-all">
                  <Mic className="w-5 h-5 text-purple-400" />
                </div>
                <span className="text-purple-200/70 group-hover:text-purple-100 transition-colors">
                  Record Voice Intro
                </span>
              </button>
            )}
          </section>

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />
          
          {/* Bottom padding for save button area */}
          <div className="h-4" />
        </div>
      </div>

      {/* Profile Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50" style={{ background: 'linear-gradient(135deg, #0f0a1a 0%, #1a0a2e 50%, #0f172a 100%)' }} data-testid="profile-preview-modal">
          {/* Header */}
          <div className="sticky top-0 z-50 backdrop-blur" style={{ background: 'rgba(15, 10, 26, 0.95)', borderBottom: '1px solid rgba(168, 85, 247, 0.2)' }}>
            <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
              <h1 className="text-lg font-bold text-purple-100">Profile Preview</h1>
              <button
                onClick={() => {
                  setShowPreview(false);
                  setPreviewAudioPlaying(false);
                  if (previewAudioRef.current) {
                    previewAudioRef.current.pause();
                  }
                }}
                className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
                style={{ background: 'rgba(139, 92, 246, 0.15)' }}
                data-testid="close-preview-btn"
              >
                <X className="w-5 h-5 text-purple-300" />
              </button>
            </div>
            
            {/* Mode Toggle */}
            <div className="max-w-lg mx-auto px-4 pb-4">
              <div className="flex rounded-xl p-1" style={{ background: 'rgba(139, 92, 246, 0.1)' }}>
                <button
                  onClick={() => {
                    setPreviewMode("before");
                    setPreviewPhotoIndex(0);
                  }}
                  className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                    previewMode === "before"
                      ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                      : "text-purple-300/60 hover:text-purple-200"
                  }`}
                  data-testid="preview-before-tab"
                >
                  <EyeOff className="w-4 h-4" />
                  Before Reveal
                </button>
                <button
                  onClick={() => {
                    setPreviewMode("after");
                    setPreviewPhotoIndex(0);
                  }}
                  className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                    previewMode === "after"
                      ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                      : "text-purple-300/60 hover:text-purple-200"
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
              /* PRE-REVEAL - Visible while blurred */
              <div className="space-y-6">
                <p className="text-sm text-purple-300/60 text-center mb-6">
                  This is how others see you before mutual curiosity
                </p>
                
                {/* Blurred Photo Carousel */}
                <div className="relative aspect-[3/4] max-w-xs mx-auto rounded-2xl overflow-hidden" style={{ background: 'rgba(139, 92, 246, 0.1)' }}>
                  {allPhotos.length > 0 ? (
                    <img 
                      src={allPhotos[previewPhotoIndex] || mainPhoto} 
                      alt="Profile" 
                      className="w-full h-full object-cover transition-opacity duration-300"
                      style={{ filter: 'blur(8px)' }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-purple-400/50">
                      <User className="w-16 h-16" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  
                  {/* Carousel Navigation */}
                  {hasMultiplePhotos && (
                    <>
                      <button
                        onClick={handlePrevPhoto}
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white hover:bg-black/60 transition-colors"
                        data-testid="carousel-prev"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        onClick={handleNextPhoto}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white hover:bg-black/60 transition-colors"
                        data-testid="carousel-next"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                      
                      {/* Photo indicator dots */}
                      <div className="absolute bottom-16 left-0 right-0 flex justify-center gap-1.5">
                        {allPhotos.map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => setPreviewPhotoIndex(idx)}
                            className={`w-2 h-2 rounded-full transition-colors ${
                              idx === previewPhotoIndex ? 'bg-white' : 'bg-white/40'
                            }`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                  
                  {/* Premium Badge */}
                  {isPremium && (
                    <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-amber-500 flex items-center gap-1.5 shadow-lg">
                      <Crown className="w-3.5 h-3.5 text-white" />
                      <span className="text-xs text-white font-medium">Premium</span>
                    </div>
                  )}
                  
                  {/* Pre-reveal Info Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold text-white">{formData.display_name || "Your Name"}</h3>
                      {user?.age && <span className="text-purple-200/70">{user.age}</span>}
                    </div>
                    {formData.presence_note && (
                      <p className="text-sm text-purple-100/80 mt-1">{formData.presence_note}</p>
                    )}
                    {formData.shy_indicator && (
                      <span className="inline-flex items-center gap-1 mt-2 px-2 py-1 rounded-full bg-pink-500/20 text-pink-300 text-xs">
                        <Heart className="w-3 h-3" />
                        May be shy to start
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Hidden fields indicator */}
                <div className="flex flex-wrap justify-center gap-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-purple-300/60 text-xs" style={{ background: 'rgba(139, 92, 246, 0.1)' }}>
                    <EyeOff className="w-3 h-3" />
                    Bio hidden
                  </div>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-purple-300/60 text-xs" style={{ background: 'rgba(139, 92, 246, 0.1)' }}>
                    <EyeOff className="w-3 h-3" />
                    Type hidden
                  </div>
                  {formData.home_country && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-purple-300/60 text-xs" style={{ background: 'rgba(139, 92, 246, 0.1)' }}>
                      <EyeOff className="w-3 h-3" />
                      Location hidden
                    </div>
                  )}
                  {formData.voice_intro_url && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-purple-300/60 text-xs" style={{ background: 'rgba(139, 92, 246, 0.1)' }}>
                      <Volume2 className="w-3 h-3" />
                      Voice locked
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* POST-REVEAL - Full profile view after mutual curiosity */
              <div className="space-y-4">
                <p className="text-sm text-purple-300/60 text-center mb-6">
                  This is how others see you after mutual curiosity
                </p>
                
                {/* Full Photo Carousel */}
                <div className="relative aspect-[3/4] max-w-xs mx-auto rounded-2xl overflow-hidden" style={{ background: 'rgba(139, 92, 246, 0.1)' }}>
                  {allPhotos.length > 0 ? (
                    <img 
                      src={allPhotos[previewPhotoIndex] || mainPhoto} 
                      alt="Profile" 
                      className="w-full h-full object-cover transition-opacity duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-purple-400/50">
                      <User className="w-16 h-16" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  
                  {/* Carousel Navigation */}
                  {hasMultiplePhotos && (
                    <>
                      <button
                        onClick={handlePrevPhoto}
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white hover:bg-black/60 transition-colors"
                        data-testid="carousel-prev-post"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        onClick={handleNextPhoto}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white hover:bg-black/60 transition-colors"
                        data-testid="carousel-next-post"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                      
                      {/* Photo indicator dots */}
                      <div className="absolute bottom-16 left-0 right-0 flex justify-center gap-1.5">
                        {allPhotos.map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => setPreviewPhotoIndex(idx)}
                            className={`w-2 h-2 rounded-full transition-colors ${
                              idx === previewPhotoIndex ? 'bg-white' : 'bg-white/40'
                            }`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                  
                  {/* Premium Badge */}
                  {isPremium && (
                    <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-amber-500 flex items-center gap-1.5 shadow-lg">
                      <Crown className="w-3.5 h-3.5 text-white" />
                      <span className="text-xs text-white font-medium">Premium</span>
                    </div>
                  )}
                  
                  {/* Full Info Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold text-white">{formData.display_name || "Your Name"}</h3>
                      {user?.age && <span className="text-purple-200/70">{user.age}</span>}
                    </div>
                    {formData.presence_note && (
                      <p className="text-sm text-purple-100/80 mt-1">{formData.presence_note}</p>
                    )}
                  </div>
                </div>
                
                {/* Bio */}
                {formData.bio && (
                  <div className="rounded-xl p-4" style={{ background: 'rgba(139, 92, 246, 0.1)' }}>
                    <h4 className="text-xs font-medium text-purple-300/60 mb-1.5 uppercase tracking-wide">About</h4>
                    <p className="text-purple-100 text-sm">{formData.bio}</p>
                  </div>
                )}
                
                {/* My Type of Person */}
                {formData.my_type_of_person && (
                  <div className="rounded-xl p-4" style={{ background: 'rgba(139, 92, 246, 0.1)' }}>
                    <h4 className="text-xs font-medium text-purple-300/60 mb-1.5 uppercase tracking-wide">My type of person is</h4>
                    <p className="text-purple-100 text-sm">{formData.my_type_of_person}</p>
                  </div>
                )}
                
                {/* Intent */}
                {formData.intent && (
                  <div className="rounded-xl p-4" style={{ background: 'rgba(139, 92, 246, 0.1)' }}>
                    <h4 className="text-xs font-medium text-purple-300/60 mb-1.5 uppercase tracking-wide">Here for</h4>
                    <p className="text-purple-100 text-sm capitalize">{formData.intent.replace('_', ' ')}</p>
                  </div>
                )}
                
                {/* Home Area */}
                {formData.home_country && (
                  <div className="rounded-xl p-4" style={{ background: 'rgba(139, 92, 246, 0.1)' }}>
                    <h4 className="text-xs font-medium text-purple-300/60 mb-1.5 uppercase tracking-wide">Based in</h4>
                    <p className="text-purple-100 text-sm flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-teal-400" />
                      {formData.home_region ? `${formData.home_region}, ${formData.home_country}` : formData.home_country}
                    </p>
                  </div>
                )}
                
                {/* Voice Intro */}
                {formData.voice_intro_url && (
                  <div className="rounded-xl p-4" style={{ background: 'rgba(139, 92, 246, 0.1)' }}>
                    <h4 className="text-xs font-medium text-purple-300/60 mb-2 uppercase tracking-wide">Voice Intro</h4>
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
                          ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white" 
                          : "text-purple-200 hover:text-white"
                      }`}
                      style={!previewAudioPlaying ? { background: 'rgba(139, 92, 246, 0.15)' } : {}}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        previewAudioPlaying ? "bg-white/20" : "bg-purple-500/20"
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
                  <div className="flex items-center gap-3 p-4 bg-pink-500/10 border border-pink-500/20 rounded-xl">
                    <Heart className="w-5 h-5 text-pink-400" />
                    <span className="text-pink-300 text-sm">May be shy to start</span>
                  </div>
                )}
                
                {/* Note: who_open_to_meeting is NEVER shown - private matching only */}
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Profile;
