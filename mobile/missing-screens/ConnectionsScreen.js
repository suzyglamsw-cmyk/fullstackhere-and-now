import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  ScrollView,
  Modal,
  Animated,
  Dimensions,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  MessageCircle,
  Eye,
  Snowflake,
  MessageSquare,
  UserPlus,
  UserCheck,
  Users,
  Heart,
  ArrowUpRight,
  ArrowDownLeft,
  Trash2,
  Info,
  Archive,
  X,
  Check,
  Ban,
} from 'lucide-react-native';

import { useAuth } from '../src/context/AuthContext';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, API_URL } from '../src/utils/constants';
import api from '../src/utils/api';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Polite decline reasons for chat requests
const POLITE_DECLINE_REASONS = [
  { id: 'not_looking', emoji: '🙏', text: 'Not looking to chat right now' },
  { id: 'settling_in', emoji: '🏠', text: 'Just got here, settling in' },
  { id: 'with_friends', emoji: '👥', text: 'Here with friends tonight' },
  { id: 'pass', emoji: '✌️', text: 'Going to pass, thanks' },
];

// LIGHT blur for HereHub (not heavy)
const HEREHUB_BLUR_RADIUS = 5;

const ConnectionsScreen = ({ route, navigation }) => {
  const initialTab = route.params?.tab || 'messages';
  const { user } = useAuth();
  const [tab, setTab] = useState(initialTab);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Data states
  const [messageThreads, setMessageThreads] = useState([]);
  const [glances, setGlances] = useState({ incoming: [], outgoing: [] });
  const [icebreakers, setIcebreakers] = useState({ incoming: [], outgoing: [] });
  const [chatRequests, setChatRequests] = useState({ incoming: [], outgoing: [] });
  const [friendRequests, setFriendRequests] = useState({ incoming: [], outgoing: [] });
  const [friends, setFriends] = useState([]);
  const [connections, setConnections] = useState([]);

  // Action sheet state
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [actionSheetType, setActionSheetType] = useState(null); // 'glance', 'icebreaker', 'chat', 'request'
  const [actionLoading, setActionLoading] = useState(false);
  
  // Animation for action sheet
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    fetchAllData();
  }, []);

  useEffect(() => {
    if (actionSheetVisible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [actionSheetVisible]);

  const fetchAllData = async () => {
    try {
      const [
        threadsRes,
        glancesRes,
        icebreakersRes,
        chatRequestsRes,
        requestsRes,
        friendsRes,
        connectionsRes,
      ] = await Promise.all([
        api.get('/api/messages/threads'),
        api.get('/api/connections/glances'),
        api.get('/api/connections/icebreakers'),
        api.get('/api/connections/chat-requests'),
        api.get('/api/friends/requests'),
        api.get('/api/friends/list'),
        api.get('/api/connections'),
      ]);

      setMessageThreads(threadsRes.data || []);
      setGlances(glancesRes.data || { incoming: [], outgoing: [] });
      setIcebreakers(icebreakersRes.data || { incoming: [], outgoing: [] });
      setChatRequests(chatRequestsRes.data || { incoming: [], outgoing: [] });
      setFriendRequests(requestsRes.data || { incoming: [], outgoing: [] });
      setFriends(friendsRes.data || []);
      setConnections(connectionsRes.data || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAllData();
  }, []);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  // Use LIGHT blur for HereHub - only clear on reveal_state === 'both_revealed'
  const getPhotoUrl = (item) => {
    if (item.photos?.[0]) {
      // Always request blurred from server, we control blur locally
      return `${API_URL}/api/photos/serve/${item.photos[0]}`;
    }
    if (item.photo_url) {
      return `${API_URL}/api/photos/serve/${item.photo_url}`;
    }
    return null;
  };

  // Determine blur radius based on reveal state
  const getBlurRadius = (item) => {
    // Only clear (0) when both have revealed
    if (item.reveal_state === 'both_revealed') {
      return 0;
    }
    // HereHub uses LIGHT blur (not heavy)
    return HEREHUB_BLUR_RADIUS;
  };

  // Show action sheet for an item
  const openActionSheet = (item, type) => {
    setSelectedItem(item);
    setActionSheetType(type);
    setActionSheetVisible(true);
  };

  const closeActionSheet = () => {
    setActionSheetVisible(false);
    setTimeout(() => {
      setSelectedItem(null);
      setActionSheetType(null);
    }, 300);
  };

  // Action handlers
  const handleGlanceBack = async () => {
    if (!selectedItem) return;
    setActionLoading(true);
    try {
      await api.post('/api/glance', {
        to_user_id: selectedItem.user_id,
        venue_id: 'herehub',
      });
      closeActionSheet();
      fetchAllData();
    } catch (error) {
      console.error('Failed to glance back:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptIcebreaker = async () => {
    if (!selectedItem) return;
    setActionLoading(true);
    try {
      await api.post(`/api/icebreaker/${selectedItem.id}/accept`);
      closeActionSheet();
      fetchAllData();
    } catch (error) {
      console.error('Failed to accept icebreaker:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeclineIcebreaker = async () => {
    if (!selectedItem) return;
    setActionLoading(true);
    try {
      await api.post(`/api/icebreaker/${selectedItem.id}/decline`);
      closeActionSheet();
      fetchAllData();
    } catch (error) {
      console.error('Failed to decline icebreaker:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptChatRequest = async () => {
    if (!selectedItem) return;
    setActionLoading(true);
    try {
      await api.post(`/api/chat-request/${selectedItem.id}/accept`);
      closeActionSheet();
      navigation.navigate('Chat', { userId: selectedItem.user_id });
      fetchAllData();
    } catch (error) {
      console.error('Failed to accept chat request:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePoliteDecline = async (reasonId) => {
    if (!selectedItem) return;
    setActionLoading(true);
    try {
      await api.post(`/api/chat-request/${selectedItem.id}/decline`, {
        reason: reasonId,
      });
      closeActionSheet();
      fetchAllData();
    } catch (error) {
      console.error('Failed to decline chat request:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveFromView = async () => {
    if (!selectedItem) return;
    setActionLoading(true);
    try {
      const endpoint = actionSheetType === 'glance' 
        ? `/api/glance/${selectedItem.id}/dismiss`
        : actionSheetType === 'icebreaker'
        ? `/api/icebreaker/${selectedItem.id}/dismiss`
        : `/api/chat-request/${selectedItem.id}/dismiss`;
      await api.post(endpoint);
      closeActionSheet();
      fetchAllData();
    } catch (error) {
      console.error('Failed to remove:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBlockUser = async () => {
    if (!selectedItem) return;
    setActionLoading(true);
    try {
      await api.post('/api/users/block', { user_id: selectedItem.user_id });
      closeActionSheet();
      fetchAllData();
    } catch (error) {
      console.error('Failed to block user:', error);
    } finally {
      setActionLoading(false);
    }
  };

  // Counts for badges
  const totalUnread = messageThreads.reduce((sum, t) => sum + (t.unread_count || 0), 0);
  const totalGlances = (glances.incoming?.length || 0) + (glances.outgoing?.length || 0);
  const pendingIcebreakers = icebreakers.incoming?.filter(d => d.status === 'pending').length || 0;
  const pendingChatRequests = chatRequests.incoming?.filter(c => c.status === 'pending').length || 0;
  const totalRequests = (friendRequests.incoming?.length || 0) + (friendRequests.outgoing?.length || 0);

  const TabButton = ({ id, label, icon: Icon, badge }) => (
    <TouchableOpacity
      style={[styles.tabButton, tab === id && styles.tabButtonActive]}
      onPress={() => setTab(id)}
      data-testid={`tab-${id}`}
    >
      <Icon color={tab === id ? COLORS.text : COLORS.textSecondary} size={16} />
      <Text style={[styles.tabText, tab === id && styles.tabTextActive]}>{label}</Text>
      {badge > 0 && (
        <View style={[styles.badge, { backgroundColor: getBadgeColor(id) }]}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const getBadgeColor = (tabId) => {
    switch (tabId) {
      case 'messages': return COLORS.accent;
      case 'glances': return COLORS.primary;
      case 'icebreakers': return COLORS.info;
      case 'chats': return COLORS.accent;
      case 'requests': return COLORS.warning;
      case 'friends': return COLORS.success;
      default: return COLORS.primary;
    }
  };

  // Message thread row (no checkbox)
  const renderMessageThread = ({ item: thread }) => {
    const photoUrl = getPhotoUrl(thread);
    const blurRadius = getBlurRadius(thread);
    const genderColor = thread.show_as === 'male' ? COLORS.male : 
                       thread.show_as === 'female' ? COLORS.female : COLORS.text;

    return (
      <TouchableOpacity
        style={styles.itemRow}
        onPress={() => navigation.navigate('Chat', { userId: thread.user_id })}
        activeOpacity={0.7}
        data-testid={`message-thread-${thread.user_id}`}
      >
        <View style={styles.itemAvatar}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.avatarImage} blurRadius={blurRadius} />
          ) : (
            <View style={[styles.avatarImage, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>{thread.display_name?.charAt(0) || '?'}</Text>
            </View>
          )}
          {thread.unread_count > 0 && <View style={styles.unreadDot} />}
        </View>
        <View style={styles.itemContent}>
          <View style={styles.itemHeader}>
            <Text style={[styles.itemName, { color: genderColor }, thread.unread_count > 0 && styles.itemNameBold]} numberOfLines={1}>
              {thread.display_name}
            </Text>
            <Text style={styles.itemTime}>{formatDate(thread.last_message_at)}</Text>
          </View>
          <Text style={[styles.itemSubtext, thread.unread_count > 0 && styles.itemSubtextUnread]} numberOfLines={1}>
            {thread.is_from_me && <Text style={styles.youPrefix}>You: </Text>}
            {thread.last_message || 'No messages yet'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // Glance row - tap to open action sheet (no checkbox)
  const renderGlanceItem = ({ item: glance, isOutgoing }) => {
    const photoUrl = getPhotoUrl(glance);
    const blurRadius = getBlurRadius(glance);
    const genderColor = glance.show_as === 'male' ? COLORS.male : 
                       glance.show_as === 'female' ? COLORS.female : COLORS.text;

    return (
      <TouchableOpacity
        style={styles.itemRow}
        onPress={() => !isOutgoing && openActionSheet(glance, 'glance')}
        onLongPress={() => navigation.navigate('UserProfile', { userId: glance.user_id })}
        activeOpacity={0.7}
        data-testid={`glance-item-${glance.id}`}
      >
        <View style={styles.itemAvatar}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.avatarImageSquare} blurRadius={blurRadius} />
          ) : (
            <View style={[styles.avatarImageSquare, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>{glance.display_name?.charAt(0) || '?'}</Text>
            </View>
          )}
        </View>
        <View style={styles.itemContent}>
          <Text style={[styles.itemName, { color: genderColor }]} numberOfLines={1}>
            {glance.display_name}
          </Text>
          <Text style={styles.itemSubtext}>
            {isOutgoing ? 'You glanced' : 'Glanced at you'} · {formatDate(glance.created_at)}
          </Text>
        </View>
        {!isOutgoing && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => openActionSheet(glance, 'glance')}
            data-testid={`glance-back-btn-${glance.id}`}
          >
            <Eye color={COLORS.text} size={14} />
            <Text style={styles.actionButtonText}>Glance Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => {
            setSelectedItem(glance);
            setActionSheetType('glance');
            handleRemoveFromView();
          }}
          data-testid={`delete-glance-${glance.id}`}
        >
          <Trash2 color={COLORS.textMuted} size={18} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  // Icebreaker row - tap to open action sheet (no checkbox)
  const renderIcebreakerItem = ({ item: icebreaker, isOutgoing }) => {
    const photoUrl = getPhotoUrl(icebreaker);
    const blurRadius = getBlurRadius(icebreaker);
    const genderColor = icebreaker.show_as === 'male' ? COLORS.male : 
                       icebreaker.show_as === 'female' ? COLORS.female : COLORS.text;
    const isPending = icebreaker.status === 'pending';

    return (
      <TouchableOpacity
        style={styles.itemRow}
        onPress={() => !isOutgoing && isPending && openActionSheet(icebreaker, 'icebreaker')}
        onLongPress={() => navigation.navigate('UserProfile', { userId: icebreaker.user_id })}
        activeOpacity={0.7}
        data-testid={`icebreaker-item-${icebreaker.id}`}
      >
        <View style={styles.itemAvatar}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.avatarImageSquare} blurRadius={blurRadius} />
          ) : (
            <View style={[styles.avatarImageSquare, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>{icebreaker.display_name?.charAt(0) || '?'}</Text>
            </View>
          )}
        </View>
        <View style={styles.itemContent}>
          <Text style={[styles.itemName, { color: genderColor }]} numberOfLines={1}>
            {icebreaker.display_name}
          </Text>
          <View style={styles.icebreakerMsgRow}>
            <Snowflake color={COLORS.info} size={12} />
            <Text style={styles.icebreakerMsg} numberOfLines={1}>
              "{icebreaker.message || 'Icebreaker'}"
            </Text>
          </View>
          <Text style={styles.itemSubtext}>
            {isOutgoing ? 'You sent' : 'Icebreaker'} · {formatDate(icebreaker.created_at)}
          </Text>
        </View>
        {!isOutgoing && isPending && (
          <TouchableOpacity
            style={styles.actionButtonOutline}
            onPress={() => openActionSheet(icebreaker, 'icebreaker')}
            data-testid={`respond-icebreaker-${icebreaker.id}`}
          >
            <Text style={styles.actionButtonOutlineText}>Respond</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => {
            setSelectedItem(icebreaker);
            setActionSheetType('icebreaker');
            handleRemoveFromView();
          }}
          data-testid={`delete-icebreaker-${icebreaker.id}`}
        >
          <Trash2 color={COLORS.textMuted} size={18} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  // Chat request row - tap to open action sheet (no checkbox)
  const renderChatRequestItem = ({ item: request, isOutgoing }) => {
    const photoUrl = getPhotoUrl(request);
    const blurRadius = getBlurRadius(request);
    const genderColor = request.show_as === 'male' ? COLORS.male : 
                       request.show_as === 'female' ? COLORS.female : COLORS.text;
    const isPending = request.status === 'pending';

    return (
      <TouchableOpacity
        style={styles.itemRow}
        onPress={() => !isOutgoing && isPending && openActionSheet(request, 'chat')}
        onLongPress={() => navigation.navigate('UserProfile', { userId: request.user_id })}
        activeOpacity={0.7}
        data-testid={`chat-request-item-${request.id}`}
      >
        <View style={styles.itemAvatar}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.avatarImageSquare} blurRadius={blurRadius} />
          ) : (
            <View style={[styles.avatarImageSquare, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>{request.display_name?.charAt(0) || '?'}</Text>
            </View>
          )}
        </View>
        <View style={styles.itemContent}>
          <Text style={[styles.itemName, { color: genderColor }]} numberOfLines={1}>
            {request.display_name}
          </Text>
          <View style={styles.chatRequestMsgRow}>
            <MessageSquare color={COLORS.textSecondary} size={12} />
            <Text style={styles.itemSubtext}>Wants to chat</Text>
          </View>
          <Text style={styles.itemSubtext}>· {formatDate(request.created_at)}</Text>
        </View>
        {!isOutgoing && isPending && (
          <TouchableOpacity
            style={styles.actionButtonPurple}
            onPress={() => openActionSheet(request, 'chat')}
            data-testid={`options-chat-request-${request.id}`}
          >
            <Text style={styles.actionButtonText}>Options</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => {
            setSelectedItem(request);
            setActionSheetType('chat');
            handleRemoveFromView();
          }}
          data-testid={`delete-chat-request-${request.id}`}
        >
          <Trash2 color={COLORS.textMuted} size={18} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  // Connection card (no checkbox)
  const renderConnection = ({ item: connection }) => {
    const photoUrl = getPhotoUrl(connection);
    const blurRadius = getBlurRadius(connection);
    const genderColor = connection.show_as === 'male' ? COLORS.male : 
                       connection.show_as === 'female' ? COLORS.female : COLORS.text;

    return (
      <TouchableOpacity
        style={styles.connectionCard}
        onPress={() => navigation.navigate('UserProfile', { userId: connection.user_id })}
        activeOpacity={0.7}
        data-testid={`connection-card-${connection.user_id}`}
      >
        <View style={styles.connectionPhoto}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.connectionImage} blurRadius={blurRadius} />
          ) : (
            <View style={[styles.connectionImage, styles.avatarPlaceholder]}>
              <Text style={styles.connectionInitial}>{connection.display_name?.charAt(0) || '?'}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.connectionName, { color: genderColor }]} numberOfLines={1}>
          {connection.display_name}
        </Text>
        <View style={styles.connectionBadge}>
          <Heart color={COLORS.accent} size={12} fill={COLORS.accent} />
          <Text style={styles.connectionBadgeText}>Mutual</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = (title, subtitle, IconComponent) => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <IconComponent color={COLORS.textMuted} size={40} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
    </View>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      );
    }

    switch (tab) {
      case 'messages':
        const activeThreads = messageThreads.filter(t => !t.is_quiet);
        const quietThreads = messageThreads.filter(t => t.is_quiet);
        
        if (activeThreads.length === 0 && quietThreads.length === 0) {
          return renderEmptyState('No messages yet', 'Start a conversation after a mutual glance or icebreaker', MessageCircle);
        }
        
        return (
          <ScrollView 
            style={styles.listContainer}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          >
            {activeThreads.length > 0 && activeThreads.map((thread) => (
              <View key={thread.user_id}>{renderMessageThread({ item: thread })}</View>
            ))}
            
            {/* Quiet Section */}
            <View style={styles.sectionHeader}>
              <Archive color={COLORS.textMuted} size={16} />
              <Text style={styles.sectionTitle}>Quiet for now</Text>
            </View>
            {quietThreads.length > 0 ? (
              quietThreads.map((thread) => (
                <View key={thread.user_id}>{renderMessageThread({ item: thread })}</View>
              ))
            ) : (
              <Text style={styles.emptySection}>(no threads yet)</Text>
            )}
          </ScrollView>
        );

      case 'glances':
        if (totalGlances === 0) {
          return renderEmptyState('No glances yet', 'Glance at someone in a venue to see them here', Eye);
        }
        
        return (
          <ScrollView 
            style={styles.listContainer}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          >
            {glances.incoming?.length > 0 && (
              <>
                <View style={styles.subsectionHeader}>
                  <ArrowDownLeft color={COLORS.textSecondary} size={16} />
                  <Text style={styles.subsectionTitle}>Received ({glances.incoming.length})</Text>
                </View>
                {glances.incoming.map((glance) => (
                  <View key={glance.id}>{renderGlanceItem({ item: glance, isOutgoing: false })}</View>
                ))}
              </>
            )}
            
            {glances.outgoing?.length > 0 && (
              <>
                <View style={styles.subsectionHeader}>
                  <ArrowUpRight color={COLORS.textSecondary} size={16} />
                  <Text style={styles.subsectionTitle}>Sent ({glances.outgoing.length})</Text>
                </View>
                {glances.outgoing.map((glance) => (
                  <View key={glance.id}>{renderGlanceItem({ item: glance, isOutgoing: true })}</View>
                ))}
              </>
            )}
          </ScrollView>
        );

      case 'icebreakers':
        const totalIcebreakers = (icebreakers.incoming?.length || 0) + (icebreakers.outgoing?.length || 0);
        if (totalIcebreakers === 0) {
          return renderEmptyState('No icebreakers yet', 'Send an icebreaker to start a conversation', Snowflake);
        }
        
        return (
          <ScrollView 
            style={styles.listContainer}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          >
            {icebreakers.incoming?.length > 0 && (
              <>
                <View style={styles.subsectionHeader}>
                  <ArrowDownLeft color={COLORS.textSecondary} size={16} />
                  <Text style={styles.subsectionTitle}>Received ({icebreakers.incoming.length})</Text>
                </View>
                {icebreakers.incoming.map((ib) => (
                  <View key={ib.id}>{renderIcebreakerItem({ item: ib, isOutgoing: false })}</View>
                ))}
              </>
            )}
            
            {icebreakers.outgoing?.length > 0 && (
              <>
                <View style={styles.subsectionHeader}>
                  <ArrowUpRight color={COLORS.textSecondary} size={16} />
                  <Text style={styles.subsectionTitle}>Sent ({icebreakers.outgoing.length})</Text>
                </View>
                {icebreakers.outgoing.map((ib) => (
                  <View key={ib.id}>{renderIcebreakerItem({ item: ib, isOutgoing: true })}</View>
                ))}
              </>
            )}
          </ScrollView>
        );

      case 'chats':
        const totalChats = (chatRequests.incoming?.length || 0) + (chatRequests.outgoing?.length || 0);
        if (totalChats === 0) {
          return renderEmptyState('No chat requests', 'Send a chat request to connect with someone', MessageSquare);
        }
        
        return (
          <ScrollView 
            style={styles.listContainer}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          >
            {chatRequests.incoming?.length > 0 && (
              <>
                <View style={styles.subsectionHeader}>
                  <ArrowDownLeft color={COLORS.textSecondary} size={16} />
                  <Text style={styles.subsectionTitle}>Received ({chatRequests.incoming.length})</Text>
                </View>
                {chatRequests.incoming.map((req) => (
                  <View key={req.id}>{renderChatRequestItem({ item: req, isOutgoing: false })}</View>
                ))}
              </>
            )}
            
            {chatRequests.outgoing?.length > 0 && (
              <>
                <View style={styles.subsectionHeader}>
                  <ArrowUpRight color={COLORS.textSecondary} size={16} />
                  <Text style={styles.subsectionTitle}>Sent ({chatRequests.outgoing.length})</Text>
                </View>
                {chatRequests.outgoing.map((req) => (
                  <View key={req.id}>{renderChatRequestItem({ item: req, isOutgoing: true })}</View>
                ))}
              </>
            )}
          </ScrollView>
        );

      case 'requests':
        if (totalRequests === 0) {
          return renderEmptyState('No friend requests', 'Friend requests will appear here', UserPlus);
        }
        
        return (
          <ScrollView 
            style={styles.listContainer}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          >
            {friendRequests.incoming?.length > 0 && (
              <>
                <View style={styles.subsectionHeader}>
                  <ArrowDownLeft color={COLORS.textSecondary} size={16} />
                  <Text style={styles.subsectionTitle}>Received ({friendRequests.incoming.length})</Text>
                </View>
                {friendRequests.incoming.map((req) => (
                  <View key={req.id}>{renderGlanceItem({ item: req, isOutgoing: false })}</View>
                ))}
              </>
            )}
            
            {friendRequests.outgoing?.length > 0 && (
              <>
                <View style={styles.subsectionHeader}>
                  <ArrowUpRight color={COLORS.textSecondary} size={16} />
                  <Text style={styles.subsectionTitle}>Sent ({friendRequests.outgoing.length})</Text>
                </View>
                {friendRequests.outgoing.map((req) => (
                  <View key={req.id}>{renderGlanceItem({ item: req, isOutgoing: true })}</View>
                ))}
              </>
            )}
          </ScrollView>
        );

      case 'friends':
        if (friends.length === 0) {
          return renderEmptyState('No friends yet', 'Add friends after making mutual connections', UserCheck);
        }
        
        return (
          <FlatList
            data={friends}
            renderItem={({ item }) => renderGlanceItem({ item, isOutgoing: false })}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          />
        );

      case 'connections':
        if (connections.length === 0) {
          return renderEmptyState('No mutual connections', 'Mutual connections appear when interest is returned', Users);
        }
        
        return (
          <FlatList
            data={connections}
            renderItem={renderConnection}
            keyExtractor={(item) => item.user_id || item.id}
            numColumns={2}
            contentContainerStyle={styles.connectionsGrid}
            columnWrapperStyle={styles.connectionsRow}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          />
        );

      default:
        return null;
    }
  };

  // Render action sheet content based on type
  const renderActionSheetContent = () => {
    if (!selectedItem) return null;

    const photoUrl = getPhotoUrl(selectedItem);
    const blurRadius = getBlurRadius(selectedItem);

    if (actionSheetType === 'glance') {
      return (
        <>
          <View style={styles.sheetUserInfo}>
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={styles.sheetAvatar} blurRadius={blurRadius} />
            ) : (
              <View style={[styles.sheetAvatar, styles.avatarPlaceholder]}>
                <Text style={styles.sheetAvatarText}>{selectedItem.display_name?.charAt(0) || '?'}</Text>
              </View>
            )}
            <Text style={styles.sheetUserName}>{selectedItem.display_name}</Text>
          </View>

          <TouchableOpacity
            style={styles.sheetAcceptButton}
            onPress={handleGlanceBack}
            disabled={actionLoading}
            data-testid="action-glance-back"
          >
            {actionLoading ? (
              <ActivityIndicator color={COLORS.text} />
            ) : (
              <>
                <Eye color={COLORS.text} size={18} />
                <Text style={styles.sheetAcceptText}>Glance Back</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.sheetDeclineButton} onPress={handleRemoveFromView} data-testid="action-remove-glance">
            <X color={COLORS.textSecondary} size={18} />
            <Text style={styles.sheetDeclineText}>Remove from view</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sheetBlockButton} onPress={handleBlockUser} data-testid="action-block-user">
            <Ban color={COLORS.error} size={18} />
            <Text style={styles.sheetBlockText}>Block User</Text>
          </TouchableOpacity>
        </>
      );
    }

    if (actionSheetType === 'icebreaker') {
      return (
        <>
          <View style={styles.sheetUserInfo}>
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={styles.sheetAvatar} blurRadius={blurRadius} />
            ) : (
              <View style={[styles.sheetAvatar, styles.avatarPlaceholder]}>
                <Text style={styles.sheetAvatarText}>{selectedItem.display_name?.charAt(0) || '?'}</Text>
              </View>
            )}
            <Text style={styles.sheetUserName}>{selectedItem.display_name}</Text>
            <View style={styles.sheetIcebreakerBadge}>
              <Snowflake color={COLORS.info} size={14} />
              <Text style={styles.sheetIcebreakerText}>"{selectedItem.message || 'Fancy a chat?'}"</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.sheetAcceptButton}
            onPress={handleAcceptIcebreaker}
            disabled={actionLoading}
            data-testid="action-accept-icebreaker"
          >
            {actionLoading ? (
              <ActivityIndicator color={COLORS.text} />
            ) : (
              <>
                <Check color={COLORS.text} size={18} />
                <Text style={styles.sheetAcceptText}>Accept</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.sheetDeclineButton} onPress={handleDeclineIcebreaker} data-testid="action-decline-icebreaker">
            <X color={COLORS.textSecondary} size={18} />
            <Text style={styles.sheetDeclineText}>Decline</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sheetBlockButton} onPress={handleBlockUser} data-testid="action-block-user">
            <Ban color={COLORS.error} size={18} />
            <Text style={styles.sheetBlockText}>Block User</Text>
          </TouchableOpacity>
        </>
      );
    }

    if (actionSheetType === 'chat') {
      return (
        <>
          <View style={styles.sheetUserInfo}>
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={styles.sheetAvatar} blurRadius={blurRadius} />
            ) : (
              <View style={[styles.sheetAvatar, styles.avatarPlaceholder]}>
                <Text style={styles.sheetAvatarText}>{selectedItem.display_name?.charAt(0) || '?'}</Text>
              </View>
            )}
            <Text style={styles.sheetUserName}>{selectedItem.display_name}</Text>
            <View style={styles.sheetChatBadge}>
              <MessageSquare color={COLORS.textSecondary} size={14} />
              <Text style={styles.sheetChatBadgeText}>Wants to chat with you</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.sheetAcceptButton}
            onPress={handleAcceptChatRequest}
            disabled={actionLoading}
            data-testid="action-accept-chat"
          >
            {actionLoading ? (
              <ActivityIndicator color={COLORS.text} />
            ) : (
              <>
                <Check color={COLORS.text} size={18} />
                <Text style={styles.sheetAcceptText}>Accept & Start Chat</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.politeDeclineHeader}>POLITELY DECLINE</Text>
          {POLITE_DECLINE_REASONS.map((reason) => (
            <TouchableOpacity
              key={reason.id}
              style={styles.politeDeclineRow}
              onPress={() => handlePoliteDecline(reason.id)}
              data-testid={`polite-decline-${reason.id}`}
            >
              <Text style={styles.politeDeclineEmoji}>{reason.emoji}</Text>
              <Text style={styles.politeDeclineText}>{reason.text}</Text>
            </TouchableOpacity>
          ))}

          <View style={styles.sheetDivider} />

          <TouchableOpacity style={styles.sheetRemoveRow} onPress={handleRemoveFromView} data-testid="action-remove-chat">
            <Trash2 color={COLORS.textMuted} size={16} />
            <Text style={styles.sheetRemoveText}>Remove from view</Text>
          </TouchableOpacity>
        </>
      );
    }

    return null;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>HereHub</Text>
          <TouchableOpacity 
            style={styles.infoButton}
            onPress={() => navigation.navigate('HowItWorks')}
            data-testid="how-it-works-btn"
          >
            <Info color={COLORS.textSecondary} size={20} />
          </TouchableOpacity>
        </View>
        <Text style={styles.headerSubtitle}>What's happening now.</Text>
      </View>

      {/* Tabs - NO Select All bar */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles.tabsContainer}
        contentContainerStyle={styles.tabsContent}
      >
        <TabButton id="messages" label="Messages" icon={MessageCircle} badge={totalUnread} />
        <TabButton id="glances" label="Glances" icon={Eye} badge={totalGlances} />
        <TabButton id="icebreakers" label="Icebreakers" icon={Snowflake} badge={pendingIcebreakers} />
        <TabButton id="chats" label="Chat Requests" icon={MessageSquare} badge={pendingChatRequests} />
        <TabButton id="requests" label="Requests" icon={UserPlus} badge={totalRequests} />
        <TabButton id="friends" label="Friends" icon={UserCheck} badge={friends.length} />
        <TabButton id="connections" label="Mutual" icon={Users} badge={0} />
      </ScrollView>

      {/* Content - NO checkboxes, NO Select All */}
      <View style={styles.content}>
        {renderContent()}
      </View>

      {/* Action Sheet Modal - Grounded black themed box */}
      <Modal
        visible={actionSheetVisible}
        transparent
        animationType="none"
        onRequestClose={closeActionSheet}
      >
        <TouchableOpacity 
          style={styles.sheetOverlay} 
          activeOpacity={1} 
          onPress={closeActionSheet}
        >
          <Animated.View
            style={[
              styles.sheetContainer,
              { transform: [{ translateY: slideAnim }] },
            ]}
          >
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
              {/* Drag handle */}
              <View style={styles.sheetHandle} />
              
              {renderActionSheetContent()}
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
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
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.primary,
  },
  headerSubtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    marginTop: SPACING.xs,
  },
  infoButton: {
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  tabsContainer: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabsContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: 'transparent',
    marginRight: SPACING.xs,
    gap: SPACING.xs,
  },
  tabButtonActive: {
    backgroundColor: COLORS.card,
  },
  tabText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: COLORS.text,
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
    marginLeft: SPACING.xs,
  },
  badgeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    color: COLORS.text,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  subsectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
  },
  subsectionTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  emptySection: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    paddingLeft: SPACING.sm,
  },
  
  // Item rows (no checkbox)
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  itemAvatar: {
    position: 'relative',
    marginRight: SPACING.md,
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarImageSquare: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
  },
  avatarPlaceholder: {
    backgroundColor: COLORS.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  unreadDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.accent,
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  itemContent: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  itemName: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    flex: 1,
  },
  itemNameBold: {
    fontWeight: '700',
  },
  itemTime: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
  },
  itemSubtext: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
  },
  itemSubtextUnread: {
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  youPrefix: {
    color: COLORS.textMuted,
  },
  icebreakerMsgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  icebreakerMsg: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.info,
    flex: 1,
  },
  chatRequestMsgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  
  // Action buttons on rows
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    gap: 4,
    marginRight: SPACING.sm,
  },
  actionButtonText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    color: COLORS.text,
  },
  actionButtonOutline: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.textSecondary,
    marginRight: SPACING.sm,
  },
  actionButtonOutlineText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  actionButtonPurple: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
    marginRight: SPACING.sm,
  },
  deleteButton: {
    padding: SPACING.sm,
  },

  // Connections grid
  connectionsGrid: {
    padding: SPACING.md,
  },
  connectionsRow: {
    justifyContent: 'space-between',
  },
  connectionCard: {
    width: '48%',
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.md,
    padding: SPACING.sm,
    alignItems: 'center',
  },
  connectionPhoto: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  connectionImage: {
    width: '100%',
    height: '100%',
  },
  connectionInitial: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  connectionName: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  connectionBadgeText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.accent,
  },
  
  // Empty states
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  emptySubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },

  // Action Sheet styles - Grounded black themed
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#1a1a2e', // Dark blue-black theme
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    paddingHorizontal: SPACING.lg,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.textMuted,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
  },
  sheetUserInfo: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  sheetAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: SPACING.md,
    borderWidth: 2,
    borderColor: COLORS.info,
  },
  sheetAvatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  sheetUserName: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  sheetIcebreakerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.info}20`,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: `${COLORS.info}40`,
    gap: SPACING.xs,
  },
  sheetIcebreakerText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.info,
  },
  sheetChatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.xs,
  },
  sheetChatBadgeText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  sheetAcceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981', // Green
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  sheetAcceptText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  sheetDeclineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  sheetDeclineText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  sheetBlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  sheetBlockText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.error,
  },
  
  // Polite decline section for chat requests
  politeDeclineHeader: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
    letterSpacing: 1,
  },
  politeDeclineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    gap: SPACING.md,
  },
  politeDeclineEmoji: {
    fontSize: 20,
  },
  politeDeclineText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  sheetDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.md,
  },
  sheetRemoveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  sheetRemoveText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textMuted,
  },
});

export default ConnectionsScreen;
