import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  MapPin,
  Users,
  ArrowLeft,
  Star,
  Clock,
  Radio,
  MapPinOff,
  Loader2,
} from 'lucide-react-native';
import * as Location from 'expo-location';

import { useAuth } from '../src/context/AuthContext';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, API_URL } from '../src/utils/constants';
import api from '../src/utils/api';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - SPACING.lg * 2 - SPACING.md) / 2;

const VenuesScreen = ({ navigation }) => {
  const { user, fetchUser } = useAuth();
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checkingIn, setCheckingIn] = useState(null);
  const [currentCheckin, setCurrentCheckin] = useState(null);
  const [geoLocation, setGeoLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [isTracking, setIsTracking] = useState(false);

  useEffect(() => {
    getLocationAndVenues();
    fetchCurrentCheckin();
  }, []);

  const getLocationAndVenues = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setIsTracking(true);
        const location = await Location.getCurrentPositionAsync({});
        const coords = {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
        };
        setGeoLocation(coords);
        setLocationError(null);
        await fetchNearbyVenues(coords.lat, coords.lng);
      } else {
        setLocationError('Location access needed for nearby venues');
        await fetchSeededVenues();
      }
    } catch (error) {
      setLocationError('Unable to get location');
      await fetchSeededVenues();
    } finally {
      setLoading(false);
    }
  };

  const fetchSeededVenues = async () => {
    try {
      const response = await api.get('/api/venues');
      setVenues(response.data);
    } catch (error) {
      console.error('Failed to load venues:', error);
    }
  };

  const fetchNearbyVenues = async (lat, lng) => {
    try {
      const response = await api.get(`/api/places/nearby?lat=${lat}&lng=${lng}`);
      if (response.data.length > 0) {
        setVenues(response.data);
      } else {
        await fetchSeededVenues();
      }
    } catch (error) {
      console.error('Failed to fetch nearby venues:', error);
      await fetchSeededVenues();
    }
  };

  const fetchCurrentCheckin = async () => {
    try {
      const response = await api.get('/api/checkin/current');
      if (response.data.checked_in) {
        setCurrentCheckin(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch current checkin:', error);
    }
  };

  const handleCheckIn = async (venueId, venue) => {
    setCheckingIn(venueId);
    try {
      await api.post(`/api/checkin/${venueId}`);
      if (fetchUser) fetchUser();
      navigation.navigate('WhosHere', { venueId, venueName: venue?.name });
    } catch (error) {
      console.error('Failed to check in:', error);
    } finally {
      setCheckingIn(null);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await getLocationAndVenues();
    await fetchCurrentCheckin();
    setRefreshing(false);
  }, []);

  const getVenueTypeColor = (type) => {
    const t = type?.toLowerCase() || '';
    if (t.includes('bar') || t.includes('night')) return COLORS.accent;
    if (t.includes('cafe') || t.includes('coffee')) return COLORS.warning;
    if (t.includes('club')) return COLORS.primary;
    if (t.includes('restaurant') || t.includes('food')) return COLORS.success;
    if (t.includes('gym') || t.includes('fitness')) return COLORS.info;
    if (t.includes('park')) return '#22c55e';
    return COLORS.textSecondary;
  };

  const VenueCard = ({ venue }) => {
    const venueId = venue.place_id || venue.id;
    const isCurrentVenue = currentCheckin?.checkin?.venue_id === venueId;

    return (
      <View style={styles.venueCard}>
        {/* Venue Image */}
        <View style={styles.venueImageContainer}>
          <Image
            source={{
              uri: venue.image_url || 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800',
            }}
            style={styles.venueImage}
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            style={styles.imageGradient}
          />

          {/* Live Count & Distance */}
          <View style={styles.venueOverlay}>
            {venue.distance && (
              <View style={styles.distanceBadge}>
                <Text style={styles.badgeText}>
                  {venue.distance < 1000
                    ? `${venue.distance}m`
                    : `${(venue.distance / 1000).toFixed(1)}km`}
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.countBadge}
              onPress={() => navigation.navigate('WhosHere', { venueId, venueName: venue.name })}
            >
              <View style={styles.liveDot} />
              <Text style={styles.countText}>{venue.checked_in_count || 0}</Text>
            </TouchableOpacity>
          </View>

          {/* Open/Closed Status */}
          {venue.is_open !== undefined && (
            <View style={styles.statusBadge}>
              <Clock color={venue.is_open ? COLORS.success : COLORS.textSecondary} size={12} />
              <Text style={[styles.statusText, { color: venue.is_open ? COLORS.success : COLORS.textSecondary }]}>
                {venue.is_open ? 'Open' : 'Closed'}
              </Text>
            </View>
          )}
        </View>

        {/* Venue Info */}
        <View style={styles.venueInfo}>
          <Text style={styles.venueName} numberOfLines={1}>{venue.name}</Text>
          <View style={styles.venueMetaRow}>
            <Text style={[styles.venueType, { color: getVenueTypeColor(venue.type) }]}>
              {venue.type?.replace(/_/g, ' ')}
            </Text>
            {venue.rating && (
              <View style={styles.ratingContainer}>
                <Star color={COLORS.warning} size={12} fill={COLORS.warning} />
                <Text style={styles.ratingText}>{venue.rating.toFixed(1)}</Text>
              </View>
            )}
          </View>

          <View style={styles.addressRow}>
            <MapPin color={COLORS.textMuted} size={14} />
            <Text style={styles.addressText} numberOfLines={1}>{venue.address}</Text>
          </View>

          <TouchableOpacity
            style={[
              styles.checkInButton,
              isCurrentVenue && styles.checkInButtonActive,
            ]}
            onPress={() => {
              if (isCurrentVenue) {
                navigation.navigate('WhosHere', { venueId, venueName: venue.name });
              } else {
                handleCheckIn(venueId, venue);
              }
            }}
            disabled={checkingIn === venueId}
          >
            {checkingIn === venueId ? (
              <ActivityIndicator size="small" color={COLORS.text} />
            ) : isCurrentVenue ? (
              <>
                <Users color={COLORS.text} size={16} />
                <Text style={styles.checkInText}>You're Here - View</Text>
              </>
            ) : (
              <Text style={styles.checkInTextDark}>Check In</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
      >
        {/* Back to Discovery */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft color={COLORS.textSecondary} size={18} />
          <Text style={styles.backText}>Back to Discovery</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Find a Venue</Text>
            <Text style={styles.headerSubtitle}>Check into a place to see who's around</Text>
            {isTracking && geoLocation && (
              <View style={styles.trackingRow}>
                <Radio color={COLORS.success} size={12} />
                <Text style={styles.trackingText}>Live tracking</Text>
                <Text style={styles.coordsText}>
                  ({geoLocation.lat.toFixed(4)}, {geoLocation.lng.toFixed(4)})
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Location Error */}
        {locationError && (
          <View style={styles.errorBanner}>
            <MapPinOff color={COLORS.warning} size={20} />
            <View style={styles.errorContent}>
              <Text style={styles.errorTitle}>Location not available</Text>
              <Text style={styles.errorText}>Showing curated venues instead</Text>
            </View>
          </View>
        )}

        {/* Current Check-in Banner */}
        {currentCheckin && (
          <View style={styles.checkinBanner}>
            <View style={styles.checkinInfo}>
              <View style={styles.liveDot} />
              <View>
                <Text style={styles.checkinTitle}>You're at {currentCheckin.venue?.name}</Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('WhosHere', { 
                    venueId: currentCheckin.checkin.venue_id,
                    venueName: currentCheckin.venue?.name
                  })}
                >
                  <Text style={styles.checkinLink}>
                    {currentCheckin.venue?.checked_in_count || 0} people here
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity
              style={styles.whosHereButton}
              onPress={() => navigation.navigate('WhosHere', {
                venueId: currentCheckin.checkin.venue_id,
                venueName: currentCheckin.venue?.name
              })}
            >
              <Text style={styles.whosHereText}>Who's Here</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Venues Grid */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : venues.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No venues found nearby</Text>
          </View>
        ) : (
          <View style={styles.venuesGrid}>
            {venues.map((venue) => (
              <VenueCard key={venue.place_id || venue.id} venue={venue} />
            ))}
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    gap: SPACING.xs,
  },
  backText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  headerSubtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  trackingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
    gap: SPACING.xs,
  },
  trackingText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.success,
  },
  coordsText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: `${COLORS.warning}40`,
    gap: SPACING.md,
  },
  errorContent: {
    flex: 1,
  },
  errorTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  errorText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  checkinBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    padding: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
  },
  checkinInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  liveDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.success,
  },
  checkinTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  checkinLink: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
  },
  whosHereButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
  },
  whosHereText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  venuesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
  },
  venueCard: {
    width: CARD_WIDTH,
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  venueImageContainer: {
    width: '100%',
    aspectRatio: 16 / 10,
    position: 'relative',
  },
  venueImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%',
  },
  venueOverlay: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  distanceBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
  },
  badgeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    color: COLORS.text,
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    gap: 4,
  },
  countText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  statusBadge: {
    position: 'absolute',
    top: SPACING.sm,
    left: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    gap: 4,
  },
  statusText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
  },
  venueInfo: {
    padding: SPACING.md,
  },
  venueName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  venueMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  venueType: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.warning,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  addressText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
  },
  checkInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.text,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.xs,
  },
  checkInButtonActive: {
    backgroundColor: COLORS.primary,
  },
  checkInText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  checkInTextDark: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.background,
  },
  bottomSpacer: {
    height: 100,
  },
});

export default VenuesScreen;
