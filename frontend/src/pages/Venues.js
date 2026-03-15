import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth, API } from "@/App";
import { toast } from "sonner";
import axios from "axios";
import Layout from "../components/Layout";
import { MapPin, Users, LogOut, Loader2, Navigation, MapPinOff, Star, Clock, Radio } from "lucide-react";
import LiveClock from "../components/LiveClock";
import useLocationTracker from "../hooks/useLocationTracker";

const Venues = () => {
  const navigate = useNavigate();
  const routeLocation = useLocation();
  const { user, fetchUser } = useAuth();
  const [venues, setVenues] = useState([]);
  const [nearbyVenues, setNearbyVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [checkingIn, setCheckingIn] = useState(null);
  const [currentCheckin, setCurrentCheckin] = useState(null);
  const [geoLocation, setGeoLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [showOpenArea, setShowOpenArea] = useState(false);
  const heartbeatRef = useRef(null);

  // Continuous location tracking
  const {
    currentLocation,
    isTracking,
    startTracking,
    error: trackingError
  } = useLocationTracker({
    enableAutoVenueDetection: false, // We handle venue detection ourselves
    updateInterval: 30000,
    minMovementDistance: 15
  });

  // Update geoLocation when tracker detects movement
  useEffect(() => {
    if (currentLocation && currentLocation.lat && currentLocation.lng) {
      const newLoc = { lat: currentLocation.lat, lng: currentLocation.lng };
      
      // Only update if location changed significantly (> 10 meters)
      if (!geoLocation || 
          Math.abs(geoLocation.lat - newLoc.lat) > 0.0001 || 
          Math.abs(geoLocation.lng - newLoc.lng) > 0.0001) {
        setGeoLocation(newLoc);
        setLocationError(null);
      }
    }
  }, [currentLocation]);

  // Start tracking on mount
  useEffect(() => {
    startTracking();
  }, []);

  // Fetch check-in on every mount, focus, and visibility change
  useEffect(() => {
    // Fetch check-in status immediately
    fetchCurrentCheckin();
    
    // Fetch when page becomes visible (user switches back to app)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchCurrentCheckin();
      }
    };
    
    // Fetch when window gains focus (tab switch)
    const handleFocus = () => {
      fetchCurrentCheckin();
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Re-fetch check-in when navigating back to this page
  useEffect(() => {
    if (routeLocation.pathname === '/venues') {
      fetchCurrentCheckin();
    }
  }, [routeLocation.pathname]);

  // Update check-in state when user profile changes
  useEffect(() => {
    if (user?.active_venue_id && !currentCheckin) {
      fetchCurrentCheckin();
    } else if (!user?.active_venue_id && currentCheckin) {
      setCurrentCheckin(null);
    }
  }, [user?.active_venue_id]);

  useEffect(() => {
    // The location tracker handles continuous GPS updates
    // This fallback only runs if tracker hasn't provided location yet
    if (!geoLocation && !isTracking) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setGeoLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude
            });
          },
          (error) => {
            console.log("Location error:", error);
            setLocationError("Location access needed for nearby venues");
            // Fallback to seeded venues
            fetchSeededVenues();
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      } else {
        fetchSeededVenues();
      }
    }
    
    // Handle tracking errors
    if (trackingError) {
      setLocationError(trackingError);
    }
    
    seedVenues();
    
    // Heartbeat for auto-checkout prevention
    heartbeatRef.current = setInterval(async () => {
      try {
        await axios.post(`${API}/checkin/heartbeat`);
      } catch (e) {
        // ignore
      }
    }, 60000); // Every minute
    
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [isTracking, trackingError]);

  useEffect(() => {
    if (geoLocation) {
      fetchNearbyVenues(geoLocation.lat, geoLocation.lng);
    }
  }, [geoLocation]);

  const seedVenues = async () => {
    try {
      await axios.post(`${API}/seed`);
    } catch (error) {
      // Already seeded, ignore
    }
  };

  const fetchSeededVenues = async () => {
    try {
      const response = await axios.get(`${API}/venues`);
      setVenues(response.data);
    } catch (error) {
      toast.error("Failed to load venues");
    } finally {
      setLoading(false);
    }
  };

  const fetchNearbyVenues = async (lat, lng) => {
    setLoadingNearby(true);
    try {
      const response = await axios.get(`${API}/places/nearby?lat=${lat}&lng=${lng}`);
      setNearbyVenues(response.data);
      // If we got real places (not seeded), show them
      if (response.data.length > 0) {
        setShowOpenArea(false);
      } else {
        setShowOpenArea(true);
      }
    } catch (error) {
      console.error("Failed to fetch nearby venues:", error);
      // Fallback to seeded
      await fetchSeededVenues();
    } finally {
      setLoading(false);
      setLoadingNearby(false);
    }
  };

  const fetchCurrentCheckin = async () => {
    try {
      const response = await axios.get(`${API}/checkin/current`);
      if (response.data.checked_in) {
        setCurrentCheckin(response.data);
      }
    } catch (error) {
      console.error("Failed to fetch current checkin");
    }
  };

  const handleCheckIn = async (venueId, venue) => {
    setCheckingIn(venueId);
    try {
      // First check in to the venue
      await axios.post(`${API}/checkin/${venueId}`);
      
      // Refresh user profile to update active_venue_id
      if (fetchUser) fetchUser();
      
      // Then save the venue details if we have them
      if (venue && (venue.name || venue.address)) {
        try {
          await axios.put(`${API}/venues/${venueId}`, {
            name: venue.name || "Unknown Venue",
            address: venue.address || venue.vicinity || "",
            type: venue.type || venue.types?.[0] || "venue",
            latitude: venue.location?.lat || venue.lat,
            longitude: venue.location?.lng || venue.lng,
            photo_url: venue.photo_url,
            rating: venue.rating
          });
        } catch (e) {
          console.error("Failed to save venue details:", e);
        }
      }
      
      toast.success(`Checked in to ${venue?.name || 'venue'}!`);
      navigate(`/venue/${venueId}`);
    } catch (error) {
      toast.error("Failed to check in");
    } finally {
      setCheckingIn(null);
    }
  };

  const handleOpenAreaCheckIn = async () => {
    if (!geoLocation) {
      toast.error("Location required for open area check-in");
      return;
    }
    setCheckingIn("open-area");
    try {
      await axios.post(`${API}/checkin/open-area`, {
        latitude: geoLocation.lat,
        longitude: geoLocation.lng
      });
      toast.success("Checked in to your area!");
      fetchCurrentCheckin();
    } catch (error) {
      toast.error("Failed to check in");
    } finally {
      setCheckingIn(null);
    }
  };

  const handleCheckOut = async () => {
    try {
      await axios.post(`${API}/checkout`);
      setCurrentCheckin(null);
      // Refresh user profile to clear active_venue_id
      if (fetchUser) fetchUser();
      toast.success("Checked out");
      if (geoLocation) {
        fetchNearbyVenues(geoLocation.lat, geoLocation.lng);
      } else {
        fetchSeededVenues();
      }
    } catch (error) {
      toast.error("Failed to check out");
    }
  };

  const displayVenues = nearbyVenues.length > 0 ? nearbyVenues : venues;

  const getVenueTypeColor = (type) => {
    const t = type?.toLowerCase() || '';
    if (t.includes('bar') || t.includes('night')) return "text-pink-400";
    if (t.includes('cafe') || t.includes('coffee')) return "text-amber-400";
    if (t.includes('club')) return "text-purple-400";
    if (t.includes('restaurant') || t.includes('food')) return "text-emerald-400";
    if (t.includes('gym') || t.includes('fitness')) return "text-blue-400";
    if (t.includes('park')) return "text-green-400";
    return "text-slate-400";
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-6 pb-32" data-testid="venues-page">
        {/* Header with Clock */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Discover</h1>
            <p className="text-slate-400">Find your vibe and see who's around</p>
            {/* Location Tracking Status */}
            {isTracking && (
              <div className="flex items-center gap-2 mt-2">
                <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                <span className="text-xs text-emerald-400">Live tracking</span>
                {geoLocation && (
                  <span className="text-xs text-slate-500">
                    ({geoLocation.lat.toFixed(4)}, {geoLocation.lng.toFixed(4)})
                  </span>
                )}
              </div>
            )}
          </div>
          <LiveClock className="w-16 h-16" />
        </div>

        {/* Location Status */}
        {locationError && (
          <div className="glass rounded-2xl p-4 mb-6 flex items-center gap-3 border border-amber-500/30" data-testid="location-error">
            <MapPinOff className="w-5 h-5 text-amber-400" />
            <div>
              <p className="text-white font-medium">Location not available</p>
              <p className="text-slate-400 text-sm">Showing curated venues instead</p>
            </div>
          </div>
        )}

        {/* Demo Mode Notice */}
        {displayVenues.length > 0 && displayVenues[0]?.is_seeded && (
          <div className="glass rounded-2xl p-4 mb-6 flex items-center gap-3 border border-indigo-500/30" data-testid="demo-mode-notice">
            <MapPin className="w-5 h-5 text-indigo-400" />
            <div>
              <p className="text-white font-medium">Demo Mode</p>
              <p className="text-slate-400 text-sm">Showing sample venues. Connect Google Places API for real venues.</p>
            </div>
          </div>
        )}

        {/* Current Check-in Banner */}
        {currentCheckin && (
          <div className="glass rounded-2xl p-4 mb-6 flex items-center justify-between" data-testid="current-checkin-banner">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald-500 animate-live" />
              <div>
                <p className="text-white font-medium">
                  {currentCheckin.checkin?.is_open_area 
                    ? `Within ${currentCheckin.checkin?.approximate_radius || 150}m` 
                    : `You're at ${currentCheckin.venue?.name}`
                  }
                </p>
                {currentCheckin.checkin?.is_open_area ? (
                  <p className="text-slate-400 text-sm">Open area check-in</p>
                ) : (
                  <button
                    onClick={() => navigate(`/venue/${currentCheckin.checkin.venue_id}`)}
                    className="text-slate-400 text-sm hover:text-indigo-400 transition-colors cursor-pointer"
                    data-testid="people-count-link"
                  >
                    {currentCheckin.venue?.checked_in_count || 0} people here
                  </button>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {!currentCheckin.checkin?.is_open_area && (
                <Button
                  data-testid="view-whos-here-btn"
                  onClick={() => navigate(`/venue/${currentCheckin.checkin.venue_id}`)}
                  className="rounded-full bg-indigo-500 hover:bg-indigo-600 text-white"
                >
                  Who's Here
                </Button>
              )}
              <Button
                data-testid="checkout-btn"
                onClick={handleCheckOut}
                variant="ghost"
                className="rounded-full text-slate-400 hover:text-white hover:bg-white/10"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Open Area Option */}
        {geoLocation && !currentCheckin && (
          <div className="glass rounded-2xl p-4 mb-6" data-testid="open-area-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                  <Navigation className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <p className="text-white font-medium">Not at a venue?</p>
                  <p className="text-slate-400 text-sm">Check in to your current area (~150m radius)</p>
                </div>
              </div>
              <Button
                data-testid="open-area-checkin-btn"
                onClick={handleOpenAreaCheckIn}
                disabled={checkingIn === "open-area"}
                className="rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400"
              >
                {checkingIn === "open-area" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Check In Here"
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Venues Grid */}
        {loading || loadingNearby ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayVenues.map((venue) => (
              <div
                key={venue.place_id || venue.id}
                data-testid={`venue-card-${venue.place_id || venue.id}`}
                className="venue-card rounded-3xl bg-slate-900/50 border border-white/5 overflow-hidden group"
              >
                {/* Venue Image */}
                <div className="relative aspect-[16/10] overflow-hidden">
                  <img
                    src={venue.image_url || "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800"}
                    alt={venue.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      e.target.src = "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800";
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent" />
                  
                  {/* Live Count & Distance */}
                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    {venue.distance && (
                      <span className="glass rounded-full px-3 py-1.5 text-white text-xs font-medium">
                        {venue.distance < 1000 ? `${venue.distance}m` : `${(venue.distance/1000).toFixed(1)}km`}
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/venue/${venue.place_id || venue.id}`);
                      }}
                      className="flex items-center gap-2 glass rounded-full px-3 py-1.5 hover:bg-white/20 transition-colors cursor-pointer"
                      data-testid={`venue-count-${venue.place_id || venue.id}`}
                    >
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-live" />
                      <span className="text-white text-sm font-medium">
                        {venue.checked_in_count || 0}
                      </span>
                    </button>
                  </div>

                  {/* Open/Closed Status */}
                  {venue.is_open !== undefined && (
                    <div className="absolute top-4 left-4">
                      <span className={`glass rounded-full px-3 py-1.5 text-xs font-medium flex items-center gap-1 ${venue.is_open ? 'text-emerald-400' : 'text-slate-400'}`}>
                        <Clock className="w-3 h-3" />
                        {venue.is_open ? 'Open' : 'Closed'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Venue Info */}
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-semibold text-white mb-1 truncate">{venue.name}</h3>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium capitalize ${getVenueTypeColor(venue.type)}`}>
                          {venue.type?.replace(/_/g, ' ')}
                        </span>
                        {venue.rating && (
                          <span className="flex items-center gap-1 text-amber-400 text-sm">
                            <Star className="w-3.5 h-3.5 fill-current" />
                            {venue.rating.toFixed(1)}
                          </span>
                        )}
                        {venue.price_level && (
                          <span className="text-slate-500 text-sm">
                            {'£'.repeat(venue.price_level)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {venue.description && (
                    <p className="text-slate-400 text-sm mb-4 line-clamp-2">{venue.description}</p>
                  )}

                  <div className="flex items-center gap-2 text-slate-500 text-sm mb-4">
                    <MapPin className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{venue.address}</span>
                  </div>

                  <Button
                    data-testid={`checkin-btn-${venue.place_id || venue.id}`}
                    onClick={() => handleCheckIn(venue.place_id || venue.id, venue)}
                    disabled={checkingIn === (venue.place_id || venue.id)}
                    className="w-full h-11 rounded-xl bg-white text-slate-900 font-semibold hover:bg-slate-100 transition-all active:scale-[0.98]"
                  >
                    {checkingIn === (venue.place_id || venue.id) ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Checking in...
                      </>
                    ) : currentCheckin?.checkin?.venue_id === (venue.place_id || venue.id) ? (
                      "You're Here"
                    ) : (
                      "Check In"
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && displayVenues.length === 0 && (
          <div className="text-center py-20">
            <p className="text-slate-400">No venues found nearby</p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Venues;
