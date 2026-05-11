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
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Users,
  Heart,
  Sparkles,
  MapPin,
  Camera,
} from 'lucide-react-native';

import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../src/utils/constants';

// Avatar visual component - represents a blurred/clear photo state
const AvatarVisual = ({ label, blurLevel = 'heavy' }) => {
  // blurLevel: "heavy" | "medium" | "clear"
  const blurRadius = blurLevel === 'heavy' ? 12 : blurLevel === 'medium' ? 6 : 0;

  return (
    <View style={styles.avatarContainer}>
      <View style={styles.avatarBox}>
        <LinearGradient
          colors={[COLORS.primary, COLORS.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.avatarGradient, { opacity: blurLevel === 'clear' ? 0 : 0.3 }]}
        />
        <View style={[styles.avatarInner, blurLevel !== 'clear' && styles.avatarBlurred]}>
          <Text style={styles.avatarInitial}>
            {label === 'You' ? 'Y' : 'T'}
          </Text>
        </View>
      </View>
      {label && <Text style={styles.avatarLabel}>{label}</Text>}
    </View>
  );
};

// Silhouette visual for Step 6
const SilhouetteVisual = ({ label }) => {
  return (
    <View style={styles.avatarContainer}>
      <View style={[styles.avatarBox, styles.silhouetteBox]}>
        <View style={styles.silhouetteHead} />
        <View style={styles.silhouetteBody} />
      </View>
      {label && <Text style={styles.avatarLabel}>{label}</Text>}
    </View>
  );
};

// Step card component
const StepCard = ({ number, title, description, children, icon: Icon }) => {
  return (
    <View style={styles.stepCard}>
      <View style={styles.stepHeader}>
        <View style={styles.stepNumber}>
          <Text style={styles.stepNumberText}>{number}</Text>
        </View>
        <Text style={styles.stepTitle}>{title}</Text>
        {Icon && <Icon color={COLORS.textSecondary} size={18} style={styles.stepIcon} />}
      </View>

      <View style={styles.stepVisual}>{children}</View>

      <Text style={styles.stepDescription}>{description}</Text>
    </View>
  );
};

const HowItWorksScreen = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft color={COLORS.textSecondary} size={20} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Quick Steps: How It Works</Text>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Step 1 - Strangers */}
        <StepCard
          number={1}
          title="STEP 1 — Strangers"
          description="You start as strangers. Photos are heavily blurred for protection."
          icon={Users}
        >
          <AvatarVisual label="You" blurLevel="heavy" />
          <AvatarVisual label="Them" blurLevel="heavy" />
        </StepCard>

        {/* Step 2 - Someone shows interest */}
        <StepCard
          number={2}
          title="STEP 2 — Someone shows interest"
          description="If you send or receive a Glance, Icebreaker, or Chat Request, photos stay heavily blurred until you both respond."
          icon={Eye}
        >
          <AvatarVisual label="You" blurLevel="heavy" />
          <View style={styles.heartContainer}>
            <Heart color={COLORS.accent} size={20} fill={COLORS.accent} />
          </View>
          <AvatarVisual label="Them" blurLevel="heavy" />
        </StepCard>

        {/* Step 3 - Mutual connection */}
        <StepCard
          number={3}
          title="STEP 3 — Mutual connection"
          description="You're connected when there's mutual interest — returned glances, accepted icebreakers, or accepted chat requests. Photos soften to a medium blur."
          icon={Heart}
        >
          <AvatarVisual label="You" blurLevel="medium" />
          <View style={styles.heartsContainer}>
            <Heart color={COLORS.accent} size={16} fill={COLORS.accent} />
            <Heart color={COLORS.accent} size={16} fill={COLORS.accent} />
          </View>
          <AvatarVisual label="Them" blurLevel="medium" />
        </StepCard>

        {/* Step 4 - Reveal choice */}
        <StepCard
          number={4}
          title="STEP 4 — Reveal choice"
          description="You can both choose to reveal your photos. Nothing changes until you've both chosen to reveal."
          icon={EyeOff}
        >
          <View style={styles.revealColumn}>
            <AvatarVisual label="You (revealed)" blurLevel="medium" />
            <Eye color={COLORS.primary} size={16} />
          </View>
          <View style={styles.waitingContainer}>
            <Text style={styles.waitingText}>waiting...</Text>
          </View>
          <View style={styles.revealColumn}>
            <AvatarVisual label="Them (not yet)" blurLevel="medium" />
            <EyeOff color={COLORS.textMuted} size={16} />
          </View>
        </StepCard>

        {/* Step 5 - Mutual reveal */}
        <StepCard
          number={5}
          title="STEP 5 — Mutual reveal"
          description="When you both reveal, you see each other clearly everywhere in the app."
          icon={Sparkles}
        >
          <View style={styles.revealColumn}>
            <AvatarVisual label="You" blurLevel="clear" />
            <Eye color={COLORS.success} size={16} />
          </View>
          <View style={styles.sparkleContainer}>
            <Sparkles color={COLORS.warning} size={20} />
          </View>
          <View style={styles.revealColumn}>
            <AvatarVisual label="Them" blurLevel="clear" />
            <Eye color={COLORS.success} size={16} />
          </View>
        </StepCard>

        {/* Step 6 - Hide photo in venues */}
        <StepCard
          number={6}
          title="STEP 6 — Hide photo in venues"
          description="If you hide your photo in venues, others will see a generic silhouette there. But anyone you've mutually revealed with will still see your clear photo in your full profile."
          icon={MapPin}
        >
          <View style={styles.venueColumn}>
            <Text style={styles.venueLabel}>In Venues</Text>
            <SilhouetteVisual label="You (hidden)" />
          </View>
          <View style={styles.dividerVertical} />
          <View style={styles.venueColumn}>
            <Text style={styles.venueLabel}>Full Profile</Text>
            <AvatarVisual label="(mutual reveal)" blurLevel="clear" />
          </View>
        </StepCard>

        {/* Step 7 - Keep it real */}
        <StepCard
          number={7}
          title="STEP 7 — Keep it real"
          description="Here&Now works best with real, recent photos — particularly in venues, where you may want to meet the person behind the photos while they're in the same place as you."
          icon={Camera}
        >
          <AvatarVisual blurLevel="clear" />
          <View style={styles.cameraContainer}>
            <Camera color={COLORS.primary} size={24} />
            <Text style={styles.cameraText}>Real & recent</Text>
          </View>
          <AvatarVisual blurLevel="clear" />
        </StepCard>

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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: SPACING.sm,
    marginRight: SPACING.sm,
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.primary,
  },
  scrollContent: {
    padding: SPACING.md,
  },
  stepCard: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  stepNumberText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.primary,
  },
  stepTitle: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.primary,
  },
  stepIcon: {
    marginLeft: SPACING.sm,
  },
  stepVisual: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
    gap: SPACING.md,
  },
  stepDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    lineHeight: 20,
  },
  avatarContainer: {
    alignItems: 'center',
    gap: SPACING.xs,
  },
  avatarBox: {
    width: 64,
    height: 64,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.backgroundLight,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  avatarInner: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarBlurred: {
    opacity: 0.6,
  },
  avatarInitial: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  avatarLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
  silhouetteBox: {
    backgroundColor: COLORS.backgroundLight,
  },
  silhouetteHead: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.textMuted,
    marginBottom: 4,
  },
  silhouetteBody: {
    width: 36,
    height: 20,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: COLORS.textMuted,
  },
  heartContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  heartsContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  revealColumn: {
    alignItems: 'center',
    gap: SPACING.xs,
  },
  waitingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  waitingText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
  },
  sparkleContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  venueColumn: {
    alignItems: 'center',
    gap: SPACING.sm,
  },
  venueLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  dividerVertical: {
    width: 1,
    height: 64,
    backgroundColor: COLORS.border,
  },
  cameraContainer: {
    alignItems: 'center',
    gap: SPACING.xs,
  },
  cameraText: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  bottomSpacer: {
    height: 100,
  },
});

export default HowItWorksScreen;
