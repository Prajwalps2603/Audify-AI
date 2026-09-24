// TeleCaller AI — Navigation Configuration (Phase 2)
// Auth-aware navigation: checks authentication state and routes accordingly.

import React from 'react';
import {View, Text, StyleSheet, ActivityIndicator} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {SafeAreaProvider, useSafeAreaInsets} from 'react-native-safe-area-context';

import LoginScreen from '../screens/Login/LoginScreen';
import HomeScreen from '../screens/Home/HomeScreen';
import CallsScreen from '../screens/Calls/CallsScreen';
import CallDetailsScreen from '../screens/CallDetails/CallDetailsScreen';
import TranscriptScreen from '../screens/Transcript/TranscriptScreen';
import SettingsScreen from '../screens/Settings/SettingsScreen';

import {AuthProvider, useAuth} from '../context/AuthContext';
import {RecordingProvider} from '../context/RecordingContext';
import {Colors, FontSize, BorderRadius, Shadow, Spacing} from '../theme';
import {RootStackParamList, MainTabParamList, CallStackParamList} from '../types';

// ─────────────────────────────────────────────────────────────
// Navigators
// ─────────────────────────────────────────────────────────────
const RootStack = createNativeStackNavigator<RootStackParamList>();
const BottomTab = createBottomTabNavigator<MainTabParamList>();
const CallStack = createNativeStackNavigator<CallStackParamList>();

// ─────────────────────────────────────────────────────────────
// Loading Screen (shown while checking session)
// ─────────────────────────────────────────────────────────────
const InitializingScreen: React.FC = () => (
  <View style={styles.initContainer}>
    <View style={styles.initLogoMark}>
      <Text style={styles.initLogoText}>TC</Text>
    </View>
    <Text style={styles.initTitle}>TeleCaller AI</Text>
    <Text style={styles.initSubtitle}>Record • Transcribe • Organize</Text>
    <ActivityIndicator
      size="small"
      color={Colors.primary}
      style={styles.initSpinner}
    />
    <Text style={styles.initLoading}>Restoring session...</Text>
  </View>
);

// ─────────────────────────────────────────────────────────────
// Tab Bar Icon
// ─────────────────────────────────────────────────────────────
interface TabIconProps {
  emoji: string;
  focused: boolean;
}

const TabIcon: React.FC<TabIconProps> = ({emoji, focused}) => (
  <View style={[styles.tabIconBadge, focused && styles.tabIconBadgeActive]}>
    <Text style={[styles.tabEmoji, {opacity: focused ? 1 : 0.65}]}>{emoji}</Text>
  </View>
);

// ─────────────────────────────────────────────────────────────
// Calls Stack
// ─────────────────────────────────────────────────────────────
const CallsStack: React.FC = () => (
  <CallStack.Navigator screenOptions={{headerShown: false}}>
    <CallStack.Screen name="CallsList" component={CallsScreen} />
    <CallStack.Screen name="CallDetails" component={CallDetailsScreen} />
    <CallStack.Screen name="Transcript" component={TranscriptScreen} />
  </CallStack.Navigator>
);

// ─────────────────────────────────────────────────────────────
// Main Bottom Tabs
// ─────────────────────────────────────────────────────────────
const MainTabs: React.FC = () => {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 10);

  return (
    <BottomTab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textTertiary,
        tabBarStyle: [
          styles.tabBar,
          {
            height: 60 + bottomInset,
            paddingBottom: bottomInset,
          },
        ],
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
      }}>
      <BottomTab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({focused}) => <TabIcon emoji="🏠" focused={focused} />,
        }}
      />
      <BottomTab.Screen
        name="Calls"
        component={CallsStack}
        options={{
          tabBarLabel: 'Calls',
          tabBarIcon: ({focused}) => <TabIcon emoji="📞" focused={focused} />,
        }}
      />
      <BottomTab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({focused}) => <TabIcon emoji="⚙️" focused={focused} />,
        }}
      />
    </BottomTab.Navigator>
  );
};

// ─────────────────────────────────────────────────────────────
// Auth-aware Root Navigator
// ─────────────────────────────────────────────────────────────
const RootNavigator: React.FC = () => {
  const {authState} = useAuth();

  // Show loading while restoring session
  if (authState.status === 'INITIALIZING') {
    return <InitializingScreen />;
  }

  const isSignedIn = authState.status === 'SIGNED_IN';

  return (
    <RootStack.Navigator
      screenOptions={{headerShown: false}}
      initialRouteName={isSignedIn ? 'Main' : 'Login'}>
      {isSignedIn ? (
        <RootStack.Screen name="Main" component={MainTabs} />
      ) : (
        <RootStack.Screen name="Login" component={LoginScreen} />
      )}
    </RootStack.Navigator>
  );
};

// ─────────────────────────────────────────────────────────────
// App Navigator (root)
// ─────────────────────────────────────────────────────────────
const AppNavigator: React.FC = () => (
  <SafeAreaProvider>
    <AuthProvider>
      <RecordingProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </RecordingProvider>
    </AuthProvider>
  </SafeAreaProvider>
);

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Initializing screen
  initContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  initLogoMark: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    ...(Shadow.lg as object),
  },
  initLogoText: {
    color: Colors.textInverse,
    fontSize: FontSize.xl,
    fontWeight: '800',
    letterSpacing: 1,
  },
  initTitle: {
    fontSize: FontSize['2xl'],
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: Spacing.xs,
  },
  initSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    letterSpacing: 1.5,
    marginBottom: Spacing['2xl'],
  },
  initSpinner: {
    marginBottom: Spacing.sm,
  },
  initLoading: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
  },

  // Tab bar
  tabBar: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 6,
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: -3},
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  tabIconBadge: {
    width: 44,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconBadgeActive: {
    backgroundColor: Colors.surfaceSecondary,
  },
  tabEmoji: {
    fontSize: 20,
  },
  tabLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    marginTop: 2,
  },
});

export default AppNavigator;
