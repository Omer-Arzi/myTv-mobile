// Backend base URL. Expo inlines EXPO_PUBLIC_* env vars at build time — see
// .env.example for how to override this per-device (Simulator vs physical
// device vs Android emulator all need a different value).
//
// A shell-exported/prefixed override (`EXPO_PUBLIC_API_BASE_URL=... npx expo
// start --web`) does NOT work for this specific var, even though it looks
// like it should — Metro's client-bundle env inlining
// (@expo/metro-config/transform-worker/dot-env-development.js) parses
// mobile/.env's file content directly with `processEnv: {}`, never
// consulting the real process.env at all. To override for a one-off test
// without touching the committed .env, add a gitignored `.env.local`
// (higher precedence, same key) instead — a full `expo start -c` restart is
// also required for either to take effect (Metro's transform cache can
// otherwise still serve an already-transformed, stale-valued copy).
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';
