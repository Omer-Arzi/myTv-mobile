// Injects PWA support (manifest, icons, service worker) into the static
// output of `expo export -p web`. Needed because this project is on Expo
// SDK 54, which predates Metro web's `public/` folder convention (added in
// SDK 56) — see mobile/CLAUDE.md's PWA notes. Run via `npm run build:web`.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');
const pwaDir = path.join(root, 'web-pwa');

if (!fs.existsSync(distDir)) {
  console.error('dist/ not found — run `expo export -p web` first (or use `npm run build:web`).');
  process.exit(1);
}

function walk(dir, base = dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, base, out);
    } else if (!entry.name.endsWith('.map')) {
      out.push('/' + path.relative(base, full).split(path.sep).join('/'));
    }
  }
  return out;
}

// Copy manifest + icons into dist/ before computing the precache list, so
// they're included in it.
fs.copyFileSync(path.join(pwaDir, 'manifest.json'), path.join(distDir, 'manifest.json'));
const distIconsDir = path.join(distDir, 'icons');
fs.mkdirSync(distIconsDir, { recursive: true });
for (const file of fs.readdirSync(path.join(pwaDir, 'icons'))) {
  fs.copyFileSync(path.join(pwaDir, 'icons', file), path.join(distIconsDir, file));
}

const precacheUrls = walk(distDir).filter((url) => url !== '/sw.js');
const cacheVersion = crypto.createHash('sha1').update(precacheUrls.join(',')).digest('hex').slice(0, 12);

const swTemplate = fs.readFileSync(path.join(pwaDir, 'sw-template.js'), 'utf8');
const sw = swTemplate
  .replace('__CACHE_VERSION__', cacheVersion)
  .replace('__PRECACHE_URLS__', JSON.stringify(precacheUrls));
fs.writeFileSync(path.join(distDir, 'sw.js'), sw);

// Patch the generated index.html with PWA meta tags + service worker
// registration. Idempotent: bails out if already injected (re-running the
// build script shouldn't double-inject on top of a stale dist/).
const indexPath = path.join(distDir, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
if (!html.includes('rel="manifest"')) {
  // viewport-fit=cover is required for env(safe-area-inset-*) to report
  // real (nonzero) values at all on notched iPhones — without it, the
  // safe-area insets react-native-safe-area-context relies on throughout
  // this app (Screen.tsx's SafeAreaView) silently resolve to 0 in
  // standalone/installed mode. Expo's own generated viewport tag doesn't
  // include it, so it's added here rather than by hand-editing a
  // generated file.
  html = html.replace(
    '<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />',
  );

  // Expo/react-native-web's own generated reset sizes html/body/#root via
  // percentage height ("height: 100%"), which iOS Safari — especially in
  // standalone (Add to Home Screen) mode — doesn't reliably resolve to the
  // true dynamic visual viewport. The whole app can end up rendering
  // shorter than the physical screen: a white gap (the page's default
  // background) below the app, and the bottom tab bar (fixed height)
  // squeezed into less room than its own layout expects, clipping labels.
  // `100dvh` is the current, purpose-built fix for exactly this — but it's
  // added as a SECOND declaration after the existing "100%", not a
  // replacement: an unsupported value is ignored outright by the CSS
  // parser (not treated as invalid-so-fall-back-to-auto), so older
  // browsers silently keep the working "100%" and only browsers that
  // understand dvh take the later, correct declaration. Native iOS/Android
  // are entirely unaffected — this is DOM/CSS-only.
  html = html.replace(
    'html,\n      body {\n        height: 100%;\n      }',
    'html,\n      body {\n        height: 100%;\n        height: 100dvh;\n      }',
  );

  const injected = `
    <link rel="manifest" href="/manifest.json">
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="MyTV">
    <script>
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
      }
    </script>
  </head>`;
  html = html.replace('</head>', injected);
  fs.writeFileSync(indexPath, html);
}

console.log(`PWA assets injected into dist/ (cache version ${cacheVersion}, ${precacheUrls.length} precached files).`);
