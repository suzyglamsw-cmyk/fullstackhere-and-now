import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth, API } from "@/App";
import { toast } from "sonner";
import axios from "axios";
import Layout from "../components/Layout";
import { UserCard, SelfCard } from "../components/UserCard";
import { NotForNowSheet } from "../components/NotForNowSheet";
import { getErrorMessage } from "../utils/errorUtils";
import { useConfirmHintGlobal } from "../components/ConfirmHint";
import { onUserBlocked } from "../utils/blockEvents";
import { onPresenceChange, onPageVisible } from "../utils/presenceEvents";
import {
  MapPin,
  Loader2,
  Users,
  ArrowRight,
  ArrowLeft,
  MapPinOff,
  RefreshCw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ICEBREAKER_MESSAGES = [
  { id: 0, name: "Hello", icon: "👋" },
  { id: 1, name: "You seem interesting", icon: "✨" },
  { id: 2, name: "Fancy a chat?", icon: "💬" },
  { id: 3, name: "Can I buy you a drink?", icon: "🍸" },
];

const RADIUS_OPTIONS = [
  { value: "0-10", label: "0–10 miles" },
  { value: "10-25", label: "10–25 miles" },
];

// Filter options
const MATCH_FILTER_OPTIONS = [
  { value: "unmatched", label: "Unmatched only" },
  { value: "all", label: "All users" },
  { value: "mutual", label: "Mutual only" },
];

const ACTIVITY_FILTER_OPTIONS = [
  { value: "now", label: "Active now", maxMinutes: 2 },
  { value: "recent", label: "Recently", maxMinutes: 10 },
  { value: "hour", label: "This hour", maxMinutes: 60 },
  { value: "all", label: "All", maxMinutes: null },
];

const AGE_PRESETS = [
  { value: "all", label: "All ages", min: 18, max: 99 },
  { value: "18-25", label: "18-25", min: 18, max: 25 },
  { value: "25-35", label: "25-35", min: 25, max: 35 },
  { value: "35-45", label: "35-45", min: 35, max: 45 },
  { value: "45+", label: "45+", min: 45, max: 99 },
];

const Discovery = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  // Determine mode from route
  const getMode = () => {
    if (location.pathname === "/discover/not-here") return "not-here";
    return null; // Show mode selector
  };
  
  const [mode, setMode] = useState(getMode());
  const [radius, setRadius] = useState("0-10");
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Location state
  const [locationStatus, setLocationStatus] = useState("checking");
  const [locationError, setLocationError] = useState(null);
  const [userCoordinates, setUserCoordinates] = useState(null);
  
  // Interaction states
  const [glancing, setGlancing] = useState(null);
  const [showIcebreakerModal, setShowIcebreakerModal] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [sendingIcebreaker, setSendingIcebreaker] = useState(false);
  const [sendingChatRequest, setSendingChatRequest] = useState(null);
  
  // Filter states
  const [matchFilter, setMatchFilter] = useState("unmatched");
  const [activityFilter, setActivityFilter] = useState("all");
  const [ageFilter, setAgeFilter] = useState("all");
  
  // Not for now sheet
  const [notForNowUser, setNotForNowUser] = useState(null);
  const [hiddenUsers, setHiddenUsers] = useState([]);
  
  // Global ref for confirmation hints
  const confirmHintRef = useConfirmHintGlobal();
  const fetchPeopleRef = useRef(null);

  // Update mode when route changes
  useEffect(() => {
    const newMode = getMode();
    setMode(newMode);
  }, [location.pathname]);

  // Listen for block events
  useEffect(() => {
    const cleanup = onUserBlocked((blockedUserId) => {
      setPeople(prev => prev.filter(p => p.id !== blockedUserId));
    });
    return cleanup;
  }, []);

  // Fetch hidden users on mount
  useEffect(() => {
    const fetchHiddenUsers = async () => {
      try {
        const response = await axios.get(`${API}/users/hidden`);
        setHiddenUsers(response.data.map(h => h.hidden_user_id));
      } catch (error) {
        console.error("Failed to fetch hidden users:", error);
      }
    };
    fetchHiddenUsers();
  }, []);

  // Check GPS location when in Not Here mode
  useEffect(() => {
    if (mode === "not-here") {
      checkLocationPermission();
    }
  }, [mode]);

  // Fetch people when mode/radius/coordinates change
  useEffect(() => {
    if (mode === "not-here" && locationStatus === "granted" && userCoordinates) {
      fetchPeople();
    }
  }, [mode, radius, locationStatus, userCoordinates, matchFilter, activityFilter, ageFilter]);

  const checkLocationPermission = async () => {
    if (!navigator.geolocation) {
      setLocationStatus("unavailable");
      setLocationError("Geolocation is not supported by your browser");
      return;
    }

    try {
      const permission = await navigator.permissions.query({ name: "geolocation" });
      
      if (permission.state === "granted") {
        await getCurrentPosition();
      } else if (permission.state === "denied") {
        setLocationStatus("denied");
        setLocationError("Location access denied. Please enable location in your browser settings.");
      } else {
        setLocationStatus("checking");
        await requestLocation();
      }

      permission.onchange = () => {
        if (permission.state === "granted") {
          getCurrentPosition();
        } else if (permission.state === "denied") {
          setLocationStatus("denied");
        }
      };
    } catch (error) {
      await requestLocation();
    }
  };

  const requestLocation = async () => {
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          await handlePositionSuccess(position);
          resolve();
        },
        (error) => {
          handlePositionError(error);
          resolve();
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  };

  const getCurrentPosition = async () => {
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          await handlePositionSuccess(position);
          resolve();
        },
        (error) => {
          handlePositionError(error);
          resolve();
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  };

  const handlePositionSuccess = async (position) => {
    const coords = {
      lat: position.coords.latitude,
      lng: position.coords.longitude
    };
    setUserCoordinates(coords);
    setLocationStatus("granted");
    setLocationError(null);

    try {
      await axios.post(`${API}/location/update`, coords);
    } catch (error) {
      console.error("Failed to update location:", error);
    }
  };

  const handlePositionError = (error) => {
    if (error.code === error.PERMISSION_DENIED) {
      setLocationStatus("denied");
      setLocationError("Location access denied. Please enable location in your browser settings.");
    } else {
      setLocationStatus("unavailable");
      setLocationError("Unable to get your location. Please try again.");
    }
  };

  const requestAndUpdateLocation = async () => {
    setLocationStatus("updating");
    await requestLocation();
  };

  // Fetch people for Not Here mode
  const fetchPeople = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/discovery/not-here?radius=${radius}`);
      let fetchedPeople = response.data || [];

      // Filter out blocked users (but NOT self - self card has is_self: true)
      const blockedUsers = user?.blocked_users || [];
      fetchedPeople = fetchedPeople.filter(p => 
        p.is_self || (!blockedUsers.includes(p.id) && p.id !== user?.id)
      );

      // Filter out hidden users (but NOT self)
      fetchedPeople = fetchedPeople.filter(p => p.is_self || !hiddenUsers.includes(p.id));

      // Apply match filter (but NOT to self)
      if (matchFilter === "unmatched") {
        fetchedPeople = fetchedPeople.filter(p => p.is_self || !p.is_connection_accepted);
      } else if (matchFilter === "mutual") {
        fetchedPeople = fetchedPeople.filter(p => p.is_self || p.is_connection_accepted);
      }

      // Apply activity filter (but NOT to self)
      if (activityFilter !== "all") {
        const maxMinutes = ACTIVITY_FILTER_OPTIONS.find(o => o.value === activityFilter)?.maxMinutes;
        if (maxMinutes) {
          const cutoff = new Date(Date.now() - maxMinutes * 60 * 1000);
          fetchedPeople = fetchedPeople.filter(p => {
            if (p.is_self) return true;
            if (!p.last_active) return false;
            return new Date(p.last_active) >= cutoff;
          });
        }
      }

      // Apply age filter (but NOT to self)
      if (ageFilter !== "all") {
        const preset = AGE_PRESETS.find(p => p.value === ageFilter);
        if (preset) {
          fetchedPeople = fetchedPeople.filter(p => {
            if (p.is_self) return true;
            if (!p.age) return true;
            return p.age >= preset.min && p.age <= preset.max;
          });
        }
      }

      setPeople(fetchedPeople);
    } catch (error) {
      console.error("Failed to load people:", error);
      setPeople([]);
    } finally {
      setLoading(false);
    }
  };

  fetchPeopleRef.current = fetchPeople;

  // Auto-refresh: Poll every 30 seconds (for Not Here mode)
  useEffect(() => {
    if (mode !== "not-here" || locationStatus !== "granted") return;
    
    const interval = setInterval(() => {
      if (fetchPeopleRef.current) {
        fetchPeopleRef.current();
      }
    }, 30000); // 30 seconds
    
    return () => clearInterval(interval);
  }, [mode, locationStatus]);

  // Auto-refresh: When page becomes visible/focused
  useEffect(() => {
    const cleanup = onPageVisible(() => {
      if (mode === "not-here" && locationStatus === "granted" && fetchPeopleRef.current) {
        fetchPeopleRef.current();
      }
    });
    return cleanup;
  }, [mode, locationStatus]);

  // Auto-refresh: When presence changes (logout, checkin, etc.)
  useEffect(() => {
    const cleanup = onPresenceChange(() => {
      if (mode === "not-here" && locationStatus === "granted" && fetchPeopleRef.current) {
        fetchPeopleRef.current();
      }
    });
    return cleanup;
  }, [mode, locationStatus]);

  // Action handlers
  const handleGlance = async (userId, venueId) => {
    setGlancing(userId);
    try {
      await axios.post(`${API}/glance`, { to_user_id: userId, venue_id: venueId || "not-here" });
      toast.success("Glance sent!");
      fetchPeople();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to send glance"));
    } finally {
      setGlancing(null);
    }
  };

  const handleOpenIcebreaker = (person) => {
    setSelectedPerson(person);
    setShowIcebreakerModal(true);
  };

  const handleSendIcebreaker = async (messageType) => {
    if (!selectedPerson) return;
    
    setSendingIcebreaker(true);
    try {
      await axios.post(`${API}/icebreaker`, {
        to_user_id: selectedPerson.id,
        venue_id: "not-here",
        message_type: messageType
      });
      toast.success("Icebreaker sent!");
      setShowIcebreakerModal(false);
      setSelectedPerson(null);
      fetchPeople();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to send icebreaker"));
    } finally {
      setSendingIcebreaker(false);
    }
  };

  const handleSendChatRequest = async (userId, venueId) => {
    setSendingChatRequest(userId);
    try {
      await axios.post(`${API}/chat-request`, { 
        to_user_id: userId, 
        venue_id: venueId || "not-here" 
      });
      toast.success("Chat request sent!");
      fetchPeople();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to send chat request"));
    } finally {
      setSendingChatRequest(null);
    }
  };

  const handleLongPress = (person) => {
    setNotForNowUser(person);
  };

  const handleHideUser = async () => {
    if (!notForNowUser) return;
    
    try {
      await axios.post(`${API}/users/${notForNowUser.id}/hide`);
      setHiddenUsers(prev => [...prev, notForNowUser.id]);
      setPeople(prev => prev.filter(p => p.id !== notForNowUser.id));
      toast.success("Profile hidden for 90 days");
    } catch (error) {
      toast.error("Failed to hide profile");
    } finally {
      setNotForNowUser(null);
    }
  };

  // Determine photo state for a user
  // ============================================================================
  // RENDER: Mode Selector (Discovery Home)
  // ============================================================================
  if (!mode) {
    return (
      <Layout>
        <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex flex-col pt-16 px-6">
          <div className="text-center mb-8">
            {/* Header - purple to pink gradient matching Save button */}
            <h1 
              className="text-4xl font-bold bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)' }}
            >
              Discover
            </h1>
            <p className="text-slate-300/70 text-sm mt-2">Choose how you want to explore people around you.</p>
          </div>
          
          <div className="w-full max-w-md mx-auto space-y-4">
            {/* Here & Now Option - Dark purple (same as Not Here) */}
            <button
              data-testid="select-here-now"
              onClick={() => navigate("/venues")}
              className="w-full p-6 rounded-2xl bg-gradient-to-br from-purple-900/50 to-violet-950/45 border border-purple-600/40 hover:border-purple-500/60 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-purple-800/30 flex items-center justify-center">
                  <MapPin className="w-7 h-7 text-indigo-400" />
                </div>
                <div className="text-left flex-1">
                  <h2 
                    className="text-xl font-bold bg-clip-text text-transparent transition-opacity group-hover:opacity-80"
                    style={{ backgroundImage: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)' }}
                  >
                    Here Now
                  </h2>
                  <p className="text-white text-sm">
                    A real-time list of nearby venues you can check into and see who else is there.
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-indigo-400 group-hover:text-indigo-300 transition-colors" />
              </div>
            </button>
            
            {/* Not Here Option - Dark purple (same as Here Now) */}
            <button
              data-testid="select-not-here"
              onClick={() => navigate("/discover/not-here")}
              className="w-full p-6 rounded-2xl bg-gradient-to-br from-purple-900/50 to-violet-950/45 border border-purple-600/40 hover:border-purple-500/60 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-purple-800/30 flex items-center justify-center">
                  <Users className="w-7 h-7 text-cyan-400" />
                </div>
                <div className="text-left flex-1">
                  <h2 
                    className="text-xl font-bold bg-clip-text text-transparent transition-opacity group-hover:opacity-80"
                    style={{ backgroundImage: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)' }}
                  >
                    Not Here
                  </h2>
                  <p className="text-white text-sm">
                    See and be seen by people nearby who aren't in a venue.
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-cyan-400 group-hover:text-cyan-300 transition-colors" />
              </div>
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  // ============================================================================
  // RENDER: Filter Bar Component
  // ============================================================================
  const FilterBar = () => (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {/* Match Filter */}
      <select
        value={matchFilter}
        onChange={(e) => setMatchFilter(e.target.value)}
        className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
        data-testid="match-filter"
      >
        {MATCH_FILTER_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value} className="bg-slate-900">{opt.label}</option>
        ))}
      </select>

      {/* Activity Filter */}
      <select
        value={activityFilter}
        onChange={(e) => setActivityFilter(e.target.value)}
        className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
        data-testid="activity-filter"
      >
        {ACTIVITY_FILTER_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value} className="bg-slate-900">{opt.label}</option>
        ))}
      </select>

      {/* Age Filter */}
      <select
        value={ageFilter}
        onChange={(e) => setAgeFilter(e.target.value)}
        className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
        data-testid="age-filter"
      >
        {AGE_PRESETS.map(opt => (
          <option key={opt.value} value={opt.value} className="bg-slate-900">{opt.label}</option>
        ))}
      </select>
    </div>
  );

  // ============================================================================
  // RENDER: Not Here Mode (/discover/not-here)
  // ============================================================================
  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
        {/* Header */}
        <div className="sticky top-0 z-40 glass border-b border-white/5">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <button
              data-testid="back-to-discovery"
              onClick={() => navigate("/discover")}
              className="flex items-center gap-2 text-slate-400 hover:text-white mb-4 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Back to Discovery</span>
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Not Here</h1>
                <p className="text-sm text-slate-400">People nearby not at a venue</p>
              </div>
            </div>

            {/* Radius Selector */}
            <div className="flex gap-2 mb-4">
              {RADIUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  data-testid={`radius-${option.value}`}
                  onClick={() => setRadius(option.value)}
                  className={`px-4 py-2 rounded-xl text-sm transition-all ${
                    radius === option.value
                      ? "bg-cyan-500 text-white"
                      : "bg-white/5 text-slate-400 hover:bg-white/10"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <FilterBar />
          </div>
        </div>

        {/* Content - People Grid */}
        <div className="max-w-4xl mx-auto px-4 py-6 pb-28">
          {locationStatus === "checking" || locationStatus === "updating" ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-10 h-10 animate-spin text-cyan-500 mb-4" />
              <p className="text-slate-400">Getting your location...</p>
            </div>
          ) : locationStatus === "denied" || locationStatus === "unavailable" ? (
            <div className="flex flex-col items-center justify-center py-20 px-4">
              <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
                <MapPinOff className="w-10 h-10 text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-3 text-center">Location Required</h2>
              <p className="text-slate-400 text-center mb-6 max-w-md">
                {locationError || "To see people nearby, we need your current GPS location."}
              </p>
              <Button
                data-testid="request-location-btn"
                onClick={requestAndUpdateLocation}
                className="bg-cyan-500 hover:bg-cyan-600 text-white px-6 py-3 rounded-xl"
              >
                <MapPin className="w-4 h-4 mr-2" />
                Enable Location
              </Button>
            </div>
          ) : loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
            </div>
          ) : people.length === 0 ? (
            <div className="text-center py-20">
              <Users className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">No one nearby</h2>
              <p className="text-slate-400 mb-4">Try widening your radius or adjusting filters.</p>
              <Button
                data-testid="refresh-location-btn"
                onClick={requestAndUpdateLocation}
                variant="ghost"
                className="text-slate-400 hover:text-white"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh location
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {people.map((person) => (
                person.is_self ? (
                  <SelfCard
                    key={person.id}
                    user={person}
                    context="not_here"
                  />
                ) : (
                  <UserCard
                    key={person.id}
                    user={person}
                    isMatched={person.is_connection_accepted}
                    revealState={person.reveal_state}
                    onGlance={handleGlance}
                    onIcebreaker={handleOpenIcebreaker}
                    onChatRequest={handleSendChatRequest}
                    onLongPress={handleLongPress}
                    disabled={{
                      glanced: person.i_glanced_at,
                      icebreaker: person.icebreaker_sent,
                      chatRequest: person.chat_request_sent
                    }}
                    loading={{
                      glance: glancing === person.id,
                      chatRequest: sendingChatRequest === person.id
                    }}
                    globalPendingRef={confirmHintRef}
                    context="not_here"
                    venueId="not-here"
                  />
                )
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Icebreaker Modal */}
      <IcebreakerModal
        show={showIcebreakerModal}
        person={selectedPerson}
        sending={sendingIcebreaker}
        onClose={() => {
          setShowIcebreakerModal(false);
          setSelectedPerson(null);
        }}
        onSend={handleSendIcebreaker}
      />

      {/* Not For Now Sheet */}
      <NotForNowSheet
        isOpen={!!notForNowUser}
        onClose={() => setNotForNowUser(null)}
        onConfirm={handleHideUser}
        userName={notForNowUser?.display_name}
      />
    </Layout>
  );
};

// ============================================================================
// Icebreaker Modal Component
// ============================================================================
const IcebreakerModal = ({ show, person, sending, onClose, onSend }) => {
  if (!show || !person) return null;

  return (
    <Dialog open={show} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-white/10 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white">Send Icebreaker</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-slate-400/70 text-sm">Choose a message to send:</p>
          {ICEBREAKER_MESSAGES.map((msg) => (
            <button
              key={msg.id}
              data-testid={`icebreaker-option-${msg.id}`}
              onClick={() => onSend(msg.id)}
              disabled={sending}
              className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors disabled:opacity-50"
            >
              <span className="text-2xl">{msg.icon}</span>
              <span className="text-white">{msg.name}</span>
              {sending && <Loader2 className="w-4 h-4 animate-spin ml-auto text-slate-400" />}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default Discovery;
