import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  MapPin,
  Users,
  RefreshCw,
  Eye,
  Snowflake,
  MessageSquare,
  Heart,
} from 'lucide-react-native';

import { useAuth } from '../src/context/AuthContext';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, API_URL } from '../src/utils/constants';
import api from '../src/utils/api';

const MATCH_FILTER_OPTIONS = [
  { value: 'unmatched', label: 'Unmatched' },
  { value: 'all', label: 'All' },
  { value: 'mutual', label: 'Mutual' },
  { value: 'friends', label: 'Friends' },
];

const ACTIVITY_FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'now', label: 'Active now', maxMinutes: 2 },
  { value: 'recent', label: 'Recently', maxMinutes: 10 },
  { value: 'hour', label: 'This hour', maxMinutes: 60 },
];

const AGE_PRESETS = [
  { value: 'all', label: 'All ages', min: 18, max: 99 },
  { value: '18-25', label: '18-25', min: 18, max: 25 },
  { value: '25-35', label: '25-35', min: 25, max: 35 },
  { value: '35-45', label: '35-45', min: 35, max: 45 },
  { value: '45+', label: '45+', min: 45, max: 99 },
];

const WhosHereScreen = ({ route, navigation }) => {
  const { venueId, venueName } = route.params;
  const { user } = useAuth();
  const [venue, setVenue] = useState(null);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  
  // Filter states
  const [matchFilter, setMatchFilter] = useState('all');
  const [activityFilter, setActivityFilter] = useState('all');
  const [ageFilter, setAgeFilter] = useState('all');

  useEffect(() => {
    fetchVenue();
    fetchPeople();
    checkIfCheckedIn();
  }, [venueId]);

  useEffect(() => {
    if (!loading) {
      fetchPeople();
    }
  }, [matchFilter, activityFilter, ageFilter]);

  const fetchVenue = async () => {
    try {
      const response = await api.get(`/api/venues/${venueId}`);
      setVenue(response.data);
    } catch (error) {
      console.error('Failed to fetch venue:', error);
    }
  };

  const checkIfCheckedIn = async () => {
    try {
      const response = await api.get('/api/checkin/current');
      const isAtThisVenue = response.data?.checked_in && response.data?.checkin?.venue_id === venueId;
      setIsCheckedIn(isAtThisVenue);
    } catch (error) {
      setIsCheckedIn(false);
    }
  };

  const fetchPeople = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/api/venues/${venueId}/people`);
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
      console.error('Failed to fetch people:', error);
      setPeople([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPeople();
  }, [matchFilter, activityFilter, ageFilter]);

  const handleCheckIn = async () => {
    try {
      await api.post(`/api/checkin/${venueId}`);
      setIsCheckedIn(true);
      fetchPeople();
    } catch (error) {
      console.error('Failed to check in:', error);
    }
  };

  const getPhotoUrl = (person) => {
    if (person.photos?.[0]) {
      const blur = person.is_self ? 'false' : 'true';
      return `${API_URL}/api/photos/serve/${person.photos[0]}?blur=${blur}`;
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
        onPress={() => !person.is_self && navigation.navigate('UserProfile', { userId: person.id })}
        activeOpacity={person.is_self ? 1 : 0.8}
      >
        <View style={styles.personPhoto}>
          {photoUrl ? (
            <Image 
              source={{ uri: photoUrl }} 
              style={styles.personImage} 
              blurRadius={person.is_self || person.is_connection_accepted ? 0 : 10}
            />
          ) : (
            <View style={[styles.personImage, styles.photoPlaceholder]}>
              <Text style={styles.placeholderText}>
                {person.display_name?.charAt(0) || '?'}
              </Text>
            </View>
          )}
          {person.is_connection_accepted && (
            <View style={styles.matchedBadge}>
              <Heart color={COLORS.text} size={10} fill={COLORS.text} />
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

  const FilterButton = ({ label, isActive, onPress }) => (
    <TouchableOpacity
      style={[styles.filterButton, isActive && styles.filterButtonActive]}
      onPress={onPress}
    >
      <Text style={[styles.filterButtonText, isActive && styles.filterButtonTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft color={COLORS.textSecondary} size={18} />
          <Text style={styles.backText}>Back to venues</Text>
        </TouchableOpacity>

        {/* Venue Info */}
        {venue && (
          <View style={styles.venueInfoRow}>
            <View style={styles.venueIcon}>
              <MapPin color={COLORS.primary} size={24} />
            </View>
            <View style={styles.venueDetails}>
              <Text style={styles.venueName}>{venue.name || venueName}</Text>
              <Text style={styles.venueAddress}>{venue.address}</Text>
            </View>
            <View style={styles.peopleCountBadge}>
              <Users color={COLORS.primary} size={16} />
              <Text style={styles.peopleCountText}>{people.length} here</Text>
            </View>
          </View>
        )}

        {/* Filters */}
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[
            { key: 'match', value: matchFilter, options: MATCH_FILTER_OPTIONS },
            { key: 'activity', value: activityFilter, options: ACTIVITY_FILTER_OPTIONS },
            { key: 'age', value: ageFilter, options: AGE_PRESETS },
          ]}
          renderItem={({ item }) => (
            <View style={styles.filterPill}>
              <Text style={styles.filterPillText}>
                {item.options.find(o => o.value === item.value)?.label}
              </Text>
            </View>
          )}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.filtersContainer}
        />
      </View>

      {/* People Count & Refresh */}
      <View style={styles.countRow}>
        <Text style={styles.countText}>
          {people.length} {people.length === 1 ? 'person' : 'people'} here
        </Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <RefreshCw color={COLORS.textSecondary} size={18} />
        </TouchableOpacity>
      </View>

      {/* People Grid */}
      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : people.length === 0 ? (
        <View style={styles.centerContent}>
          <Users color={COLORS.textMuted} size={64} />
          <Text style={styles.emptyTitle}>No one here yet</Text>
          <Text style={styles.emptyText}>
            {isCheckedIn
              ? "Be the first to arrive! Others will see you when they check in."
              : "Check in to see who's around and let others find you."}
          </Text>
          {!isCheckedIn && (
            <TouchableOpacity style={styles.checkInButton} onPress={handleCheckIn}>
              <MapPin color={COLORS.text} size={18} />
              <Text style={styles.checkInButtonText}>Check in now</Text>
            </TouchableOpacity>
          )}
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
  header: {
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    marginBottom: SPACING.sm,
    gap: SPACING.xs,
  },
  backText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  venueInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  venueIcon: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: `${COLORS.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  venueDetails: {
    flex: 1,
  },
  venueName: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  venueAddress: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  peopleCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.primary}20`,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: `${COLORS.primary}40`,
    gap: SPACING.xs,
  },
  peopleCountText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.primary,
  },
  filtersContainer: {
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  filterPill: {
    backgroundColor: COLORS.card,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: SPACING.sm,
  },
  filterPillText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  countText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  refreshButton: {
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
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
    textAlign: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  checkInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.sm,
  },
  checkInButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
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
    bottom: SPACING.xs,
    right: SPACING.xs,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
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

export default WhosHereScreen;
