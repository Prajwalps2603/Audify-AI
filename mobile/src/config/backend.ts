// TeleCaller AI — Backend API Configuration
// Supports Android Emulator (10.0.2.2), Physical Device on Local Wi-Fi (10.0.1.64), and Localhost

import {Platform} from 'react-native';

// Change or configure the primary server IP here
export const BACKEND_HOST = '10.0.1.64';
export const BACKEND_PORT = 3000;
export const ADMIN_API_SECRET = 'tc_sec_admin_key_9948_auth_2026';

export const BACKEND_URLS = [
  `http://${BACKEND_HOST}:${BACKEND_PORT}`,
  Platform.OS === 'android'
    ? `http://10.0.2.2:${BACKEND_PORT}`
    : `http://localhost:${BACKEND_PORT}`,
  `http://localhost:${BACKEND_PORT}`,
];

let activeBackendUrl = BACKEND_URLS[0];
let lastDetectedAt = 0;
const DETECTION_CACHE_MS = 60_000; // Re-check backend at most once per minute
let detectionPromise: Promise<string> | null = null;

export function getBackendUrl(): string {
  return activeBackendUrl;
}

export function setBackendUrl(url: string): void {
  activeBackendUrl = url;
}

/**
 * Ping each backend URL to find the reachable one.
 * Caches the result for 60 seconds to avoid repeated network pings on every sync.
 */
export async function detectActiveBackend(): Promise<string> {
  const now = Date.now();

  // Return cached result if still fresh
  if (now - lastDetectedAt < DETECTION_CACHE_MS) {
    return activeBackendUrl;
  }

  // If a detection is already in-flight, wait for it instead of launching another
  if (detectionPromise) {
    return detectionPromise;
  }

  detectionPromise = (async () => {
    for (const url of BACKEND_URLS) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);
        const res = await fetch(`${url}/api/health`, {signal: controller.signal});
        clearTimeout(timeoutId);
        if (res.ok) {
          activeBackendUrl = url;
          lastDetectedAt = Date.now();
          return url;
        }
      } catch {
        // try next
      }
    }
    // All failed — keep current URL, but don't update lastDetectedAt so we retry sooner
    return activeBackendUrl;
  })().finally(() => {
    detectionPromise = null;
  });

  return detectionPromise;
}

/**
 * Force-clear the backend detection cache (e.g. after sign-in or network change).
 */
export function resetBackendDetection(): void {
  lastDetectedAt = 0;
  detectionPromise = null;
}
