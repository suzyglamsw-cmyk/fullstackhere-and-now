import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuth } from '../../context/AuthContext';
import { authAPI } from '../../utils/api';
import Button from '../../components/Button';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../utils/constants';

const OnboardingGenderScreen = ({ navigation }) => {
  const { user, updateUser } = useAuth();
  const [showAs, setShowAs] = useState('');
  const [seeking, setSeeking] = useState([]);
  const [rainbow, setRainbow] = useState(false);
  const [openToAll, setOpenToAll] = useState(false);
  const [loading, setLoading] = useState(false);

  const toggleSeeking = (gender) => {
    setSeeking(prev => 
      prev.includes(gender)
        ? prev.filter(g => g !== gender)
        : [...prev, gender]
    );
  };

  const handleContinue = async () => {
    if (!showAs) {
      Alert.alert('Required', 'Please select how you identify');
      return;
    }
    
    if (seeking.length === 0 && !openToAll) {
      Alert.alert('Required', 'Please select who you\'re looking to meet');
      return;
    }
    
    setLoading(true);
    try {
      const response = await authAPI.updateProfile({
        show_as: showAs,
        seeking: openToAll ? ['male', 'female'] : seeking,
        rainbow,
        open_to_all: openToAll,
      });
      updateUser(response.data);
    } catch (error) {
      Alert.alert('Error', 'Failed to save. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const GenderOption = ({ value, label, color, selected, onPress }) => (
    <TouchableOpacity
      style={[
        styles.genderOption,
        selected && { borderColor: color, backgroundColor: `${color}15` }
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.genderDot, { backgroundColor: color }]} />
      <Text style={[styles.genderLabel, selected && { color }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>About You</Text>
          <Text style={styles.subtitle}>
            Help us show you to the right people
          </Text>
        </View>

        {/* Show As Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>I identify as...</Text>
          <View style={styles.optionsRow}>
            <GenderOption
              value="female"
              label="Woman"
              color={COLORS.female}
              selected={showAs === 'female'}
              onPress={() => setShowAs('female')}
            />
            <GenderOption
              value="male"
              label="Man"
              color={COLORS.male}
              selected={showAs === 'male'}
              onPress={() => setShowAs('male')}
            />
          </View>
        </View>

        {/* Seeking Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>I'm looking to meet...</Text>
          <View style={styles.optionsRow}>
            <GenderOption
              value="female"
              label="Women"
              color={COLORS.female}
              selected={seeking.includes('female') || openToAll}
              onPress={() => !openToAll && toggleSeeking('female')}
            />
            <GenderOption
              value="male"
              label="Men"
              color={COLORS.male}
              selected={seeking.includes('male') || openToAll}
              onPress={() => !openToAll && toggleSeeking('male')}
            />
          </View>
          
          <TouchableOpacity
            style={[
              styles.openToAllOption,
              openToAll && styles.openToAllSelected
            ]}
            onPress={() => setOpenToAll(!openToAll)}
          >
            <Text style={[
              styles.openToAllText,
              openToAll && styles.openToAllTextSelected
            ]}>
              Open to all
            </Text>
          </TouchableOpacity>
        </View>

        {/* Rainbow Option */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[
              styles.rainbowOption,
              rainbow && styles.rainbowSelected
            ]}
            onPress={() => setRainbow(!rainbow)}
          >
            <LinearGradient
              colors={['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#9b59b6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.rainbowGradient}
            />
            <Text style={styles.rainbowText}>Show rainbow badge</Text>
            <Text style={styles.rainbowSubtext}>
              Visible to LGBTQ+ community
            </Text>
          </TouchableOpacity>
        </View>

        <Button
          title="Continue"
          onPress={handleContinue}
          loading={loading}
          disabled={!showAs}
          size="lg"
          style={styles.continueButton}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: SPACING.lg,
  },
  header: {
    marginBottom: SPACING.xl,
  },
  title: {
    fontSize: FONT_SIZES.xxxl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  genderOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  genderDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: SPACING.sm,
  },
  genderLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.text,
  },
  openToAllOption: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    alignItems: 'center',
  },
  openToAllSelected: {
    borderColor: COLORS.rainbow,
    backgroundColor: `${COLORS.rainbow}15`,
  },
  openToAllText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.text,
  },
  openToAllTextSelected: {
    color: COLORS.rainbow,
  },
  rainbowOption: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    overflow: 'hidden',
  },
  rainbowSelected: {
    borderColor: COLORS.rainbow,
  },
  rainbowGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  rainbowText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.xs,
  },
  rainbowSubtext: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  continueButton: {
    marginTop: 'auto',
  },
});

export default OnboardingGenderScreen;
