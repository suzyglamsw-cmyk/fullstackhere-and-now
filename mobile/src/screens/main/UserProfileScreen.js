import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Eye,
  Heart,
  MessageCircle,
  MessageSquare,
  UserPlus,
  Snowflake,
  Lock,
  Shield,
  MapPin,
  X,
} from 'lucide-react-native';

import { useAuth } from '../../context/AuthContext';
import api, { connectionsAPI, messagesAPI, buildPhotoUrl, getBlurRadius } from '../../utils/api';
import Button from '../../components/Button';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, API_URL } from '../../utils/constants';

const ICEBREAKER_MESSAGES = [
  { id: 0, name: 'Hello', icon: '👋' },
  { id: 1, name: 'You seem interesting', icon: '✨' },
  { id: 2, name: 'Fancy a chat?', icon: '💬' },
  { id: 3, name: 'Can I buy you a drink?', icon: '🍸' },
];

const UserProfileScreen = ({ route, navigation }) => {
  const { userId, user: passedUser } = route.params || {};
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState(passedUser || null);
  const [loading, setLoading] = useState(!passedUser);
  const [glancing, setGlancing] = useState(false);
  const [sendingChatRequest, setSendingChatRequest] = useState(false);
  const [showIcebreakerModal, setShowIcebreakerModal] = useState(false);
  const [sendingIcebreaker, setSendingIcebreaker] = useState(false);

  useEffect(() => {
    if (userId && !passedUser) {
      fetchProfile();
    }
  }, [userId]);

  const fetchProfile = async () => {
    try {
      const response = await api.get(`/api/users/${userId}/profile`);
      setProfile(response.data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load profile');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  // Use canonical buildPhotoUrl
  const getPhotoUrl = () => {
    return buildPhotoUrl(profile, {
      blur: true,
      revealState: profile?.reveal_state || (profile?.is_revealed ? 'both_revealed' : 'none')
    });
  };

  const getNameColor = () => {
    if (profile?.show_as === 'female') return COLORS.female;
    if (profile?.show_as === 'male') return COLORS.male;
    return COLORS.rainbow;
  };

  const handleGlance = async () => {
    setGlancing(true);
    try {
      await api.post('/api/glance', {
        to_user_id: userId || profile.id,
        venue_id: 'profile_view',
      });
      Alert.alert('Success', 'Glance sent!');
      fetchProfile();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to send glance');
    } finally {
      setGlancing(false);
    }
  };

  const handleSendIcebreaker = async (messageType) => {
    setSendingIcebreaker(true);
    try {
      await api.post('/api/icebreaker', {
        to_user_id: userId || profile.id,
        message_type: messageType,
        venue_id: 'profile_view',
      });
      Alert.alert('Success', 'Icebreaker sent!');
      setShowIcebreakerModal(false);
      fetchProfile();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to send icebreaker');
    } finally {
      setSendingIcebreaker(false);
    }
  };

  const handleSendChatRequest = async () => {
    setSendingChatRequest(true);
    try {
      await api.post('/api/chat-request', {
        to_user_id: userId || profile.id,
        venue_id: 'profile_view',
        request_type: 'chat',
      });
      Alert.alert('Success', 'Chat request sent!');
      fetchProfile();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to send chat request');
    } finally {
      setSendingChatRequest(false);
    }
  };

  const handleMessage = () => {
    navigation.navigate('Chat', {
      threadId: profile.thread_id || userId || profile.id,
      otherUser: profile,
    });
  };

  const isMutualMatch = profile?.is_connection_accepted === true;
  const photoUrl = getPhotoUrl();
  // Get blur radius based on reveal state
  const blurRadius = getBlurRadius(
    profile?.reveal_state || (profile?.is_revealed ? 'both_revealed' : 'none'),
    isMutualMatch,
    'profile'
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Profile not found</Text>
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
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Photo */}
        <View style={styles.photoContainer}>
          {photoUrl ? (
            <Image
              source={{ uri: photoUrl }}
              style={styles.mainPhoto}
              blurRadius={blurRadius}
            />
          ) : (
            <View style={[styles.mainPhoto, styles.photoPlaceholder]}>
              <Text style={styles.photoPlaceholderText}>
                {profile.display_name?.charAt(0) || '?'}
              </Text>
            </View>
          )}
        </View>

        {/* Profile Info */}
        <View style={styles.profileInfo}>
          {/* Intent Badge */}
          {profile.intent && (
            <View style={[
              styles.intentBadge,
              profile.intent === 'dating' && styles.intentDating,
              profile.intent === 'friends' && styles.intentFriends,
            ]}>
              <Text style={styles.intentText}>
                Here for {profile.intent === 'dating' ? 'Dating' : profile.intent === 'friends' ? 'Friends' : 'Both'}
              </Text>
            </View>
          )}

          {/* Name + Age */}
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: getNameColor() }]}>
              {profile.is_revealed ? profile.display_name : (profile.display_name || '?').charAt(0)}
              {profile.age && <Text style={styles.age}>, {profile.age}</Text>}
            </Text>
            
            {/* Gender indicator */}
            {profile.show_as && (
              <View style={[
                styles.genderBadge,
                profile.show_as === 'male' ? styles.genderMale : styles.genderFemale,
              ]}>
                <Text style={styles.genderText}>
                  {profile.show_as === 'male' ? 'M' : 'F'}
                </Text>
              </View>
            )}
          </View>

          {/* Location */}
          {(profile.home_area || profile.home_country) && (
            <View style={styles.locationRow}>
              <MapPin color={COLORS.textMuted} size={14} />
              <Text style={styles.locationText}>
                {profile.home_area && profile.home_country
                  ? `${profile.home_area}, ${profile.home_country}`
                  : profile.home_area || profile.home_country}
              </Text>
            </View>
          )}

          {/* Presence Note */}
          {profile.presence_note && (
            <View style={styles.presenceCard}>
              <Text style={styles.presenceText}>{profile.presence_note}</Text>
            </View>
          )}

          {/* Match Status Badge */}
          {isMutualMatch && (
            <View style={styles.mutualBadge}>
              <Heart color={COLORS.accent} size={16} />
              <Text style={styles.mutualText}>Mutual</Text>
            </View>
          )}

          {/* Bio */}
          {profile.bio && (
            <View style={styles.bioCard}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.bioText}>{profile.bio}</Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            {isMutualMatch ? (
              /* Mutual Match UI */
              <>
                <View style={styles.matchedBanner}>
                  <Text style={styles.matchedText}>You're mutual. Start a conversation!</Text>
                </View>

                {profile.has_chat_thread ? (
                  <Button
                    title="Message"
                    onPress={handleMessage}
                    icon={<MessageCircle color={COLORS.text} size={18} />}
                    style={styles.actionButton}
                  />
                ) : profile.chat_request_sent ? (
                  <Button
                    title="Chat Requested"
                    disabled
                    variant="secondary"
                    icon={<MessageSquare color={COLORS.textMuted} size={18} />}
                    style={styles.actionButton}
                  />
                ) : (
                  <Button
                    title="Send Chat Request"
                    onPress={handleSendChatRequest}
                    loading={sendingChatRequest}
                    icon={<MessageSquare color={COLORS.text} size={18} />}
                    style={styles.actionButton}
                  />
                )}
              </>
            ) : (
              /* Pre-Match UI */
              <>
                <View style={styles.actionRow}>
                  {/* Glance Button */}
                  {profile.i_glanced_at_them ? (
                    <Button
                      title="Glanced"
                      disabled
                      variant="secondary"
                      size="sm"
                      icon={<Eye color={COLORS.textMuted} size={16} />}
                      style={styles.smallButton}
                    />
                  ) : (
                    <Button
                      title={profile.they_glanced_at_me ? 'Glance Back' : 'Glance'}
                      onPress={handleGlance}
                      loading={glancing}
                      size="sm"
                      icon={<Eye color={COLORS.text} size={16} />}
                      style={styles.smallButton}
                    />
                  )}

                  {/* Icebreaker Button */}
                  {profile.icebreaker_sent ? (
                    <Button
                      title="Sent"
                      disabled
                      variant="secondary"
                      size="sm"
                      icon={<Snowflake color={COLORS.textMuted} size={16} />}
                      style={styles.smallButton}
                    />
                  ) : (
                    <Button
                      title="Icebreaker"
                      onPress={() => setShowIcebreakerModal(true)}
                      size="sm"
                      icon={<Snowflake color={COLORS.text} size={16} />}
                      style={styles.smallButton}
                    />
                  )}

                  {/* Chat Request Button */}
                  {profile.chat_request_sent ? (
                    <Button
                      title="Requested"
                      disabled
                      variant="secondary"
                      size="sm"
                      icon={<MessageSquare color={COLORS.textMuted} size={16} />}
                      style={styles.smallButton}
                    />
                  ) : (
                    <Button
                      title="Chat"
                      onPress={handleSendChatRequest}
                      loading={sendingChatRequest}
                      size="sm"
                      icon={<MessageSquare color={COLORS.text} size={16} />}
                      style={styles.smallButton}
                    />
                  )}
                </View>

                {/* Locked buttons */}
                <View style={styles.lockedRow}>
                  <View style={styles.lockedButton}>
                    <Lock color={COLORS.textMuted} size={14} />
                    <MessageCircle color={COLORS.textMuted} size={16} />
                    <Text style={styles.lockedText}>Message</Text>
                  </View>
                  <View style={styles.lockedButton}>
                    <Lock color={COLORS.textMuted} size={14} />
                    <UserPlus color={COLORS.textMuted} size={16} />
                    <Text style={styles.lockedText}>Add Friend</Text>
                  </View>
                </View>

                <Text style={styles.infoText}>
                  Send a glance, icebreaker, or chat request to connect. Messaging unlocks when they respond.
                </Text>
              </>
            )}
          </View>

          {/* Additional Photos */}
          {profile.photos && profile.photos.length > 1 && (
            <View style={styles.photosSection}>
              <Text style={styles.sectionTitle}>More Photos</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.photosRow}>
                  {profile.photos.slice(1).map((photo, index) => (
                    <Image
                      key={index}
                      source={{ uri: buildPhotoUrl({ photos: [photo] }, { 
                        blur: true, 
                        revealState: profile.reveal_state || (profile.is_revealed ? 'both_revealed' : 'none')
                      }) }}
                      style={styles.thumbnail}
                      blurRadius={blurRadius}
                    />
                  ))}
                </View>
              </ScrollView>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Icebreaker Modal */}
      {showIcebreakerModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setShowIcebreakerModal(false)}
            >
              <X color={COLORS.text} size={24} />
            </TouchableOpacity>

            <View style={styles.modalHeader}>
              <View style={styles.modalIcon}>
                <Snowflake color={COLORS.info} size={24} />
              </View>
              <Text style={styles.modalTitle}>Send Icebreaker</Text>
              <Text style={styles.modalSubtitle}>Choose a message to send</Text>
            </View>

            <View style={styles.icebreakerOptions}>
              {ICEBREAKER_MESSAGES.map((msg) => (
                <TouchableOpacity
                  key={msg.id}
                  style={styles.icebreakerOption}
                  onPress={() => handleSendIcebreaker(msg.id)}
                  disabled={sendingIcebreaker}
                >
                  <Text style={styles.icebreakerIcon}>{msg.icon}</Text>
                  <Text style={styles.icebreakerName}>{msg.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}
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
  errorText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: SPACING.xxl,
  },
  photoContainer: {
    aspectRatio: 1,
    backgroundColor: COLORS.backgroundLight,
  },
  mainPhoto: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderText: {
    fontSize: 80,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  profileInfo: {
    padding: SPACING.lg,
  },
  intentBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: `${COLORS.primary}30`,
    marginBottom: SPACING.md,
  },
  intentDating: {
    backgroundColor: `${COLORS.accent}30`,
  },
  intentFriends: {
    backgroundColor: `${COLORS.success}30`,
  },
  intentText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    color: COLORS.text,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  name: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '700',
  },
  age: {
    color: COLORS.textSecondary,
  },
  genderBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.sm,
  },
  genderMale: {
    backgroundColor: COLORS.male,
  },
  genderFemale: {
    backgroundColor: COLORS.female,
  },
  genderText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  locationText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    marginLeft: SPACING.xs,
  },
  presenceCard: {
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
  },
  presenceText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
  },
  mutualBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: `${COLORS.accent}20`,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    marginBottom: SPACING.md,
  },
  mutualText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    color: COLORS.accent,
    marginLeft: SPACING.xs,
  },
  bioCard: {
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
  },
  bioText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
  actionsContainer: {
    marginBottom: SPACING.lg,
  },
  matchedBanner: {
    backgroundColor: `${COLORS.success}20`,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
  },
  matchedText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.success,
    textAlign: 'center',
    fontWeight: '500',
  },
  actionButton: {
    marginBottom: SPACING.sm,
  },
  actionRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  smallButton: {
    flex: 1,
  },
  lockedRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  lockedButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    opacity: 0.5,
  },
  lockedText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
  },
  infoText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  photosSection: {
    marginTop: SPACING.lg,
  },
  photosRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.md,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modal: {
    backgroundColor: COLORS.backgroundLight,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    width: '100%',
    maxWidth: 340,
  },
  modalClose: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
    zIndex: 1,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  modalIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${COLORS.info}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  modalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  modalSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  icebreakerOptions: {
    gap: SPACING.sm,
  },
  icebreakerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.md,
  },
  icebreakerIcon: {
    fontSize: 24,
  },
  icebreakerName: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    fontWeight: '500',
  },
});

export default UserProfileScreen;
