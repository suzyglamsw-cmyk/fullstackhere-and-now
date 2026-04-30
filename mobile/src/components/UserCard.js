import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin, Clock } from 'lucide-react-native';
import { COLORS, BORDER_RADIUS, FONT_SIZES, SPACING } from '../utils/constants';
import { API_URL } from '../utils/constants';

export const UserCard = ({
  user,
  onPress,
  context = 'venue', // venue, discovery, connection
  isMatched = false,
  showActions = true,
  blurLevel = 'heavy', // heavy, light, none
  style,
}) => {
  const getPhotoUrl = () => {
    if (user?.photos?.[0]) {
      const photoId = user.photos[0];
      const blur = blurLevel !== 'none';
      return `${API_URL}/api/photos/serve/${photoId}?blur=${blur}`;
    }
    if (user?.avatar_url) {
      return user.avatar_url.startsWith('http') 
        ? user.avatar_url 
        : `${API_URL}${user.avatar_url}`;
    }
    return null;
  };

  const getNameColor = () => {
    const gender = user?.show_as;
    if (gender === 'female') return COLORS.female;
    if (gender === 'male') return COLORS.male;
    return COLORS.rainbow;
  };

  const getBlurRadius = () => {
    if (blurLevel === 'none') return 0;
    if (blurLevel === 'light') return 6;
    return 12;
  };

  const photoUrl = getPhotoUrl();
  const displayName = user?.display_name || user?.first_name || 'Unknown';
  const age = user?.age;

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      {/* Photo */}
      <View style={styles.photoContainer}>
        {photoUrl ? (
          <Image
            source={{ uri: photoUrl }}
            style={styles.photo}
            blurRadius={getBlurRadius()}
          />
        ) : (
          <View style={[styles.photo, styles.photoPlaceholder]}>
            <Text style={styles.photoPlaceholderText}>
              {displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        
        {/* Gradient overlay */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={styles.gradient}
        />
        
        {/* Intent badge */}
        {user?.intent && (
          <View style={styles.intentBadge}>
            <Text style={styles.intentText}>{user.intent}</Text>
          </View>
        )}
        
        {/* Info overlay */}
        <View style={styles.infoOverlay}>
          <Text style={[styles.name, { color: getNameColor() }]}>
            {displayName}{age ? `, ${age}` : ''}
          </Text>
          
          {user?.presence_note && (
            <View style={styles.presenceRow}>
              <Clock color={COLORS.textSecondary} size={12} />
              <Text style={styles.presenceText} numberOfLines={1}>
                {user.presence_note}
              </Text>
            </View>
          )}
          
          {user?.home_area && context === 'discovery' && (
            <View style={styles.locationRow}>
              <MapPin color={COLORS.textSecondary} size={12} />
              <Text style={styles.locationText} numberOfLines={1}>
                {user.home_area}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: COLORS.card,
  },
  photoContainer: {
    aspectRatio: 3 / 4,
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoPlaceholder: {
    backgroundColor: COLORS.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderText: {
    fontSize: 48,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  intentBadge: {
    position: 'absolute',
    top: SPACING.sm,
    left: SPACING.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  intentText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.xs,
    fontWeight: '500',
  },
  infoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: SPACING.md,
  },
  name: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    marginBottom: SPACING.xs,
  },
  presenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  presenceText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.xs,
    marginLeft: SPACING.xs,
    flex: 1,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.xs,
    marginLeft: SPACING.xs,
    flex: 1,
  },
});

export default UserCard;
