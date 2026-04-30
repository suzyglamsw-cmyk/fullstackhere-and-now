import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { ArrowLeft, MapPin, Users, Navigation, List, Map as MapIcon } from 'lucide-react-native';

import { useAuth } from '../../context/AuthContext';
import { venuesAPI } from '../../utils/api';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../utils/constants';

const { width } = Dimensions.get('window');

const VenuesScreen = ({ navigation }) => {
  const { user } = useAuth();
  const mapRef = useRef(null);
  const [location, setLocation] = useState(null);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('map'); // 'map' or 'list'
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [currentCheckIn, setCurrentCheckIn] = useState(null);

  useEffect(() => {
    requestLocationAndFetch();
  }, []);

  const requestLocationAndFetch = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Required',
          'Here & Now needs your location to show nearby venues.',
          [{ text: 'OK' }]
        );
        setLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation(loc.coords);

      await fetchVenues(loc.coords);
      await checkCurrentCheckIn();
    } catch (error) {
      console.log('Location error:', error);
      setLoading(false);
    }
  };

  const fetchVenues = async (coords) => {
    try {
      const response = await venuesAPI.nearby(coords.latitude, coords.longitude, 5);
      setVenues(response.data || []);
    } catch (error) {
      console.log('Fetch venues error:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkCurrentCheckIn = async () => {
    try {
      const res = await venuesAPI.currentCheckIn();
      setCurrentCheckIn(res.data.checked_in ? res.data.checkin : null);
    } catch (error) {
      console.log('Check-in status error:', error);
    }
  };

  const handleVenuePress = (venue) => {
    setSelectedVenue(venue);
    if (viewMode === 'map' && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: venue.lat,
        longitude: venue.lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  };

  const handleGoToVenue = (venue) => {
    navigation.navigate('WhosHere', { venue, location });
  };

  const centerOnUser = () => {
    if (location && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
    }
  };

  const VenueCard = ({ venue, compact = false }) => (
    <TouchableOpacity
      style={[styles.venueCard, compact && styles.venueCardCompact]}
      onPress={() => handleGoToVenue(venue)}
      activeOpacity={0.8}
    >
      <View style={styles.venueInfo}>
        <Text style={styles.venueName} numberOfLines={1}>{venue.name}</Text>
        {venue.vicinity && (
          <Text style={styles.venueAddress} numberOfLines={1}>{venue.vicinity}</Text>
        )}
        <View style={styles.venueDetails}>
          <MapPin color={COLORS.textMuted} size={14} />
          <Text style={styles.venueDistance}>
            {venue.distance ? `${venue.distance.toFixed(1)} mi` : 'Nearby'}
          </Text>
        </View>
      </View>
      <View style={styles.venueCount}>
        <Users color={COLORS.primary} size={16} />
        <Text style={styles.venueCountText}>
          {venue.checked_in_count || 0}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const BottomCard = () => {
    if (!selectedVenue) return null;

    return (
      <View style={styles.bottomCard}>
        <View style={styles.bottomCardHandle} />
        <Text style={styles.bottomCardName}>{selectedVenue.name}</Text>
        {selectedVenue.vicinity && (
          <Text style={styles.bottomCardAddress}>{selectedVenue.vicinity}</Text>
        )}
        <View style={styles.bottomCardStats}>
          <View style={styles.bottomCardStat}>
            <Users color={COLORS.primary} size={18} />
            <Text style={styles.bottomCardStatText}>
              {selectedVenue.checked_in_count || 0} here now
            </Text>
          </View>
          <View style={styles.bottomCardStat}>
            <MapPin color={COLORS.textMuted} size={18} />
            <Text style={styles.bottomCardStatText}>
              {selectedVenue.distance ? `${selectedVenue.distance.toFixed(1)} mi` : 'Nearby'}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.bottomCardButton}
          onPress={() => handleGoToVenue(selectedVenue)}
        >
          <Text style={styles.bottomCardButtonText}>See Who's Here</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Finding nearby venues...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft color={COLORS.text} size={24} />
        </TouchableOpacity>
        
        <View style={styles.headerInfo}>
          <Text style={styles.title}>Here Now</Text>
          <Text style={styles.subtitle}>
            {venues.length} venue{venues.length !== 1 ? 's' : ''} nearby
          </Text>
        </View>

        {/* View Toggle */}
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'map' && styles.toggleButtonActive]}
            onPress={() => setViewMode('map')}
          >
            <MapIcon color={viewMode === 'map' ? COLORS.text : COLORS.textMuted} size={18} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'list' && styles.toggleButtonActive]}
            onPress={() => setViewMode('list')}
          >
            <List color={viewMode === 'list' ? COLORS.text : COLORS.textMuted} size={18} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Current Check-in Banner */}
      {currentCheckIn && (
        <View style={styles.checkInBanner}>
          <MapPin color={COLORS.success} size={16} />
          <Text style={styles.checkInText}>You're at {currentCheckIn.venue_name}</Text>
        </View>
      )}

      {viewMode === 'map' ? (
        /* Map View */
        <View style={styles.mapContainer}>
          {location && (
            <MapView
              ref={mapRef}
              style={styles.map}
              provider={PROVIDER_GOOGLE}
              initialRegion={{
                latitude: location.latitude,
                longitude: location.longitude,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
              }}
              showsUserLocation
              showsMyLocationButton={false}
              customMapStyle={darkMapStyle}
            >
              {venues.map((venue) => (
                <Marker
                  key={venue.id}
                  coordinate={{ latitude: venue.lat, longitude: venue.lng }}
                  onPress={() => handleVenuePress(venue)}
                >
                  <View style={[
                    styles.marker,
                    selectedVenue?.id === venue.id && styles.markerSelected,
                  ]}>
                    <Text style={styles.markerText}>
                      {venue.checked_in_count || 0}
                    </Text>
                  </View>
                </Marker>
              ))}
            </MapView>
          )}

          {/* Center on User Button */}
          <TouchableOpacity
            style={styles.centerButton}
            onPress={centerOnUser}
          >
            <Navigation color={COLORS.text} size={20} />
          </TouchableOpacity>

          {/* Bottom Card */}
          <BottomCard />
        </View>
      ) : (
        /* List View */
        <FlatList
          data={venues}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => <VenueCard venue={item} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MapPin color={COLORS.textMuted} size={48} />
              <Text style={styles.emptyTitle}>No venues nearby</Text>
              <Text style={styles.emptySubtitle}>
                Try expanding your search area or check back later
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

// Dark map style for consistency with app theme
const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1a1425' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8c8c8c' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1425' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2c2436' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1a1425' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f0a1e' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#252030' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1e2a1e' }] },
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    marginRight: SPACING.md,
  },
  headerInfo: {
    flex: 1,
  },
  title: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    padding: 2,
  },
  toggleButton: {
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
  },
  toggleButtonActive: {
    backgroundColor: COLORS.primary,
  },
  checkInBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${COLORS.success}20`,
    paddingVertical: SPACING.sm,
    gap: SPACING.xs,
  },
  checkInText: {
    color: COLORS.success,
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  marker: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  markerSelected: {
    backgroundColor: COLORS.accent,
    transform: [{ scale: 1.2 }],
  },
  markerText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
  },
  centerButton: {
    position: 'absolute',
    bottom: 200,
    right: SPACING.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.backgroundLight,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    paddingTop: SPACING.md,
  },
  bottomCardHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: SPACING.md,
  },
  bottomCardName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  bottomCardAddress: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    marginBottom: SPACING.md,
  },
  bottomCardStats: {
    flexDirection: 'row',
    gap: SPACING.lg,
    marginBottom: SPACING.md,
  },
  bottomCardStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  bottomCardStatText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  bottomCardButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    alignItems: 'center',
  },
  bottomCardButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  listContent: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  venueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  venueCardCompact: {
    padding: SPACING.sm,
  },
  venueInfo: {
    flex: 1,
  },
  venueName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  venueAddress: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    marginBottom: SPACING.xs,
  },
  venueDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  venueDistance: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
  },
  venueCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: `${COLORS.primary}20`,
    borderRadius: BORDER_RADIUS.full,
  },
  venueCountText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.primary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  emptySubtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
});

export default VenuesScreen;
