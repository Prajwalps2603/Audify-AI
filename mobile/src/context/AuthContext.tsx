// TeleCaller AI — Auth Context
// Provides app-wide authentication state and consent tracking.
// Wrap the app in <AuthProvider> and consume with useAuth().

import React, {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useCallback,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  configureGoogleSignIn,
  signInWithGoogle,
  signOut as authSignOut,
  restoreSession,
  AuthError,
} from '../services/auth/AuthService';
import {AuthSession, AuthState} from '../types/auth';
import {toast} from '../components/Toast';

const CONSENT_KEY = 'telecaller_ai_consent_accepted';

// ─────────────────────────────────────────────────────────────
// State reducer
// ─────────────────────────────────────────────────────────────
type AuthAction =
  | {type: 'INITIALIZING'}
  | {type: 'SIGNED_IN'; session: AuthSession; needsConsent: boolean}
  | {type: 'CONSENT_ACCEPTED'}
  | {type: 'SIGNED_OUT'}
  | {type: 'ERROR'; message: string};

function authReducer(
  state: AuthState,
  action: AuthAction,
): AuthState {
  switch (action.type) {
    case 'INITIALIZING':
      return {status: 'INITIALIZING'};
    case 'SIGNED_IN':
      return {
        status: 'SIGNED_IN',
        session: action.session,
        needsConsent: action.needsConsent,
      };
    case 'CONSENT_ACCEPTED':
      if (state.status === 'SIGNED_IN') {
        return {...state, needsConsent: false};
      }
      return state;
    case 'SIGNED_OUT':
      return {status: 'SIGNED_OUT'};
    case 'ERROR':
      return {status: 'ERROR', message: action.message};
    default:
      return state;
  }
}

// ─────────────────────────────────────────────────────────────
// Context value type
// ─────────────────────────────────────────────────────────────
interface AuthContextValue {
  authState: AuthState;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
  acceptConsent: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ─────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────
export const AuthProvider: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  const [authState, dispatch] = useReducer(authReducer, {
    status: 'INITIALIZING',
  });

  // Configure Google Sign-In once on mount
  useEffect(() => {
    configureGoogleSignIn();
    tryRestoreSession();
  }, []);

  const hasUserAcceptedConsent = async (): Promise<boolean> => {
    try {
      const val = await AsyncStorage.getItem(CONSENT_KEY);
      return val === 'true';
    } catch {
      return false;
    }
  };

  const tryRestoreSession = async () => {
    try {
      const session = await restoreSession();
      if (session) {
        const consentAccepted = await hasUserAcceptedConsent();
        dispatch({
          type: 'SIGNED_IN',
          session,
          needsConsent: !consentAccepted,
        });
      } else {
        dispatch({type: 'SIGNED_OUT'});
      }
    } catch {
      dispatch({type: 'SIGNED_OUT'});
    }
  };

  const signIn = useCallback(async () => {
    try {
      dispatch({type: 'INITIALIZING'});
      const session = await signInWithGoogle();
      const consentAccepted = await hasUserAcceptedConsent();
      dispatch({
        type: 'SIGNED_IN',
        session,
        needsConsent: !consentAccepted,
      });
      const userName = session.user?.name || 'User';
      toast.success('Logged In Successfully', `Welcome back, ${userName}!`);
    } catch (error) {
      if (error instanceof AuthError) {
        if (error.code === 'CANCELLED') {
          // User cancelled — go back to signed-out, not error state
          dispatch({type: 'SIGNED_OUT'});
        } else {
          dispatch({type: 'ERROR', message: error.message});
        }
      } else {
        dispatch({type: 'ERROR', message: 'An unexpected error occurred.'});
      }
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await authSignOut();
      dispatch({type: 'SIGNED_OUT'});
      toast.info('Logged Out', 'You have been signed out.');
    } catch {
      // Even on error, move to signed-out state
      dispatch({type: 'SIGNED_OUT'});
      toast.info('Logged Out', 'Signed out from local session.');
    }
  }, []);

  const clearError = useCallback(() => {
    dispatch({type: 'SIGNED_OUT'});
  }, []);

  const acceptConsent = useCallback(async () => {
    try {
      await AsyncStorage.setItem(CONSENT_KEY, 'true');
    } catch {}
    dispatch({type: 'CONSENT_ACCEPTED'});
  }, []);

  return (
    <AuthContext.Provider
      value={{authState, signIn, signOut, clearError, acceptConsent}}>
      {children}
    </AuthContext.Provider>
  );
};

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}
