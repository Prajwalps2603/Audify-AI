// Jest setup file for TeleCaller AI (Phase 15)

// Mock React Native NativeModules
import {NativeModules} from 'react-native';

NativeModules.RecordingScanner = {
  checkStoragePermission: jest.fn().mockResolvedValue(true),
  checkCallLogPermission: jest.fn().mockResolvedValue(true),
  scanRecordings: jest.fn().mockResolvedValue([]),
  getCommonRecordingFolders: jest.fn().mockResolvedValue([]),
};

NativeModules.BackgroundServiceModule = {
  startForegroundService: jest.fn().mockResolvedValue(true),
  stopForegroundService: jest.fn().mockResolvedValue(true),
  isServiceRunning: jest.fn().mockResolvedValue(false),
  isIgnoringBatteryOptimizations: jest.fn().mockResolvedValue(true),
  requestIgnoreBatteryOptimizations: jest.fn().mockResolvedValue(true),
  isWifiConnected: jest.fn().mockResolvedValue(true),
  isConnectedToWifi: jest.fn().mockResolvedValue(true),
};

// In-Memory Mock for AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => {
  let store: Record<string, string> = {};
  const mockStorage = {
    setItem: jest.fn(async (key: string, val: string) => {
      store[key] = String(val);
    }),
    getItem: jest.fn(async (key: string) => store[key] ?? null),
    removeItem: jest.fn(async (key: string) => {
      delete store[key];
    }),
    clear: jest.fn(async () => {
      store = {};
    }),
    getAllKeys: jest.fn(async () => Object.keys(store)),
    multiGet: jest.fn(async (keys: string[]) => keys.map(k => [k, store[k] ?? null])),
    multiSet: jest.fn(async (pairs: [string, string][]) => {
      pairs.forEach(([k, v]) => {
        store[k] = String(v);
      });
    }),
    multiRemove: jest.fn(async (keys: string[]) => {
      keys.forEach(k => delete store[k]);
    }),
  };

  return {
    __esModule: true,
    default: mockStorage,
    ...mockStorage,
  };
});

// Mock EncryptedStorage
jest.mock('react-native-encrypted-storage', () => {
  const store: Record<string, string> = {};
  return {
    setItem: jest.fn(async (key: string, value: string) => {
      store[key] = value;
    }),
    getItem: jest.fn(async (key: string) => {
      return store[key] ?? null;
    }),
    removeItem: jest.fn(async (key: string) => {
      delete store[key];
    }),
    clear: jest.fn(async () => {
      Object.keys(store).forEach(k => delete store[k]);
    }),
  };
});

// Mock Google Sign-In
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: jest.fn().mockResolvedValue({
      type: 'success',
      data: {
        user: {
          id: 'test_user_id',
          name: 'Test Telecaller',
          email: 'test@telecaller.ai',
          photo: null,
          familyName: 'Telecaller',
          givenName: 'Test',
        },
        serverAuthCode: 'auth_code_123',
      },
    }),
    signOut: jest.fn().mockResolvedValue(null),
    isSignedIn: jest.fn().mockResolvedValue(true),
    getCurrentUser: jest.fn().mockResolvedValue({
      user: {
        id: 'test_user_id',
        name: 'Test Telecaller',
        email: 'test@telecaller.ai',
      },
    }),
    getTokens: jest.fn().mockResolvedValue({
      accessToken: 'mock_access_token',
      idToken: 'mock_id_token',
    }),
    clearCachedAccessToken: jest.fn().mockResolvedValue(null),
  },
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  },
  isErrorWithCode: jest.fn(() => false),
  isSuccessResponse: jest.fn((res: any) => res && res.type === 'success'),
  isCancelledResponse: jest.fn(() => false),
  isNoSavedCredentialFoundResponse: jest.fn(() => false),
}));

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const inset = {top: 0, right: 0, bottom: 0, left: 0};
  const SafeAreaInsetsContext = React.createContext(inset);
  return {
    SafeAreaProvider: ({children}: any) => children,
    SafeAreaConsumer: ({children}: any) => children(inset),
    SafeAreaInsetsContext,
    SafeAreaView: ({children}: any) => children,
    useSafeAreaInsets: () => inset,
    useSafeAreaFrame: () => ({x: 0, y: 0, width: 390, height: 844}),
  };
});

// Mock react-native-screens
jest.mock('react-native-screens', () => {
  const React = require('react');
  const {View} = require('react-native');
  return {
    enableScreens: jest.fn(),
    compatibilityFlags: {
      usesNewAndroidHeaderHeightImplementation: false,
    },
    ScreenContainer: ({children}: any) => React.createElement(View, null, children),
    Screen: ({children}: any) => React.createElement(View, null, children),
    NativeScreen: ({children}: any) => React.createElement(View, null, children),
    NativeScreenContainer: ({children}: any) => React.createElement(View, null, children),
    ScreenStack: ({children}: any) => React.createElement(View, null, children),
    ScreenStackItem: ({children}: any) => React.createElement(View, null, children),
    ScreenStackHeaderConfig: ({children}: any) => React.createElement(View, null, children),
    ScreenStackHeaderSubview: ({children}: any) => React.createElement(View, null, children),
  };
});

// Mock react-native-linear-gradient
jest.mock('react-native-linear-gradient', () => 'LinearGradient');

// Mock react-native-vector-icons
jest.mock('react-native-vector-icons/MaterialIcons', () => 'Icon');
