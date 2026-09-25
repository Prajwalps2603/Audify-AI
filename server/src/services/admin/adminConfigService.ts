// TeleCaller AI — Server Admin Configuration Service
// Role-based visibility and feature toggling for hackerweb402@gmail.com

import fs from 'fs';
import path from 'path';

export const ADMIN_EMAIL = 'hackerweb402@gmail.com';

export interface AdminFeatureConfig {
  recordingFolder: boolean;
  changeRecordingFolder: boolean;
  scanRecordings: boolean;
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
  googleDrive: boolean;
  googleSheets: boolean;
  sttProvider: boolean;
  languageDetection: boolean;
  privacyConsent: boolean;
  securityAudit: boolean;
  deleteAccount: boolean;
}

export const DEFAULT_ADMIN_CONFIG: AdminFeatureConfig = {
  recordingFolder: true,
  changeRecordingFolder: true,
  scanRecordings: true,
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
  googleDrive: true,
  googleSheets: true,
  sttProvider: true,
  languageDetection: true,
  privacyConsent: true,
  securityAudit: true,
  deleteAccount: true,
};

const DATA_DIR = path.join(__dirname, '../../data');
const CONFIG_FILE = path.join(DATA_DIR, 'adminConfig.json');

function ensureConfigFile(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, {recursive: true});
    }
    if (!fs.existsSync(CONFIG_FILE)) {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_ADMIN_CONFIG, null, 2), 'utf-8');
    }
  } catch (e) {
    console.warn('[ServerAdminService] Failed to ensure config file:', e);
  }
}

function loadConfig(): AdminFeatureConfig {
  ensureConfigFile();
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return {...DEFAULT_ADMIN_CONFIG, ...JSON.parse(raw)};
  } catch (e) {
    console.warn('[ServerAdminService] Failed to read config file:', e);
  }
  return {...DEFAULT_ADMIN_CONFIG};
}

function saveConfig(cfg: AdminFeatureConfig): void {
  ensureConfigFile();
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf-8');
  } catch (e) {
    console.error('[ServerAdminService] Failed to persist config to disk:', e);
  }
}

let currentConfig: AdminFeatureConfig = loadConfig();

export class ServerAdminService {
  public static isAdmin(email?: string | null): boolean {
    if (!email) return false;
    return email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase();
  }

  public static getConfigForUser(email?: string | null): AdminFeatureConfig {
    if (this.isAdmin(email)) {
      return currentConfig;
    }
    // Return sanitized config for regular users
    return {...currentConfig};
  }

  public static updateConfig(
    updates: Partial<AdminFeatureConfig>,
    requesterEmail?: string | null,
  ): AdminFeatureConfig {
    if (!this.isAdmin(requesterEmail)) {
      throw new Error(`Unauthorized: ${requesterEmail} is not allowed to change admin settings.`);
    }
    currentConfig = {...currentConfig, ...updates};
    saveConfig(currentConfig);
    return {...currentConfig};
  }

  public static resetConfig(requesterEmail?: string | null): AdminFeatureConfig {
    if (!this.isAdmin(requesterEmail)) {
      throw new Error(`Unauthorized: ${requesterEmail} is not allowed to reset admin settings.`);
    }
    currentConfig = {...DEFAULT_ADMIN_CONFIG};
    saveConfig(currentConfig);
    return {...currentConfig};
  }
}
