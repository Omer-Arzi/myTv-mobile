# MyTV as an installable PWA

## What was found before any of this work started

MyTV's web target is **Expo (react-native-web) exporting through Metro**, not
a separate frontend framework — there is exactly one app codebase (`App.tsx`
→ `src/`), and `expo export -p web` produces a static bundle
(`index.html` + one hashed JS file + assets) that's indistinguishable, from a
browser's point of view, from a hand-rolled SPA. This repo is on **Expo SDK
54**, which predates Metro web's `public/` static-folder convention (added in
SDK 56) — that one fact drives several decisions below.

By the time this specific task started, the repo already had a *substantial*
partial PWA setup from earlier work this session: `web-pwa/manifest.json`,
`web-pwa/icons/` (192/512/apple-touch-icon, generated from `assets/icon.png`
via `sips`), `web-pwa/sw-template.js`, and `scripts/build-web-pwa.js` (a
postbuild step run via `npm run build:web`, injecting all of the above into
`dist/` after `expo export -p web`, since SDK 54 has no `public/` folder to
just drop static files into). `app.json`'s `web` block already had
`bundler: metro`, `output: single`, and matching theme/background colors.
This task's job was to audit that existing setup against a much more
detailed spec, fix the real gaps found, and document the whole thing
properly — not start over.

**Deployment structure** (why `start_url`/`scope` are `/`, not assumed):
the built `dist/` is deployed as its own Railway service (`Client`,
`railway.json` here: `buildCommand: npm run build:web`), served at
`https://client-production-00eb.up.railway.app/` — the app root **is** the
site root, no subpath. HTTPS is provided by Railway automatically (required
for both installability and the service worker — browsers refuse to
register a service worker over plain HTTP except on `localhost`). The API
(`https://mytv-server-production.up.railway.app`) is a **separate Railway
service/origin**, which matters a lot for the auth and service-worker
design below.

## Gaps found and fixed this pass

1. **No maskable icon.** The manifest only declared `purpose: "any"` icons.
   Added `web-pwa/icons/icon-maskable-512-PLACEHOLDER.png` — the existing
   1024×1024 source (`assets/icon.png`) scaled to 75% and padded back out
   to a full square with the app's background color (`#0A0A0D`) via `sips`
   (macOS's built-in image tool — no new dependency), landing the artwork
   safely inside Android's ~80%-diameter maskable safe zone. This is a
   mechanical safe-zone repackaging of the existing source image, not a
   redesign — no cropping or stretching of the artwork itself.
2. **Missing `viewport-fit=cover`.** Expo's generated viewport meta tag
   doesn't include it, which means `env(safe-area-inset-*)` — what
   `react-native-safe-area-context` (`Screen.tsx`'s `SafeAreaView`, used by
   every screen) resolves to on web — silently reports `0` on notched
   iPhones in standalone mode without it. Now patched in by
   `scripts/build-web-pwa.js`, the same place the manifest/apple-touch-icon
   links already get injected (a generated file, not hand-edited).
3. **Missing standard `mobile-web-app-capable` meta tag.** Only the
   `apple-mobile-web-app-capable` (Safari-specific) tag existed. Chrome/
   Android now also recognize the non-prefixed standard tag; added
   alongside the Apple one rather than instead of it, since iOS Safari
   still specifically needs its own prefixed version.
4. **Manifest polish**: description updated to actually mention anime (per
   how the app is described to its own users), and an explicit `"id": "/"`
   added — current PWA best practice (not required, but stabilizes the
   installed app's identity across future manifest changes, e.g. if
   `start_url` ever gains query params).

Everything else audited against the spec (service worker caching strategy,
auth token storage, CORS/origin structure, HTTPS) was **already correct**
from the earlier session — see "Service worker" and "Auth" sections below
for why, rather than assuming and re-doing it.

## Files created or changed this pass

- `web-pwa/manifest.json` — maskable icon entry, `id`, description wording.
- `web-pwa/icons/icon-maskable-512-PLACEHOLDER.png` — **new, placeholder**.
- `web-pwa/sw-template.js` — comment-only clarification of update-safety
  reasoning (no behavior change — it already satisfied the spec).
- `scripts/build-web-pwa.js` — `viewport-fit=cover` patch,
  `mobile-web-app-capable` meta tag.
- `docs/pwa.md` — this file.
- `CLAUDE.md` — pointer to this doc.

(Everything else referenced above — the base manifest, icon set, service
worker structure, `app.json` web config, `railway.json` — was created in
the earlier PWA/deploy work this session, not this pass.)

## Manifest values, and why

| Field | Value | Why |
|---|---|---|
| `name` / `short_name` | `MyTV` | Matches the app's actual name everywhere else (native `app.json`, login screen). |
| `description` | "Personal TV series and anime tracker — track what you watch, see what's next, and follow upcoming releases." | Concise, matches how the app actually describes itself (Home/Watch Next/Upcoming are real features, not generic marketing copy). |
| `start_url` / `scope` | `/` | The deployed site **is** the origin root (see deployment structure above) — not assumed, verified against the actual Railway `Client` service. |
| `id` | `/` | Stabilizes installed-app identity across future manifest edits (current Chrome/Android recommendation). |
| `display` | `standalone` | Hides browser chrome (address bar, tab strip) on launch — the actual ask ("open with an app-like experience"), without going as far as `fullscreen` (which would also hide the OS status bar, fighting the safe-area handling this app already relies on). |
| `background_color` | `#0A0A0D` | The app's actual background color (`src/theme/theme.ts`'s `colors.background`) — shown as the launch splash background before the first paint. |
| `theme_color` | `#0A0A0D` | Same color, used for the OS/browser UI chrome tint (Android's status bar, Chrome's toolbar) that's still visible even in standalone mode. |
| `orientation` | `portrait` | Matches the native app's own `app.json` (`expo.orientation: "portrait"`) — a deliberate existing product decision (no landscape-specific layouts exist anywhere in this app), not a new constraint invented for this task. |
| `icons` | 192/512 (`any`) + 512 maskable | Covers both the "standard" and "adaptive/maskable" Android icon paths — see placeholder note below. |

## iOS

- `apple-touch-icon` (180×180, generated from `assets/icon.png`) — this is
  what Safari actually uses for "Add to Home Screen" on iOS; the manifest's
  own icons are a Chromium/Android convention iOS mostly ignores for this
  specific step.
- `apple-mobile-web-app-capable` + `apple-mobile-web-app-status-bar-style:
  black-translucent` + `apple-mobile-web-app-title: MyTV` — the standalone
  launch, status-bar-blends-with-dark-UI, and Home Screen label
  respectively.
- `viewport-fit=cover` — see gap #2 above.
- Deliberately **no** Apple splash-screen (`apple-touch-startup-image`)
  assets. iOS derives a **reasonable default** splash automatically from
  the manifest's `background_color` + icon when none are supplied; manually
  maintaining the full matrix of exact per-device-resolution splash images
  Apple's older docs describe is exactly the kind of asset set that goes
  stale the moment a device ships with a new screen size, and doing it
  "properly" is a bigger, separate task the actual spec here didn't ask for
  ("do not add ... unless ... can be maintained reliably").

## Android / Chromium

- Manifest is linked from `<head>` and discoverable by Chrome's
  installability check (valid JSON, required fields present, icons
  resolve, `display: standalone`, served over HTTPS).
- Maskable icon (see gap #1) covers Android's adaptive-icon masking.
- `theme_color` tints Chrome's UI in both regular-tab and (where supported)
  standalone/TWA-style launch.

## Service worker and caching strategy

**Yes, a service worker was added** (in the earlier session, reviewed and
lightly clarified in this pass) — `web-pwa/sw-template.js`, templated at
build time by `scripts/build-web-pwa.js` into `dist/sw.js`. It is
deliberately narrow:

- **Only ever caches same-origin static build output** (the HTML/JS/CSS/
  image files `expo export -p web` produces). The API
  (`mytv-server-production.up.railway.app`) is a genuinely different origin
  from the deployed app (`client-production-00eb.up.railway.app`), so the
  very first check in the fetch handler (`url.origin !== self.location.
  origin`) means the service worker **cannot** intercept or cache an API
  request even by accident — this isn't a rule that has to be remembered
  and kept correct over time, it's structurally impossible given how the
  two are deployed.
- **Navigations are network-first**: reloading/relaunching the app always
  tries the network first and only falls back to the cached shell if
  actually offline. This is what makes update behavior predictable — as
  long as you're online, relaunching always gets the current build; a
  stale build is only ever seen while genuinely offline (arguably correct
  behavior, not a bug).
- **Static, content-hashed assets use cache-first.** Expo/Metro hash the
  JS bundle's filename per build (`_expo/static/js/web/index-<hash>.js`),
  so a cache-first strategy for those specific files can never serve a
  stale one under a new deploy — a new build always has a new URL.
- **`skipWaiting()` + `clients.claim()`** on install/activate, plus deleting
  any cache whose name doesn't match the current build's version hash —
  together these mean a newly deployed version takes over immediately
  (including tabs that were already open), and there is no lingering path
  back to an old cache once a new one has installed successfully.

No PWA framework/package (Workbox, etc.) was added — the entire worker is
~50 lines of plain, dependency-free service-worker API code, which is both
simpler to fully audit against "never touch API/auth data" and avoids
pulling in something with its own update cadence to track.

**What's explicitly out of scope**: the API/tracking data does not work
offline, and this is deliberate, not a limitation to fix later — MyTV's
whole value is showing current, correct watch state; a stale cached
`/home` or `/watchlist` response would be actively misleading (e.g.
un-marking something as watched, offline, then coming back online to a
sync conflict). "Offline" here means "the app shell loads and shows its
normal loading/error UI", not "your library is browsable with no
connection."

## Auth in standalone mode

The session mechanism (see `server/docs/auth.md`) is a **bearer token
stored via AsyncStorage** (→ `localStorage` on web), sent as an
`Authorization` header on every request — deliberately **not** a cookie,
because `*.up.railway.app` is on the Public Suffix List, making the app and
API genuinely different *sites* to a browser and turning a cookie-based
session into a third-party cookie that Safari/iOS blocks by default (this
was discovered and fixed earlier this session, the hard way — see that
doc's "Why a bearer token, not a cookie"). Practically, for this task, that
means:

- **No OAuth callback/external-browser-redirect concerns at all** — login
  is a plain in-app password form POSTing directly to the API; there is no
  redirect flow of any kind to break in standalone mode.
- `localStorage` is scoped to the app's own origin and persists across
  standalone launches the same way it does in a normal Safari/Chrome tab
  for that origin — verified by logging in, then relaunching from a
  simulated fresh load (see Verification below).
- Nothing about this task weakens or bypasses that auth — the service
  worker never touches API requests (above), so it has no way to interfere
  with the token or the login flow either.

## Known limitations (not fixed in this pass — see reasoning)

- **No URL-based routing on web.** `App.tsx`'s `NavigationContainer` has no
  `linking` config. Practically: the URL bar always stays at `/` no matter
  which tab/screen you're on, so refreshing (or "nested-route refresh")
  always reloads back to the app's initial screen, not wherever you were —
  and the browser back button navigates *away from the app* rather than
  back within it, since none of the in-app navigation is reflected in
  browser history. This is a genuine, pre-existing limitation of how this
  app is built (native-first, web is a secondary target), not something
  introduced by or regressed in this PWA work. Fixing it properly means
  designing a `linking` config mapping every screen (including
  auth-gated ones) to a URL — a real, separate scope of work the task's
  own constraints ("do not rewrite unrelated architecture") argue against
  doing incidentally here.
- **Resolved: icons are now the real MyTV mark** (a geometric "M" monogram,
  drawn directly in the app's own tokens — `#0A0A0D` ground,
  a blue-tinted near-white stroke `#D7DEF7`). All of `assets/icon.png`,
  `assets/favicon.png`, `assets/splash-icon.png`, the three
  `assets/android-icon-*.png` layers, and every file under `web-pwa/icons/`
  (including `icon-maskable-512.png`, no longer `-PLACEHOLDER`) were
  regenerated from one shared SVG source, each with safe margins for its
  own mask (Android adaptive icon's ~66% safe circle was the binding
  constraint; iOS and web maskable icons have more headroom by comparison).
  No code/build changes were needed — `scripts/build-web-pwa.js` copies
  whatever's in `web-pwa/icons/` as-is into every build. Vector sources for
  all four layers (icon-with-bg, foreground-only, background-solid,
  monochrome) live in `assets/brand/monogram-*.svg` — regenerate any PNG at
  a new size by rendering that SVG at the target resolution rather than
  scaling an existing raster.
- **iOS Safari's general storage-eviction behavior** (clearing site data,
  including `localStorage`, after ~7 days of a site/PWA not being opened,
  per WebKit's Intelligent Tracking Prevention) applies here same as any
  other site — there's no PWA-specific way around this; a long-unused
  install may require logging in again. Not something this task can fix,
  worth knowing about.
- **Keyboard/on-screen-input behavior in standalone mode** wasn't verified
  on a physical device (only in headless Chromium) — text inputs
  (LoginScreen's password field, NoteEditModal, SearchScreen) should behave
  like any other web `<input>`, but real iOS Safari standalone keyboard
  interaction (viewport resize behavior specifically) is worth a real-device
  spot check the next time you have the installed app open.

## Installing it

**iPhone (Safari)**:
1. Open `https://client-production-00eb.up.railway.app` in Safari (must be
   Safari specifically — Chrome/Firefox on iOS can't add a standalone PWA
   the same way).
2. Tap the Share icon → "Add to Home Screen".
3. Confirm the name shown is "MyTV" and the icon matches
   `apple-touch-icon.png` before tapping Add.
4. Launch from the new Home Screen icon — it should open without Safari's
   address bar/tab UI.

**Android (Chrome)**:
1. Open the same URL in Chrome.
2. Chrome should offer an "Install app" / "Add to Home screen" prompt
   automatically (or via the ⋮ menu → "Add to Home screen" /
   "Install app").
3. Confirm the name/icon shown match MyTV before installing.
4. Launch from the Home Screen/app drawer — opens standalone, no browser
   chrome.

## Addendum: white gap below the tab bar persisted after the 100dvh fix

The `100dvh` height fix above (commit `f37cce4`) reduced but did not fully
eliminate a white strip below the bottom tab bar on a real installed iPhone
PWA, confirmed via a real-device screenshot. Root cause turned out to be one
level deeper than the CSS unit itself:

`react-native-safe-area-context`'s web provider
(`node_modules/react-native-safe-area-context/src/NativeSafeAreaProvider.web.tsx`)
derives the app's entire layout frame from
`document.documentElement.offsetHeight`, read **once** at mount (plus one
delayed correction ~50ms later via a CSS-transition trick) — there is no
resize listener at all (confirmed identical in the latest published version,
5.8.0, so this isn't a fixed-upstream bug). `100dvh` makes the `<html>`
element's *eventual* height correct, but nothing guarantees it has already
resolved to the true edge-to-edge standalone-mode height at the exact moment
that one-time measurement runs. If it captures a shorter value, the app
permanently sizes itself smaller than the physical screen — the leftover
strip is literally unstyled page background (default white) outside the
React tree's rendered box, not a native home-indicator artifact.

**Fix** (`scripts/build-web-pwa.js`): an inline, synchronous script in
`<head>` (runs before the deferred app bundle even starts downloading) sets
a `--app-vh` custom property from `window.visualViewport.height` — supported
since iOS 13, well before `dvh` existed — and keeps it in sync via
`resize`/`orientationchange`/`visualViewport resize` listeners. The height
rule is now a three-tier progressive-enhancement chain:
`height: 100%` → `height: 100dvh` → `height: var(--app-vh, 100dvh)`, each
one only taking effect where the previous one is supported, so by the time
`react-native-safe-area-context` reads `offsetHeight`, it reads the real
measured viewport rather than a CSS unit that may not have settled yet.

**Verification limitation**: this could only be checked structurally
(confirmed the script/CSS ships correctly in `dist/index.html`, no
regressions in Chromium/WebKit via Playwright) — the actual bug is specific
to real iOS standalone display mode, which Playwright's device emulation
does not reproduce (no browser-chrome-hiding behavior, no real home
indicator). **Needs a real-device re-check** after the next deploy.

### Second addendum: still present after the visualViewport fix

Real-device re-test reported the white strip "exactly like before" — the
`--app-vh` fix above made no visible difference. Re-grepped the entire
`dist/` output for any `background-color` declaration on `html`/`body`:
there wasn't one, anywhere — Expo's generated reset only ever sets
`height`, never a background. Whatever the exact residual gap turns out to
be (this pass didn't find a way to prove the precise remaining cause on
real iOS standalone display mode — see the verification limitation above,
still unresolved), it was rendering as the browser's plain default white,
not this app's own dark background. Added
`background-color: #0A0A0D;` to the same `html, body` reset block as a
fourth declaration. This isn't "painting over" the layout bug — the height
math above is left entirely in place — it's a genuinely missing
declaration for a dark-themed app's root elements, independent of whatever
causes any small gap: with it, such a gap is the app's own color instead
of a jarring white one. Still needs a real-device re-check; if the strip
persists even now, the next step is measuring `document.documentElement`'s
actual rendered box against `window.visualViewport` live on a real device
(e.g. via Safari's remote Web Inspector) rather than reasoning about it
from a desktop/emulated environment again.

### Third addendum: real-device re-check confirmed the gap, plus a second, unrelated bug found alongside it

A real-device screenshot (installed iPhone PWA, Home tab) confirmed the black gap below the tab bar is
still present — the second addendum's fix (`background-color: #0A0A0D`) is working as intended (it's
black, not the earlier white), but the underlying gap itself, per that addendum, remains open. The same
screenshot surfaced a **second, distinct, previously-undocumented bug**: a dark band *above* the tab
bar, cutting into the last visible card, plus tab labels ("Watchlist", "Library") not rendering fully.

**The dark band above the bar turned out to be unrelated to the `offsetHeight`/`dvh` timing issue
above** — reading `@react-navigation/bottom-tabs`' actual source (`BottomTabView.js`) confirmed the tab
bar is laid out as a normal flex sibling above the screen content (`flexDirection: 'column'`, `screens:
{ flex: 1 }`), never an absolutely-positioned overlay, and it already fully reserves
`insets.bottom` for its own height (`getTabBarHeight`: `height: 49 + insets.bottom`, `paddingBottom:
insets.bottom` — these cancel out to a stable 49px content budget regardless of the inset's actual
value). Because it's a real flex sibling, no screen ever needs its own bottom safe-area padding — but
every tab-root screen was adding one anyway (`Screen.tsx`'s default `edges = ['top', 'bottom']`, used
unmodified by `HomeScreen`/`SearchScreen`/`LibraryScreen`; `WatchlistScreen`'s own top-level
`SafeAreaView` did the same with `edges={['top', 'bottom']}`, having previously only solved *doubling
within itself*, not against the tab bar externally). **Fixed** by dropping `'bottom'` from all four
tab-root screens' `edges` (`Screen.tsx`'s own default is untouched — still correct for non-tab-root,
stack-pushed screens with no sibling tab bar). Verified structurally via a local build served against
the local dev API (headless Chromium, 414×896 viewport): the dark band is gone on all four tabs, and
all four tab labels now render fully — this is not itself proof the label issue's root cause was
exactly as diagnosed (see below), only that it's no longer reproducing.

**The tab-label issue**: hypothesized as a `react-native-web` flexbox text-truncation gap — the
library's own `Label` component sets `numberOfLines={1}` (should ellipsize long text), but web
flexbox children default to `min-width: auto`, which lets intrinsic text width win over the item's
allotted space unless something sets `min-width: 0` explicitly. Added `tabBarItemStyle: { minWidth: 0
}` to `TabNavigator.tsx`'s `screenOptions` as a low-risk, purely-additive fix. Could not independently
confirm this was the exact original mechanism (the reporting screenshot's own hand-drawn annotation
covered the affected labels), but post-fix verification shows all four labels rendering fully with no
regression to the ones that already fit.

**Also added, targeting this addendum's own still-open gap specifically**: a CSS-only safety net
independent of the JS-measured insets entirely, in `scripts/build-web-pwa.js`'s injected `<head>`
block — `div:has(> [role="tablist"]) { padding-bottom: env(safe-area-inset-bottom) !important;
min-height: calc(49px + env(safe-area-inset-bottom)) !important; }`. `@react-navigation/bottom-tabs`
gives its tab-items row a stable `role="tablist"` (confirmed in its own source, and it's the only such
element in this app), so targeting its parent — the actual bar element carrying height/padding — via
`:has()` is safe and specific. `env()` resolves natively and synchronously in CSS, with no JS
measurement race at all, sidestepping the `offsetHeight` timing problem this addendum describes for at
least this one highly-visible element. Verified structurally (the selector matches the correct DOM
node, computed styles reflect the rule) via headless Chromium — but a normal desktop/emulated browser
has no real safe-area inset to observe, so **this remains an unproven best-effort mitigation, not a
confirmed fix — still needs the same real-device re-check this whole addendum chain keeps needing.**

### Fourth addendum: real root cause found via real-device telemetry, not another structural guess

Three more rounds of structural reasoning (this file, extensively) and Chromium/Playwright-based
verification never actually confirmed or denied whether the gap was fixed — because neither can
reproduce a real notched iPhone's `env(safe-area-inset-bottom)` or standalone-mode
`window.visualViewport` behavior at all (confirmed directly: Chromium's own CDP
`Emulation.setSafeAreaInsetsOverride` rejects every parameter shape tried, current build). Rather than
a fifth structural guess, this pass added `installViewportDiagnosticsLogger` (`src/utils/
remoteLogger.ts`, wired into `App.tsx`) — reusing the existing `POST /client-logs` → `railway logs`
pipeline this app already has for exactly this class of bug — to report real window/`visualViewport`/
`documentElement` heights, `#root` and the tab bar's actual bounding rects, and an independently-
measured `env(safe-area-inset-bottom)`, from the real installed PWA.

**What it showed, verbatim (timestamps from `railway logs`):**

- **10:47:09–10, fresh load, Home tab**: `windowInnerHeight: 874`, `visualViewportHeight: 874`,
  `computedSafeAreaInsetBottom: 34`, `isStandalone: true`. Tab bar `bottom: 874` — flush with the
  window, **no gap**. The `--app-vh` mechanism was working correctly at this point.
- **10:47:12.491, navigating into Search**: still `windowInnerHeight: 874`, still no gap.
- **10:47:12.547, 56ms later**: `visualViewportHeight: 498` — `windowInnerHeight` unchanged at `874`.
  Because `--app-vh` was bound to `visualViewport`'s own `resize` event, this single event
  immediately shrank the entire root container (`#root`, tab bar included) to `498px` tall while the
  physical screen stayed `874px` — a **376px black gap**, live, matching exactly what was reported.
- **10:47:13.710, ~1.2s later**: settled at `windowInnerHeight: 812`, `visualViewportHeight: 812` —
  internally consistent again (no gap at that instant), but **62px shorter than the original 874**,
  with nothing left to ever correct it back.

**Root cause**: Search's text input triggers iOS's on-screen-keyboard viewport handling, and even a
brief focus/blur cycle causes `visualViewport.height` to dip and then permanently under-report
afterward — an iOS Safari standalone-mode quirk, not anything under this app's control. The `--app-vh`
script trusted every `resize`/`visualViewport` `resize` event unconditionally, so it inherited both the
transient glitch and the permanent under-report. This is a different, more specific bug than anything
earlier addenda considered — not a CSS-ownership problem (the tab bar's own height/padding/background
model was independently verified correct this pass by reproducing its exact DOM/CSS in an isolated
harness), and not a double-inset problem (none exists currently). It only manifests after interacting
with a screen that has a text input, which is exactly what earlier real-device reports ("looked fine at
first, came back after visiting Search") were actually describing.

**Fix**: `scripts/build-web-pwa.js`'s `--app-vh` script now only re-measures on `orientationchange` —
a real, rare, layout-significant event — never on plain `resize`/`visualViewport` `resize`. This app is
portrait-locked (`app.json`'s `expo.orientation: "portrait"`), so `orientationchange` alone is
sufficient coverage for any resize that should legitimately reshape the app shell; a keyboard
appearing should never do that. The diagnostic logger is left in place for one more deploy to confirm
this against real telemetry rather than trusting it blind — remove `installViewportDiagnosticsLogger`
(`App.tsx`/`remoteLogger.ts`) once confirmed.

### Fifth addendum: the app's own DOM/CSS is now proven correct at every level — the remaining gap, if
### any, is outside this app's code entirely

The `--app-vh` fix above stopped the *keyboard-triggered* collapse, but a real-device report said a
(smaller) gap was still visible even on a fresh cold open, before touching anything. Rather than add a
sixth CSS guess, this pass added two things: a temporary nested-`outline` debug `<style>` block (one
distinct color per wrapping level, `html` down to `[role="tablist"]`, using `outline`/`outline-offset`
specifically because `outline` never affects box size or position — pure visualization, zero risk of
changing the actual bug), and — more decisively — extended `installViewportDiagnosticsLogger` to walk
the real DOM ancestor chain from the tab bar up to `#root` and report every level's actual
`getBoundingClientRect()`, rather than a couple of hand-picked levels.

Real-device screenshots of the outline CSS first ruled out the root container: `html`/`#root`'s rings
reached almost all the way to the true physical bottom edge, while the tab bar's own ring stopped well
short — narrowing the gap to *somewhere between* `#root` and the tab bar. The follow-up ancestor-chain
telemetry then closed the question completely. Verbatim, from a real installed iPhone PWA:

```
#root:                  top:0,   bottom:812, height:812
SafeAreaProvider:        top:0,   bottom:812, height:812
NavigationContainer:     top:0,   bottom:812, height:812
RootNavigator:           top:0,   bottom:812, height:812
(3 more intermediate wrappers, all identical)
SafeAreaProviderCompat:  top:0,   bottom:812, height:812
tab bar's own box:       top:729, bottom:812, height:83
[role="tablist"] row:    top:730, bottom:778, height:48
```

**Every single level, with no exception, is `bottom: 812` — exactly matching `windowInnerHeight: 812`
measured in the same payload.** The tab bar's own box is not short by even one pixel relative to what
the browser reports as the available viewport. There is no CSS/layout bug left anywhere in this app's
own code — full stop, proven by measurement, not inferred from a clean-looking screenshot.

**What's actually happening**: `window.innerHeight`/`window.visualViewport.height` themselves are
reporting `812` while the device's true physical screen height is `874` (the value seen on this same
device's very first-ever clean reading, days earlier, before any of this session's testing). This is a
browser/OS-level number — the app is correctly using 100% of what iOS *tells* it is available; iOS
itself is under-reporting by ~62px in standalone mode, for reasons outside any JS or CSS running inside
the page's own document to detect or override. Both the debug outline CSS and the earlier CSS-only
`div:has(> [role="tablist"])` safety net were removed once this was confirmed — they can't fix a number
the browser itself is wrong about, and the safety net's own `env(safe-area-inset-bottom)` reads
correctly (`34`, consistent across every real-device reading this whole investigation), so it was never
actually the missing piece either.

**Next step, if this persists**: this looks like a stale/incorrect WKWebView viewport metric cached
against the specific installed Home Screen web-clip, not something fixable in-app. The next thing to
try is deleting the installed MyTV icon and re-adding it fresh (Safari → Share → Add to Home Screen) to
force iOS to re-measure from scratch — not yet confirmed either way. `installViewportDiagnosticsLogger`
is left in place specifically to check whether a fresh reinstall restores `874`; remove it
(`App.tsx`/`remoteLogger.ts`) once that's resolved one way or the other.
