import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Send,
  Lock,
  Unlock,
  Shield,
  Check,
  CheckCheck,
  MoreVertical,
  VolumeX,
  Volume2,
  Trash2,
} from 'lucide-react-native';

import { useAuth } from '../src/context/AuthContext';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, API_URL } from '../src/utils/constants';
import api from '../src/utils/api';

const ChatScreen = ({ route, navigation }) => {
  const { userId } = route.params;
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isBothRevealed, setIsBothRevealed] = useState(false);
  const flatListRef = useRef(null);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [userId]);

  const fetchMessages = async () => {
    try {
      const response = await api.get(`/api/messages/${userId}`);
      const data = response.data;

      if (data.messages !== undefined) {
        setMessages(data.messages);
        setIsUnlocked(data.is_unlocked);
        setIsBlocked(data.is_blocked || false);
        setIsBothRevealed(data.reveal_state === 'both_revealed');
        if (data.other_user) {
          setOtherUser(data.other_user);
        }
      } else {
        setMessages(data);
        setIsUnlocked(true);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || isBlocked) return;

    setSending(true);
    try {
      await api.post('/api/messages', {
        to_user_id: userId,
        content: newMessage.trim(),
      });
      setNewMessage('');
      fetchMessages();
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPhotoUrl = () => {
    if (otherUser?.photos?.[0]) {
      const blur = isBothRevealed ? 'false' : 'true';
      return `${API_URL}/api/photos/serve/${otherUser.photos[0]}?blur=${blur}`;
    }
    return null;
  };

  const renderMessage = ({ item: msg, index }) => {
    const isMe = msg.from_user_id === user?.id;

    return (
      <View style={[styles.messageContainer, isMe ? styles.messageRight : styles.messageLeft]}>
        <View style={[styles.messageBubble, isMe ? styles.bubbleMe : styles.bubbleOther, msg.is_masked && styles.bubbleMasked]}>
          {msg.is_masked && (
            <View style={styles.maskedLabel}>
              <Lock color={COLORS.warning} size={12} />
              <Text style={styles.maskedText}>Preview only</Text>
            </View>
          )}
          <Text style={styles.messageText}>{msg.content}</Text>
          <View style={styles.messageFooter}>
            <Text style={styles.messageTime}>{formatTime(msg.created_at)}</Text>
            {isMe && (
              msg.is_read ? (
                <CheckCheck color={COLORS.info} size={14} />
              ) : (
                <Check color={COLORS.textMuted} size={14} />
              )
            )}
          </View>
        </View>
      </View>
    );
  };

  const photoUrl = getPhotoUrl();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft color={COLORS.textSecondary} size={24} />
        </TouchableOpacity>

        {otherUser ? (
          <TouchableOpacity
            style={styles.userInfo}
            onPress={() => !isBlocked && navigation.navigate('UserProfile', { userId })}
            disabled={isBlocked}
          >
            <View style={styles.avatarContainer}>
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.avatar} blurRadius={isBothRevealed ? 0 : 5} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarText}>{otherUser.display_name?.charAt(0) || '?'}</Text>
                </View>
              )}
            </View>
            <View style={styles.userTextContainer}>
              <Text style={styles.userName}>{otherUser.display_name}</Text>
              {isBlocked ? (
                <View style={styles.statusRow}>
                  <Shield color={COLORS.textSecondary} size={12} />
                  <Text style={styles.statusText}>Not available</Text>
                </View>
              ) : isUnlocked ? (
                <View style={styles.statusRow}>
                  <Unlock color={COLORS.success} size={12} />
                  <Text style={[styles.statusText, { color: COLORS.success }]}>Connected</Text>
                </View>
              ) : (
                <View style={styles.statusRow}>
                  <Lock color={COLORS.warning} size={12} />
                  <Text style={[styles.statusText, { color: COLORS.warning }]}>Chat locked</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.userInfo}>
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <ActivityIndicator size="small" color={COLORS.textMuted} />
            </View>
            <View style={styles.userTextContainer}>
              <View style={styles.loadingBar} />
              <View style={[styles.loadingBar, { width: 60 }]} />
            </View>
          </View>
        )}

        <TouchableOpacity style={styles.menuButton}>
          <MoreVertical color={COLORS.textSecondary} size={20} />
        </TouchableOpacity>
      </View>

      {/* Blocked Banner */}
      {isBlocked && (
        <View style={styles.blockedBanner}>
          <Shield color={COLORS.textSecondary} size={16} />
          <Text style={styles.blockedText}>This user is not available.</Text>
        </View>
      )}

      {/* Messages */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No messages yet. Say hello!</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          inverted={false}
        />
      )}

      {/* Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.inputContainer}>
          <TextInput
            style={[styles.input, isBlocked && styles.inputDisabled]}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder={
              isBlocked
                ? "You can't message this user."
                : isUnlocked
                  ? 'Type a message...'
                  : 'Send a message request...'
            }
            placeholderTextColor={COLORS.textMuted}
            editable={!isBlocked}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendButton, (!newMessage.trim() || isBlocked) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={sending || !newMessage.trim() || isBlocked}
          >
            {sending ? (
              <ActivityIndicator size="small" color={COLORS.text} />
            ) : (
              <Send color={COLORS.text} size={20} />
            )}
          </TouchableOpacity>
        </View>

        {!isUnlocked && !isBlocked && (
          <View style={styles.lockedHint}>
            <Shield color={COLORS.warning} size={12} />
            <Text style={styles.lockedHintText}>Contact details are hidden until chat is unlocked</Text>
          </View>
        )}
      </KeyboardAvoidingView>
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
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: SPACING.sm,
    marginRight: SPACING.sm,
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: SPACING.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  avatarPlaceholder: {
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  userTextContainer: {
    flex: 1,
  },
  userName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  statusText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  loadingBar: {
    height: 14,
    width: 100,
    backgroundColor: COLORS.card,
    borderRadius: 4,
    marginBottom: 4,
  },
  menuButton: {
    padding: SPACING.sm,
  },
  blockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  blockedText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  messagesList: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.lg,
  },
  messageContainer: {
    marginBottom: SPACING.sm,
  },
  messageRight: {
    alignItems: 'flex-end',
  },
  messageLeft: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
  },
  bubbleMe: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: COLORS.card,
    borderBottomLeftRadius: 4,
  },
  bubbleMasked: {
    backgroundColor: `${COLORS.warning}20`,
    borderWidth: 1,
    borderColor: `${COLORS.warning}40`,
  },
  maskedLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  maskedText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.warning,
  },
  messageText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    lineHeight: 20,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  messageTime: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING.md,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  inputDisabled: {
    opacity: 0.5,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  lockedHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: SPACING.sm,
    gap: 4,
  },
  lockedHintText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.warning,
  },
});

export default ChatScreen;
