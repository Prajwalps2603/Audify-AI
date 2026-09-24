// TeleCaller AI — Auth Service (Phase 2)
// Wraps @react-native-google-signin/google-signin
// Handles sign-in, sign-out, token refresh, and session persistence.
//
// SECURITY NOTES:
//   - The WEB_CLIENT_ID is NOT a secret — it is safe in the Android app.
//   - The CLIENT_SECRET stays on the server only.
//   - Access tokens / ID tokens are stored in EncryptedStorage (not AsyncStorage).
//   - We never log tokens.

import {
  GoogleSignin,
  statusCodes,
  isErrorWithCode,
  isSuccessResponse,
  isCancelledResponse,
  isNoSavedCredentialFoundResponse,
} from '@react-native-google-signin/google-signin';
import EncryptedStorage from 'react-native-encrypted-storage';
import {AuthSession, AuthTokens, GoogleUserInfo} from '../../types/auth';

// ─────────────────────────────────────────────────────────────
// IMPORTANT: Replace this with your actual Web Client ID from
// Google Cloud Console → APIs & Services → Credentials
// This value is safe to include in the app (it is not a secret).
// ─────────────────────────────────────────────────────────────
const WEB_CLIENT_ID =
  '61262487363-uv1dc8mhta6fhr60tqtgppsn925fkdd9.apps.googleusercontent.com';

const SESSION_STORAGE_KEY = 'telecaller_auth_session';

// ─────────────────────────────────────────────────────────────
// Configure Google Sign-In
// Call this once at app startup (before any sign-in attempt)
// ─────────────────────────────────────────────────────────────
export function configureGoogleSignIn(): void {
  const config: Parameters<typeof GoogleSignin.configure>[0] = {
    scopes: [
      'https://www.googleapis.com/auth/drive.file',   // Upload files to Drive
      'https://www.googleapis.com/auth/spreadsheets', // Read/write Sheets
    ],
  };

  if (WEB_CLIENT_ID && WEB_CLIENT_ID.trim().length > 0) {
    config.webClientId = WEB_CLIENT_ID;
    config.offlineAccess = true;
  }

  GoogleSignin.configure(config);
}

// ─────────────────────────────────────────────────────────────
// Sign In
// ─────────────────────────────────────────────────────────────
export async function signInWithGoogle(): Promise<AuthSession> {
  try {
    await GoogleSignin.hasPlayServices({showPlayServicesUpdateDialog: true});
    const response = await GoogleSignin.signIn();

    if (isCancelledResponse(response)) {
      throw new AuthError('CANCELLED', 'Sign-in was cancelled by user.');
    }

    if (!isSuccessResponse(response)) {
      throw new AuthError('UNKNOWN', 'Unexpected sign-in response.');
    }

    const {user} = response.data;
    const tokens = await GoogleSignin.getTokens();

    const googleUser: GoogleUserInfo = {
      id: user.id,
      name: user.name,
      email: user.email,
      photo: user.photo,
      familyName: user.familyName,
      givenName: user.givenName,
    };

    const authTokens: AuthTokens = {
      idToken: tokens.idToken,
      accessToken: tokens.accessToken,
      serverAuthCode: response.data.serverAuthCode ?? null,
    };

    const session: AuthSession = {
      user: googleUser,
      tokens: authTokens,
      signedInAt: new Date().toISOString(),
    };

    await saveSession(session);
    return session;
  } catch (error) {
    if (error instanceof AuthError) throw error;
    if (isErrorWithCode(error)) {
      switch (error.code) {
        case statusCodes.SIGN_IN_CANCELLED:
          throw new AuthError('CANCELLED', 'Sign-in was cancelled.');
        case statusCodes.IN_PROGRESS:
          throw new AuthError('IN_PROGRESS', 'Sign-in is already in progress.');
        case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
          throw new AuthError(
            'PLAY_SERVICES_UNAVAILABLE',
            'Google Play Services is not available on this device.',
          );
        default:
          throw new AuthError('UNKNOWN', `Sign-in failed: ${error.message}`);
      }
    }
    throw new AuthError('UNKNOWN', 'An unexpected error occurred during sign-in.');
  }
}

// ─────────────────────────────────────────────────────────────
// Sign Out
// ─────────────────────────────────────────────────────────────
export async function signOut(): Promise<void> {
  try {
    await GoogleSignin.signOut();
    await clearSession();
  } catch (error) {
    // Clear local session regardless
    await clearSession();
    throw new AuthError('SIGN_OUT_FAILED', 'Sign-out encountered an error.');
  }
}

// ─────────────────────────────────────────────────────────────
// Restore Session (called on app launch)
// Returns null if no session, throws if storage error
// ─────────────────────────────────────────────────────────────
export async function restoreSession(): Promise<AuthSession | null> {
  try {
    const raw = await EncryptedStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;

    const session: AuthSession = JSON.parse(raw);

    // Also check if Google Sign-In still has a valid user
    const currentUser = await GoogleSignin.getCurrentUser();
    if (!currentUser) {
      // Google session expired — clear local session
      await clearSession();
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Refresh Access Token
// ─────────────────────────────────────────────────────────────
export async function refreshAccessToken(): Promise<string | null> {
  try {
    const tokens = await GoogleSignin.getTokens();
    const session = await restoreSession();
    if (session && tokens.accessToken) {
      session.tokens = {
        ...session.tokens,
        accessToken: tokens.accessToken,
        idToken: tokens.idToken,
      };
      await saveSession(session);
    }
    return tokens.accessToken;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Proactively Retrieve Valid Access Token with Silent Fallback
// ─────────────────────────────────────────────────────────────
export async function getValidAccessToken(): Promise<string | null> {
  try {
    const tokens = await getTokens();
    if (tokens?.accessToken) {
      return tokens.accessToken;
    }
    return await refreshAccessToken();
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Get Valid Tokens (from saved session or Google Sign-In)
// ─────────────────────────────────────────────────────────────
export async function getTokens(): Promise<AuthTokens | null> {
  try {
    const session = await restoreSession();
    if (session?.tokens?.accessToken) {
      return session.tokens;
    }
    const tokens = await GoogleSignin.getTokens();
    return {
      accessToken: tokens.accessToken,
      idToken: tokens.idToken,
      serverAuthCode: null,
    };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Get Current User (from Google Sign-In state)
// ─────────────────────────────────────────────────────────────
export async function getCurrentGoogleUser(): Promise<GoogleUserInfo | null> {
  try {
    const user = await GoogleSignin.getCurrentUser();
    if (!user) return null;
    return {
      id: user.user.id ?? '',
      name: user.user.name ?? null,
      email: user.user.email ?? '',
      photo: user.user.photo ?? null,
      familyName: user.user.familyName ?? null,
      givenName: user.user.givenName ?? null,
    };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────────────────────
async function saveSession(session: AuthSession): Promise<void> {
  // SECURITY: Store in EncryptedStorage, NOT AsyncStorage
  // EncryptedStorage uses Android Keystore / iOS Keychain
  await EncryptedStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

async function clearSession(): Promise<void> {
  await EncryptedStorage.removeItem(SESSION_STORAGE_KEY);
}

// ─────────────────────────────────────────────────────────────
// AuthError — structured error type
// ─────────────────────────────────────────────────────────────
export class AuthError extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

export type AuthErrorCode =
  | 'CANCELLED'
  | 'IN_PROGRESS'
  | 'PLAY_SERVICES_UNAVAILABLE'
  | 'SIGN_OUT_FAILED'
  | 'NO_CLIENT_ID'
  | 'UNKNOWN';
