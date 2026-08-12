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

let viewportDiagnosticsInstalled = false;

// Temporary, targeted diagnostic for the "black strip below the bottom tab
// bar" PWA bug (see mobile/docs/pwa.md's addendum chain) — every prior fix
// attempt for this was verified only via structural checks or Chromium/
// Playwright emulation, neither of which can reproduce a real notched
// iPhone's env(safe-area-inset-bottom) or standalone-mode
// window.visualViewport behavior at all (confirmed directly: Chromium's own
// CDP Emulation.setSafeAreaInsetsOverride rejected every parameter shape
// tried). This reports the actual runtime numbers from a real device
// instead of guessing at another CSS patch. Remove once the real cause is
// confirmed and fixed.
//
// computedSafeAreaInsetBottom is measured independently of
// react-native-safe-area-context's own web provider (same hidden-probe-div
// + getComputedStyle technique, but a separate element) — deliberately not
// trusting the exact code path already suspected of measuring this wrong.
export function installViewportDiagnosticsLogger(): void {
  if (Platform.OS !== 'web' || viewportDiagnosticsInstalled) return;
  viewportDiagnosticsInstalled = true;

  const probe = document.createElement('div');
  probe.style.position = 'fixed';
  probe.style.left = '0';
  probe.style.top = '0';
  probe.style.width = '0';
  probe.style.height = '0';
  probe.style.paddingBottom = 'env(safe-area-inset-bottom)';
  probe.style.visibility = 'hidden';
  probe.style.pointerEvents = 'none';
  document.body.appendChild(probe);

  const rectSummary = (r: DOMRect | undefined) => (r ? { top: r.top, bottom: r.bottom, height: r.height } : null);

  // Real-device screenshots (outline CSS, see build-web-pwa.js) showed
  // html/body/#root correctly reaching almost the full physical height,
  // while the tab bar's own box stopped well short — narrowing the gap to
  // *somewhere between* #root and the tab bar, not the root container
  // itself. Rather than add more hand-picked CSS selectors for each
  // intermediate wrapper (SafeAreaProvider, NavigationContainer,
  // RootNavigator, SafeAreaProviderCompat, ...), walk the real DOM chain
  // from the tab bar up to #root and measure every level's actual box —
  // this pinpoints exactly which ancestor's height first falls short, with
  // no CSS selector guessing at all.
  const walkAncestorChain = (from: Element | null, root: Element | null) => {
    const chain: { tag: string; className: string; rect: { top: number; bottom: number; height: number } | null }[] = [];
    let el: Element | null = from;
    let guard = 0;
    while (el && guard < 30) {
      chain.push({ tag: el.tagName, className: typeof el.className === 'string' ? el.className.slice(0, 60) : '', rect: rectSummary(el.getBoundingClientRect()) });
      if (el === root) break;
      el = el.parentElement;
      guard += 1;
    }
    return chain.reverse(); // root-to-leaf order, matching the visual top-to-bottom ownership hierarchy
  };

  const report = () => {
    const root = document.getElementById('root');
    const tablist = document.querySelector('[role="tablist"]');
    const rootRect = root?.getBoundingClientRect();

    logEvent('viewport_diagnostics', {
      windowInnerHeight: window.innerHeight,
      windowInnerWidth: window.innerWidth,
      visualViewportHeight: window.visualViewport?.height ?? null,
      documentElementOffsetHeight: document.documentElement.offsetHeight,
      documentElementClientHeight: document.documentElement.clientHeight,
      rootBoundingClientRect: rectSummary(rootRect),
      ancestorChainRootToTablist: tablist ? walkAncestorChain(tablist, root) : null,
      computedSafeAreaInsetBottom: parseInt(window.getComputedStyle(probe).paddingBottom || '0', 10),
      isStandalone:
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as unknown as { standalone?: boolean }).standalone === true,
      userAgent: navigator.userAgent,
    });
  };

  // Fired at a few delays after mount (not just once) since the tab bar
  // itself only exists once AuthGate resolves — there's no single "layout
  // is definitely settled" moment to hook without adding real coupling to
  // auth/navigation state for what's meant to be a temporary tool. Ongoing
  // coverage afterward via the same resize/orientation/visualViewport
  // listener set build-web-pwa.js's injected --app-vh script already uses.
  requestAnimationFrame(report);
  setTimeout(report, 1000);
  setTimeout(report, 3000);
  window.addEventListener('resize', report);
  window.addEventListener('orientationchange', report);
  window.visualViewport?.addEventListener('resize', report);
}
