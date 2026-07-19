import AsyncStorage from '@react-native-async-storage/async-storage';

// The bearer token from POST /auth/login — sent as `Authorization: Bearer
// <token>` on every request (see client.ts). Not a cookie: Railway registers
// *.up.railway.app on the Public Suffix List specifically so different
// customers' apps can't share cookies, which makes the mobile PWA's and the
// API's Railway subdomains genuinely different *sites* to a browser — a
// cookie-based session is a third-party cookie there, which Safari/iOS (the
// actual target platform) blocks by default. See server/docs/auth.md.
const STORAGE_KEY = 'mytv_auth_token';

export function getAuthToken(): Promise<string | null> {
  return AsyncStorage.getItem(STORAGE_KEY);
}

export function setAuthToken(token: string): Promise<void> {
  return AsyncStorage.setItem(STORAGE_KEY, token);
}

export function clearAuthToken(): Promise<void> {
  return AsyncStorage.removeItem(STORAGE_KEY);
}
