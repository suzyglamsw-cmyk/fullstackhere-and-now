import React, { useState, useEffect } from 'react';
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
import { ArrowLeft, MapPin, Users, CheckCircle } from 'lucide-react-native';

import { useAuth } from '../../context/AuthContext';
import { venuesAPI, connectionsAPI } from '../../utils/api';
import UserCard from '../../components/UserCard';
import Button from '../../components/Button';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../utils/constants';

const WhosHereScreen = ({ route, navigation }) => {
  const { venue, location } = route.params || {};
  const { user } = useAuth();
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);

  useEffect(() => {
    if (venue?.id) {
      fetchPeople();
      checkCurrentCheckIn();
    }
  }, [venue?.id]);

  const checkCurrentCheckIn = async () => {
    try {
      const res = await venuesAPI.currentCheckIn();
      setIsCheckedIn(res.data.checked_in && res.data.checkin?.venue_id === venue.id);
    } catch (error) {
      console.log('Check-in status error:', error);
    }
  };

  const fetchPeople = async () => {
    try {
      const response = await venuesAPI.people(venue.id);
      setPeople(response.data || []);
    } catch (error) {
      console.log('Fetch people error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleCheckIn = async () => {
    if (!location) {
      Alert.alert('Location Required', 'Please enable location to check in.');
      return;
    }

    setCheckingIn(true);
    try {
      await venuesAPI.checkIn(venue.id, location.latitude, location.longitude);
      setIsCheckedIn(true);
      fetchPeople();
      Alert.alert('Checked In!', `You're now at ${venue.name}`);
    } catch (error) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to check in');
    } finally {
      setCheckingIn(false);
    }
  };

  const handleCheckOut = async () => {
    setCheckingIn(true);
    try {
      await venuesAPI.checkOut();
      setIsCheckedIn(false);
      fetchPeople();
    } catch (error) {
      console.log('Check out error:', error);
    } finally {
      setCheckingIn(false);
    }
  };

  const handleUserPress = (person) => {
    if (person.id === user?.id) return;
    navigation.navigate('UserProfile', { userId: person.id, user: person });
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchPeople();
  };

  const otherPeople = people.filter(p => p.id !== user?.id);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
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
          <Text style={styles.venueName} numberOfLines={1}>{venue?.name}</Text>
          <View style={styles.venueDetails}>
            <Users color={COLORS.textMuted} size={14} />
            <Text style={styles.peopleCount}>
              {people.length} {people.length === 1 ? 'person' : 'people'} here
            </Text>
          </View>
        </View>
      </View>

      {/* Check In/Out Button */}
      <View style={styles.checkInContainer}>
        {isCheckedIn ? (
          <View style={styles.checkedInRow}>
            <View style={styles.checkedInBadge}>
              <CheckCircle color={COLORS.success} size={18} />
              <Text style={styles.checkedInText}>You're here</Text>
            </View>
            <Button
              title="Check Out"
              variant="outline"
              size="sm"
              onPress={handleCheckOut}
              loading={checkingIn}
            />
          </View>
        ) : (
          <Button
            title="Check In Here"
            onPress={handleCheckIn}
            loading={checkingIn}
            icon={<MapPin color={COLORS.text} size={18} />}
          />
        )}
      </View>

      {/* People List */}
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
        {otherPeople.length === 0 ? (
          <View style={styles.emptyState}>
            <Users color={COLORS.textMuted} size={48} />
            <Text style={styles.emptyTitle}>No one else here yet</Text>
            <Text style={styles.emptySubtitle}>
              Check in to be the first!
            </Text>
          </View>
        ) : (
          <View style={styles.peopleGrid}>
            {otherPeople.map((person) => (
              <View key={person.id} style={styles.cardWrapper}>
                <UserCard
                  user={person}
                  onPress={() => handleUserPress(person)}
                  context="venue"
                  blurLevel={person.is_connection_accepted ? 'none' : 'heavy'}
                />
              </View>
            ))}
          </View>
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
  venueName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  venueDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: 2,
  },
  peopleCount: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
  },
  checkInContainer: {
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  checkedInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  checkedInBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  checkedInText: {
    color: COLORS.success,
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: SPACING.lg,
  },
  peopleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  cardWrapper: {
    width: '47%',
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

export default WhosHereScreen;
