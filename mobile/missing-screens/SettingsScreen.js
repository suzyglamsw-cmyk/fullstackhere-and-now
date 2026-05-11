import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
  Image,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Crown,
  Coins,
  ChevronRight,
  Share2,
  QrCode,
  HelpCircle,
  Heart,
  MapPin,
  Bell,
  Shield,
  UserX,
  FileText,
  LogOut,
  Trash2,
  Loader2,
  X,
} from 'lucide-react-native';

import { useAuth } from '../src/context/AuthContext';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, API_URL } from '../src/utils/constants';
import api from '../src/utils/api';

const SettingsScreen = ({ navigation }) => {
  const { user, logout, updateUser } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [blockedLoading, setBlockedLoading] = useState(false);
  const [unblocking, setUnblocking] = useState(null);
  
  // Push notification settings
  const [pushSettings, setPushSettings] = useState({
    enabled: true,
    glances: true,
    drinks: true,
    messages: true,
    matches: true,
  });
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    fetchBlockedUsers();
    fetchPushSettings();
  }, []);

  const fetchBlockedUsers = async () => {
    setBlockedLoading(true);
    try {
      const response = await api.get('/api/users/blocked');
      setBlockedUsers(response.data || []);
    } catch (error) {
      console.error('Failed to fetch blocked users:', error);
    } finally {
      setBlockedLoading(false);
    }
  };

  const fetchPushSettings = async () => {
    try {
      const response = await api.get('/api/push/settings');
      setPushSettings(response.data);
    } catch (error) {
      console.error('Failed to fetch push settings:', error);
    }
  };

  const handleUnblock = async (userId) => {
    setUnblocking(userId);
    try {
      await api.post('/api/users/unblock', { user_id: userId });
      setBlockedUsers((prev) => prev.filter((u) => u.id !== userId));
      Alert.alert('Success', 'User unblocked. You can now see each other again.');
    } catch (error) {
      Alert.alert('Error', 'Failed to unblock user');
    } finally {
      setUnblocking(null);
    }
  };

  const handlePushSettingChange = async (key, value) => {
    const newSettings = { ...pushSettings, [key]: value };
    setPushSettings(newSettings);

    try {
      await api.put('/api/push/settings', newSettings);
    } catch (error) {
      setPushSettings(pushSettings); // Revert
      Alert.alert('Error', 'Failed to update notification settings');
    }
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: () => {
          logout();
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. This will permanently delete your account and all your data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await api.delete('/api/auth/account');
              logout();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete account');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const handleShareApp = async () => {
    try {
      await Linking.openURL('https://hereandnow.app/download');
    } catch (error) {
      Alert.alert('Error', 'Unable to share');
    }
  };

  const MenuItem = ({ icon: Icon, iconColor, title, subtitle, onPress, rightElement }) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.menuIcon, { backgroundColor: `${iconColor || COLORS.primary}20` }]}>
        <Icon color={iconColor || COLORS.primary} size={20} />
      </View>
      <View style={styles.menuContent}>
        <Text style={styles.menuTitle}>{title}</Text>
        {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
      </View>
      {rightElement || <ChevronRight color={COLORS.textMuted} size={20} />}
    </TouchableOpacity>
  );

  const SectionHeader = ({ title }) => (
    <Text style={styles.sectionHeader}>{title}</Text>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Settings</Text>
          <Text style={styles.headerSubtitle}>Manage your account and preferences</Text>
        </View>

        {/* Upgrades Section */}
        <View style={styles.section}>
          <SectionHeader title="Upgrades" />
          <View style={styles.card}>
            <MenuItem
              icon={Crown}
              iconColor={COLORS.warning}
              title="Premium"
              subtitle={user?.is_premium ? 'Active' : 'Unlock extra features'}
              onPress={() => {}}
            />
            <View style={styles.divider} />
            <MenuItem
              icon={Coins}
              iconColor="#EAB308"
              title="Tokens"
              subtitle={`Balance: ${user?.token_balance || 0}`}
              onPress={() => {}}
            />
          </View>
        </View>

        {/* Spread the Word Section */}
        <View style={styles.section}>
          <SectionHeader title="Spread the Word" />
          <View style={styles.card}>
            <MenuItem
              icon={Share2}
              iconColor={COLORS.primary}
              title="Share Here & Now"
              subtitle="Invite friends to join"
              onPress={handleShareApp}
            />
            <View style={styles.divider} />
            <MenuItem
              icon={QrCode}
              iconColor={COLORS.primary}
              title="Scan Here & Now"
              subtitle="Show QR code to friends"
              onPress={() => {}}
            />
          </View>
        </View>

        {/* Help Section */}
        <View style={styles.section}>
          <SectionHeader title="Help" />
          <View style={styles.card}>
            <MenuItem
              icon={HelpCircle}
              iconColor={COLORS.primary}
              title="How It Works"
              subtitle="Quick guide to photos & reveals"
              onPress={() => navigation.navigate('HowItWorks')}
            />
            <View style={styles.divider} />
            <MenuItem
              icon={Heart}
              iconColor={COLORS.accent}
              title="Community Guidelines"
              subtitle="How we keep things warm & safe"
              onPress={() => {}}
            />
          </View>
        </View>

        {/* For Venues Section */}
        <View style={styles.section}>
          <SectionHeader title="For Venues" />
          <View style={styles.card}>
            <View style={styles.venueInfo}>
              <View style={[styles.menuIcon, { backgroundColor: `${COLORS.info}20` }]}>
                <MapPin color={COLORS.info} size={20} />
              </View>
              <View style={styles.venueContent}>
                <Text style={styles.venueTitle}>Where & How</Text>
                <Text style={styles.venueText}>
                  Add your website, menu, socials or events to your venue page.
                </Text>
                <Text style={styles.venueEmail}>hereandnow.social.uk@gmail.com</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Notifications Section */}
        <View style={styles.section}>
          <SectionHeader title="Notifications" />
          <View style={styles.card}>
            <View style={styles.switchRow}>
              <View style={styles.switchInfo}>
                <Text style={styles.switchTitle}>Enable Push Notifications</Text>
                <Text style={styles.switchSubtitle}>Get notified when the app is closed</Text>
              </View>
              <Switch
                value={pushSettings.enabled}
                onValueChange={(value) => handlePushSettingChange('enabled', value)}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                thumbColor={COLORS.text}
              />
            </View>

            {pushSettings.enabled && (
              <>
                <View style={styles.divider} />
                <View style={styles.subSettings}>
                  <View style={styles.subSwitchRow}>
                    <Text style={styles.subSwitchText}>Glances</Text>
                    <Switch
                      value={pushSettings.glances}
                      onValueChange={(value) => handlePushSettingChange('glances', value)}
                      trackColor={{ false: COLORS.border, true: COLORS.primary }}
                      thumbColor={COLORS.text}
                    />
                  </View>
                  <View style={styles.subSwitchRow}>
                    <Text style={styles.subSwitchText}>Icebreakers</Text>
                    <Switch
                      value={pushSettings.drinks}
                      onValueChange={(value) => handlePushSettingChange('drinks', value)}
                      trackColor={{ false: COLORS.border, true: COLORS.primary }}
                      thumbColor={COLORS.text}
                    />
                  </View>
                  <View style={styles.subSwitchRow}>
                    <Text style={styles.subSwitchText}>Messages</Text>
                    <Switch
                      value={pushSettings.messages}
                      onValueChange={(value) => handlePushSettingChange('messages', value)}
                      trackColor={{ false: COLORS.border, true: COLORS.primary }}
                      thumbColor={COLORS.text}
                    />
                  </View>
                  <View style={styles.subSwitchRow}>
                    <Text style={styles.subSwitchText}>Matches</Text>
                    <Switch
                      value={pushSettings.matches}
                      onValueChange={(value) => handlePushSettingChange('matches', value)}
                      trackColor={{ false: COLORS.border, true: COLORS.primary }}
                      thumbColor={COLORS.text}
                    />
                  </View>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Safety Section */}
        <View style={styles.section}>
          <SectionHeader title="Safety" />
          <View style={styles.card}>
            <View style={styles.blockedHeader}>
              <UserX color={COLORS.textSecondary} size={18} />
              <Text style={styles.blockedTitle}>Blocked Users</Text>
              <Text style={styles.blockedCount}>{blockedUsers.length}</Text>
            </View>

            {blockedLoading ? (
              <ActivityIndicator color={COLORS.textSecondary} style={{ marginVertical: SPACING.md }} />
            ) : blockedUsers.length === 0 ? (
              <Text style={styles.blockedEmpty}>No blocked users. Users you block will appear here.</Text>
            ) : (
              <View style={styles.blockedList}>
                {blockedUsers.map((blockedUser) => (
                  <View key={blockedUser.id} style={styles.blockedUserRow}>
                    <View style={styles.blockedUserAvatar}>
                      <Text style={styles.blockedUserInitial}>
                        {blockedUser.display_name?.charAt(0) || '?'}
                      </Text>
                    </View>
                    <Text style={styles.blockedUserName}>{blockedUser.display_name}</Text>
                    <TouchableOpacity
                      style={styles.unblockButton}
                      onPress={() => handleUnblock(blockedUser.id)}
                      disabled={unblocking === blockedUser.id}
                    >
                      {unblocking === blockedUser.id ? (
                        <ActivityIndicator size="small" color={COLORS.success} />
                      ) : (
                        <Text style={styles.unblockText}>Unblock</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <Text style={styles.blockedHint}>
              Unblocking restores visibility but does not restore previous matches or chat history.
            </Text>
          </View>
        </View>

        {/* Legal Section */}
        <View style={styles.section}>
          <View style={styles.card}>
            <MenuItem
              icon={FileText}
              iconColor={COLORS.textSecondary}
              title="Legal"
              subtitle="Terms, Privacy, Safety"
              onPress={() => {}}
            />
          </View>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <SectionHeader title="Account" />
          <View style={styles.card}>
            <TouchableOpacity style={styles.accountButton} onPress={handleLogout}>
              <LogOut color={COLORS.textSecondary} size={20} />
              <Text style={styles.accountButtonText}>Log Out</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.accountButton} onPress={handleDeleteAccount} disabled={deleting}>
              {deleting ? (
                <ActivityIndicator size="small" color={COLORS.error} />
              ) : (
                <Trash2 color={COLORS.error} size={20} />
              )}
              <Text style={[styles.accountButtonText, { color: COLORS.error }]}>Delete Account</Text>
            </TouchableOpacity>
          </View>
        </View>

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
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  headerSubtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  section: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  sectionHeader: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  menuSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.md,
  },
  venueInfo: {
    flexDirection: 'row',
    padding: SPACING.md,
  },
  venueContent: {
    flex: 1,
  },
  venueTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  venueText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  venueEmail: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    marginTop: SPACING.xs,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
  },
  switchInfo: {
    flex: 1,
    marginRight: SPACING.md,
  },
  switchTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  switchSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  subSettings: {
    paddingLeft: SPACING.lg,
    paddingRight: SPACING.md,
    paddingBottom: SPACING.md,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.border,
    marginLeft: SPACING.md,
  },
  subSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
  },
  subSwitchText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  blockedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  blockedTitle: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  blockedCount: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
  },
  blockedEmpty: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
  },
  blockedList: {
    maxHeight: 200,
  },
  blockedUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  blockedUserAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  blockedUserInitial: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  blockedUserName: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  unblockButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  unblockText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.success,
    fontWeight: '600',
  },
  blockedHint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    padding: SPACING.md,
    paddingTop: 0,
  },
  accountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.md,
  },
  accountButtonText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  bottomSpacer: {
    height: 100,
  },
});

export default SettingsScreen;
