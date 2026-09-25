// TeleCaller AI — Admin Configuration Service
// Role-based visibility and feature toggling for hackerweb402@gmail.com
// Handled directly via backend server with offline local caching

import AsyncStorage from '@react-native-async-storage/async-storage';
import {getBackendUrl, detectActiveBackend, ADMIN_API_SECRET} from '../../config/backend';

export const ADMIN_EMAIL = 'hackerweb402@gmail.com';

export interface AdminFeatureConfig {
  // Recordings
  recordingFolder: boolean;
  changeRecordingFolder: boolean;
  scanRecordings: boolean;

  // Automation & Background
  backgroundMonitoring: boolean;
  persistentNotification: boolean;
  scanFrequency: boolean;
  autoProcessPipeline: boolean;
  autoDriveUpload: boolean;
  autoTranscription: boolean;
  wifiOnlySync: boolean;
  batteryOptimization: boolean;
  triggerBackgroundScan: boolean;
  lastBackgroundCheck: boolean;

  // Google Services
  googleDrive: boolean;
  googleSheets: boolean;

  // Transcription
  sttProvider: boolean;
  languageDetection: boolean;

  // Privacy & Security
  privacyConsent: boolean;
  securityAudit: boolean;

  // Account
  deleteAccount: boolean;
}

export type AdminSettingKey = keyof AdminFeatureConfig;

export const DEFAULT_ADMIN_CONFIG: AdminFeatureConfig = {
  // Recordings
  recordingFolder: true,
  changeRecordingFolder: true,
  scanRecordings: true,

  // Automation & Background
  backgroundMonitoring: true,
  persistentNotification: true,
  scanFrequency: true,
  autoProcessPipeline: true,
  autoDriveUpload: true,
  autoTranscription: true,
  wifiOnlySync: true,
  batteryOptimization: true,
  triggerBackgroundScan: true,
  lastBackgroundCheck: true,

  // Google Services
  googleDrive: true,
  googleSheets: true,

  // Transcription
  sttProvider: true,
  languageDetection: true,

  // Privacy & Security
  privacyConsent: true,
  securityAudit: true,

  // Account
  deleteAccount: true,
};

const STORAGE_KEY = '@telecaller_admin_config_v1';

class AdminConfigServiceClass {
  private config: AdminFeatureConfig = {...DEFAULT_ADMIN_CONFIG};
  private listeners: Array<(config: AdminFeatureConfig) => void> = [];
  private isLoaded = false;
  private currentUserEmail: string = '';

  constructor() {
    this.loadFromStorage();
  }

  public setUserEmail(email?: string | null): void {
    if (email && email !== this.currentUserEmail) {
      this.currentUserEmail = email;
      // Only sync when we have a real email (avoids a wasted empty-email request on boot)
      this.syncFromBackend(email);
    }
  }

  /**
   * Check if a given user email is the authorized Super Admin
   */
  public isAdmin(email?: string | null): boolean {
    if (!email) return false;
    return email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase();
  }

  /**
   * Load persisted settings from storage and sync from backend
   */
  public async loadFromStorage(): Promise<AdminFeatureConfig> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.config = {...DEFAULT_ADMIN_CONFIG, ...parsed};
      }
    } catch (e) {
      console.warn('[AdminConfigService] Failed to load config:', e);
    } finally {
      this.isLoaded = true;
      this.notifyListeners();
    }

    // Only sync from backend if we already have a known user email;
    // otherwise wait for setUserEmail() to trigger the first sync.
    if (this.currentUserEmail) {
      this.syncFromBackend(this.currentUserEmail);
    }
    return this.config;
  }

  /**
   * Synchronize config from backend server
   */
  public async syncFromBackend(userEmail?: string | null): Promise<AdminFeatureConfig> {
    try {
      await detectActiveBackend();
      const backendUrl = getBackendUrl();
      const email = userEmail || this.currentUserEmail || '';

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(
        `${backendUrl}/api/admin/config?email=${encodeURIComponent(email)}`,
        {
          signal: controller.signal,
          headers: {
            'x-admin-key': ADMIN_API_SECRET,
            'x-admin-email': email,
          },
        },
      );
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.config) {
          this.config = {...DEFAULT_ADMIN_CONFIG, ...data.config};
          await this.saveToStorage();
          this.notifyListeners();
        }
      }
    } catch (e) {
      // Backend not reached, keep cached config
    }
    return this.config;
  }

  /**
   * Get current config snapshot synchronously
   */
  public getConfig(): AdminFeatureConfig {
    return {...this.config};
  }

  /**
   * Check if a specific setting is visible for a user
   */
  public isVisible(key: AdminSettingKey, userEmail?: string | null): boolean {
    if (this.isAdmin(userEmail)) {
      return true;
    }
    return Boolean(this.config[key]);
  }

  /**
   * Update a setting toggle (Requires Admin privileges, sent to backend)
   */
  public async updateSetting(
    key: AdminSettingKey,
    value: boolean,
    requesterEmail?: string | null,
  ): Promise<AdminFeatureConfig> {
    const email = requesterEmail || this.currentUserEmail;
    if (!this.isAdmin(email)) {
      throw new Error(
        `Unauthorized: Only ${ADMIN_EMAIL} is authorized to change admin controls.`,
      );
    }

    const updates = {[key]: value};

    // Send to backend
    try {
      const backendUrl = getBackendUrl();
      const res = await fetch(`${backendUrl}/api/admin/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': ADMIN_API_SECRET,
          'x-admin-email': email,
        },
        body: JSON.stringify({updates, email}),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.config) {
          this.config = {...this.config, ...data.config};
          await this.saveToStorage();
          this.notifyListeners();
          return {...this.config};
        }
      }
    } catch (e) {
      console.warn('[AdminConfigService] Backend unreachable, applying locally:', e);
    }

    this.config[key] = value;
    await this.saveToStorage();
    this.notifyListeners();
    return {...this.config};
  }

  /**
   * Batch update all settings (e.g. Enable All / Disable All)
   */
  public async batchUpdate(
    updates: Partial<AdminFeatureConfig>,
    requesterEmail?: string | null,
  ): Promise<AdminFeatureConfig> {
    const email = requesterEmail || this.currentUserEmail;
    if (!this.isAdmin(email)) {
      throw new Error(
        `Unauthorized: Only ${ADMIN_EMAIL} is authorized to change admin controls.`,
      );
    }

    // Send to backend
    try {
      const backendUrl = getBackendUrl();
      const res = await fetch(`${backendUrl}/api/admin/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': ADMIN_API_SECRET,
          'x-admin-email': email,
        },
        body: JSON.stringify({updates, email}),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.config) {
          this.config = {...this.config, ...data.config};
          await this.saveToStorage();
          this.notifyListeners();
          return {...this.config};
        }
      }
    } catch (e) {
      console.warn('[AdminConfigService] Backend unreachable, applying locally:', e);
    }

    this.config = {...this.config, ...updates};
    await this.saveToStorage();
    this.notifyListeners();
    return {...this.config};
  }

  /**
   * Reset all settings to factory default
   */
  public async resetToDefaults(
    requesterEmail?: string | null,
  ): Promise<AdminFeatureConfig> {
    const email = requesterEmail || this.currentUserEmail;
    if (!this.isAdmin(email)) {
      throw new Error(
        `Unauthorized: Only ${ADMIN_EMAIL} is authorized to change admin controls.`,
      );
    }

    // Send to backend
    try {
      const backendUrl = getBackendUrl();
      const res = await fetch(`${backendUrl}/api/admin/config/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': ADMIN_API_SECRET,
          'x-admin-email': email,
        },
        body: JSON.stringify({email}),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.config) {
          this.config = {...DEFAULT_ADMIN_CONFIG, ...data.config};
          await this.saveToStorage();
          this.notifyListeners();
          return {...this.config};
        }
      }
    } catch (e) {
      console.warn('[AdminConfigService] Backend unreachable, resetting locally:', e);
    }

    this.config = {...DEFAULT_ADMIN_CONFIG};
    await this.saveToStorage();
    this.notifyListeners();
    return {...this.config};
  }

  /**
   * Subscribe to real-time changes
   */
  public subscribe(listener: (config: AdminFeatureConfig) => void): () => void {
    this.listeners.push(listener);
    listener({...this.config});
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private async saveToStorage(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    } catch (e) {
      console.warn('[AdminConfigService] Failed to save config:', e);
    }
  }

  private notifyListeners(): void {
    const copy = {...this.config};
    this.listeners.forEach(l => {
      try {
        l(copy);
      } catch (e) {
        console.error('[AdminConfigService] Listener error:', e);
      }
    });
  }
}

export const AdminConfigService = new AdminConfigServiceClass();
