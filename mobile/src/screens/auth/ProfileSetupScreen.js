import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Plus, X } from 'lucide-react-native';

import { useAuth } from '../../context/AuthContext';
import { authAPI, photosAPI, buildPhotoUrl } from '../../utils/api';
import Button from '../../components/Button';
import TextInput from '../../components/TextInput';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../utils/constants';

const ProfileSetupScreen = ({ navigation }) => {
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [formData, setFormData] = useState({
    display_name: user?.display_name || user?.first_name || '',
    bio: user?.bio || '',
    presence_note: user?.presence_note || '',
    photos: user?.photos || [],
  });

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      uploadPhoto(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      uploadPhoto(result.assets[0].uri);
    }
  };

  const uploadPhoto = async (uri) => {
    setUploadingPhoto(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', {
        uri,
        type: 'image/jpeg',
        name: 'photo.jpg',
      });
      formDataUpload.append('slot', formData.photos.length);

      const response = await photosAPI.upload(formDataUpload);
      const newPhotos = [...formData.photos, response.data.photo_id];
      updateField('photos', newPhotos);
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to upload photo';
      Alert.alert('Upload Failed', message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const removePhoto = (index) => {
    const newPhotos = formData.photos.filter((_, i) => i !== index);
    updateField('photos', newPhotos);
  };

  const handleComplete = async () => {
    if (!formData.display_name.trim()) {
      Alert.alert('Required', 'Please enter a display name');
      return;
    }

    if (formData.photos.length === 0) {
      Alert.alert('Required', 'Please add at least one photo');
      return;
    }

    setLoading(true);
    try {
      const response = await authAPI.updateProfile({
        display_name: formData.display_name.trim(),
        bio: formData.bio.trim(),
        presence_note: formData.presence_note.trim(),
        profile_complete: true,
      });
      updateUser(response.data);
    } catch (error) {
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const showPhotoOptions = () => {
    Alert.alert(
      'Add Photo',
      'Choose how to add your photo',
      [
        { text: 'Take Photo', onPress: takePhoto },
        { text: 'Choose from Library', onPress: pickImage },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Complete Your Profile</Text>
          <Text style={styles.subtitle}>
            Add photos and tell others about yourself
          </Text>
        </View>

        {/* Photos Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Photos</Text>
          <Text style={styles.sectionSubtitle}>
            Add up to 3 photos. First photo is your main profile picture.
          </Text>
          
          <View style={styles.photosGrid}>
            {[0, 1, 2].map((index) => {
              const photoId = formData.photos[index];
              // Own photos during setup - always clear
              const photoUrl = photoId 
                ? buildPhotoUrl({ photos: [photoId] }, { blur: false, revealState: 'both_revealed' })
                : null;

              return (
                <View key={index} style={styles.photoSlot}>
                  {photoUrl ? (
                    <>
                      <Image source={{ uri: photoUrl }} style={styles.photo} />
                      <TouchableOpacity
                        style={styles.removePhoto}
                        onPress={() => removePhoto(index)}
                      >
                        <X color={COLORS.text} size={16} />
                      </TouchableOpacity>
                      {index === 0 && (
                        <View style={styles.mainBadge}>
                          <Text style={styles.mainBadgeText}>Main</Text>
                        </View>
                      )}
                    </>
                  ) : (
                    <TouchableOpacity
                      style={styles.addPhoto}
                      onPress={showPhotoOptions}
                      disabled={uploadingPhoto}
                    >
                      {uploadingPhoto && index === formData.photos.length ? (
                        <Text style={styles.uploadingText}>Uploading...</Text>
                      ) : (
                        <>
                          <Plus color={COLORS.textMuted} size={32} />
                          {index === 0 && (
                            <Text style={styles.addPhotoText}>Add photo</Text>
                          )}
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* Profile Info Section */}
        <View style={styles.section}>
          <TextInput
            label="Display Name"
            placeholder="How should others see you?"
            value={formData.display_name}
            onChangeText={(v) => updateField('display_name', v)}
            maxLength={20}
          />
          
          <TextInput
            label="Bio (optional)"
            placeholder="Tell others about yourself..."
            value={formData.bio}
            onChangeText={(v) => updateField('bio', v)}
            multiline
            numberOfLines={3}
            maxLength={500}
          />
          
          <TextInput
            label="What brings you here today? (optional)"
            placeholder="e.g., Coffee and good vibes"
            value={formData.presence_note}
            onChangeText={(v) => updateField('presence_note', v)}
            maxLength={100}
          />
        </View>

        <Button
          title="Complete Profile"
          onPress={handleComplete}
          loading={loading}
          disabled={!formData.display_name.trim() || formData.photos.length === 0}
          size="lg"
          style={styles.completeButton}
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
    marginBottom: SPACING.xs,
  },
  sectionSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  photosGrid: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  photoSlot: {
    flex: 1,
    aspectRatio: 3 / 4,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    backgroundColor: COLORS.card,
  },
  photo: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  addPhoto: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    borderRadius: BORDER_RADIUS.md,
  },
  addPhotoText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.sm,
    marginTop: SPACING.xs,
  },
  uploadingText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.sm,
  },
  removePhoto: {
    position: 'absolute',
    top: SPACING.xs,
    right: SPACING.xs,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: BORDER_RADIUS.full,
    padding: SPACING.xs,
  },
  mainBadge: {
    position: 'absolute',
    bottom: SPACING.xs,
    left: SPACING.xs,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  mainBadgeText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
  },
  completeButton: {
    marginTop: 'auto',
  },
});

export default ProfileSetupScreen;
