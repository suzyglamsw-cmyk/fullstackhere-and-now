import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { MapPin, Users, Globe } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuth } from '../../context/AuthContext';
import { venuesAPI, discoveryAPI } from '../../utils/api';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../utils/constants';

const DiscoverScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('hereNow'); // hereNow, notHere
  const [location, setLocation] = useState(null);
  const [venues, setVenues] = useState([]);
  const [notHereUsers, setNotHereUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
          'Here & Now needs your location to show nearby venues and people.',
          [{ text: 'OK' }]
        );
        setLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation(loc.coords);
      
      await fetchData(loc.coords);
    } catch (error) {
      console.log('Location error:', error);
      setLoading(false);
    }
  };

  const fetchData = async (coords) => {
    if (!coords) return;
    
    try {
      // Check current check-in
      const checkInRes = await venuesAPI.currentCheckIn();
      setCurrentCheckIn(checkInRes.data.checked_in ? checkInRes.data.checkin : null);

      // Fetch venues
      const venuesRes = await venuesAPI.nearby(coords.latitude, coords.longitude, 5);
      setVenues(venuesRes.data || []);

      // Fetch not here users
      const notHereRes = await discoveryAPI.notHere(coords.latitude, coords.longitude, 25);
      setNotHereUsers(notHereRes.data || []);
    } catch (error) {
      console.log('Fetch error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (location) {
      fetchData(location);
    } else {
      requestLocationAndFetch();
    }
  }, [location]);

  const handleVenuePress = (venue) => {
    navigation.navigate('WhosHere', { venue, location });
  };

  const VenueCard = ({ venue }) => (
    <TouchableOpacity
      style={styles.venueCard}
      onPress={() => handleVenuePress(venue)}
      activeOpacity={0.8}
    >
      <View style={styles.venueInfo}>
        <Text style={styles.venueName} numberOfLines={1}>{venue.name}</Text>
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
        <Text style={styles.title}>Discover</Text>
        {currentCheckIn && (
          <View style={styles.checkedInBadge}>
            <MapPin color={COLORS.success} size={14} />
            <Text style={styles.checkedInText}>At {currentCheckIn.venue_name}</Text>
          </View>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'hereNow' && styles.tabActive]}
          onPress={() => setActiveTab('hereNow')}
        >
          <MapPin 
            color={activeTab === 'hereNow' ? COLORS.primary : COLORS.textMuted} 
            size={18} 
          />
          <Text style={[
            styles.tabText,
            activeTab === 'hereNow' && styles.tabTextActive
          ]}>
            Here Now
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'notHere' && styles.tabActive]}
          onPress={() => setActiveTab('notHere')}
        >
          <Globe 
            color={activeTab === 'notHere' ? COLORS.primary : COLORS.textMuted} 
            size={18} 
          />
          <Text style={[
            styles.tabText,
            activeTab === 'notHere' && styles.tabTextActive
          ]}>
            Not Here
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'hereNow' ? (
          <>
            {venues.length === 0 ? (
              <View style={styles.emptyState}>
                <MapPin color={COLORS.textMuted} size={48} />
                <Text style={styles.emptyTitle}>No venues nearby</Text>
                <Text style={styles.emptySubtitle}>
                  Try expanding your search area or check back later
                </Text>
              </View>
            ) : (
              <View style={styles.venuesList}>
                {venues.map((venue) => (
                  <VenueCard key={venue.id} venue={venue} />
                ))}
              </View>
            )}
          </>
        ) : (
          <>
            {notHereUsers.length === 0 ? (
              <View style={styles.emptyState}>
                <Globe color={COLORS.textMuted} size={48} />
                <Text style={styles.emptyTitle}>No one nearby yet</Text>
                <Text style={styles.emptySubtitle}>
                  People in your area will appear here
                </Text>
              </View>
            ) : (
              <View style={styles.usersGrid}>
                {notHereUsers.map((person) => (
                  <TouchableOpacity
                    key={person.id}
                    style={styles.userCard}
                    onPress={() => navigation.navigate('UserProfile', { userId: person.id })}
                  >
                    <View style={styles.userPhoto}>
                      <Text style={styles.userInitial}>
                        {person.display_name?.charAt(0) || '?'}
                      </Text>
                    </View>
                    <Text style={styles.userName} numberOfLines={1}>
                      {person.display_name}, {person.age}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

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
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  title: {
    fontSize: FONT_SIZES.xxxl,
    fontWeight: '700',
    color: COLORS.text,
  },
  checkedInBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  checkedInText: {
    color: COLORS.success,
    fontSize: FONT_SIZES.sm,
    marginLeft: SPACING.xs,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.card,
    gap: SPACING.xs,
  },
  tabActive: {
    backgroundColor: `${COLORS.primary}20`,
  },
  tabText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
  },
  tabTextActive: {
    color: COLORS.primary,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: SPACING.lg,
  },
  venuesList: {
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
  usersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  userCard: {
    width: '47%',
    aspectRatio: 3 / 4,
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    padding: SPACING.sm,
  },
  userPhoto: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInitial: {
    fontSize: 48,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  userName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
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

export default DiscoverScreen;
