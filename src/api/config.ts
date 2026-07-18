// Backend base URL. Expo inlines EXPO_PUBLIC_* env vars at build time — see
// .env.example for how to override this per-device (Simulator vs physical
// device vs Android emulator all need a different value).
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';
