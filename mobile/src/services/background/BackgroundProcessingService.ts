// TeleCaller AI — Background Processing & Automation Service (Phase 12)
// Coordinates background monitoring, periodic scan watchdogs,
// Android Foreground Service execution, and automatic pipeline triggers.

import {NativeModules, Platform, AppState, AppStateStatus} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {BackgroundSettings, BackgroundSyncProgress} from '../../types/background';
import {RecordingScannerService} from '../scanner/RecordingScannerService';
import {PipelineService} from '../pipeline/PipelineService';
import {DiscoveredRecording} from '../../types/recordings';

const BACKGROUND_SETTINGS_KEY = 'telecaller_background_settings';

const {BackgroundServiceModule} = NativeModules;

const DEFAULT_SETTINGS: BackgroundSettings = {
  enabled: true,
  intervalMinutes: 5,
  wifiOnly: false,
  autoProcess: true,
  autoUpload: true,
  autoTranscribe: true,
  foregroundServiceEnabled: true,
  lastSyncTimestamp: null,
  lastSyncStatus: 'idle',
  batteryOptimizationsIgnored: false,
};

type BackgroundListener = (settings: BackgroundSettings) => void;
type ProgressListener = (progress: BackgroundSyncProgress) => void;

export class BackgroundProcessingService {
  private static settings: BackgroundSettings = {...DEFAULT_SETTINGS};
  private static isInitialized = false;
  private static isRunningSync = false;
  private static timerId: any = null;
  private static listeners: Set<BackgroundListener> = new Set();
  private static progressListeners: Set<ProgressListener> = new Set();

  /**
   * Initialize background processing service.
   */
  static async init(): Promise<BackgroundSettings> {
    if (this.isInitialized) return this.settings;

    try {
      const stored = await AsyncStorage.getItem(BACKGROUND_SETTINGS_KEY);
      if (stored) {
        this.settings = {...DEFAULT_SETTINGS, ...JSON.parse(stored)};
      } else {
        this.settings = {...DEFAULT_SETTINGS};
        await AsyncStorage.setItem(
          BACKGROUND_SETTINGS_KEY,
          JSON.stringify(this.settings),
        );
      }

      // Check battery optimization exemption on Android
      if (Platform.OS === 'android' && BackgroundServiceModule?.isIgnoringBatteryOptimizations) {
        try {
          const isIgnored = await BackgroundServiceModule.isIgnoringBatteryOptimizations();
          this.settings.batteryOptimizationsIgnored = Boolean(isIgnored);
        } catch {}
      }

      // Listen for app state changes (background <-> active)
      AppState.addEventListener('change', this.handleAppStateChange);

      // Start periodic timer watchdog if enabled
      if (this.settings.enabled) {
        this.startPeriodicWatchdog();
        if (this.settings.foregroundServiceEnabled) {
          await this.startForegroundService();
        }
        // Perform initial check
        this.checkAndProcessNewRecordings().catch(() => {});
      }

      this.isInitialized = true;
    } catch (err) {
      console.warn('BackgroundProcessingService init failed:', err);
    }

    return this.settings;
  }

  /**
   * Subscribe to settings updates.
   */
  static subscribe(listener: BackgroundListener): () => void {
    this.listeners.add(listener);
    listener(this.settings);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Subscribe to real-time background sync progress.
   */
  static subscribeProgress(listener: ProgressListener): () => void {
    this.progressListeners.add(listener);
    return () => {
      this.progressListeners.delete(listener);
    };
  }

  private static notifyListeners(): void {
    this.listeners.forEach(fn => {
      try {
        fn({...this.settings});
      } catch {}
    });
  }

  private static notifyProgress(progress: BackgroundSyncProgress): void {
    this.progressListeners.forEach(fn => {
      try {
        fn(progress);
      } catch {}
    });
  }

  /**
   * Get current background settings.
   */
  static getSettings(): BackgroundSettings {
    return {...this.settings};
  }

  /**
   * Update and persist background settings.
   */
  static async updateSettings(
    update: Partial<BackgroundSettings>,
  ): Promise<BackgroundSettings> {
    const prevEnabled = this.settings.enabled;
    const prevForeground = this.settings.foregroundServiceEnabled;
    const prevInterval = this.settings.intervalMinutes;

    this.settings = {...this.settings, ...update};
    await AsyncStorage.setItem(
      BACKGROUND_SETTINGS_KEY,
      JSON.stringify(this.settings),
    );
    this.notifyListeners();

    // Adjust timer and foreground service if enabled state or interval changed
    if (this.settings.enabled !== prevEnabled || this.settings.intervalMinutes !== prevInterval) {
      if (this.settings.enabled) {
        this.startPeriodicWatchdog();
      } else {
        this.stopPeriodicWatchdog();
      }
    }

    if (
      this.settings.foregroundServiceEnabled !== prevForeground ||
      this.settings.enabled !== prevEnabled
    ) {
      if (this.settings.enabled && this.settings.foregroundServiceEnabled) {
        await this.startForegroundService();
      } else {
        await this.stopForegroundService();
      }
    }

    return this.settings;
  }

  /**
   * Check if device is connected to Wi-Fi.
   */
  static async isConnectedToWifi(): Promise<boolean> {
    if (Platform.OS === 'android' && BackgroundServiceModule?.isConnectedToWifi) {
      try {
        return await BackgroundServiceModule.isConnectedToWifi();
      } catch {
        return false;
      }
    }
    return true;
  }

  /**
   * Start native Android Foreground Service.
   */
  static async startForegroundService(): Promise<void> {
    if (Platform.OS === 'android' && BackgroundServiceModule?.startForegroundService) {
      try {
        await BackgroundServiceModule.startForegroundService(
          'TeleCaller AI Background Monitor',
          'Actively monitoring call recordings & auto-processing in background',
        );
      } catch (err) {
        console.warn('Failed to start native foreground service:', err);
      }
    }
  }

  /**
   * Stop native Android Foreground Service.
   */
  static async stopForegroundService(): Promise<void> {
    if (Platform.OS === 'android' && BackgroundServiceModule?.stopForegroundService) {
      try {
        await BackgroundServiceModule.stopForegroundService();
      } catch (err) {
        console.warn('Failed to stop native foreground service:', err);
      }
    }
  }

  /**
   * Request battery optimization exemption (Doze mode whitelist).
   */
  static async requestIgnoreBatteryOptimizations(): Promise<boolean> {
    if (Platform.OS === 'android' && BackgroundServiceModule?.requestIgnoreBatteryOptimizations) {
      try {
        const res = await BackgroundServiceModule.requestIgnoreBatteryOptimizations();
        this.settings.batteryOptimizationsIgnored = true;
        this.notifyListeners();
        return Boolean(res);
      } catch {
        return false;
      }
    }
    return true;
  }

  /**
   * Start periodic timer watchdog.
   */
  private static startPeriodicWatchdog(): void {
    this.stopPeriodicWatchdog();
    const intervalMs = Math.max(1, this.settings.intervalMinutes) * 60 * 1000;
    this.timerId = setInterval(() => {
      this.checkAndProcessNewRecordings().catch(() => {});
    }, intervalMs);
  }

  /**
   * Stop periodic timer watchdog.
   */
  private static stopPeriodicWatchdog(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  /**
   * Handle app state changes.
   */
  private static handleAppStateChange = (nextState: AppStateStatus): void => {
    if (nextState === 'active') {
      // When user brings app to foreground, check for any recordings created while away
      BackgroundProcessingService.checkAndProcessNewRecordings().catch(() => {});
    }
  };

  /**
   * Scan for new recordings and execute the pipeline automatically if configured.
   */
  static async checkAndProcessNewRecordings(force = false): Promise<{
    discovered: number;
    processed: number;
    failed: number;
  }> {
    if (this.isRunningSync) {
      return {discovered: 0, processed: 0, failed: 0};
    }

    if (!force && !this.settings.enabled) {
      return {discovered: 0, processed: 0, failed: 0};
    }

    // Check Wi-Fi constraint
    if (this.settings.wifiOnly) {
      const isWifi = await this.isConnectedToWifi();
      if (!isWifi) {
        this.notifyProgress({
          status: 'idle',
          message: 'Paused (Waiting for Wi-Fi connection)',
          totalCalls: 0,
          processedCalls: 0,
        });
        return {discovered: 0, processed: 0, failed: 0};
      }
    }

    this.isRunningSync = true;
    this.settings.lastSyncStatus = 'running';
    this.notifyListeners();

    this.notifyProgress({
      status: 'scanning',
      message: 'Scanning storage for new call recordings...',
      totalCalls: 0,
      processedCalls: 0,
    });

    try {
      // 1. Scan device recordings
      let scanned: DiscoveredRecording[] = [];
      try {
        scanned = await RecordingScannerService.scanRecordings();
      } catch {
        scanned = [];
      }
      const existingJobs = await PipelineService.getJobs();

      // 2. Identify pending recordings
      const pendingRecordings = scanned.filter((rec: DiscoveredRecording) => {
        const job = existingJobs[rec.id];
        return !job || (job.stage !== 'COMPLETED' && job.stage !== 'FAILED');
      });

      let processedCount = 0;
      let failedCount = 0;

      if (this.settings.autoProcess && pendingRecordings.length > 0) {
        this.notifyProgress({
          status: 'processing',
          message: `Processing ${pendingRecordings.length} pending call(s)...`,
          totalCalls: pendingRecordings.length,
          processedCalls: 0,
        });

        for (let i = 0; i < pendingRecordings.length; i++) {
          const item = pendingRecordings[i];
          try {
            const job = await PipelineService.processCall(item);
            if (job.stage === 'COMPLETED') {
              processedCount++;
            } else if (job.stage === 'FAILED') {
              failedCount++;
            }
          } catch {
            failedCount++;
          }

          this.notifyProgress({
            status: 'processing',
            message: `Processed ${i + 1} of ${pendingRecordings.length} call(s)...`,
            totalCalls: pendingRecordings.length,
            processedCalls: i + 1,
          });
        }
      }

      const syncResult = {
        discovered: scanned.length,
        processed: processedCount,
        failed: failedCount,
      };

      this.settings.lastSyncTimestamp = new Date().toISOString();
      this.settings.lastSyncStatus =
        failedCount > 0 && processedCount === 0 ? 'failed' : 'success';
      this.settings.lastSyncResult = {
        newlyDiscovered: scanned.length,
        processed: processedCount,
        failed: failedCount,
      };

      await AsyncStorage.setItem(
        BACKGROUND_SETTINGS_KEY,
        JSON.stringify(this.settings),
      );
      this.notifyListeners();

      this.notifyProgress({
        status: 'completed',
        message:
          pendingRecordings.length > 0
            ? `Background sync finished: ${processedCount} processed.`
            : 'All recordings up to date.',
        totalCalls: pendingRecordings.length,
        processedCalls: processedCount,
      });

      return syncResult;
    } catch (err: any) {
      this.settings.lastSyncStatus = 'failed';
      this.notifyListeners();
      this.notifyProgress({
        status: 'failed',
        message: err?.message || 'Background sync failed',
        totalCalls: 0,
        processedCalls: 0,
      });
      return {discovered: 0, processed: 0, failed: 0};
    } finally {
      this.isRunningSync = false;
    }
  }
}
