import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  MapPin,
  Users,
  ArrowRight,
  ArrowLeft,
  MapPinOff,
  RefreshCw,
  Loader2,
} from 'lucide-react-native';
import * as Location from 'expo-location';

import { useAuth } from '../src/context/AuthContext';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, API_URL } from '../src/utils/constants';
import api from '../src/utils/api';

const RADIUS_OPTIONS = [
  { value: '0-10', label: '0-10 miles' },
  { value: '10-25', label: '10-25 miles' },
  { value: '25-50', label: '25-50 miles' },
];

const MATCH_FILTER_OPTIONS = [
  { value: 'unmatched', label: 'Unmatched' },
  { value: 'all', label: 'All' },
  { value: 'mutual', label: 'Mutual' },
  { value: 'friends', label: 'Friends' },
  { value: 'hidden', label: 'Hidden Matches' },
];

const ACTIVITY_FILTER_OPTIONS = [
  { value: 'now', label: 'Active now', maxMinutes: 2 },
  { value: 'recent', label: 'Recently', maxMinutes: 10 },
  { value: 'hour', label: 'This hour', maxMinutes: 60 },
  { value: 'all', label: 'All', maxMinutes: null },
];

const AGE_PRESETS = [
  { value: 'all', label: 'All ages', min: 18, max: 99 },
  { value: '18-25', label: '18-25', min: 18, max: 25 },
  { value: '25-35', label: '25-35', min: 25, max: 35 },
  { value: '35-45', label: '35-45', min: 35, max: 45 },
  { value: '45+', label: '45+', min: 45, max: 99 },
];

const DiscoverScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [mode, setMode] = useState(null); // null = mode selector, 'not-here' = Not Here mode
  const [radius, setRadius] = useState('0-10');
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Location state
  const [locationStatus, setLocationStatus] = useState('checking');
  const [locationError, setLocationError] = useState(null);
  const [userCoordinates, setUserCoordinates] = useState(null);
  
  // Filter states
  const [matchFilter, setMatchFilter] = useState('all');
  const [activityFilter, setActivityFilter] = useState('all');
  const [ageFilter, setAgeFilter] = useState('all');

  useEffect(() => {
    if (mode === 'not-here') {
      checkLocationPermission();
    }
  }, [mode]);

  useEffect(() => {
    if (mode === 'not-here' && locationStatus === 'granted' && userCoordinates) {
      fetchPeople();
    }
  }, [mode, radius, locationStatus, userCoordinates, matchFilter, activityFilter, ageFilter]);

  const checkLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        setUserCoordinates({
          lat: location.coords.latitude,
          lng: location.coords.longitude,
        });
        setLocationStatus('granted');
        setLocationError(null);
        
        // Update location on server
        try {
          await api.post('/api/location/update', {
            lat: location.coords.latitude,
            lng: location.coords.longitude,
          });
        } catch (error) {
          console.error('Failed to update location:', error);
        }
      } else {
        setLocationStatus('denied');
        setLocationError('Location access denied. Please enable location in settings.');
      }
    } catch (error) {
      setLocationStatus('unavailable');
      setLocationError('Unable to get your location. Please try again.');
    }
  };

  const fetchPeople = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/api/discovery/not-here?radius=${radius}`);
      let fetchedPeople = response.data || [];

      // Apply match filter
      if (matchFilter === 'unmatched') {
        fetchedPeople = fetchedPeople.filter(p => p.is_self || !p.is_connection_accepted);
      } else if (matchFilter === 'mutual') {
        fetchedPeople = fetchedPeople.filter(p => p.is_self || p.is_connection_accepted);
      }

      // Apply activity filter
      if (activityFilter !== 'all') {
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

      // Apply age filter
      if (ageFilter !== 'all') {
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
      console.error('Failed to load people:', error);
      setPeople([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPeople();
  }, [radius, matchFilter, activityFilter, ageFilter]);

  const getPhotoUrl = (person) => {
    if (person.photos?.[0]) {
      return `${API_URL}/api/photos/serve/${person.photos[0]}?blur=true`;
    }
    return null;
  };

  const renderPersonCard = ({ item: person }) => {
    const photoUrl = getPhotoUrl(person);
    const genderColor = person.show_as === 'male' ? COLORS.male : 
                       person.show_as === 'female' ? COLORS.female : COLORS.text;

    return (
      <TouchableOpacity
        style={styles.personCard}
        onPress={() => navigation.navigate('UserProfile', { userId: person.id })}
        activeOpacity={0.8}
      >
        <View style={styles.personPhoto}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.personImage} blurRadius={person.is_self ? 0 : 10} />
          ) : (
            <View style={[styles.personImage, styles.photoPlaceholder]}>
              <Text style={styles.placeholderText}>
                {person.display_name?.charAt(0) || '?'}
              </Text>
            </View>
          )}
          {person.is_connection_accepted && (
            <View style={styles.matchedBadge}>
              <Text style={styles.matchedText}>Mutual</Text>
            </View>
          )}
        </View>
        <Text style={[styles.personName, { color: genderColor }]} numberOfLines={1}>
          {person.display_name}
        </Text>
        {person.age && <Text style={styles.personAge}>{person.age}</Text>}
        {person.is_self && <Text style={styles.youLabel}>You</Text>}
      </TouchableOpacity>
    );
  };

  // Mode Selector View
  if (!mode) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.modeSelectorContainer}>
          <View style={styles.header}>
            <LinearGradient
              colors={[COLORS.primary, COLORS.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientTextContainer}
            >
              <Text style={styles.headerTitle}>Discover</Text>
            </LinearGradient>
            <Text style={styles.headerSubtitle}>Choose how you want to explore people around you.</Text>
          </View>

          <View style={styles.modeOptions}>
            {/* Here & Now Option */}
            <TouchableOpacity
              style={styles.modeCard}
              onPress={() => navigation.navigate('Venues')}
              activeOpacity={0.8}
            >
              <View style={styles.modeIconContainer}>
                <MapPin color={COLORS.primary} size={28} />
              </View>
              <View style={styles.modeContent}>
                <Text style={styles.modeTitle}>Here Now</Text>
                <Text style={styles.modeDescription}>
                  A real-time list of nearby venues you can check into and see who else is there.
                </Text>
              </View>
              <ArrowRight color={COLORS.primary} size={20} />
            </TouchableOpacity>

            {/* Not Here Option */}
            <TouchableOpacity
              style={styles.modeCard}
              onPress={() => setMode('not-here')}
              activeOpacity={0.8}
            >
              <View style={[styles.modeIconContainer, { backgroundColor: `${COLORS.info}20` }]}>
                <Users color={COLORS.info} size={28} />
              </View>
              <View style={styles.modeContent}>
                <Text style={styles.modeTitle}>Not Here</Text>
                <Text style={styles.modeDescription}>
                  See and be seen by people nearby who aren't in a venue.
                </Text>
              </View>
              <ArrowRight color={COLORS.info} size={20} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Not Here Mode View
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.notHereHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setMode(null)}
        >
          <ArrowLeft color={COLORS.textSecondary} size={20} />
          <Text style={styles.backText}>Back to Discovery</Text>
        </TouchableOpacity>

        <View style={styles.notHereTitleRow}>
          <View style={[styles.modeIconContainer, { backgroundColor: `${COLORS.primary}20` }]}>
            <Users color={COLORS.primary} size={24} />
          </View>
          <View>
            <Text style={styles.notHereTitle}>Not Here</Text>
            <Text style={styles.notHereSubtitle}>People nearby not at a venue</Text>
          </View>
        </View>

        {/* Radius Selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.radiusScroll}>
          {RADIUS_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.radiusButton,
                radius === option.value && styles.radiusButtonActive,
              ]}
              onPress={() => setRadius(option.value)}
            >
              {radius === option.value ? (
                <LinearGradient
                  colors={[COLORS.primary, COLORS.accent]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.radiusButtonGradient}
                >
                  <Text style={styles.radiusTextActive}>{option.label}</Text>
                </LinearGradient>
              ) : (
                <Text style={styles.radiusText}>{option.label}</Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Filter Bar */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <View style={styles.filterContainer}>
            <TouchableOpacity style={styles.filterPill}>
              <Text style={styles.filterText}>{MATCH_FILTER_OPTIONS.find(o => o.value === matchFilter)?.label}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.filterPill}>
              <Text style={styles.filterText}>{ACTIVITY_FILTER_OPTIONS.find(o => o.value === activityFilter)?.label}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.filterPill}>
              <Text style={styles.filterText}>{AGE_PRESETS.find(o => o.value === ageFilter)?.label}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>

      {/* Content */}
      {locationStatus === 'checking' || locationStatus === 'updating' ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={COLORS.info} />
          <Text style={styles.statusText}>Getting your location...</Text>
        </View>
      ) : locationStatus === 'denied' || locationStatus === 'unavailable' ? (
        <View style={styles.centerContent}>
          <View style={styles.errorIcon}>
            <MapPinOff color={COLORS.error} size={40} />
          </View>
          <Text style={styles.errorTitle}>Location Required</Text>
          <Text style={styles.errorText}>
            {locationError || 'To see people nearby, we need your current GPS location.'}
          </Text>
          <TouchableOpacity
            style={styles.enableButton}
            onPress={checkLocationPermission}
          >
            <MapPin color={COLORS.text} size={18} />
            <Text style={styles.enableButtonText}>Enable Location</Text>
          </TouchableOpacity>
        </View>
      ) : loading && people.length === 0 ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={COLORS.info} />
        </View>
      ) : people.length === 0 ? (
        <View style={styles.centerContent}>
          <Users color={COLORS.textMuted} size={64} />
          <Text style={styles.emptyTitle}>No one nearby</Text>
          <Text style={styles.emptyText}>Try widening your radius or adjusting filters.</Text>
          <TouchableOpacity style={styles.refreshButton} onPress={checkLocationPermission}>
            <RefreshCw color={COLORS.textSecondary} size={18} />
            <Text style={styles.refreshText}>Refresh location</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={people}
          renderItem={renderPersonCard}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.gridRow}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modeSelectorContainer: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  gradientTextContainer: {
    marginBottom: SPACING.sm,
  },
  headerTitle: {
    fontSize: 36,
    fontWeight: '700',
    color: COLORS.primary,
  },
  headerSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    textAlign: 'center',
  },
  modeOptions: {
    gap: SPACING.md,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modeIconContainer: {
    width: 56,
    height: 56,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: `${COLORS.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  modeContent: {
    flex: 1,
  },
  modeTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  modeDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    lineHeight: 20,
  },
  notHereHeader: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  backText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginLeft: SPACING.xs,
  },
  notHereTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  notHereTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.primary,
  },
  notHereSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
  },
  radiusScroll: {
    marginBottom: SPACING.md,
  },
  radiusButton: {
    marginRight: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  radiusButtonActive: {
    borderRadius: BORDER_RADIUS.md,
  },
  radiusButtonGradient: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  radiusText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
  },
  radiusTextActive: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  filterScroll: {
    marginBottom: SPACING.sm,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  filterPill: {
    backgroundColor: COLORS.card,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  statusText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
  errorIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${COLORS.error}10`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  errorTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  errorText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  enableButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.info,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.sm,
  },
  enableButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  refreshText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  gridContent: {
    padding: SPACING.md,
  },
  gridRow: {
    justifyContent: 'space-between',
  },
  personCard: {
    width: '48%',
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  personPhoto: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
  },
  personImage: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    backgroundColor: COLORS.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  matchedBadge: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    backgroundColor: `${COLORS.accent}CC`,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  matchedText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    color: COLORS.text,
  },
  personName: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    paddingHorizontal: SPACING.sm,
    paddingTop: SPACING.sm,
  },
  personAge: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    paddingHorizontal: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  youLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    fontWeight: '600',
    paddingHorizontal: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
});

export default DiscoverScreen;
