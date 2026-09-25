// TeleCaller AI — App Lock & Biometric / PIN Security Service
// Secures call recordings, audio playback, and AI transcripts behind hardware KeyStore PIN

import EncryptedStorage from 'react-native-encrypted-storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const APP_LOCK_ENABLED_KEY = '@telecaller_app_lock_enabled';
const APP_LOCK_PIN_KEY = 'telecaller_app_lock_pin_keystore';

class AppLockServiceClass {
  private isEnabled: boolean = false;
  private isLocked: boolean = false;
  private listeners: Array<(locked: boolean) => void> = [];
  private isInitialized: boolean = false;

  constructor() {
    this.init();
  }

  public async init(): Promise<void> {
    if (this.isInitialized) return;
    try {
      const enabled = await AsyncStorage.getItem(APP_LOCK_ENABLED_KEY);
      this.isEnabled = enabled === 'true';
      if (this.isEnabled) {
        // App starts locked if lock is enabled
        this.isLocked = true;
      }
    } catch (e) {
      console.warn('[AppLockService] Init error:', e);
    } finally {
      this.isInitialized = true;
      this.notifyListeners();
    }
  }

  public isLockEnabled(): boolean {
    return this.isEnabled;
  }

  public getIsLocked(): boolean {
    return this.isEnabled && this.isLocked;
  }

  public lock(): void {
    if (this.isEnabled && !this.isLocked) {
      this.isLocked = true;
      this.notifyListeners();
    }
  }

  public async unlockWithPin(enteredPin: string): Promise<boolean> {
    try {
      const storedPin = await EncryptedStorage.getItem(APP_LOCK_PIN_KEY);
      if (storedPin && storedPin === enteredPin) {
        this.isLocked = false;
        this.notifyListeners();
        return true;
      }
      return false;
    } catch (e) {
      console.error('[AppLockService] Unlock error:', e);
      return false;
    }
  }

  public async setPin(newPin: string): Promise<boolean> {
    if (!newPin || newPin.length < 4) {
      throw new Error('PIN must be at least 4 digits');
    }
    try {
      await EncryptedStorage.setItem(APP_LOCK_PIN_KEY, newPin);
      await AsyncStorage.setItem(APP_LOCK_ENABLED_KEY, 'true');
      this.isEnabled = true;
      this.isLocked = false;
      this.notifyListeners();
      return true;
    } catch (e) {
      console.error('[AppLockService] Set PIN error:', e);
      return false;
    }
  }

  public async disable(): Promise<void> {
    try {
      await EncryptedStorage.removeItem(APP_LOCK_PIN_KEY);
      await AsyncStorage.setItem(APP_LOCK_ENABLED_KEY, 'false');
      this.isEnabled = false;
      this.isLocked = false;
      this.notifyListeners();
    } catch (e) {
      console.error('[AppLockService] Disable lock error:', e);
    }
  }

  public async disableLock(currentPin: string): Promise<boolean> {
    const isValid = await this.unlockWithPin(currentPin);
    if (!isValid) {
      return false;
    }
    try {
      await EncryptedStorage.removeItem(APP_LOCK_PIN_KEY);
      await AsyncStorage.setItem(APP_LOCK_ENABLED_KEY, 'false');
      this.isEnabled = false;
      this.isLocked = false;
      this.notifyListeners();
      return true;
    } catch (e) {
      console.error('[AppLockService] Disable lock error:', e);
      return false;
    }
  }

  public subscribe(listener: (locked: boolean) => void): () => void {
    this.listeners.push(listener);
    listener(this.getIsLocked());
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    const locked = this.getIsLocked();
    this.listeners.forEach(l => {
      try {
        l(locked);
      } catch (e) {
        console.error('[AppLockService] Listener error:', e);
      }
    });
  }
}

export const AppLockService = new AppLockServiceClass();
