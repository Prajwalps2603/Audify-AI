// TeleCaller AI — Auth Types (Phase 2)

export interface GoogleUserInfo {
  id: string;
  name: string | null;
  email: string;
  photo: string | null;
  familyName: string | null;
  givenName: string | null;
}

export interface AuthTokens {
  idToken: string;
  accessToken: string;
  serverAuthCode?: string | null;
}

export interface AuthSession {
  user: GoogleUserInfo;
  tokens: AuthTokens;
  signedInAt: string; // ISO timestamp
}

export type AuthState =
  | {status: 'INITIALIZING'}
  | {status: 'SIGNED_OUT'}
  | {status: 'SIGNED_IN'; session: AuthSession}
  | {status: 'ERROR'; message: string};
