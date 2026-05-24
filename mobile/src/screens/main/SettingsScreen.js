import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Crown,
  Coins,
  Bell,
  Share2,
  HelpCircle,
  Heart,
  FileText,
  Shield,
  LogOut,
  Trash2,
  ChevronRight,
  MapPin,
  Zap,
} from 'lucide-react-native';

import { useAuth } from '../../context/AuthContext';
import api, { settingsAPI } from '../../utils/api';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../utils/constants';

const SettingsScreen = ({ navigation }) => {
  const { user, logout } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [dailyActions, setDailyActions] = useState(null);
  const [loadingActions, setLoadingActions] = useState(true);

  useEffect(() => {
    fetchDailyActions();
  }, []);

  const fetchDailyActions = async () => {
    try {
      const response = await api.get('/api/daily-actions/status');
      setDailyActions(response.data);
    } catch (error) {
      console.error('Failed to fetch daily actions:', error);
    } finally {
      setLoadingActions(false);
    }
  };

const SettingsScreen = ({ navigation }) => {
  const { user, logout } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(true);

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
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
              await logout();
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

  const handlePushToggle = async (value) => {
    setPushEnabled(value);
    try {
      await settingsAPI.updatePrivacy({ push_enabled: value });
    } catch (error) {
      setPushEnabled(!value); // Revert on error
      Alert.alert('Error', 'Failed to update notification settings');
    }
  };

  const handleShare = async () => {
    try {
      const message = "I'm using Here & Now — join me on it.\nhttps://hereandnow.app/download";
      await Linking.openURL(`sms:?body=${encodeURIComponent(message)}`);
    } catch (error) {
      Alert.alert('Share', 'Copy this link: https://hereandnow.app/download');
    }
  };

  const MenuItem = ({ icon: Icon, title, subtitle, onPress, rightElement, iconBg }) => (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      <View style={[styles.menuIcon, { backgroundColor: iconBg || `${COLORS.primary}20` }]}>
        <Icon color={COLORS.text} size={20} />
      </View>
      <View style={styles.menuInfo}>
        <Text style={styles.menuTitle}>{title}</Text>
        {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
      </View>
      {rightElement || (onPress && <ChevronRight color={COLORS.textMuted} size={20} />)}
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
          <ArrowLeft color={COLORS.text} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Daily Actions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Daily Actions</Text>
          <View style={styles.sectionContent}>
            {loadingActions ? (
              <View style={styles.loadingActions}>
                <ActivityIndicator color={COLORS.primary} />
              </View>
            ) : dailyActions ? (
              <View style={styles.dailyActionsCard}>
                <View style={styles.dailyActionsHeader}>
                  <View style={[styles.menuIcon, { backgroundColor: `${COLORS.primary}20` }]}>
                    <Zap color={COLORS.primary} size={20} />
                  </View>
                  <View style={styles.dailyActionsInfo}>
                    <Text style={styles.dailyActionsTitle}>
                      {dailyActions.daily_remaining} / {dailyActions.daily_limit} remaining
                    </Text>
                    <Text style={styles.dailyActionsSubtitle}>
                      Resets daily at 5:00 AM
                    </Text>
                  </View>
                </View>
                
                {/* Progress bar */}
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { width: `${(dailyActions.daily_remaining / dailyActions.daily_limit) * 100}%` }
                    ]} 
                  />
                </View>
                
                <Text style={styles.dailyActionsDescription}>
                  Daily actions cover glances, icebreakers, and chat requests.
                  {dailyActions.is_premium 
                    ? ' Premium members get 20 actions per day.'
                    : ' Upgrade to Premium for 20 actions per day.'}
                </Text>
                
                {/* Token balance */}
                <View style={styles.tokenBalanceRow}>
                  <Coins color={COLORS.warning} size={16} />
                  <Text style={styles.tokenBalanceText}>
                    {dailyActions.token_balance} tokens available
                  </Text>
                </View>
                <Text style={styles.tokenDescription}>
                  Tokens are used when daily actions run out. They never expire.
                </Text>
              </View>
            ) : (
              <Text style={styles.errorText}>Unable to load daily actions</Text>
            )}
          </View>
        </View>

        {/* Upgrades Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upgrades</Text>
          <View style={styles.sectionContent}>
            <MenuItem
              icon={Crown}
              title="Premium"
              subtitle={user?.is_premium 
                ? 'Active - 20 daily actions' 
                : 'Get 20 daily actions (vs 5 free)'}
              iconBg={`${COLORS.warning}20`}
              onPress={() => Alert.alert('Premium', 'Premium features coming soon!')}
            />
            <MenuItem
              icon={Coins}
              title="Buy Tokens"
              subtitle={`Balance: ${dailyActions?.token_balance || user?.token_balance || 0} tokens`}
              iconBg={`${COLORS.warning}20`}
              onPress={() => Alert.alert('Tokens', 'Token purchase coming soon!')}
            />
          </View>
        </View>

        {/* Share Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Spread the Word</Text>
          <View style={styles.sectionContent}>
            <MenuItem
              icon={Share2}
              title="Share Here & Now"
              subtitle="Invite friends to join"
              iconBg={`${COLORS.accent}20`}
              onPress={handleShare}
            />
          </View>
        </View>

        {/* Help Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Help</Text>
          <View style={styles.sectionContent}>
            <MenuItem
              icon={HelpCircle}
              title="How It Works"
              subtitle="Quick guide to photos & reveals"
              iconBg={`${COLORS.primary}20`}
              onPress={() => Alert.alert('How It Works', 'Tutorial coming soon!')}
            />
            <MenuItem
              icon={Heart}
              title="Community Guidelines"
              subtitle="How we keep things warm & safe"
              iconBg={`${COLORS.accent}20`}
              onPress={() => Alert.alert('Guidelines', 'Community guidelines coming soon!')}
            />
          </View>
        </View>

        {/* For Venues Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>For Venues</Text>
          <View style={styles.sectionContent}>
            <View style={styles.venueCard}>
              <View style={[styles.menuIcon, { backgroundColor: `${COLORS.success}20` }]}>
                <MapPin color={COLORS.success} size={20} />
              </View>
              <View style={styles.venueInfo}>
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
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.sectionContent}>
            <MenuItem
              icon={Bell}
              title="Push Notifications"
              subtitle="Get notified when the app is closed"
              iconBg={`${COLORS.info}20`}
              rightElement={
                <Switch
                  value={pushEnabled}
                  onValueChange={handlePushToggle}
                  trackColor={{ false: COLORS.card, true: COLORS.primary }}
                  thumbColor={COLORS.text}
                />
              }
            />
          </View>
        </View>

        {/* Safety Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Safety</Text>
          <View style={styles.sectionContent}>
            <MenuItem
              icon={Shield}
              title="Blocked Users"
              subtitle="Manage blocked users"
              iconBg={`${COLORS.error}20`}
              onPress={() => Alert.alert('Blocked Users', 'Blocked users management coming soon!')}
            />
          </View>
        </View>

        {/* Legal Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legal</Text>
          <View style={styles.sectionContent}>
            <MenuItem
              icon={FileText}
              title="Terms & Privacy"
              subtitle="Terms, Privacy, Safety"
              iconBg={`${COLORS.textMuted}20`}
              onPress={() => Linking.openURL('https://hereandnow.app/legal')}
            />
          </View>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.sectionContent}>
            <TouchableOpacity
              style={styles.accountButton}
              onPress={handleLogout}
            >
              <LogOut color={COLORS.textSecondary} size={20} />
              <Text style={styles.accountButtonText}>Log Out</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.accountButton, styles.deleteButton]}
              onPress={handleDeleteAccount}
              disabled={deleting}
            >
              {deleting ? (
                <ActivityIndicator size="small" color={COLORS.error} />
              ) : (
                <>
                  <Trash2 color={COLORS.error} size={20} />
                  <Text style={styles.deleteButtonText}>Delete Account</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* App Version */}
        <View style={styles.footer}>
          <Text style={styles.versionText}>Here & Now v1.0.0</Text>
        </View>
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
    paddingVertical: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  section: {
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
  },
  sectionContent: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  menuInfo: {
    flex: 1,
  },
  menuTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.text,
  },
  menuSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  venueCard: {
    flexDirection: 'row',
    padding: SPACING.md,
  },
  venueInfo: {
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
  accountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    gap: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  accountButtonText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  deleteButton: {
    borderBottomWidth: 0,
  },
  deleteButtonText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.error,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  versionText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
  },
  // Daily Actions styles
  loadingActions: {
    padding: SPACING.lg,
    alignItems: 'center',
  },
  dailyActionsCard: {
    padding: SPACING.md,
  },
  dailyActionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  dailyActionsInfo: {
    flex: 1,
  },
  dailyActionsTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  dailyActionsSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
  },
  progressBar: {
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 4,
  },
  dailyActionsDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  tokenBalanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  tokenBalanceText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    color: COLORS.text,
  },
  tokenDescription: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    lineHeight: 18,
  },
  errorText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.error,
    padding: SPACING.md,
    textAlign: 'center',
  },
});

export default SettingsScreen;
