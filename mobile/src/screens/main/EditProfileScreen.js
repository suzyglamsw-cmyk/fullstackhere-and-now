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
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import {
  ArrowLeft,
  Camera,
  Plus,
  X,
  Mic,
  Play,
  Square,
  Trash2,
} from 'lucide-react-native';

import { useAuth } from '../../context/AuthContext';
import { authAPI, photosAPI, voiceAPI } from '../../utils/api';
import Button from '../../components/Button';
import TextInput from '../../components/TextInput';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, API_URL } from '../../utils/constants';

const EditProfileScreen = ({ navigation }) => {
  const { user, updateUser, fetchUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [formData, setFormData] = useState({
    display_name: user?.display_name || '',
    bio: user?.bio || '',
    presence_note: user?.presence_note || '',
    home_area: user?.home_area || '',
    photos: user?.photos || [],
  });

  // Voice intro state
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [voiceIntroUrl, setVoiceIntroUrl] = useState(user?.voice_intro_url || null);
  const [uploadingVoice, setUploadingVoice] = useState(false);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

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
      Alert.alert('Success', 'Photo uploaded!');
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to upload photo';
      Alert.alert('Upload Failed', message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const removePhoto = async (index) => {
    const photoId = formData.photos[index];
    try {
      await photosAPI.delete(photoId);
      const newPhotos = formData.photos.filter((_, i) => i !== index);
      updateField('photos', newPhotos);
    } catch (error) {
      Alert.alert('Error', 'Failed to remove photo');
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

  // Voice Recording Functions
  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow microphone access');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
    } catch (error) {
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    setIsRecording(false);
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setRecording(null);

    if (uri) {
      uploadVoiceIntro(uri);
    }
  };

  const uploadVoiceIntro = async (uri) => {
    setUploadingVoice(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', {
        uri,
        type: 'audio/m4a',
        name: 'voice_intro.m4a',
      });

      const response = await voiceAPI.upload(formDataUpload);
      setVoiceIntroUrl(response.data.voice_intro_url);
      Alert.alert('Success', 'Voice intro saved!');
    } catch (error) {
      Alert.alert('Error', 'Failed to upload voice intro');
    } finally {
      setUploadingVoice(false);
    }
  };

  const playVoiceIntro = async () => {
    if (!voiceIntroUrl) return;

    try {
      if (sound) {
        await sound.unloadAsync();
      }

      const url = voiceIntroUrl.startsWith('http')
        ? voiceIntroUrl
        : `${API_URL}${voiceIntroUrl}`;

      const { sound: newSound } = await Audio.Sound.createAsync({ uri: url });
      setSound(newSound);
      setIsPlaying(true);

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          setIsPlaying(false);
        }
      });

      await newSound.playAsync();
    } catch (error) {
      Alert.alert('Error', 'Failed to play voice intro');
    }
  };

  const stopPlayback = async () => {
    if (sound) {
      await sound.stopAsync();
      setIsPlaying(false);
    }
  };

  const deleteVoiceIntro = async () => {
    try {
      await voiceAPI.delete();
      setVoiceIntroUrl(null);
      Alert.alert('Success', 'Voice intro removed');
    } catch (error) {
      Alert.alert('Error', 'Failed to delete voice intro');
    }
  };

  const handleSave = async () => {
    if (!formData.display_name.trim()) {
      Alert.alert('Required', 'Please enter a display name');
      return;
    }

    setLoading(true);
    try {
      const response = await authAPI.updateProfile({
        display_name: formData.display_name.trim(),
        bio: formData.bio.trim(),
        presence_note: formData.presence_note.trim(),
        home_area: formData.home_area.trim(),
      });
      updateUser(response.data);
      Alert.alert('Success', 'Profile updated!');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

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
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity onPress={handleSave} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Text style={styles.saveButton}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Photos Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Photos</Text>
          <Text style={styles.sectionSubtitle}>
            Add up to 3 photos. First photo is your main profile picture.
          </Text>

          <View style={styles.photosGrid}>
            {[0, 1, 2].map((index) => {
              const photoId = formData.photos[index];
              const photoUrl = photoId
                ? `${API_URL}/api/photos/serve/${photoId}?blur=false`
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
                        <ActivityIndicator size="small" color={COLORS.textMuted} />
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

        {/* Voice Intro Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Voice Intro</Text>
          <Text style={styles.sectionSubtitle}>
            Record a short intro (up to 30 seconds) to let others hear your voice.
          </Text>

          <View style={styles.voiceContainer}>
            {voiceIntroUrl ? (
              <View style={styles.voiceControls}>
                <TouchableOpacity
                  style={styles.voiceButton}
                  onPress={isPlaying ? stopPlayback : playVoiceIntro}
                >
                  {isPlaying ? (
                    <Square color={COLORS.primary} size={24} />
                  ) : (
                    <Play color={COLORS.primary} size={24} />
                  )}
                </TouchableOpacity>
                <Text style={styles.voiceLabel}>
                  {isPlaying ? 'Playing...' : 'Voice intro saved'}
                </Text>
                <TouchableOpacity
                  style={styles.voiceDeleteButton}
                  onPress={deleteVoiceIntro}
                >
                  <Trash2 color={COLORS.error} size={20} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.recordButton, isRecording && styles.recordButtonActive]}
                onPress={isRecording ? stopRecording : startRecording}
                disabled={uploadingVoice}
              >
                {uploadingVoice ? (
                  <ActivityIndicator size="small" color={COLORS.text} />
                ) : (
                  <>
                    <Mic color={COLORS.text} size={24} />
                    <Text style={styles.recordButtonText}>
                      {isRecording ? 'Stop Recording' : 'Record Voice Intro'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Profile Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile Info</Text>

          <TextInput
            label="Display Name"
            placeholder="How should others see you?"
            value={formData.display_name}
            onChangeText={(v) => updateField('display_name', v)}
            maxLength={20}
          />

          <TextInput
            label="Bio"
            placeholder="Tell others about yourself..."
            value={formData.bio}
            onChangeText={(v) => updateField('bio', v)}
            multiline
            numberOfLines={3}
            maxLength={500}
          />

          <TextInput
            label="What brings you here today?"
            placeholder="e.g., Coffee and good vibes"
            value={formData.presence_note}
            onChangeText={(v) => updateField('presence_note', v)}
            maxLength={100}
          />

          <TextInput
            label="Home Area"
            placeholder="e.g., London, Manchester"
            value={formData.home_area}
            onChangeText={(v) => updateField('home_area', v)}
            maxLength={50}
          />
        </View>

        <Button
          title="Save Changes"
          onPress={handleSave}
          loading={loading}
          size="lg"
          style={styles.saveButtonMain}
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
  saveButton: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.primary,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
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
  voiceContainer: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
  },
  voiceControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  voiceButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${COLORS.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceLabel: {
    flex: 1,
    marginLeft: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  voiceDeleteButton: {
    padding: SPACING.sm,
  },
  recordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  recordButtonActive: {
    backgroundColor: `${COLORS.error}20`,
    borderRadius: BORDER_RADIUS.md,
  },
  recordButtonText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    fontWeight: '500',
  },
  saveButtonMain: {
    marginTop: SPACING.lg,
  },
});

export default EditProfileScreen;
