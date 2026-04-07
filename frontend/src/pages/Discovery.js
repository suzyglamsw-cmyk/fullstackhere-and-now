import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth, API } from "@/App";
import { toast } from "sonner";
import axios from "axios";
import Layout from "../components/Layout";
import BlurredImage from "../components/BlurredImage";
import { getErrorMessage } from "../utils/errorUtils";
import { ConfirmHint, useConfirmHintGlobal } from "../components/ConfirmHint";
import { onUserBlocked } from "../utils/blockEvents";
import {
  Eye,
  Snowflake,
  MapPin,
  Loader2,
  Sparkles,
  Users,
  Crown,
  Bell,
  Shield,
  Mic,
  Heart,
  Radio,
  Navigation,
  Building2,
  ArrowRight,
  ArrowLeft,
  User,
  MapPinOff,
  RefreshCw,
  MessageSquare,
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

// Silhouette component for users who have "Hide photo in venues" enabled
const SilhouetteAvatar = ({ className = "" }) => (
  <div className={`w-full h-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center ${className}`}>
    <User className="w-1/2 h-1/2 text-slate-500/60" strokeWidth={1.5} />
  </div>
);

const Discovery = ({ defaultMode = null }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, updateUser } = useAuth();
  
  // Determine mode from route or prop
  const getInitialMode = () => {
    if (location.pathname === "/discover/here") return "here";
    if (location.pathname === "/discover/not-here") return "not-here";
    if (defaultMode) return defaultMode;
    return null; // Show mode selector (gateway)
  };
  
  const [mode, setMode] = useState(getInitialMode());
  const [radius, setRadius] = useState("0-10");
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(false);
  const [venue, setVenue] = useState(null);
  const [venueLoading, setVenueLoading] = useState(true);
  const [nearbyVenues, setNearbyVenues] = useState([]);
  const [venuesLoading, setVenuesLoading] = useState(false);
  const [proximityEchoes, setProximityEchoes] = useState([]);
  
  // STRICT GPS LOCATION STATE
  const [locationStatus, setLocationStatus] = useState("checking"); // "checking", "granted", "denied", "unavailable", "updating"
  const [locationError, setLocationError] = useState(null);
  const [userCoordinates, setUserCoordinates] = useState(null);
  
  // Interaction states
  const [glancing, setGlancing] = useState(null);
  const [showIcebreakerModal, setShowIcebreakerModal] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [sendingIcebreaker, setSendingIcebreaker] = useState(false);
  const [sendingChatRequest, setSendingChatRequest] = useState(null);
  
  // Global ref for confirmation hints (only one visible at a time)
  const confirmHintRef = useConfirmHintGlobal();

  // Update mode when route changes
  useEffect(() => {
    const newMode = getInitialMode();
    setMode(newMode);
  }, [location.pathname]);

  // Ref to hold the fetchPeople function for use in block event listener
  const fetchPeopleRef = useRef(null);

  // Listen for block events and remove blocked users from all lists
  useEffect(() => {
    const cleanup = onUserBlocked((blockedUserId) => {
      // Update local user's blocked_users list to ensure filter works
      if (user && !user.blocked_users?.includes(blockedUserId)) {
        updateUser({
          blocked_users: [...(user.blocked_users || []), blockedUserId]
        });
      }
      
      // Immediately remove blocked user from people list (covers both Here and Not Here)
      setPeople(prev => prev.filter(p => p.id !== blockedUserId));
      
      // Remove from proximity echoes if present
      setProximityEchoes(prev => prev.filter(e => e.user_id !== blockedUserId && e.id !== blockedUserId));
      
      // Clear any interaction state for this user
      setGlancing(prev => prev === blockedUserId ? null : prev);
      setSendingChatRequest(prev => prev === blockedUserId ? null : prev);
      setSelectedPerson(prev => {
        if (prev?.id === blockedUserId) {
          setShowIcebreakerModal(false);
          setSendingIcebreaker(false);
          return null;
        }
        return prev;
      });
      
      // Force a data refresh to ensure complete sync with backend
      if (fetchPeopleRef.current) {
        fetchPeopleRef.current();
      }
    });
    return cleanup;
  }, [user, updateUser]);

  // REQUEST AND UPDATE GPS LOCATION - Strict enforcement
  const requestAndUpdateLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setLocationStatus("unavailable");
      setLocationError("Your browser doesn't support geolocation.");
      return false;
    }
    
    setLocationStatus("updating");
    setLocationError(null);
    
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          setUserCoordinates({ lat: latitude, lng: longitude });
          
          // Send coordinates to backend
          try {
            await axios.post(`${API}/location/update`, {
              lat: latitude,
              lng: longitude
            });
            setLocationStatus("granted");
            resolve(true);
          } catch (error) {
            console.error("Failed to update location on server:", error);
            // Still proceed if we have coordinates - backend will validate
            setLocationStatus("granted");
            resolve(true);
          }
        },
        (error) => {
          console.error("Geolocation error:", error);
          if (error.code === error.PERMISSION_DENIED) {
            setLocationStatus("denied");
            setLocationError("Location access denied. Please enable location in your browser settings to see nearby people.");
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            setLocationStatus("unavailable");
            setLocationError("Unable to determine your location. Please try again.");
          } else if (error.code === error.TIMEOUT) {
            setLocationStatus("unavailable");
            setLocationError("Location request timed out. Please try again.");
          } else {
            setLocationStatus("unavailable");
            setLocationError("Failed to get your location. Please try again.");
          }
          resolve(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 60000 // Cache for 1 minute
        }
      );
    });
  }, []);

  // Check location on mount and when mode changes to discovery modes
  useEffect(() => {
    if (mode === "here" || mode === "not-here") {
      requestAndUpdateLocation();
    }
  }, [mode, requestAndUpdateLocation]);

  // Fetch current venue on mount
  useEffect(() => {
    fetchCurrentVenue();
  }, []);

  // Fetch data when mode changes - ONLY if location is granted
  useEffect(() => {
    if (locationStatus !== "granted") return;
    
    if (mode === "here") {
      fetchProximityEchoes();
      fetchPeople();
      fetchNearbyVenues();
    } else if (mode === "not-here") {
      fetchPeople();
    }
  }, [mode, radius, venue, locationStatus]);

  // Handle mode selection from gateway - set discovery_mode on backend
  const handleSelectMode = async (selectedMode) => {
    try {
      if (selectedMode === "here") {
        // Set discovery_mode to "here_now" and navigate to venues
        await axios.post(`${API}/settings/discovery-mode`, { mode: "here_now" });
        navigate("/venues");
      } else {
        // Set discovery_mode to "not_here" and navigate to not-here
        await axios.post(`${API}/settings/discovery-mode`, { mode: "not_here" });
        navigate("/discover/not-here");
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to set discovery mode"));
    }
  };

  // Handle "Back to Discovery" - clear discovery_mode
  const handleBackToDiscovery = async () => {
    try {
      // Clear discovery_mode on backend (sets to null)
      await axios.post(`${API}/settings/discovery-mode`, { mode: null });
      navigate("/discover/select");
    } catch (error) {
      // Navigate anyway even if API fails
      navigate("/discover/select");
    }
  };

  const fetchCurrentVenue = async () => {
    setVenueLoading(true);
    try {
      const response = await axios.get(`${API}/checkin/current`);
      if (response.data && response.data.checked_in && response.data.venue) {
        setVenue({
          venue_id: response.data.checkin?.venue_id || response.data.venue?.id,
          venue_name: response.data.venue?.name,
          venue_type: response.data.venue?.type,
          checked_in_at: response.data.checkin?.checked_in_at,
          checked_in_count: response.data.venue?.checked_in_count || 0,
          ...response.data.checkin
        });
      } else if (response.data && response.data.venue_id) {
        setVenue(response.data);
      } else {
        setVenue(null);
      }
    } catch (error) {
      setVenue(null);
    } finally {
      setVenueLoading(false);
    }
  };

  const fetchNearbyVenues = async () => {
    setVenuesLoading(true);
    try {
      const response = await axios.get(`${API}/venues`);
      if (response.data && Array.isArray(response.data)) {
        // Filter out current venue if checked in
        const filtered = venue 
          ? response.data.filter(v => v.id !== venue.venue_id)
          : response.data;
        setNearbyVenues(filtered.slice(0, 6)); // Show top 6 nearby venues
      }
    } catch (error) {
      console.error("Failed to fetch venues:", error);
    } finally {
      setVenuesLoading(false);
    }
  };

  const fetchProximityEchoes = async () => {
    try {
      const response = await axios.get(`${API}/connections/proximity-echoes`);
      setProximityEchoes(response.data || []);
    } catch (error) {
      setProximityEchoes([]);
    }
  };

  const fetchPeople = async () => {
    setLoading(true);
    try {
      let endpoint = mode === "here" 
        ? `${API}/discovery/here`
        : `${API}/discovery/not-here?radius=${radius}`;
      
      const response = await axios.get(endpoint);
      let fetchedPeople = response.data || [];
      
      // Frontend defense: filter out blocked users (in case backend hasn't synced yet)
      const blockedUsers = user?.blocked_users || [];
      const blockedByUsers = user?.blocked_by_users || [];
      if (blockedUsers.length > 0 || blockedByUsers.length > 0) {
        fetchedPeople = fetchedPeople.filter(p => 
          !blockedUsers.includes(p.id) && !blockedByUsers.includes(p.id)
        );
      }
      
      setPeople(fetchedPeople);
    } catch (error) {
      if (error.response?.status !== 403) {
        console.error("Failed to fetch people:", error);
      }
      setPeople([]);
    } finally {
      setLoading(false);
    }
  };

  // Keep ref updated for use in block event listener
  fetchPeopleRef.current = fetchPeople;

  const handleGlance = async (userId, venueId) => {
    setGlancing(userId);
    try {
      await axios.post(`${API}/glance`, { 
        to_user_id: userId, 
        venue_id: venueId || venue?.id || "not-here"
      });
      toast.success("Glance sent!");
      fetchPeople();
    } catch (error) {
      const msg = getErrorMessage(error);
      toast.error(msg);
    } finally {
      setGlancing(null);
    }
  };

  const handleOpenIcebreaker = (person) => {
    setSelectedPerson(person);
    setShowIcebreakerModal(true);
  };

  const handleSendIcebreaker = async (messageIndex) => {
    if (!selectedPerson) return;
    setSendingIcebreaker(true);
    try {
      await axios.post(`${API}/icebreaker`, {
        to_user_id: selectedPerson.id,
        venue_id: venue?.id || "not-here",
        message_type: messageIndex
      });
      toast.success("Icebreaker sent!");
      setShowIcebreakerModal(false);
      setSelectedPerson(null);
      fetchPeople();
    } catch (error) {
      const msg = getErrorMessage(error);
      toast.error(msg);
    } finally {
      setSendingIcebreaker(false);
    }
  };

  const handleSendChatRequest = async (person) => {
    setSendingChatRequest(person.id);
    try {
      await axios.post(`${API}/chat-request`, {
        to_user_id: person.id,
        venue_id: venue?.id || "not-here",
        request_type: "chat"
      });
      toast.success("Chat request sent!");
      fetchPeople();
    } catch (error) {
      const msg = getErrorMessage(error);
      toast.error(msg);
    } finally {
      setSendingChatRequest(null);
    }
  };

  const handleCheckIn = async (venueId) => {
    try {
      await axios.post(`${API}/checkin/${venueId}`);
      toast.success("Checked in!");
      fetchCurrentVenue();
      fetchPeople();
      fetchNearbyVenues();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  // ============================================================================
  // RENDER: Mode Selection Screen (Gateway) - /discover/select
  // ============================================================================
  if (mode === null) {
    return (
      <Layout>
        <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
          <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-white mb-2">Discover</h1>
              <p className="text-slate-400">How would you like to meet people?</p>
            </div>
            
            <div className="w-full max-w-md space-y-4">
              {/* Here & Now Option */}
              <button
                data-testid="select-here-now"
                onClick={() => handleSelectMode("here")}
                className="w-full p-6 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 hover:border-indigo-400/50 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                    <MapPin className="w-7 h-7 text-indigo-400" />
                  </div>
                  <div className="text-left flex-1">
                    <h2 className="text-xl font-bold text-white group-hover:text-indigo-300 transition-colors">
                      Here & Now
                    </h2>
                    <p className="text-slate-400 text-sm">
                      Check into a venue to see who's there
                    </p>
                  </div>
                </div>
              </button>
              
              {/* Not Here Option */}
              <button
                data-testid="select-not-here"
                onClick={() => handleSelectMode("not-here")}
                className="w-full p-6 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-cyan-500/30 hover:border-cyan-400/50 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                    <Users className="w-7 h-7 text-cyan-400" />
                  </div>
                  <div className="text-left flex-1">
                    <h2 className="text-xl font-bold text-white group-hover:text-cyan-300 transition-colors">
                      Not Here
                    </h2>
                    <p className="text-slate-400 text-sm">
                      People in the area but not at a venue
                    </p>
                  </div>
                </div>
              </button>
            </div>
            
            {/* User-facing presence micro-copy */}
            <p className="w-full max-w-md mt-6 text-center text-sm text-slate-500 px-4">
              "Here" auto-checks you out after 1 hour of inactivity. "Not here" expires after 24 hours of inactivity. You can rejoin either option anytime by returning to this Discovery page.
            </p>
            
            {venueLoading && (
              <div className="mt-6 flex items-center gap-2 text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Checking venue status...</span>
              </div>
            )}
          </div>
        </div>
      </Layout>
    );
  }

  // ============================================================================
  // RENDER: Here & Now Mode (/discover/here)
  // ============================================================================
  if (mode === "here") {
    return (
      <Layout>
        <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
          {/* Header - Back to Discovery only, NO tabs */}
          <div className="sticky top-0 z-40 glass border-b border-white/5">
            <div className="max-w-4xl mx-auto px-4 py-4">
              {/* Back to Discovery Button */}
              <button
                data-testid="back-to-discovery"
                onClick={handleBackToDiscovery}
                className="flex items-center gap-2 text-slate-400 hover:text-white mb-4 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm">Back to Discovery</span>
              </button>

              {/* Mode Title */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">Here & Now</h1>
                  <p className="text-sm text-slate-400">People at venues near you</p>
                </div>
              </div>

              {/* Current Venue Card */}
              {venue ? (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-white">{venue.venue_name}</h2>
                        <div className="flex items-center gap-2 text-emerald-400 text-sm">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span>You're here • {venue.checked_in_count || people.length} people</span>
                        </div>
                      </div>
                    </div>
                    {/* Live Tracking Badge */}
                    {locationStatus === "granted" && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30">
                        <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                        <span className="text-xs text-emerald-400 font-medium">Live</span>
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => navigate("/venues")}
                    className="mt-3 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 p-0 h-auto"
                  >
                    Change venue <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              ) : (
                <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-white">Not checked in</h2>
                      <p className="text-slate-400 text-sm">Check into a venue to see who's around</p>
                    </div>
                    <Button
                      data-testid="check-in-btn"
                      onClick={() => navigate("/venues")}
                      className="rounded-xl bg-indigo-500 hover:bg-indigo-600"
                    >
                      <Navigation className="w-4 h-4 mr-2" />
                      Find venue
                    </Button>
                  </div>
                </div>
              )}

              {/* Nearby Venues Section */}
              <div className="mb-4">
                <h3 className="text-sm font-medium text-slate-400 mb-2">
                  {venue ? "Other venues nearby" : "Venues nearby"}
                </h3>
                {venuesLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
                  </div>
                ) : nearbyVenues.length > 0 ? (
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {nearbyVenues.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => handleCheckIn(v.id)}
                        className="flex-shrink-0 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
                      >
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-slate-400" />
                          <span className="text-white text-sm whitespace-nowrap">{v.name}</span>
                          {v.checked_in_count > 0 && (
                            <span className="text-xs text-slate-500">({v.checked_in_count})</span>
                          )}
                        </div>
                      </button>
                    ))}
                    <button
                      onClick={() => navigate("/venues")}
                      className="flex-shrink-0 px-4 py-2 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 transition-all"
                    >
                      <span className="text-indigo-400 text-sm whitespace-nowrap">See all →</span>
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-slate-500 text-sm">No venues found nearby</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => navigate("/venues")}
                      className="mt-2 text-indigo-400"
                    >
                      Search venues
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Proximity Echoes */}
          {proximityEchoes.length > 0 && (
            <div className="max-w-4xl mx-auto px-4 py-3">
              <div className="bg-pink-500/10 border border-pink-500/30 rounded-xl p-3 flex items-center gap-3">
                <Bell className="w-5 h-5 text-pink-400" />
                <p className="text-sm text-pink-300">
                  {proximityEchoes.length === 1
                    ? "Someone nearby noticed you."
                    : `${proximityEchoes.length} people nearby noticed you.`}
                </p>
              </div>
            </div>
          )}

          {/* Content - People Grid */}
          <div className="max-w-4xl mx-auto px-4 py-6">
            {/* LOCATION REQUIRED PROMPT FOR HERE & NOW */}
            {locationStatus === "checking" || locationStatus === "updating" ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
                <p className="text-slate-400">Getting your location...</p>
              </div>
            ) : locationStatus === "denied" || locationStatus === "unavailable" ? (
              <div className="flex flex-col items-center justify-center py-20 px-4">
                <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
                  <MapPinOff className="w-10 h-10 text-red-400" />
                </div>
                <h2 className="text-xl font-bold text-white mb-3 text-center">Location Required</h2>
                <p className="text-slate-400 text-center mb-6 max-w-md">
                  {locationError || "To see people at venues, we need your current GPS location. No region or manual location fallbacks are used."}
                </p>
                <Button
                  data-testid="request-location-btn-here"
                  onClick={requestAndUpdateLocation}
                  className="bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-3 rounded-xl"
                >
                  <MapPin className="w-4 h-4 mr-2" />
                  Enable Location
                </Button>
                <p className="text-slate-500 text-xs mt-4 text-center max-w-sm">
                  Your exact location is used only for distance matching and is never shared publicly.
                </p>
              </div>
            ) : loading || venueLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              </div>
            ) : people.length === 0 ? (
              <div className="text-center py-20">
                <Users className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-white mb-2">No one's around</h2>
                <p className="text-slate-400 mb-4">
                  No one's checked in at this venue right now. Try again soon!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {people.map((person) => (
                  <PersonCard
                    key={person.id}
                    person={person}
                    onGlance={handleGlance}
                    onIcebreaker={handleOpenIcebreaker}
                    onChatRequest={handleSendChatRequest}
                    glancing={glancing}
                    sendingChatRequest={sendingChatRequest}
                    isVenueContext={true}
                    venueId={venue?.id}
                    globalPendingRef={confirmHintRef}
                  />
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
      </Layout>
    );
  }

  // ============================================================================
  // RENDER: Not Here Mode (/discover/not-here)
  // ============================================================================
  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
        {/* Header - Back to Discovery only, NO tabs */}
        <div className="sticky top-0 z-40 glass border-b border-white/5">
          <div className="max-w-4xl mx-auto px-4 py-4">
            {/* Back to Discovery Button */}
            <button
              data-testid="back-to-discovery"
              onClick={handleBackToDiscovery}
              className="flex items-center gap-2 text-slate-400 hover:text-white mb-4 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Back to Discovery</span>
            </button>

            {/* Mode Title */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Not Here</h1>
                <p className="text-sm text-slate-400">People nearby who aren't at a venue</p>
              </div>
            </div>

            {/* Radius Selector */}
            <div className="flex gap-2">
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
          </div>
        </div>

        {/* Content - People Grid */}
        <div className="max-w-4xl mx-auto px-4 py-6">
          {/* LOCATION REQUIRED PROMPT */}
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
                {locationError || "To see people nearby, we need your current GPS location. No region or manual location fallbacks are used."}
              </p>
              <Button
                data-testid="request-location-btn"
                onClick={requestAndUpdateLocation}
                className="bg-cyan-500 hover:bg-cyan-600 text-white px-6 py-3 rounded-xl"
              >
                <MapPin className="w-4 h-4 mr-2" />
                Enable Location
              </Button>
              <p className="text-slate-500 text-xs mt-4 text-center max-w-sm">
                Your exact location is used only for distance matching and is never shared publicly.
              </p>
            </div>
          ) : loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
            </div>
          ) : people.length === 0 ? (
            <div className="text-center py-20">
              <Users className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">No one nearby</h2>
              <p className="text-slate-400 mb-4">
                No one is near enough right now. Try widening your radius.
              </p>
              {/* Refresh location button */}
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
                <PersonCard
                  key={person.id}
                  person={person}
                  onGlance={handleGlance}
                  onIcebreaker={handleOpenIcebreaker}
                  onChatRequest={handleSendChatRequest}
                  glancing={glancing}
                  sendingChatRequest={sendingChatRequest}
                  isVenueContext={false}
                  venueId="not-here"
                  globalPendingRef={confirmHintRef}
                />
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
    </Layout>
  );
};

// ============================================================================
// Person Card Component
// ============================================================================
const PersonCard = ({ person, onGlance, onIcebreaker, onChatRequest, glancing, sendingChatRequest, isVenueContext, venueId, globalPendingRef }) => {
  const navigate = useNavigate();
  
  // Check if this is the user's own card
  const isSelf = person.is_self === true;
  
  // Determine if we should show silhouette
  // For self: show silhouette if hide_photo_in_venues is ON
  // For others: show silhouette if they have hide_photo_in_venues=true AND we're in venue context AND not revealed
  const showSilhouette = isSelf 
    ? (isVenueContext && person.hide_photo_in_venues)
    : (isVenueContext && person.hide_photo_in_venues && !person.is_revealed);
  
  // Handle click on self card - navigate to profile
  const handleSelfClick = () => {
    navigate("/profile-tab");
  };
  
  // Self card - special rendering
  if (isSelf) {
    return (
      <div
        data-testid="self-card"
        onClick={handleSelfClick}
        className="bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-2xl overflow-hidden border-2 border-indigo-500/50 hover:border-indigo-400 transition-all cursor-pointer group"
      >
        {/* Photo */}
        <div className="relative aspect-[3/4]">
          {showSilhouette ? (
            <SilhouetteAvatar />
          ) : (
            <BlurredImage
              src={person.avatar_url || person.photos?.[0]}
              alt="You"
              isRevealed={false}  // Always show as blurred (pre-reveal view)
              className="w-full h-full object-cover"
            />
          )}
          
          {/* "You're here" badge */}
          <div className="absolute top-2 left-2 px-3 py-1.5 rounded-full bg-indigo-500 flex items-center gap-1.5 shadow-lg">
            <MapPin className="w-3 h-3 text-white" />
            <span className="text-xs text-white font-medium">You're here</span>
          </div>
          
          {/* Premium badge */}
          {person.is_premium && (
            <div className="absolute top-2 right-2 px-2 py-1 rounded-full bg-amber-500/90 flex items-center gap-1">
              <Crown className="w-3 h-3 text-white" />
            </div>
          )}
          
          {/* Overlay info */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
            <p className="text-white font-medium truncate">You</p>
            {person.age && <p className="text-slate-300 text-sm">{person.age}</p>}
            {person.presence_note && (
              <p className="text-slate-400 text-xs mt-1 truncate">{person.presence_note}</p>
            )}
          </div>
        </div>
        
        {/* Action - View Profile */}
        <div className="p-3">
          <Button
            size="sm"
            className="w-full bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 group-hover:bg-indigo-500/40"
            onClick={(e) => {
              e.stopPropagation();
              handleSelfClick();
            }}
          >
            <Eye className="w-4 h-4 mr-2" />
            View your profile
          </Button>
        </div>
      </div>
    );
  }
  
  // Regular person card (non-self)
  // Handle card click - always navigate to profile
  const handleCardClick = () => {
    navigate(`/profile/${person.id}`);
  };
  
  return (
    <div
      data-testid={`person-card-${person.id}`}
      onClick={handleCardClick}
      className="bg-white/5 rounded-2xl overflow-hidden border border-white/10 hover:border-indigo-500/50 transition-all group cursor-pointer"
    >
      {/* Photo */}
      <div className="relative aspect-[3/4]">
        {showSilhouette ? (
          <SilhouetteAvatar />
        ) : (
          <BlurredImage
            src={person.avatar_url || person.photos?.[0]}
            alt={person.display_name}
            isRevealed={person.is_revealed}
            className="w-full h-full object-cover"
          />
        )}
        
        {/* Premium badge */}
        {person.is_premium && (
          <div className="absolute top-2 right-2 px-2 py-1 rounded-full bg-amber-500/90 flex items-center gap-1">
            <Crown className="w-3 h-3 text-white" />
          </div>
        )}
        
        {/* Gender indicator - bottom left */}
        {person.show_as && (
          <div 
            className={`absolute bottom-14 left-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-lg ${
              person.show_as === "male" 
                ? "bg-blue-400/90 text-white" 
                : "bg-pink-400/90 text-white"
            }`}
            data-testid={`gender-indicator-${person.id}`}
          >
            {person.show_as === "male" ? "M" : "F"}
          </div>
        )}
        
        {/* Rainbow/OpenToAll indicators - next to gender */}
        {/* Rule: rainbow only = 🌈, open_to_all only = 🤗, both = 🌈🤗, neither = nothing */}
        <div className="absolute bottom-14 left-9 flex gap-1">
          {person.rainbow && (
            <div 
              className="w-6 h-6 rounded-full flex items-center justify-center shadow-lg overflow-hidden"
              style={{ 
                background: 'linear-gradient(135deg, #ef4444 0%, #f97316 20%, #eab308 40%, #22c55e 60%, #3b82f6 80%, #8b5cf6 100%)'
              }}
              data-testid={`rainbow-indicator-${person.id}`}
            >
              <div className="w-4 h-4 rounded-full bg-slate-900/50" />
            </div>
          )}
          {person.open_to_all && (
            <div 
              className="w-6 h-6 rounded-full flex items-center justify-center shadow-lg bg-amber-400/90"
              data-testid={`open-to-all-indicator-${person.id}`}
            >
              <span className="text-xs">🤗</span>
            </div>
          )}
        </div>
        
        {/* Safety Halo */}
        {person.has_safety_halo && person.is_revealed && (
          <div className="absolute top-2 left-2 px-2 py-1 rounded-full bg-emerald-500/90 flex items-center gap-1">
            <Shield className="w-3 h-3 text-white" />
          </div>
        )}
        
        {/* Mutual Match Badge - shows when both revealed and connected */}
        {person.is_revealed && person.is_connected && (
          <div 
            className="absolute top-2 right-2 px-2 py-1 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 flex items-center gap-1 shadow-lg"
            data-testid={`mutual-match-badge-${person.id}`}
          >
            <Sparkles className="w-3 h-3 text-white" />
            <span className="text-white text-xs font-medium">Match</span>
          </div>
        )}
        
        {/* Voice intro indicator */}
        {person.voice_intro_url && person.is_revealed && (
          <div className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-purple-500/90 flex items-center justify-center">
            <Mic className="w-4 h-4 text-white" />
          </div>
        )}
        
        {/* Overlay info */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
          <p className="text-white font-medium truncate">
            {person.is_revealed 
              ? `${person.display_name}${person.age ? `, ${person.age}` : ""}` 
              : `${(person.display_name || "?").charAt(0)}${person.age ? `, ${person.age}` : ""}`
            }
          </p>
          {/* Intent badge */}
          {person.intent && (
            <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full ${
              person.intent === "dating" ? "bg-pink-500/30 text-pink-300" :
              person.intent === "friends" ? "bg-emerald-500/30 text-emerald-300" :
              "bg-purple-500/30 text-purple-300"
            }`}>
              {person.intent === "dating" ? "Dating" : 
               person.intent === "friends" ? "Friends" : 
               person.intent === "open_to_both" ? "Open to both" : ""}
            </span>
          )}
          {person.presence_note && (
            <p className="text-slate-400 text-xs mt-1 truncate">{person.presence_note}</p>
          )}
          {person.shy_indicator && (
            <div className="flex items-center gap-1 mt-1">
              <Heart className="w-3 h-3 text-pink-400" />
              <span className="text-pink-300 text-xs">May be shy to start</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Actions - Icon-only thumbs */}
      <div className="p-3 flex gap-2 justify-center">
        {/* Pre-reveal state: Show Glance, Icebreaker, and Chat Request icons */}
        {!person.is_revealed ? (
          <>
            {/* Glance Button (Eye icon) - with confirmation hint */}
            {person.i_glanced_at ? (
              <Button
                data-testid={`glance-btn-${person.id}`}
                size="icon"
                variant="ghost"
                className="w-10 h-10 rounded-full bg-pink-500/20 text-pink-400"
                disabled
                title="Glanced"
              >
                <Eye className="w-5 h-5" />
              </Button>
            ) : (
              <ConfirmHint
                hint="Send a glance?"
                onConfirm={() => onGlance(person.id, venueId)}
                disabled={glancing === person.id}
                globalPendingRef={globalPendingRef}
                compact
              >
                <Button
                  data-testid={`glance-btn-${person.id}`}
                  size="icon"
                  variant="ghost"
                  className="w-10 h-10 rounded-full bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
                  disabled={glancing === person.id}
                  title="Send a glance"
                >
                  {glancing === person.id ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </Button>
              </ConfirmHint>
            )}
            
            {/* Icebreaker Button (Snowflake icon) - with confirmation hint */}
            {person.icebreaker_sent ? (
              <Button
                data-testid={`icebreaker-btn-${person.id}`}
                size="icon"
                variant="ghost"
                className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400"
                disabled
                title="Icebreaker sent"
              >
                <Snowflake className="w-5 h-5" />
              </Button>
            ) : person.icebreaker_received ? (
              <Button
                data-testid={`icebreaker-btn-${person.id}`}
                size="icon"
                variant="ghost"
                className="w-10 h-10 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white animate-pulse"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/profile/${person.id}`);
                }}
                title="Reply to icebreaker"
              >
                <Snowflake className="w-5 h-5" />
              </Button>
            ) : (
              <ConfirmHint
                hint="Send an icebreaker?"
                onConfirm={() => onIcebreaker(person)}
                globalPendingRef={globalPendingRef}
                compact
              >
                <Button
                  data-testid={`icebreaker-btn-${person.id}`}
                  size="icon"
                  variant="ghost"
                  className="w-10 h-10 rounded-full bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
                  title="Send an icebreaker"
                >
                  <Snowflake className="w-5 h-5" />
                </Button>
              </ConfirmHint>
            )}
            
            {/* Chat Request Button (MessageSquare icon) - with confirmation hint */}
            {person.chat_request_sent ? (
              <Button
                data-testid={`chat-request-btn-${person.id}`}
                size="icon"
                variant="ghost"
                className="w-10 h-10 rounded-full bg-purple-500/20 text-purple-400"
                disabled
                title="Chat request sent"
              >
                <MessageSquare className="w-5 h-5" />
              </Button>
            ) : (
              <ConfirmHint
                hint="Send a chat request?"
                onConfirm={() => onChatRequest && onChatRequest(person)}
                disabled={sendingChatRequest === person.id}
                globalPendingRef={globalPendingRef}
                compact
              >
                <Button
                  data-testid={`chat-request-btn-${person.id}`}
                  size="icon"
                  variant="ghost"
                  className="w-10 h-10 rounded-full bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
                  disabled={sendingChatRequest === person.id}
                  title="Send a chat request"
                >
                  {sendingChatRequest === person.id ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <MessageSquare className="w-5 h-5" />
                  )}
                </Button>
              </ConfirmHint>
            )}
          </>
        ) : person.is_connected ? (
          /* Post-reveal AND connected: Show Message button */
          <Button
            data-testid={`message-btn-${person.id}`}
            size="sm"
            className="flex-1 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/chat/${person.id}`);
            }}
          >
            Message
          </Button>
        ) : (
          /* Post-reveal but NOT connected yet: Show View Profile */
          <Button
            data-testid={`view-profile-btn-${person.id}`}
            size="sm"
            className="flex-1 bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/profile/${person.id}`);
            }}
          >
            View Profile
          </Button>
        )}
      </div>
      
      {/* Pre-reveal: Mutual interest indicator (they glanced at you but you haven't glanced back) */}
      {!person.is_revealed && person.has_glanced_at_me && !person.i_glanced_at && (
        <div className="px-3 pb-3">
          <div className="flex items-center gap-2 text-pink-400 text-xs">
            <Sparkles className="w-3 h-3" />
            <span>Showed interest in you</span>
          </div>
        </div>
      )}
      
      {/* Post-reveal + Connected: Mutual Match status */}
      {person.is_revealed && person.is_connected && (
        <div className="px-3 pb-3">
          <div className="flex items-center gap-2 text-emerald-400 text-xs">
            <Heart className="w-3 h-3 fill-current" />
            <span>You're matched! Start a conversation</span>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Icebreaker Modal Component
// ============================================================================
const IcebreakerModal = ({ show, person, sending, onClose, onSend }) => {
  if (!show || !person) return null;
  
  return (
    <Dialog open={show} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white">Send Icebreaker to {person.is_revealed ? person.display_name : (person.display_name || "?").charAt(0)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-4">
          {ICEBREAKER_MESSAGES.map((msg) => (
            <button
              key={msg.id}
              onClick={() => onSend(msg.id)}
              disabled={sending}
              className="w-full p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-indigo-500/50 transition-all flex items-center gap-3 disabled:opacity-50"
            >
              <span className="text-2xl">{msg.icon}</span>
              <span className="text-white">{msg.name}</span>
              {sending && <Loader2 className="w-4 h-4 animate-spin ml-auto text-indigo-400" />}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default Discovery;
