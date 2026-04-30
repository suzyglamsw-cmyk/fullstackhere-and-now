import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Settings, Edit, Crown, ChevronRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuth } from '../../context/AuthContext';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, API_URL } from '../../utils/constants';

const ProfileScreen = ({ navigation }) => {
  const { user } = useAuth();

  const getPhotoUrl = () => {
    if (user?.photos?.[0]) {
      return `${API_URL}/api/photos/serve/${user.photos[0]}?blur=false`;
    }
    return null;
  };

  const photoUrl = getPhotoUrl();

  const MenuItem = ({ icon: Icon, title, subtitle, onPress, badge }) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.menuIcon}>
        <Icon color={COLORS.primary} size={22} />
      </View>
      <View style={styles.menuInfo}>
        <Text style={styles.menuTitle}>{title}</Text>
        {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
      </View>
      {badge && (
        <View style={styles.menuBadge}>
          <Text style={styles.menuBadgeText}>{badge}</Text>
        </View>
      )}
      <ChevronRight color={COLORS.textMuted} size={20} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
            <Settings color={COLORS.text} size={24} />
          </TouchableOpacity>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.photoContainer}>
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={styles.photo} />
            ) : (
              <View style={[styles.photo, styles.photoPlaceholder]}>
                <Text style={styles.photoPlaceholderText}>
                  {user?.display_name?.charAt(0) || '?'}
                </Text>
              </View>
            )}
            <TouchableOpacity style={styles.editPhotoButton}>
              <Edit color={COLORS.text} size={16} />
            </TouchableOpacity>
          </View>

          <Text style={styles.userName}>
            {user?.display_name || user?.first_name}
            {user?.age ? `, ${user.age}` : ''}
          </Text>
          
          {user?.bio && (
            <Text style={styles.userBio} numberOfLines={2}>
              {user.bio}
            </Text>
          )}

          {user?.is_premium && (
            <View style={styles.premiumBadge}>
              <Crown color={COLORS.warning} size={16} />
              <Text style={styles.premiumText}>Premium Member</Text>
            </View>
          )}
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          <MenuItem
            icon={Edit}
            title="Edit Profile"
            subtitle="Photos, bio, preferences"
            onPress={() => navigation.navigate('EditProfile')}
          />
        </View>

        {!user?.is_premium && (
          <TouchableOpacity style={styles.upgradeCard} activeOpacity={0.9}>
            <LinearGradient
              colors={[COLORS.primary, COLORS.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.upgradeGradient}
            >
              <Crown color={COLORS.text} size={28} />
              <View style={styles.upgradeInfo}>
                <Text style={styles.upgradeTitle}>Upgrade to Premium</Text>
                <Text style={styles.upgradeSubtitle}>
                  Unlimited reveals, see who viewed you & more
                </Text>
              </View>
              <ChevronRight color={COLORS.text} size={24} />
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Stats */}
        <View style={styles.statsCard}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{user?.stats?.glances_received || 0}</Text>
            <Text style={styles.statLabel}>Glances</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{user?.stats?.reveals_received || 0}</Text>
            <Text style={styles.statLabel}>Reveals</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{user?.stats?.connections || 0}</Text>
            <Text style={styles.statLabel}>Connections</Text>
          </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  title: {
    fontSize: FONT_SIZES.xxxl,
    fontWeight: '700',
    color: COLORS.text,
  },
  profileCard: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  photoContainer: {
    position: 'relative',
    marginBottom: SPACING.md,
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  photoPlaceholder: {
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderText: {
    fontSize: 48,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  editPhotoButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.background,
  },
  userName: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '700',
    color: COLORS.text,
  },
  userBio: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
    paddingHorizontal: SPACING.xl,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    backgroundColor: `${COLORS.warning}20`,
    borderRadius: BORDER_RADIUS.full,
  },
  premiumText: {
    color: COLORS.warning,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  menuSection: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: `${COLORS.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  menuInfo: {
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
  menuBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
    marginRight: SPACING.sm,
  },
  menuBadgeText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
  },
  upgradeCard: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  upgradeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  upgradeInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  upgradeTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  upgradeSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  statsCard: {
    flexDirection: 'row',
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    padding: SPACING.lg,
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '700',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.md,
  },
});

export default ProfileScreen;
