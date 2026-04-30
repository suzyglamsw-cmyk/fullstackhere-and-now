import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { settingsAPI } from './api';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Register for push notifications
 * @returns {Promise<string|null>} Push token or null if failed
 */
export async function registerForPushNotificationsAsync() {
  let token = null;

  // Must be a physical device
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permissions if not granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permissions not granted');
    return null;
  }

  try {
    // Get Expo push token (works with FCM on Android)
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'here-and-now', // Must match app.json eas.projectId
    });
    token = tokenData.data;

    // Register token with backend
    await registerTokenWithBackend(token);

    console.log('Push token:', token);
  } catch (error) {
    console.log('Error getting push token:', error);
  }

  // Android specific channel setup
  if (Platform.OS === 'android') {
    await setupAndroidChannels();
  }

  return token;
}

/**
 * Setup Android notification channels
 */
async function setupAndroidChannels() {
  // Main channel for general notifications
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#a855f7',
  });

  // Messages channel
  await Notifications.setNotificationChannelAsync('messages', {
    name: 'Messages',
    description: 'New message notifications',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#a855f7',
  });

  // Connections channel (glances, reveals, icebreakers)
  await Notifications.setNotificationChannelAsync('connections', {
    name: 'Connections',
    description: 'Glances, reveals, and icebreakers',
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: '#ec4899',
  });

  // Venue channel
  await Notifications.setNotificationChannelAsync('venues', {
    name: 'Venue Activity',
    description: 'Updates about people at your venue',
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: '#22c55e',
  });
}

/**
 * Register push token with backend
 * @param {string} token Expo push token
 */
async function registerTokenWithBackend(token) {
  try {
    await settingsAPI.registerPush(token);
    console.log('Push token registered with backend');
  } catch (error) {
    console.log('Failed to register push token with backend:', error);
  }
}

/**
 * Add notification listeners
 * @param {Function} onNotificationReceived Called when notification received in foreground
 * @param {Function} onNotificationResponse Called when user taps notification
 * @returns {Object} Subscription objects for cleanup
 */
export function addNotificationListeners(onNotificationReceived, onNotificationResponse) {
  // Foreground notification listener
  const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
    console.log('Notification received:', notification);
    if (onNotificationReceived) {
      onNotificationReceived(notification);
    }
  });

  // User interaction listener
  const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    console.log('Notification response:', response);
    if (onNotificationResponse) {
      onNotificationResponse(response);
    }
  });

  return {
    receivedSubscription,
    responseSubscription,
  };
}

/**
 * Remove notification listeners
 * @param {Object} subscriptions Subscription objects from addNotificationListeners
 */
export function removeNotificationListeners(subscriptions) {
  if (subscriptions.receivedSubscription) {
    Notifications.removeNotificationSubscription(subscriptions.receivedSubscription);
  }
  if (subscriptions.responseSubscription) {
    Notifications.removeNotificationSubscription(subscriptions.responseSubscription);
  }
}

/**
 * Get notification navigation target based on notification data
 * @param {Object} notification The notification object
 * @returns {Object} Navigation params { screen, params }
 */
export function getNotificationNavigationTarget(notification) {
  const data = notification.request?.content?.data || {};

  switch (data.type) {
    case 'message':
      return {
        screen: 'Chat',
        params: { threadId: data.thread_id, otherUser: data.sender },
      };
    case 'glance':
    case 'reveal':
    case 'icebreaker':
      return {
        screen: 'UserProfile',
        params: { userId: data.from_user_id },
      };
    case 'chat_request':
      return {
        screen: 'Connections',
        params: { tab: 'requests' },
      };
    case 'venue_activity':
      return {
        screen: 'WhosHere',
        params: { venue: data.venue },
      };
    default:
      return { screen: 'DiscoverMain', params: {} };
  }
}

/**
 * Schedule a local notification (for testing)
 * @param {string} title Notification title
 * @param {string} body Notification body
 * @param {number} seconds Delay in seconds
 */
export async function scheduleLocalNotification(title, body, seconds = 1) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: {},
    },
    trigger: { seconds },
  });
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Get badge count
 */
export async function getBadgeCount() {
  return await Notifications.getBadgeCountAsync();
}

/**
 * Set badge count
 * @param {number} count Badge count
 */
export async function setBadgeCount(count) {
  await Notifications.setBadgeCountAsync(count);
}

export default {
  registerForPushNotificationsAsync,
  addNotificationListeners,
  removeNotificationListeners,
  getNotificationNavigationTarget,
  scheduleLocalNotification,
  cancelAllNotifications,
  getBadgeCount,
  setBadgeCount,
};
