import React, { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import { COLORS } from './src/utils/constants';
import {
  registerForPushNotificationsAsync,
  addNotificationListeners,
  removeNotificationListeners,
  getNotificationNavigationTarget,
} from './src/utils/pushNotifications';

// Main App wrapper with navigation reference
function AppContent() {
  const navigationRef = useRef(null);
  const notificationListener = useRef(null);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      // Register for push notifications when authenticated
      registerForPushNotificationsAsync();

      // Set up notification listeners
      const subscriptions = addNotificationListeners(
        // Foreground notification received
        (notification) => {
          console.log('Notification received in foreground:', notification.request.content.title);
        },
        // User tapped notification
        (response) => {
          const target = getNotificationNavigationTarget(response.notification);
          if (navigationRef.current && target.screen) {
            navigationRef.current.navigate(target.screen, target.params);
          }
        }
      );
      notificationListener.current = subscriptions;

      return () => {
        if (notificationListener.current) {
          removeNotificationListeners(notificationListener.current);
        }
      };
    }
  }, [isAuthenticated]);

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={{
        dark: true,
        colors: {
          primary: COLORS.primary,
          background: COLORS.background,
          card: COLORS.backgroundLight,
          text: COLORS.text,
          border: COLORS.border,
          notification: COLORS.accent,
        },
      }}
    >
      <StatusBar style="light" />
      <AppNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
