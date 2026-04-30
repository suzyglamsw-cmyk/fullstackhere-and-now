import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Home, Users, MessageCircle, User, Settings } from 'lucide-react-native';

import { useAuth } from '../context/AuthContext';
import { COLORS } from '../utils/constants';

// Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import OnboardingGenderScreen from '../screens/auth/OnboardingGenderScreen';
import ProfileSetupScreen from '../screens/auth/ProfileSetupScreen';

// Main Screens
import DiscoverScreen from '../screens/main/DiscoverScreen';
import VenuesScreen from '../screens/main/VenuesScreen';
import WhosHereScreen from '../screens/main/WhosHereScreen';
import ConnectionsScreen from '../screens/main/ConnectionsScreen';
import ChatScreen from '../screens/main/ChatScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import SettingsScreen from '../screens/main/SettingsScreen';
import UserProfileScreen from '../screens/main/UserProfileScreen';
import EditProfileScreen from '../screens/main/EditProfileScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Loading Screen
const LoadingScreen = () => (
  <View style={styles.loading}>
    <ActivityIndicator size="large" color={COLORS.primary} />
  </View>
);

// Auth Stack
const AuthStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: COLORS.background },
    }}
  >
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="Register" component={RegisterScreen} />
    <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    <Stack.Screen name="OnboardingGender" component={OnboardingGenderScreen} />
    <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
  </Stack.Navigator>
);

// Main Tab Navigator
const MainTabs = () => (
  <Tab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarStyle: styles.tabBar,
      tabBarActiveTintColor: COLORS.primary,
      tabBarInactiveTintColor: COLORS.textMuted,
      tabBarShowLabel: true,
      tabBarLabelStyle: styles.tabBarLabel,
    }}
  >
    <Tab.Screen
      name="Discover"
      component={DiscoverStack}
      options={{
        tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
      }}
    />
    <Tab.Screen
      name="Connections"
      component={ConnectionsStack}
      options={{
        tabBarIcon: ({ color, size }) => <Users color={color} size={size} />,
      }}
    />
    <Tab.Screen
      name="Messages"
      component={MessagesStack}
      options={{
        tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size} />,
      }}
    />
    <Tab.Screen
      name="Profile"
      component={ProfileStack}
      options={{
        tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
      }}
    />
  </Tab.Navigator>
);

// Discover Stack
const DiscoverStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: COLORS.background },
    }}
  >
    <Stack.Screen name="DiscoverMain" component={DiscoverScreen} />
    <Stack.Screen name="Venues" component={VenuesScreen} />
    <Stack.Screen name="WhosHere" component={WhosHereScreen} />
    <Stack.Screen name="UserProfile" component={UserProfileScreen} />
  </Stack.Navigator>
);

// Connections Stack
const ConnectionsStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: COLORS.background },
    }}
  >
    <Stack.Screen name="ConnectionsMain" component={ConnectionsScreen} />
    <Stack.Screen name="UserProfile" component={UserProfileScreen} />
  </Stack.Navigator>
);

// Messages Stack
const MessagesStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: COLORS.background },
    }}
  >
    <Stack.Screen name="MessagesMain" component={ConnectionsScreen} initialParams={{ tab: 'messages' }} />
    <Stack.Screen name="Chat" component={ChatScreen} />
    <Stack.Screen name="UserProfile" component={UserProfileScreen} />
  </Stack.Navigator>
);

// Profile Stack
const ProfileStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: COLORS.background },
    }}
  >
    <Stack.Screen name="ProfileMain" component={ProfileScreen} />
    <Stack.Screen name="EditProfile" component={EditProfileScreen} />
    <Stack.Screen name="Settings" component={SettingsScreen} />
  </Stack.Navigator>
);

// Main Navigator
const AppNavigator = () => {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  // Check if user needs to complete profile setup
  const needsOnboarding = isAuthenticated && user && !user.show_as;
  const needsProfileSetup = isAuthenticated && user && user.show_as && !user.profile_complete;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <Stack.Screen name="Auth" component={AuthStack} />
      ) : needsOnboarding ? (
        <Stack.Screen name="OnboardingGender" component={OnboardingGenderScreen} />
      ) : needsProfileSetup ? (
        <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
      ) : (
        <Stack.Screen name="Main" component={MainTabs} />
      )}
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  tabBar: {
    backgroundColor: COLORS.backgroundLight,
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    paddingBottom: 8,
    paddingTop: 8,
    height: 65,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
});

export default AppNavigator;
