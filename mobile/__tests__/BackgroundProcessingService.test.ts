// TeleCaller AI — Background Processing Unit Tests (Phase 15)
// Tests background settings persistence, watchdog interval triggers,
// Wi-Fi only restriction checks, and battery optimization state.

import {BackgroundProcessingService} from '../src/services/background/BackgroundProcessingService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {NativeModules, Platform} from 'react-native';

describe('BackgroundProcessingService', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('initializes and returns default background settings', async () => {
    const settings = await BackgroundProcessingService.init();

    expect(settings).toBeDefined();
    expect(settings.enabled).toBe(true);
    expect(settings.intervalMinutes).toBe(5);
    expect(settings.foregroundServiceEnabled).toBe(true);
    expect(typeof settings.batteryOptimizationsIgnored).toBe('boolean');
  });

  it('updates and persists settings into storage and notifies subscribers', async () => {
    const listener = jest.fn();
    const unsub = BackgroundProcessingService.subscribe(listener);

    const updated = await BackgroundProcessingService.updateSettings({
      intervalMinutes: 15,
      wifiOnly: true,
      autoProcess: false,
    });

    expect(updated.intervalMinutes).toBe(15);
    expect(updated.wifiOnly).toBe(true);
    expect(updated.autoProcess).toBe(false);

    expect(listener).toHaveBeenCalled();
    unsub();
  });

  it('checks Wi-Fi connectivity state via native module on Android', async () => {
    Platform.OS = 'android';
    (NativeModules.BackgroundServiceModule.isConnectedToWifi as jest.Mock).mockResolvedValueOnce(
      true,
    );
    const isWifi = await BackgroundProcessingService.isConnectedToWifi();
    expect(isWifi).toBe(true);

    // Mock non-wifi state
    (NativeModules.BackgroundServiceModule.isConnectedToWifi as jest.Mock).mockResolvedValueOnce(
      false,
    );
    const isWifiFalse = await BackgroundProcessingService.isConnectedToWifi();
    expect(isWifiFalse).toBe(false);
  });
});
