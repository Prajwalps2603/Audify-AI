// TeleCaller AI — Auth Context (Phase 2)
// Provides app-wide authentication state.
// Wrap the app in <AuthProvider> and consume with useAuth().

import React, {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useCallback,
} from 'react';
import {
  configureGoogleSignIn,
  signInWithGoogle,
  signOut as authSignOut,
  restoreSession,
  AuthError,
} from '../services/auth/AuthService';
import {AuthSession, AuthState} from '../types/auth';

// ─────────────────────────────────────────────────────────────
// State reducer
// ─────────────────────────────────────────────────────────────
type AuthAction =
  | {type: 'INITIALIZING'}
  | {type: 'SIGNED_IN'; session: AuthSession}
  | {type: 'SIGNED_OUT'}
  | {type: 'ERROR'; message: string};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'INITIALIZING':
      return {status: 'INITIALIZING'};
    case 'SIGNED_IN':
      return {status: 'SIGNED_IN', session: action.session};
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

  const tryRestoreSession = async () => {
    try {
      const session = await restoreSession();
      if (session) {
        dispatch({type: 'SIGNED_IN', session});
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
      dispatch({type: 'SIGNED_IN', session});
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
    } catch {
      // Even on error, move to signed-out state
      dispatch({type: 'SIGNED_OUT'});
    }
  }, []);

  const clearError = useCallback(() => {
    dispatch({type: 'SIGNED_OUT'});
  }, []);

  return (
    <AuthContext.Provider value={{authState, signIn, signOut, clearError}}>
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
