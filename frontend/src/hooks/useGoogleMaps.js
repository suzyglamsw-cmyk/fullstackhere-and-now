import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for Google Maps functionality
 * Provides: map loading, user location, place search, autocomplete, geocoding
 */
export const useGoogleMaps = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [loadingLocation, setLoadingLocation] = useState(false);

  // Check if Google Maps is loaded
  useEffect(() => {
    if (window.google && window.google.maps) {
      setIsLoaded(true);
    } else {
      const handleLoad = () => setIsLoaded(true);
      window.addEventListener('google-maps-loaded', handleLoad);
      return () => window.removeEventListener('google-maps-loaded', handleLoad);
    }
  }, []);

  // Get user's current location using Geolocation API
  const getCurrentLocation = useCallback(() => {
    return new Promise((resolve, reject) => {
      setLoadingLocation(true);
      setLocationError(null);

      if (!navigator.geolocation) {
        const error = 'Geolocation is not supported by your browser';
        setLocationError(error);
        setLoadingLocation(false);
        reject(new Error(error));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
          };
          setUserLocation(location);
          setLoadingLocation(false);
          resolve(location);
        },
        (error) => {
          let errorMessage = 'Unable to get your location';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location permission denied';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information unavailable';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out';
              break;
            default:
              break;
          }
          setLocationError(errorMessage);
          setLoadingLocation(false);
          reject(new Error(errorMessage));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // Cache for 5 minutes
        }
      );
    });
  }, []);

  // Search for places using Places API
  const searchPlaces = useCallback(async (query, location = null, radius = 5000) => {
    if (!isLoaded || !window.google) {
      throw new Error('Google Maps not loaded');
    }

    return new Promise((resolve, reject) => {
      const service = new window.google.maps.places.PlacesService(
        document.createElement('div')
      );

      const request = {
        query,
        ...(location && { location: new window.google.maps.LatLng(location.lat, location.lng) }),
        ...(radius && { radius })
      };

      service.textSearch(request, (results, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK) {
          resolve(results);
        } else {
          reject(new Error(`Places search failed: ${status}`));
        }
      });
    });
  }, [isLoaded]);

  // Search nearby places
  const searchNearby = useCallback(async (location, type = 'bar', radius = 5000) => {
    if (!isLoaded || !window.google) {
      throw new Error('Google Maps not loaded');
    }

    return new Promise((resolve, reject) => {
      const service = new window.google.maps.places.PlacesService(
        document.createElement('div')
      );

      const request = {
        location: new window.google.maps.LatLng(location.lat, location.lng),
        radius,
        type
      };

      service.nearbySearch(request, (results, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK) {
          resolve(results);
        } else if (status === window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
          resolve([]);
        } else {
          reject(new Error(`Nearby search failed: ${status}`));
        }
      });
    });
  }, [isLoaded]);

  // Get place details
  const getPlaceDetails = useCallback(async (placeId) => {
    if (!isLoaded || !window.google) {
      throw new Error('Google Maps not loaded');
    }

    return new Promise((resolve, reject) => {
      const service = new window.google.maps.places.PlacesService(
        document.createElement('div')
      );

      const request = {
        placeId,
        fields: ['name', 'formatted_address', 'geometry', 'photos', 'rating', 'opening_hours', 'types', 'website', 'formatted_phone_number']
      };

      service.getDetails(request, (place, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK) {
          resolve(place);
        } else {
          reject(new Error(`Place details failed: ${status}`));
        }
      });
    });
  }, [isLoaded]);

  // Geocode an address to coordinates
  const geocodeAddress = useCallback(async (address) => {
    if (!isLoaded || !window.google) {
      throw new Error('Google Maps not loaded');
    }

    return new Promise((resolve, reject) => {
      const geocoder = new window.google.maps.Geocoder();

      geocoder.geocode({ address }, (results, status) => {
        if (status === 'OK' && results[0]) {
          resolve({
            lat: results[0].geometry.location.lat(),
            lng: results[0].geometry.location.lng(),
            formatted_address: results[0].formatted_address
          });
        } else {
          reject(new Error(`Geocoding failed: ${status}`));
        }
      });
    });
  }, [isLoaded]);

  // Reverse geocode coordinates to address
  const reverseGeocode = useCallback(async (lat, lng) => {
    if (!isLoaded || !window.google) {
      throw new Error('Google Maps not loaded');
    }

    return new Promise((resolve, reject) => {
      const geocoder = new window.google.maps.Geocoder();
      const latlng = { lat, lng };

      geocoder.geocode({ location: latlng }, (results, status) => {
        if (status === 'OK' && results[0]) {
          resolve({
            formatted_address: results[0].formatted_address,
            address_components: results[0].address_components
          });
        } else {
          reject(new Error(`Reverse geocoding failed: ${status}`));
        }
      });
    });
  }, [isLoaded]);

  // Calculate distance between two points (in meters)
  const calculateDistance = useCallback((from, to) => {
    if (!isLoaded || !window.google) {
      // Fallback Haversine formula
      const R = 6371e3; // Earth's radius in meters
      const lat1 = from.lat * Math.PI / 180;
      const lat2 = to.lat * Math.PI / 180;
      const deltaLat = (to.lat - from.lat) * Math.PI / 180;
      const deltaLng = (to.lng - from.lng) * Math.PI / 180;

      const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
                Math.cos(lat1) * Math.cos(lat2) *
                Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      return R * c;
    }

    const fromLatLng = new window.google.maps.LatLng(from.lat, from.lng);
    const toLatLng = new window.google.maps.LatLng(to.lat, to.lng);
    return window.google.maps.geometry.spherical.computeDistanceBetween(fromLatLng, toLatLng);
  }, [isLoaded]);

  // Format distance for display
  const formatDistance = useCallback((meters) => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  }, []);

  return {
    isLoaded,
    userLocation,
    locationError,
    loadingLocation,
    getCurrentLocation,
    searchPlaces,
    searchNearby,
    getPlaceDetails,
    geocodeAddress,
    reverseGeocode,
    calculateDistance,
    formatDistance
  };
};

export default useGoogleMaps;
