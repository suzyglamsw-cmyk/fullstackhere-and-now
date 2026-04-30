import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eye, Heart, MessageCircle, Snowflake, ChevronRight } from 'lucide-react-native';

import { useAuth } from '../../context/AuthContext';
import { connectionsAPI, messagesAPI } from '../../utils/api';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, API_URL } from '../../utils/constants';

const ConnectionsScreen = ({ route, navigation }) => {
  const initialTab = route.params?.tab || 'glances';
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [data, setData] = useState({
    glances: [],
    reveals: [],
    icebreakers: [],
    messages: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      const [glancesRes, revealsRes, icebreakersRes, messagesRes] = await Promise.all([
        connectionsAPI.getGlances().catch(() => ({ data: [] })),
        connectionsAPI.getReveals().catch(() => ({ data: [] })),
        connectionsAPI.getIcebreakers().catch(() => ({ data: [] })),
        messagesAPI.getThreads().catch(() => ({ data: [] })),
      ]);

      setData({
        glances: glancesRes.data || [],
        reveals: revealsRes.data || [],
        icebreakers: icebreakersRes.data || [],
        messages: messagesRes.data || [],
      });
    } catch (error) {
      console.log('Fetch error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAllData();
  }, []);

  const getNameColor = (showAs) => {
    if (showAs === 'female') return COLORS.female;
    if (showAs === 'male') return COLORS.male;
    return COLORS.rainbow;
  };

  const tabs = [
    { key: 'glances', label: 'Glances', icon: Eye, count: data.glances.length },
    { key: 'reveals', label: 'Reveals', icon: Heart, count: data.reveals.length },
    { key: 'icebreakers', label: 'Ice', icon: Snowflake, count: data.icebreakers.length },
    { key: 'messages', label: 'Messages', icon: MessageCircle, count: data.messages.length },
  ];

  const ConnectionItem = ({ item, type }) => {
    const photoUrl = item.avatar_url 
      ? (item.avatar_url.startsWith('http') ? item.avatar_url : `${API_URL}${item.avatar_url}`)
      : null;
    const displayName = item.display_name || item.first_name || 'Unknown';
    const nameColor = getNameColor(item.show_as);

    const handlePress = () => {
      if (type === 'messages') {
        navigation.navigate('Chat', { threadId: item.thread_id, otherUser: item });
      } else {
        navigation.navigate('UserProfile', { userId: item.id || item.user_id, user: item });
      }
    };

    return (
      <TouchableOpacity
        style={styles.connectionItem}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        {photoUrl ? (
          <Image
            source={{ uri: photoUrl }}
            style={styles.avatar}
            blurRadius={item.is_revealed ? 0 : 10}
          />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarText}>{displayName.charAt(0)}</Text>
          </View>
        )}

        <View style={styles.connectionInfo}>
          <Text style={[styles.connectionName, { color: nameColor }]}>
            {displayName}{item.age ? `, ${item.age}` : ''}
          </Text>
          {type === 'icebreakers' && item.message && (
            <Text style={styles.connectionSubtext} numberOfLines={1}>
              {item.message}
            </Text>
          )}
          {type === 'messages' && item.last_message && (
            <Text style={styles.connectionSubtext} numberOfLines={1}>
              {item.last_message}
            </Text>
          )}
          {item.timestamp && (
            <Text style={styles.connectionTime}>
              {new Date(item.timestamp).toLocaleDateString()}
            </Text>
          )}
        </View>

        <ChevronRight color={COLORS.textMuted} size={20} />
      </TouchableOpacity>
    );
  };

  const currentData = data[activeTab] || [];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Connections</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <tab.icon
              color={activeTab === tab.key ? COLORS.primary : COLORS.textMuted}
              size={18}
            />
            {tab.count > 0 && (
              <View style={[
                styles.tabBadge,
                activeTab === tab.key && styles.tabBadgeActive
              ]}>
                <Text style={styles.tabBadgeText}>{tab.count}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {currentData.length === 0 ? (
          <View style={styles.emptyState}>
            {tabs.find(t => t.key === activeTab)?.icon && (
              React.createElement(tabs.find(t => t.key === activeTab).icon, {
                color: COLORS.textMuted,
                size: 48,
              })
            )}
            <Text style={styles.emptyTitle}>
              No {activeTab} yet
            </Text>
            <Text style={styles.emptySubtitle}>
              Start discovering people nearby!
            </Text>
          </View>
        ) : (
          <View style={styles.connectionsList}>
            {currentData.map((item, index) => (
              <ConnectionItem
                key={item.id || item.thread_id || index}
                item={item}
                type={activeTab}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  title: {
    fontSize: FONT_SIZES.xxxl,
    fontWeight: '700',
    color: COLORS.text,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.card,
    position: 'relative',
  },
  tabActive: {
    backgroundColor: `${COLORS.primary}20`,
  },
  tabBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBadgeActive: {
    backgroundColor: COLORS.primary,
  },
  tabBadgeText: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: SPACING.lg,
  },
  connectionsList: {
    gap: SPACING.sm,
  },
  connectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: SPACING.md,
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
  connectionInfo: {
    flex: 1,
  },
  connectionName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  connectionSubtext: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  connectionTime: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  emptySubtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
});

export default ConnectionsScreen;
