# MyTv — Mobile

React Native client for MyTv, built against the backend documented in `../server/API_CONTRACT.md`. Expo + TypeScript + React Navigation (bottom tabs) + TanStack Query. No auth yet — every request is implicitly the backend's single hardcoded dev user.

## Prerequisites

- The backend running locally (`cd ../server && npm run start:dev`, defaults to `http://localhost:3000`)
- [Expo Go](https://expo.dev/go) on a physical device, or an iOS Simulator / Android emulator

## Setup

```bash
npm install
cp .env.example .env   # adjust EXPO_PUBLIC_API_BASE_URL if needed — see below
npm start
```

Then press `i` for iOS Simulator, `a` for Android emulator, or scan the QR code in Expo Go.

### Backend URL

Set via `EXPO_PUBLIC_API_BASE_URL` in `.env` (Expo inlines `EXPO_PUBLIC_*` vars at build time):

| Target | URL |
| --- | --- |
| iOS Simulator | `http://localhost:3000` (default — Simulator shares your Mac's network) |
| Physical device (Expo Go) | `http://<your-Mac's-LAN-IP>:3000` — find it with `ipconfig getifaddr en0` |
| Android emulator | `http://10.0.2.2:3000` |

## Troubleshooting: "Can't reach the server"

If the app loads in Expo Go but every screen shows a connection error, it's almost always one of these:

1. **Backend isn't running.** `cd ../server && npm run start:dev` and confirm it's listening on port 3000.
2. **`EXPO_PUBLIC_API_BASE_URL` is wrong for your setup** — check `.env` against the table above (Simulator vs physical device vs Android emulator each need a different value).
3. **Testing on a physical iPhone with `localhost` in `.env`.** On a real device, `localhost` means the phone itself, not your Mac — this is the most common cause. Get your Mac's LAN IP and use that instead:

   ```bash
   ipconfig getifaddr en0
   ```

   Update `.env`:

   ```
   EXPO_PUBLIC_API_BASE_URL=http://<the-ip-from-above>:3000
   ```

   Your phone and Mac must be on the same Wi-Fi network for this to work.

4. **Restart Expo with a cleared cache** after editing `.env` — `EXPO_PUBLIC_*` vars are inlined at build time, so a plain reload won't pick up the change:

   ```bash
   npx expo start -c
   ```

## Scripts

```bash
npm start        # expo start
npm run ios       # expo start --ios
npm run android   # expo start --android
npm run web       # expo start --web
npm run typecheck # tsc --noEmit
npm run lint      # expo lint
```

## Folder structure

```
App.tsx                        Root: SafeAreaProvider + QueryClientProvider + NavigationContainer
index.ts                       Expo entry point (registerRootComponent) — generated, not touched
src/
  api/
    config.ts                  API_BASE_URL, read from EXPO_PUBLIC_API_BASE_URL
    client.ts                  Typed fetch wrapper (apiClient.get/post/patch/delete) + ApiError
    queryKeys.ts                Centralized TanStack Query key builders
    types/                      Request/response types, one file per resource — mirrors the
                                 backend's DTOs field-for-field (see each file's header comment
                                 for which server file it mirrors)
    endpoints/                  One function per backend call (getHome, getWatchlist,
                                 getSeriesDetail, listSeries, updateSeriesStatus)
  navigation/
    types.ts                    RootStackParamList / TabParamList + React Navigation type augmentation
    RootNavigator.tsx            Native-stack: Tabs screen + SeriesDetail pushed on top
    TabNavigator.tsx             Bottom tabs: Home / Watchlist / Search
  screens/
    HomeScreen.tsx                GET /home — Recently Watched / Watch Next / Haven't Watched For A While
    WatchlistScreen.tsx           GET /watchlist
    SearchScreen.tsx              Placeholder only — no backend search endpoint exists yet
    SeriesDetailScreen.tsx        GET /series/:id — backdrop/poster/overview/status, seasons/episodes
  components/
    SeriesCard.tsx                 Poster thumbnail + title/subtitle/status badges row
    EpisodeRow.tsx                 Episode still + watched state/watchedAt/note/episodeWatchId
    SectionHeader.tsx, EmptyState.tsx, LoadingView.tsx, ErrorView.tsx
  utils/
    format.ts                     Date formatting, "S1E5 — Title" episode labels
    errors.ts                     ApiError -> user-facing message
```

## What's deliberately not built yet

- **Search** — placeholder screen; the backend has no search/add endpoint to call (`GET /series` is a "my library" view, not a catalog browse — see `API_CONTRACT.md`).
- Visual polish — layout/styling is intentionally minimal; this pass is about correct data flow end-to-end.

Note: this list predates a batch of features added since (swipe-to-watch, note editing, a Library
status-browse screen, and — as of `server/docs/on-hold-dropped-status-todo.md` — manual status
changes via a series-page options menu), so it's narrower than it used to be; not otherwise
audited/refreshed as part of that task.
