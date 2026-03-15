import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { API } from '@/App';

/**
 * Continuous location tracking hook
 * - Watches GPS position in background
 * - Detects when user enters venue radius
 * - Auto-updates nearby venues
 */
export const useLocationTracker = (options = {}) => {
  const {
    enableAutoVenueDetection = true,
    venueRadius = 100, // meters to consider "at" a venue
    updateInterval = 30000, // Check venues every 30 seconds
    minMovementDistance = 20 // Minimum movement in meters to trigger venue check
  } = options;

  const [currentLocation, setCurrentLocation] = useState(null);
  const [nearbyVenues, setNearbyVenues] = useState([]);
  const [currentVenue, setCurrentVenue] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const watchIdRef = useRef(null);
  const lastLocationRef = useRef(null);
  const venueCheckIntervalRef = useRef(null);

  // Calculate distance between two points (Haversine formula)
  const calculateDistance = useCallback((lat1, lng1, lat2, lng2) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }, []);

  // Fetch nearby venues from API
  const fetchNearbyVenues = useCallback(async (lat, lng) => {
    try {
      const response = await axios.get(`${API}/places/nearby`, {
        params: { lat, lng, radius: 500 }
      });
      setNearbyVenues(response.data || []);
      setLastUpdate(new Date());
      return response.data || [];
    } catch (err) {
      console.error('Failed to fetch nearby venues:', err);
      return [];
    }
  }, []);

  // Check if user is at a venue
  const detectCurrentVenue = useCallback((location, venues) => {
    if (!location || !venues.length) return null;

    let closestVenue = null;
    let closestDistance = Infinity;

    for (const venue of venues) {
      // Use venue's lat/lng if available, otherwise skip
      const venueLat = venue.latitude || venue.lat;
      const venueLng = venue.longitude || venue.lng;
      
      if (venueLat && venueLng) {
        const distance = calculateDistance(
          location.lat, location.lng,
          venueLat, venueLng
        );

        if (distance < closestDistance && distance <= venueRadius) {
          closestDistance = distance;
          closestVenue = { ...venue, distance };
        }
      }
    }

    return closestVenue;
  }, [calculateDistance, venueRadius]);

  // Handle location update
  const handleLocationUpdate = useCallback(async (position) => {
    const newLocation = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: position.timestamp
    };

    setCurrentLocation(newLocation);
    setError(null);

    // Check if moved enough to warrant venue check
    const lastLoc = lastLocationRef.current;
    let shouldCheckVenues = !lastLoc;

    if (lastLoc) {
      const movedDistance = calculateDistance(
        lastLoc.lat, lastLoc.lng,
        newLocation.lat, newLocation.lng
      );
      shouldCheckVenues = movedDistance >= minMovementDistance;
    }

    if (shouldCheckVenues && enableAutoVenueDetection) {
      lastLocationRef.current = newLocation;
      const venues = await fetchNearbyVenues(newLocation.lat, newLocation.lng);
      const detectedVenue = detectCurrentVenue(newLocation, venues);
      
      if (detectedVenue) {
        setCurrentVenue(detectedVenue);
      }
    }
  }, [calculateDistance, minMovementDistance, enableAutoVenueDetection, fetchNearbyVenues, detectCurrentVenue]);

  // Handle location error
  const handleLocationError = useCallback((err) => {
    let errorMessage = 'Location error';
    switch (err.code) {
      case err.PERMISSION_DENIED:
        errorMessage = 'Location permission denied';
        break;
      case err.POSITION_UNAVAILABLE:
        errorMessage = 'Location unavailable';
        break;
      case err.TIMEOUT:
        errorMessage = 'Location request timed out';
        break;
      default:
        errorMessage = err.message || 'Unknown location error';
    }
    setError(errorMessage);
  }, []);

  // Start tracking
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      return;
    }

    if (watchIdRef.current !== null) {
      return; // Already tracking
    }

    setIsTracking(true);
    setError(null);

    // Start watching position
    watchIdRef.current = navigator.geolocation.watchPosition(
      handleLocationUpdate,
      handleLocationError,
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000
      }
    );

    // Also set up periodic venue check
    venueCheckIntervalRef.current = setInterval(() => {
      if (currentLocation) {
        fetchNearbyVenues(currentLocation.lat, currentLocation.lng).then(venues => {
          const detectedVenue = detectCurrentVenue(currentLocation, venues);
          if (detectedVenue) {
            setCurrentVenue(detectedVenue);
          }
        });
      }
    }, updateInterval);

  }, [handleLocationUpdate, handleLocationError, currentLocation, fetchNearbyVenues, detectCurrentVenue, updateInterval]);

  // Stop tracking
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (venueCheckIntervalRef.current) {
      clearInterval(venueCheckIntervalRef.current);
      venueCheckIntervalRef.current = null;
    }

    setIsTracking(false);
  }, []);

  // Get current location once
  const getCurrentLocation = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
          };
          setCurrentLocation(location);
          resolve(location);
        },
        (err) => {
          handleLocationError(err);
          reject(err);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );
    });
  }, [handleLocationError]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  return {
    currentLocation,
    nearbyVenues,
    currentVenue,
    isTracking,
    error,
    lastUpdate,
    startTracking,
    stopTracking,
    getCurrentLocation,
    fetchNearbyVenues
  };
};

export default useLocationTracker;
