import { Platform } from 'react-native';
import { apiClient } from '../api/client';

type ClientLogLevel = 'info' | 'warn' | 'error';

// Fire-and-forget breadcrumb/error reporting to the server (POST
// /client-logs), written there to stdout for `railway logs` — exists
// purely to debug real-device-only web bugs (crashes, weird state) that
// can't be reproduced locally, e.g. a mobile Safari WebContent process
// getting OOM-killed. Web-only: native has no equivalent need. Deliberately
// best-effort, not a feature the app depends on — a logging failure (or a
// hard crash mid-flight, which no browser API can guarantee survives) must
// never surface anywhere or throw.
export function logEvent(event: string, context?: Record<string, unknown>, level: ClientLogLevel = 'info'): void {
  if (Platform.OS !== 'web') return;
  void apiClient
    .post('/client-logs', {
      level,
      event,
      context,
      clientTimestamp: new Date().toISOString(),
    })
    .catch(() => {});
}

let installed = false;

// Registers the global web-only listeners this logger depends on — call
// once, from App.tsx. Idempotent (guards against a second call, e.g. React
// StrictMode's double-invoke of effects).
//
// Note on what this can and can't catch: a real WebContent-process OOM
// kill on iOS Safari doesn't run any JS before it happens — there is no
// "about to die" hook for that. window.onerror/unhandledrejection catch
// real JS exceptions; visibilitychange/pagehide catch ordinary
// backgrounding. What actually matters for diagnosing a hard crash is the
// trail of breadcrumbs (see logEvent call sites in App.tsx/WatchlistScreen)
// logged progressively BEFORE it happens — the last line before silence,
// followed by a fresh mount with no matching pagehide in between, is
// itself the signal.
export function installRemoteLoggerListeners(): void {
  if (Platform.OS !== 'web' || installed) return;
  installed = true;

  window.addEventListener('error', (event) => {
    logEvent('window.onerror', { message: event.message, filename: event.filename, lineno: event.lineno }, 'error');
  });

  window.addEventListener('unhandledrejection', (event) => {
    logEvent('unhandledrejection', { reason: String(event.reason) }, 'error');
  });

  document.addEventListener('visibilitychange', () => {
    logEvent('visibilitychange', { visibilityState: document.visibilityState });
  });

  window.addEventListener('pagehide', (event) => {
    logEvent('pagehide', { persisted: event.persisted });
  });

  logEvent('logger_installed', { userAgent: navigator.userAgent });
}
