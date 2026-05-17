import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
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
  VolumeX,
  Volume2,
  Archive,
} from 'lucide-react-native';

import { useAuth } from '../src/context/AuthContext';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, API_URL } from '../src/utils/constants';
import api from '../src/utils/api';

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

  useEffect(() => {
    fetchAllData();
  }, []);

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

  const getPhotoUrl = (item) => {
    if (item.photos?.[0]) {
      return `${API_URL}/api/photos/serve/${item.photos[0]}?blur=true`;
    }
    if (item.photo_url) {
      return `${API_URL}/api/photos/serve/${item.photo_url}?blur=true`;
    }
    return null;
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

  const renderMessageThread = ({ item: thread }) => {
    const photoUrl = getPhotoUrl(thread);
    const genderColor = thread.show_as === 'male' ? COLORS.male : 
                       thread.show_as === 'female' ? COLORS.female : COLORS.text;

    return (
      <TouchableOpacity
        style={styles.threadRow}
        onPress={() => navigation.navigate('Chat', { userId: thread.user_id })}
        activeOpacity={0.7}
      >
        <View style={styles.threadAvatar}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.avatarImage} blurRadius={5} />
          ) : (
            <View style={[styles.avatarImage, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>{thread.display_name?.charAt(0) || '?'}</Text>
            </View>
          )}
          {thread.unread_count > 0 && <View style={styles.unreadDot} />}
        </View>
        <View style={styles.threadContent}>
          <View style={styles.threadHeader}>
            <Text style={[styles.threadName, { color: genderColor }, thread.unread_count > 0 && styles.threadNameBold]} numberOfLines={1}>
              {thread.display_name}
            </Text>
            <Text style={styles.threadTime}>{formatDate(thread.last_message_at)}</Text>
          </View>
          <Text style={[styles.threadMessage, thread.unread_count > 0 && styles.threadMessageUnread]} numberOfLines={1}>
            {thread.is_from_me && <Text style={styles.youPrefix}>You: </Text>}
            {thread.last_message || 'No messages yet'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderGlance = ({ item: glance, isOutgoing }) => {
    const photoUrl = getPhotoUrl(glance);
    const genderColor = glance.show_as === 'male' ? COLORS.male : 
                       glance.show_as === 'female' ? COLORS.female : COLORS.text;

    return (
      <TouchableOpacity
        style={styles.glanceRow}
        onPress={() => navigation.navigate('UserProfile', { userId: glance.user_id })}
        activeOpacity={0.7}
      >
        <View style={styles.glanceAvatar}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.avatarImageSmall} blurRadius={8} />
          ) : (
            <View style={[styles.avatarImageSmall, styles.avatarPlaceholder]}>
              <Text style={styles.avatarTextSmall}>{glance.display_name?.charAt(0) || '?'}</Text>
            </View>
          )}
          {glance.is_connection_accepted && (
            <View style={styles.matchIndicator}>
              <Heart color={COLORS.text} size={8} fill={COLORS.text} />
            </View>
          )}
        </View>
        <View style={styles.glanceContent}>
          <Text style={[styles.glanceName, { color: genderColor }]} numberOfLines={1}>
            {glance.display_name}
          </Text>
          <Text style={styles.glanceSubtext}>
            {isOutgoing ? 'You glanced' : 'Glanced at you'} · {formatDate(glance.created_at)}
          </Text>
        </View>
        {!isOutgoing && !glance.is_connection_accepted && (
          <TouchableOpacity style={styles.glanceBackButton}>
            <Eye color={COLORS.text} size={14} />
            <Text style={styles.glanceBackText}>Glance Back</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const renderConnection = ({ item: connection }) => {
    const photoUrl = getPhotoUrl(connection);
    const genderColor = connection.show_as === 'male' ? COLORS.male : 
                       connection.show_as === 'female' ? COLORS.female : COLORS.text;

    return (
      <TouchableOpacity
        style={styles.connectionCard}
        onPress={() => navigation.navigate('UserProfile', { userId: connection.user_id })}
        activeOpacity={0.7}
      >
        <View style={styles.connectionPhoto}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.connectionImage} blurRadius={5} />
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

  const renderEmptyState = (title, subtitle, icon: Icon) => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Icon color={COLORS.textMuted} size={40} />
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
          <ScrollView style={styles.listContainer}>
            {activeThreads.length > 0 && (
              <FlatList
                data={activeThreads}
                renderItem={renderMessageThread}
                keyExtractor={(item) => item.user_id}
                scrollEnabled={false}
              />
            )}
            
            {/* Quiet Section */}
            <View style={styles.sectionHeader}>
              <Archive color={COLORS.textMuted} size={16} />
              <Text style={styles.sectionTitle}>Quiet for now</Text>
            </View>
            {quietThreads.length > 0 ? (
              <FlatList
                data={quietThreads}
                renderItem={renderMessageThread}
                keyExtractor={(item) => item.user_id}
                scrollEnabled={false}
              />
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
          <ScrollView style={styles.listContainer}>
            {glances.incoming?.length > 0 && (
              <>
                <View style={styles.subsectionHeader}>
                  <ArrowDownLeft color={COLORS.textSecondary} size={16} />
                  <Text style={styles.subsectionTitle}>Received ({glances.incoming.length})</Text>
                </View>
                {glances.incoming.map((glance) => (
                  <View key={glance.id}>{renderGlance({ item: glance, isOutgoing: false })}</View>
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
                  <View key={glance.id}>{renderGlance({ item: glance, isOutgoing: true })}</View>
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
          <ScrollView style={styles.listContainer}>
            {icebreakers.incoming?.length > 0 && (
              <>
                <View style={styles.subsectionHeader}>
                  <ArrowDownLeft color={COLORS.textSecondary} size={16} />
                  <Text style={styles.subsectionTitle}>Received ({icebreakers.incoming.length})</Text>
                </View>
                {icebreakers.incoming.map((ib) => (
                  <View key={ib.id}>{renderGlance({ item: ib, isOutgoing: false })}</View>
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
                  <View key={ib.id}>{renderGlance({ item: ib, isOutgoing: true })}</View>
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
          <ScrollView style={styles.listContainer}>
            {chatRequests.incoming?.length > 0 && (
              <>
                <View style={styles.subsectionHeader}>
                  <ArrowDownLeft color={COLORS.textSecondary} size={16} />
                  <Text style={styles.subsectionTitle}>Received ({chatRequests.incoming.length})</Text>
                </View>
                {chatRequests.incoming.map((req) => (
                  <View key={req.id}>{renderGlance({ item: req, isOutgoing: false })}</View>
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
                  <View key={req.id}>{renderGlance({ item: req, isOutgoing: true })}</View>
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
          <ScrollView style={styles.listContainer}>
            {friendRequests.incoming?.length > 0 && (
              <>
                <View style={styles.subsectionHeader}>
                  <ArrowDownLeft color={COLORS.textSecondary} size={16} />
                  <Text style={styles.subsectionTitle}>Received ({friendRequests.incoming.length})</Text>
                </View>
                {friendRequests.incoming.map((req) => (
                  <View key={req.id}>{renderGlance({ item: req, isOutgoing: false })}</View>
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
                  <View key={req.id}>{renderGlance({ item: req, isOutgoing: true })}</View>
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
            renderItem={({ item }) => renderGlance({ item, isOutgoing: false })}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
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
          />
        );

      default:
        return null;
    }
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
          >
            <Info color={COLORS.textSecondary} size={20} />
          </TouchableOpacity>
        </View>
        <Text style={styles.headerSubtitle}>What's happening now.</Text>
      </View>

      {/* Tabs */}
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

      {/* Content */}
      <View style={styles.content}>
        {renderContent()}
      </View>
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
  threadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  threadAvatar: {
    position: 'relative',
    marginRight: SPACING.md,
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarImageSmall: {
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
  avatarTextSmall: {
    fontSize: FONT_SIZES.md,
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
  threadContent: {
    flex: 1,
  },
  threadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  threadName: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    flex: 1,
  },
  threadNameBold: {
    fontWeight: '700',
  },
  threadTime: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
  },
  threadMessage: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
  },
  threadMessageUnread: {
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  youPrefix: {
    color: COLORS.textMuted,
  },
  glanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  glanceAvatar: {
    position: 'relative',
    marginRight: SPACING.md,
  },
  matchIndicator: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  glanceContent: {
    flex: 1,
  },
  glanceName: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  glanceSubtext: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  glanceBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
    gap: 4,
  },
  glanceBackText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    color: COLORS.text,
  },
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
});

export default ConnectionsScreen;
