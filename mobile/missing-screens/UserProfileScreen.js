import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  X,
  ArrowLeft,
  Eye,
  MessageCircle,
  Heart,
  UserPlus,
  Snowflake,
  MessageSquare,
  Lock,
  ShieldOff,
  AlertTriangle,
  MapPin,
  Crown,
  Coins,
} from 'lucide-react-native';

import { useAuth } from '../src/context/AuthContext';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, API_URL } from '../src/utils/constants';
import api from '../src/utils/api';

const ICEBREAKER_MESSAGES = [
  { id: 0, name: 'Hello', icon: '👋' },
  { id: 1, name: 'You seem interesting', icon: '✨' },
  { id: 2, name: 'Fancy a chat?', icon: '💬' },
  { id: 3, name: "Can I buy you a drink?", icon: '🍸' },
];

const UserProfileScreen = ({ route, navigation }) => {
  const { userId } = route.params;
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [glancing, setGlancing] = useState(false);
  const [sendingIcebreaker, setSendingIcebreaker] = useState(false);
  const [sendingChatRequest, setSendingChatRequest] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [addingFriend, setAddingFriend] = useState(false);
  const [showIcebreakerModal, setShowIcebreakerModal] = useState(false);
  const [selectedIcebreaker, setSelectedIcebreaker] = useState(null);

  useEffect(() => {
    fetchProfile();
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

  const handleGlance = async () => {
    setGlancing(true);
    try {
      const response = await api.post('/api/glance', {
        to_user_id: userId,
        venue_id: 'profile_view',
      });
      const nowMutual = response.data.is_connection_accepted === true;
      Alert.alert('Success', nowMutual ? "It's mutual! You can now message each other." : 'Glance sent!');
      fetchProfile();
    } catch (error) {
      if (error.response?.status === 429) {
        Alert.alert('No Glances Left', "You're all out of glances for today.");
      } else {
        Alert.alert('Error', 'Failed to send glance');
      }
    } finally {
      setGlancing(false);
    }
  };

  const handleSendIcebreaker = async (messageType) => {
    setSendingIcebreaker(true);
    try {
      await api.post('/api/icebreaker', {
        to_user_id: userId,
        message_type: messageType,
        venue_id: 'profile_view',
      });
      Alert.alert('Success', 'Icebreaker sent!');
      setShowIcebreakerModal(false);
      setSelectedIcebreaker(null);
      fetchProfile();
    } catch (error) {
      Alert.alert('Error', 'Failed to send icebreaker');
    } finally {
      setSendingIcebreaker(false);
    }
  };

  const handleSendChatRequest = async () => {
    setSendingChatRequest(true);
    try {
      await api.post('/api/chat-request', {
        to_user_id: userId,
        venue_id: 'profile_view',
        request_type: 'chat',
      });
      Alert.alert('Success', 'Chat request sent!');
      fetchProfile();
    } catch (error) {
      Alert.alert('Error', 'Failed to send chat request');
    } finally {
      setSendingChatRequest(false);
    }
  };

  const handleReveal = async () => {
    setRevealing(true);
    try {
      const response = await api.post(`/api/reveal/${userId}`);
      if (response.data.is_mutual) {
        Alert.alert('Success', "You've mutually revealed! You can now see each other clearly.");
      } else {
        Alert.alert('Success', "You've revealed to them. They can reveal back anytime.");
      }
      fetchProfile();
    } catch (error) {
      Alert.alert('Error', 'Failed to reveal photo');
    } finally {
      setRevealing(false);
    }
  };

  const handleAddFriend = async () => {
    setAddingFriend(true);
    try {
      await api.post('/api/friends/add', { user_id: userId });
      Alert.alert('Success', 'Friend request sent!');
      fetchProfile();
    } catch (error) {
      Alert.alert('Error', 'Failed to add friend');
    } finally {
      setAddingFriend(false);
    }
  };

  const handleBlockUser = () => {
    Alert.alert(
      `Block ${profile?.display_name}?`,
      'This will remove them from your discovery, matches, and chats.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post('/api/users/block', { user_id: userId });
              Alert.alert('Success', "User blocked. They won't be able to see or contact you.");
              navigation.goBack();
            } catch (error) {
              Alert.alert('Error', 'Failed to block user');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Profile not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Unavailable user
  if (profile.is_unavailable) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.unavailableContainer}>
          <View style={styles.unavailableIcon}>
            <ShieldOff color={COLORS.textMuted} size={40} />
          </View>
          <Text style={styles.unavailableTitle}>User Unavailable</Text>
          <Text style={styles.unavailableText}>
            {profile.unavailable_message || 'Sorry, this user is unavailable right now.'}
          </Text>
          <TouchableOpacity style={styles.goBackButton} onPress={() => navigation.goBack()}>
            <Text style={styles.goBackText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isMutualMatch = profile?.is_connection_accepted === true;
  const isRevealed = profile?.is_revealed === true;
  const theyRevealed = profile?.they_revealed === true;
  const iRevealed = profile?.i_revealed === true;
  const isBlocked = profile?.is_blocked === true;

  const getPhotoUrl = () => {
    const photo = profile.avatar_url || profile.photos?.[0];
    if (!photo) return null;
    const blur = isRevealed ? 'false' : isMutualMatch ? 'medium' : 'true';
    return `${API_URL}/api/photos/serve/${photo}?blur=${blur !== 'false'}`;
  };

  const photoUrl = getPhotoUrl();
  const genderColor = profile.show_as === 'male' ? COLORS.male : 
                     profile.show_as === 'female' ? COLORS.female : COLORS.text;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Close Button */}
      <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
        <X color={COLORS.textSecondary} size={24} />
      </TouchableOpacity>

      {/* Back Button */}
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <ArrowLeft color={COLORS.textSecondary} size={18} />
        <Text style={styles.backText}>Return</Text>
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          {/* Main Photo */}
          <View style={styles.photoContainer}>
            {photoUrl ? (
              <Image
                source={{ uri: photoUrl }}
                style={styles.mainPhoto}
                blurRadius={isRevealed ? 0 : isMutualMatch ? 5 : 10}
              />
            ) : (
              <View style={[styles.mainPhoto, styles.photoPlaceholder]}>
                <Text style={styles.placeholderText}>{profile.display_name?.charAt(0) || '?'}</Text>
              </View>
            )}
          </View>

          {/* Profile Info */}
          <View style={styles.profileInfo}>
            {/* Intent Badge */}
            {profile.intent && (
              <View style={[styles.intentBadge, { 
                backgroundColor: profile.intent === 'dating' ? `${COLORS.accent}30` :
                                profile.intent === 'friends' ? `${COLORS.success}30` : `${COLORS.primary}30`
              }]}>
                <Text style={[styles.intentText, {
                  color: profile.intent === 'dating' ? COLORS.accent :
                         profile.intent === 'friends' ? COLORS.success : COLORS.primary
                }]}>
                  Here for {profile.intent === 'dating' ? 'Dating' : 
                           profile.intent === 'friends' ? 'Friends' : 'Both'}
                </Text>
              </View>
            )}

            {/* Name & Age */}
            <View style={styles.nameRow}>
              <Text style={[styles.userName, { color: genderColor }]}>
                {isRevealed ? profile.display_name : profile.display_name?.charAt(0) || '?'}
                {profile.age && <Text style={styles.userAge}> {profile.age}</Text>}
              </Text>
              {profile.show_as && (
                <View style={[styles.genderBadge, { backgroundColor: genderColor }]}>
                  <Text style={styles.genderText}>{profile.show_as === 'male' ? 'M' : 'F'}</Text>
                </View>
              )}
            </View>

            {/* Location */}
            {(profile.home_area || profile.home_country) && (
              <View style={styles.locationRow}>
                <MapPin color={COLORS.info} size={14} />
                <Text style={styles.locationText}>
                  {profile.home_area && profile.home_country
                    ? `${profile.home_area}, ${profile.home_country}`
                    : profile.home_area || profile.home_country}
                </Text>
              </View>
            )}

            {/* Reveal Status */}
            {!isRevealed && theyRevealed && !iRevealed && (
              <View style={styles.revealBanner}>
                <Text style={styles.revealBannerTitle}>They've revealed. You can reveal anytime.</Text>
                <Text style={styles.revealBannerText}>
                  Revealed means their photos and profile are now clear to you once you reveal too.
                </Text>
              </View>
            )}

            {/* Mutual Match Badge */}
            {isMutualMatch && (
              <View style={styles.mutualBadge}>
                <Heart color={COLORS.accent} size={16} fill={COLORS.accent} />
                <Text style={styles.mutualText}>Mutual</Text>
              </View>
            )}

            {/* Bio */}
            {profile.bio && (
              <View style={styles.bioSection}>
                <Text style={styles.sectionTitle}>About</Text>
                <Text style={styles.bioText}>{profile.bio}</Text>
              </View>
            )}

            {/* Presence Note */}
            {profile.presence_note && (
              <View style={styles.presenceSection}>
                <Text style={styles.presenceText}>{profile.presence_note}</Text>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionsSection}>
              {isMutualMatch ? (
                // Mutual Match Actions
                <>
                  <View style={styles.mutualBanner}>
                    <Text style={styles.mutualBannerText}>You're mutual. Start a conversation</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={() => navigation.navigate('Chat', { userId })}
                  >
                    <MessageCircle color={COLORS.text} size={18} />
                    <Text style={styles.primaryButtonText}>Message</Text>
                  </TouchableOpacity>

                  {(!iRevealed || (iRevealed && !isRevealed)) && (
                    <TouchableOpacity
                      style={[styles.secondaryButton, iRevealed && styles.buttonDisabled]}
                      onPress={handleReveal}
                      disabled={revealing || iRevealed}
                    >
                      {revealing ? (
                        <ActivityIndicator size="small" color={COLORS.text} />
                      ) : (
                        <>
                          <Eye color={COLORS.text} size={18} />
                          <Text style={styles.secondaryButtonText}>
                            {iRevealed ? "You've Revealed" : 'Reveal My Photo'}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}

                  {!profile.is_friend && !profile.friend_request_sent && (
                    <TouchableOpacity
                      style={styles.outlineButton}
                      onPress={handleAddFriend}
                      disabled={addingFriend}
                    >
                      {addingFriend ? (
                        <ActivityIndicator size="small" color={COLORS.text} />
                      ) : (
                        <>
                          <UserPlus color={COLORS.text} size={18} />
                          <Text style={styles.outlineButtonText}>Add Friend</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </>
              ) : (
                // Pre-Match Actions
                <>
                  <View style={styles.actionButtonsRow}>
                    {/* Glance Button */}
                    {profile.i_glanced_at_them ? (
                      <View style={[styles.actionPill, styles.actionPillDisabled]}>
                        <Eye color={COLORS.primary} size={16} />
                        <Text style={styles.actionPillTextDisabled}>Glanced</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.actionPill}
                        onPress={handleGlance}
                        disabled={glancing}
                      >
                        {glancing ? (
                          <ActivityIndicator size="small" color={COLORS.text} />
                        ) : (
                          <>
                            <Eye color={COLORS.text} size={16} />
                            <Text style={styles.actionPillText}>
                              {profile.they_glanced_at_me ? 'Glance Back' : 'Glance'}
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}

                    {/* Icebreaker Button */}
                    {profile.icebreaker_sent ? (
                      <View style={[styles.actionPill, styles.actionPillDisabled]}>
                        <Snowflake color={COLORS.warning} size={16} />
                        <Text style={styles.actionPillTextDisabled}>Sent</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[styles.actionPill, styles.actionPillCyan]}
                        onPress={() => setShowIcebreakerModal(true)}
                      >
                        <Snowflake color={COLORS.text} size={16} />
                        <Text style={styles.actionPillText}>Icebreaker</Text>
                      </TouchableOpacity>
                    )}

                    {/* Chat Request Button */}
                    {profile.chat_request_sent ? (
                      <View style={[styles.actionPill, styles.actionPillDisabled]}>
                        <MessageSquare color={COLORS.success} size={16} />
                        <Text style={styles.actionPillTextDisabled}>Requested</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[styles.actionPill, styles.actionPillGreen]}
                        onPress={handleSendChatRequest}
                        disabled={sendingChatRequest}
                      >
                        {sendingChatRequest ? (
                          <ActivityIndicator size="small" color={COLORS.text} />
                        ) : (
                          <>
                            <MessageSquare color={COLORS.text} size={16} />
                            <Text style={styles.actionPillText}>Chat</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Locked Actions */}
                  <View style={styles.lockedRow}>
                    <View style={styles.lockedButton}>
                      <Lock color={COLORS.textMuted} size={14} />
                      <MessageCircle color={COLORS.textMuted} size={16} />
                      <Text style={styles.lockedButtonText}>Message</Text>
                    </View>
                    <View style={styles.lockedButton}>
                      <Lock color={COLORS.textMuted} size={14} />
                      <UserPlus color={COLORS.textMuted} size={16} />
                      <Text style={styles.lockedButtonText}>Add Friend</Text>
                    </View>
                  </View>

                  <Text style={styles.infoText}>
                    Send a glance, icebreaker, or chat request to connect. Messaging unlocks when they respond.
                  </Text>
                </>
              )}

              {/* Block User */}
              <TouchableOpacity style={styles.blockButton} onPress={handleBlockUser}>
                <ShieldOff color={COLORS.error} size={18} />
                <Text style={styles.blockButtonText}>Block User</Text>
              </TouchableOpacity>
              <Text style={styles.blockHint}>
                Blocking removes all visibility and messaging between you.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Icebreaker Modal */}
      {showIcebreakerModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => {
                setShowIcebreakerModal(false);
                setSelectedIcebreaker(null);
              }}
            >
              <X color={COLORS.textSecondary} size={20} />
            </TouchableOpacity>

            <View style={styles.modalIcon}>
              <Snowflake color={COLORS.info} size={24} />
            </View>
            <Text style={styles.modalTitle}>Send Icebreaker</Text>
            <Text style={styles.modalSubtitle}>
              Choose a message to send to {isRevealed ? profile.display_name : profile.display_name?.charAt(0)}
            </Text>

            <View style={styles.icebreakerOptions}>
              {ICEBREAKER_MESSAGES.map((msg) => (
                <TouchableOpacity
                  key={msg.id}
                  style={[
                    styles.icebreakerOption,
                    selectedIcebreaker === msg.id && styles.icebreakerOptionSelected,
                  ]}
                  onPress={() => setSelectedIcebreaker(msg.id)}
                >
                  <Text style={styles.icebreakerEmoji}>{msg.icon}</Text>
                  <Text style={styles.icebreakerText}>{msg.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowIcebreakerModal(false);
                  setSelectedIcebreaker(null);
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSendButton, selectedIcebreaker === null && styles.buttonDisabled]}
                onPress={() => handleSendIcebreaker(selectedIcebreaker)}
                disabled={sendingIcebreaker || selectedIcebreaker === null}
              >
                {sendingIcebreaker ? (
                  <ActivityIndicator size="small" color={COLORS.text} />
                ) : (
                  <>
                    <Snowflake color={COLORS.text} size={16} />
                    <Text style={styles.modalSendText}>Send</Text>
                  </>
                )}
              </TouchableOpacity>
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
  },
  errorText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  closeButton: {
    position: 'absolute',
    top: 60,
    right: SPACING.md,
    zIndex: 50,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    gap: SPACING.xs,
  },
  backText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  unavailableContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  unavailableIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  unavailableTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  unavailableText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  goBackButton: {
    backgroundColor: COLORS.card,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  goBackText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  profileCard: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.xl,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    overflow: 'hidden',
  },
  photoContainer: {
    width: '100%',
    aspectRatio: 1,
  },
  mainPhoto: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    backgroundColor: COLORS.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 64,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  profileInfo: {
    padding: SPACING.md,
  },
  intentBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    marginBottom: SPACING.md,
  },
  intentText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  userName: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '700',
    flex: 1,
  },
  userAge: {
    color: COLORS.textSecondary,
  },
  genderBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  genderText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    color: COLORS.text,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  locationText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  revealBanner: {
    backgroundColor: `${COLORS.success}10`,
    borderWidth: 1,
    borderColor: `${COLORS.success}30`,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  revealBannerTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.success,
  },
  revealBannerText: {
    fontSize: FONT_SIZES.xs,
    color: `${COLORS.success}AA`,
    marginTop: SPACING.xs,
  },
  mutualBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: `${COLORS.accent}20`,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    alignSelf: 'flex-start',
    marginBottom: SPACING.md,
  },
  mutualText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.accent,
    fontWeight: '600',
  },
  bioSection: {
    backgroundColor: COLORS.backgroundLight,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
  },
  bioText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  presenceSection: {
    backgroundColor: COLORS.backgroundLight,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  presenceText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
  },
  actionsSection: {
    marginTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.md,
  },
  mutualBanner: {
    backgroundColor: `${COLORS.success}20`,
    borderWidth: 1,
    borderColor: `${COLORS.success}40`,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  mutualBannerText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.success,
    textAlign: 'center',
    fontWeight: '600',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.success,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  primaryButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  secondaryButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  outlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  outlineButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    gap: SPACING.xs,
  },
  actionPillCyan: {
    backgroundColor: COLORS.info,
  },
  actionPillGreen: {
    backgroundColor: COLORS.success,
  },
  actionPillDisabled: {
    backgroundColor: COLORS.card,
  },
  actionPillText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    color: COLORS.text,
  },
  actionPillTextDisabled: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    color: COLORS.textSecondary,
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
    backgroundColor: COLORS.backgroundLight,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.xs,
  },
  lockedButtonText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
  },
  infoText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  blockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
    marginTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.lg,
  },
  blockButtonText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.error,
  },
  blockHint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  bottomSpacer: {
    height: 100,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  modal: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    width: '100%',
    maxWidth: 350,
  },
  modalClose: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
    padding: SPACING.xs,
  },
  modalIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${COLORS.info}20`,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: SPACING.md,
  },
  modalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
    marginBottom: SPACING.lg,
  },
  icebreakerOptions: {
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  icebreakerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.backgroundLight,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: SPACING.md,
  },
  icebreakerOptionSelected: {
    borderColor: COLORS.info,
    backgroundColor: `${COLORS.info}20`,
  },
  icebreakerEmoji: {
    fontSize: 20,
  },
  icebreakerText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.backgroundLight,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  modalSendButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.info,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  modalSendText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
});

export default UserProfileScreen;
