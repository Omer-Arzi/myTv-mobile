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
- **Maskable icon (and all current icons) are placeholder-derived.**
  `assets/icon.png` itself is a generic placeholder (visibly not real MyTV
  branding — confirmed by looking at it), not a temporary "final" logo.
  Every file under `web-pwa/icons/` is downstream of that same placeholder.
  **Exactly what to replace once a final logo exists**, and how:
  1. Replace `assets/icon.png` (1024×1024) with the final artwork — this
     also feeds the **native** iOS/Android app icons, so getting this one
     file right covers both platforms.
  2. Regenerate the PWA-specific derived files from it:
     `web-pwa/icons/icon-192.png`, `icon-512.png`, `apple-touch-icon.png`
     (plain resizes), and `icon-maskable-512-PLACEHOLDER.png` (should be
     regenerated from — ideally — a maskable-safe export the designer
     provides directly, with intentional safe-zone padding baked into the
     actual artwork, rather than this pass's mechanical 75%-scale-and-pad
     placeholder). Rename away the `-PLACEHOLDER` suffix once that happens
     and update the one reference to it in `web-pwa/manifest.json`.
  3. No code/build changes are needed beyond replacing these image files —
     `scripts/build-web-pwa.js` copies whatever's in `web-pwa/icons/`
     as-is into every build.
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
   `apple-touch-icon.png` (currently the placeholder icon — see limitations
   above) before tapping Add.
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
