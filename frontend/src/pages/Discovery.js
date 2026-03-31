import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth, API } from "@/App";
import { toast } from "sonner";
import axios from "axios";
import Layout from "../components/Layout";
import BlurredImage from "../components/BlurredImage";
import { getErrorMessage } from "../utils/errorUtils";
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
  X,
  Radio,
  Navigation,
  Building2,
  ArrowRight,
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

const Discovery = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  
  // Mode: null (selection screen), "here", or "not-here"
  const urlMode = searchParams.get("mode");
  const [mode, setMode] = useState(urlMode || null);
  const [radius, setRadius] = useState("0-10");
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(false);
  const [venue, setVenue] = useState(null);
  const [venueLoading, setVenueLoading] = useState(true);
  const [nearbyVenues, setNearbyVenues] = useState([]);
  const [venuesLoading, setVenuesLoading] = useState(false);
  const [proximityEchoes, setProximityEchoes] = useState([]);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  
  // Interaction states
  const [glancing, setGlancing] = useState(null);
  const [showIcebreakerModal, setShowIcebreakerModal] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [sendingIcebreaker, setSendingIcebreaker] = useState(false);

  // Check location permission
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.permissions?.query({ name: 'geolocation' }).then((result) => {
        setHasLocationPermission(result.state === 'granted');
      }).catch(() => {
        setHasLocationPermission(true);
      });
    }
  }, []);

  // Fetch current venue on mount
  useEffect(() => {
    fetchCurrentVenue();
  }, []);

  // Fetch data when mode changes
  useEffect(() => {
    if (mode === "here") {
      fetchProximityEchoes();
      fetchPeople();
      fetchNearbyVenues();
    } else if (mode === "not-here") {
      fetchPeople();
    }
  }, [mode, radius, venue]);

  // Update URL when mode changes
  useEffect(() => {
    if (mode) {
      setSearchParams({ mode });
    } else {
      setSearchParams({});
    }
  }, [mode, setSearchParams]);

  // Handle mode selection
  const handleSelectMode = (selectedMode) => {
    if (selectedMode === "here") {
      setMode("here");
    } else {
      setMode("not-here");
    }
  };

  // Go back to mode selector
  const goToModeSelector = () => {
    setMode(null);
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
        setNearbyVenues(filtered.slice(0, 5)); // Show top 5 nearby venues
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
        ? `${API}/discovery/here-and-now`
        : `${API}/discovery/not-here?radius=${radius}`;
      
      const response = await axios.get(endpoint);
      setPeople(response.data || []);
    } catch (error) {
      if (error.response?.status !== 403) {
        console.error("Failed to fetch people:", error);
      }
      setPeople([]);
    } finally {
      setLoading(false);
    }
  };

  const handleGlance = async (userId) => {
    setGlancing(userId);
    try {
      await axios.post(`${API}/glances`, { to_user_id: userId });
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
      await axios.post(`${API}/icebreakers/send`, {
        to_user_id: selectedPerson.id,
        message_index: messageIndex
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

  const handleCheckIn = async (venueId) => {
    try {
      await axios.post(`${API}/checkin/${venueId}`);
      toast.success("Checked in!");
      fetchCurrentVenue();
      fetchPeople();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  // ============================================================================
  // RENDER: Mode Selection Screen
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
                      {venue ? `You're at ${venue.venue_name}` : "Check into a venue to see who's there"}
                    </p>
                  </div>
                  {venue && (
                    <div className="flex items-center gap-1 text-emerald-400 text-sm">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Active
                    </div>
                  )}
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
                      People nearby but not at the same place
                    </p>
                  </div>
                </div>
              </button>
            </div>
            
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
  // RENDER: Here & Now / Not Here Mode
  // ============================================================================
  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
        {/* Header with Tabs */}
        <div className="sticky top-0 z-40 glass border-b border-white/5">
          <div className="max-w-4xl mx-auto px-4 py-4">
            {/* Mode Toggle Tabs */}
            <div className="flex rounded-xl bg-white/5 p-1 mb-4">
              <button
                data-testid="tab-here"
                onClick={() => setMode("here")}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                  mode === "here"
                    ? "bg-indigo-500 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                HERE & NOW
              </button>
              <button
                data-testid="tab-not-here"
                onClick={() => setMode("not-here")}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                  mode === "not-here"
                    ? "bg-indigo-500 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                NOT HERE
              </button>
            </div>

            {/* Mode-specific header content */}
            {mode === "here" ? (
              <div>
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
                      {hasLocationPermission && (
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
                {nearbyVenues.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-slate-400 mb-2">Other venues nearby</h3>
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
                  </div>
                )}
              </div>
            ) : (
              <div>
                <p className="text-slate-400 text-sm mb-3">
                  People who aren't here right now, but quite near.
                </p>
                {/* Radius Selector */}
                <div className="flex gap-2">
                  {RADIUS_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      data-testid={`radius-${option.value}`}
                      onClick={() => setRadius(option.value)}
                      className={`px-4 py-2 rounded-xl text-sm transition-all ${
                        radius === option.value
                          ? "bg-indigo-500 text-white"
                          : "bg-white/5 text-slate-400 hover:bg-white/10"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-2">Choose how near you want people to be</p>
              </div>
            )}
          </div>
        </div>

        {/* Proximity Echoes - Here & Now only */}
        {mode === "here" && proximityEchoes.length > 0 && (
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
          {loading || (mode === "here" && venueLoading) ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
          ) : people.length === 0 ? (
            <div className="text-center py-20">
              <Users className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">
                {mode === "here" 
                  ? (venue ? "No one's around" : "Find a venue") 
                  : "No one nearby"}
              </h2>
              <p className="text-slate-400 mb-4">
                {mode === "here"
                  ? (venue 
                      ? "No one's around at the moment. Try again soon or switch to Not Here."
                      : "Check into a venue to see who's around.")
                  : "No one is near enough right now. Try widening your radius."}
              </p>
              {mode === "here" && !venue && (
                <Button
                  data-testid="find-venue-btn"
                  onClick={() => navigate("/venues")}
                  className="rounded-xl bg-indigo-500 hover:bg-indigo-600"
                >
                  <Navigation className="w-4 h-4 mr-2" />
                  Find a venue to check in
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {people.map((person) => (
                <div
                  key={person.id}
                  className="bg-white/5 rounded-2xl overflow-hidden border border-white/10 hover:border-indigo-500/50 transition-all group"
                >
                  {/* Photo */}
                  <div className="relative aspect-[3/4]">
                    <BlurredImage
                      src={person.avatar_url || person.photos?.[0]}
                      alt={person.display_name}
                      isRevealed={person.is_revealed}
                      isThumbnail={true}
                      className="w-full h-full object-cover"
                    />
                    
                    {/* Badges overlay */}
                    <div className="absolute top-2 left-2 flex flex-col gap-1">
                      {person.is_premium && (
                        <div className="bg-amber-500/90 rounded-full p-1">
                          <Crown className="w-3 h-3 text-white" />
                        </div>
                      )}
                      {person.is_shy && (
                        <div className="bg-pink-500/90 rounded-full p-1">
                          <Heart className="w-3 h-3 text-white" />
                        </div>
                      )}
                      {person.has_voice_intro && (
                        <div className="bg-indigo-500/90 rounded-full p-1">
                          <Mic className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>

                    {/* Safety Halo */}
                    {person.safety_halo && (
                      <div className="absolute top-2 right-2 bg-emerald-500/90 rounded-full p-1">
                        <Shield className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-white truncate">
                        {person.display_name}, {person.age}
                      </h3>
                    </div>
                    
                    {/* Presence Note */}
                    {person.presence_note && (
                      <p className="text-xs text-slate-400 mb-2 line-clamp-2">
                        "{person.presence_note}"
                      </p>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      {/* Glance Button */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleGlance(person.id)}
                        disabled={glancing === person.id || person.has_glanced}
                        className={`flex-1 h-8 text-xs ${
                          person.has_glanced 
                            ? "bg-indigo-500/20 text-indigo-400" 
                            : "hover:bg-white/10"
                        }`}
                      >
                        {glancing === person.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <>
                            <Eye className="w-3 h-3 mr-1" />
                            {person.has_glanced ? "Glanced" : "Glance"}
                          </>
                        )}
                      </Button>
                      
                      {/* Icebreaker Button */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenIcebreaker(person)}
                        disabled={person.has_icebreaker}
                        className={`flex-1 h-8 text-xs ${
                          person.has_icebreaker 
                            ? "bg-cyan-500/20 text-cyan-400" 
                            : "hover:bg-white/10"
                        }`}
                      >
                        <Snowflake className="w-3 h-3 mr-1" />
                        {person.has_icebreaker ? "Sent" : "Break ice"}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Icebreaker Modal */}
        <Dialog open={showIcebreakerModal} onOpenChange={setShowIcebreakerModal}>
          <DialogContent className="bg-slate-900 border-white/10 max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-white text-center">
                Send an Icebreaker
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-4">
              {ICEBREAKER_MESSAGES.map((msg) => (
                <button
                  key={msg.id}
                  onClick={() => handleSendIcebreaker(msg.id)}
                  disabled={sendingIcebreaker}
                  className="w-full p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-all flex items-center gap-3"
                >
                  <span className="text-2xl">{msg.icon}</span>
                  <span className="text-white">{msg.name}</span>
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Discovery;
