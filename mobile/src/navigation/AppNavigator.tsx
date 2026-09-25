// TeleCaller AI — Navigation Configuration
// Auth-aware navigation with consent gating and premium icon tab bar.

import React, {useState, useEffect} from 'react';
import {View, Text, Image, StyleSheet, ActivityIndicator, AppState} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {SafeAreaProvider, useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import LoginScreen from '../screens/Login/LoginScreen';
import HomeScreen from '../screens/Home/HomeScreen';
import CallsScreen from '../screens/Calls/CallsScreen';
import CallDetailsScreen from '../screens/CallDetails/CallDetailsScreen';
import TranscriptScreen from '../screens/Transcript/TranscriptScreen';
import SettingsScreen from '../screens/Settings/SettingsScreen';
import OnboardingConsentScreen from '../screens/Onboarding/OnboardingConsentScreen';
import ProfileScreen from '../screens/Profile/ProfileScreen';
import AdminSettingsScreen from '../screens/Admin/AdminSettingsScreen';
import ModelTierDetailsScreen from '../screens/Settings/ModelTierDetailsScreen';

import {AuthProvider, useAuth} from '../context/AuthContext';
import {RecordingProvider} from '../context/RecordingContext';
import {Colors, FontSize, BorderRadius, Shadow, Spacing} from '../theme';
import {RootStackParamList, MainTabParamList, CallStackParamList} from '../types';

import {ToastContainer} from '../components/Toast';
import {AppModalContainer} from '../components/AppModal';
import {AppLockService} from '../services/security/AppLockService';
import {AppLockModal} from '../components/AppLockModal';

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
    <Image
      source={require('../assets/logo_main.png')}
      style={styles.initLogoImage}
      resizeMode="contain"
    />
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
// Tab Bar Icon (Vector Icons)
// ─────────────────────────────────────────────────────────────
interface TabIconProps {
  iconName: string;
  focused: boolean;
}

const TabIcon: React.FC<TabIconProps> = ({iconName, focused}) => (
  <View style={[styles.tabIconBadge, focused && styles.tabIconBadgeActive]}>
    <Icon
      name={iconName}
      size={22}
      color={focused ? Colors.primary : Colors.textTertiary}
    />
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
          tabBarIcon: ({focused}) => <TabIcon iconName="home" focused={focused} />,
        }}
      />
      <BottomTab.Screen
        name="Calls"
        component={CallsStack}
        options={{
          tabBarLabel: 'Calls',
          tabBarIcon: ({focused}) => <TabIcon iconName="phone" focused={focused} />,
        }}
      />
      <BottomTab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({focused}) => <TabIcon iconName="cog" focused={focused} />,
        }}
      />
    </BottomTab.Navigator>
  );
};

// ─────────────────────────────────────────────────────────────
// Consent Screen Wrapper (passes acceptConsent callback)
// ─────────────────────────────────────────────────────────────
const ConsentScreenWrapper: React.FC = () => {
  const {acceptConsent} = useAuth();
  return <OnboardingConsentScreen onAccept={acceptConsent} />;
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
  const needsConsent =
    authState.status === 'SIGNED_IN' && authState.needsConsent === true;

  // Determine initial route
  let initialRouteName: keyof RootStackParamList;
  if (!isSignedIn) {
    initialRouteName = 'Login';
  } else if (needsConsent) {
    initialRouteName = 'OnboardingConsent';
  } else {
    initialRouteName = 'Main';
  }

  return (
    <RootStack.Navigator
      screenOptions={{headerShown: false}}
      initialRouteName={initialRouteName}>
      {!isSignedIn ? (
        <RootStack.Screen name="Login" component={LoginScreen} />
      ) : needsConsent ? (
        <RootStack.Screen
          name="OnboardingConsent"
          component={ConsentScreenWrapper}
        />
      ) : (
        <>
          <RootStack.Screen name="Main" component={MainTabs} />
          <RootStack.Screen
            name="Profile"
            component={ProfileScreen}
            options={{animation: 'slide_from_right'}}
          />
          <RootStack.Screen
            name="AdminSettings"
            component={AdminSettingsScreen}
            options={{animation: 'slide_from_right'}}
          />
          <RootStack.Screen
            name="ModelTierDetails"
            component={ModelTierDetailsScreen}
            options={{animation: 'slide_from_right'}}
          />
        </>
      )}
    </RootStack.Navigator>
  );
};

// ─────────────────────────────────────────────────────────────
// App Navigator (root)
// ─────────────────────────────────────────────────────────────
const AppNavigator: React.FC = () => {
  const [isAppLocked, setIsAppLocked] = useState(AppLockService.getIsLocked());

  useEffect(() => {
    const unsub = AppLockService.subscribe(locked => {
      setIsAppLocked(locked);
    });

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'background') {
        if (AppLockService.isLockEnabled()) {
          AppLockService.lock();
        }
      }
    });

    return () => {
      unsub();
      subscription.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RecordingProvider>
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
          <ToastContainer />
          <AppModalContainer />
          <AppLockModal
            visible={isAppLocked}
            mode="unlock"
            onSuccess={() => setIsAppLocked(false)}
          />
        </RecordingProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
};

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
  initLogoImage: {
    width: 220,
    height: 70,
    marginBottom: Spacing.md,
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
  tabLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    marginTop: 2,
  },
});

export default AppNavigator;
