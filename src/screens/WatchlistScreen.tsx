import { useRef, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useScrollToTop } from '@react-navigation/native';
import { WatchListPanel } from '../components/WatchListPanel';
import { UpcomingTimeline, UpcomingTimelineHandle } from '../components/UpcomingTimeline';
import { colors, radii, spacing, typography } from '../theme/theme';
import { WatchlistItem } from '../api/types';
import { logEvent } from '../utils/remoteLogger';

type ShowsMode = 'watchlist' | 'upcoming';

// "What can I watch now?" (Watch List) vs. "What was released, releases
// today, and releases next?" (Upcoming) — two modes of the same Shows tab.
// Both subtrees stay mounted at all times; switching only toggles RN's
// `display: 'none'` on the inactive one (never a conditional unmount) — this
// is what makes "preserve Watch List state" and "preserve Upcoming scroll
// position during the session" free: no remount, no query-cache loss, no
// refetch, no scroll-position loss, for either side, with no extra
// state-preservation code. See server/docs/upcoming-timeline-todo.md
// "Frontend structure".
export function WatchlistScreen() {
  const [mode, setMode] = useState<ShowsMode>('watchlist');
  const watchListScrollRef = useRef<SectionList<WatchlistItem>>(null);
  const upcomingRef = useRef<UpcomingTimelineHandle>(null);

  // Exactly ONE useScrollToTop registration for the whole Shows tab —
  // deliberately not one per panel (that was the "could accidentally call
  // both lists" gap flagged in Phase 4-6 and fixed in Phase 8, see
  // server/docs/upcoming-timeline-todo.md). The dispatcher's scrollToTop
  // method is reassigned on every render (mutating a ref during render is
  // safe — it's not part of the render output) so it always closes over
  // the CURRENT `mode` and refs, never a stale value from whenever this ref
  // object was first created.
  const scrollDispatcherRef = useRef<{ scrollToTop: () => void }>({ scrollToTop: () => {} });
  scrollDispatcherRef.current.scrollToTop = () => {
    if (mode === 'watchlist') {
      watchListScrollRef.current?.scrollToLocation({ sectionIndex: 0, itemIndex: 0, animated: true, viewOffset: 0 });
    } else {
      upcomingRef.current?.scrollToToday();
    }
  };
  useScrollToTop(scrollDispatcherRef);

  return (
    // A single top-level safe area for the whole screen (switch row +
    // both panels) — each panel's own inner chrome (Screen/UpcomingTimeline)
    // renders with edges={[]} so the top/bottom inset is only ever applied
    // once, not doubled.
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.switchRow}>
        <Pressable
          style={[styles.switchButton, mode === 'watchlist' && styles.switchButtonActive]}
          onPress={() => {
            logEvent('watchlist_mode_change', { mode: 'watchlist' });
            setMode('watchlist');
          }}
        >
          <Text style={[styles.switchLabel, mode === 'watchlist' && styles.switchLabelActive]}>WATCH LIST</Text>
        </Pressable>
        <Pressable
          style={[styles.switchButton, mode === 'upcoming' && styles.switchButtonActive]}
          onPress={() => {
            logEvent('watchlist_mode_change', { mode: 'upcoming' });
            setMode('upcoming');
          }}
        >
          <Text style={[styles.switchLabel, mode === 'upcoming' && styles.switchLabelActive]}>UPCOMING</Text>
        </Pressable>
      </View>

      <View style={[styles.panel, mode !== 'watchlist' && styles.hidden]}>
        <WatchListPanel ref={watchListScrollRef} />
      </View>
      <View style={[styles.panel, mode !== 'upcoming' && styles.hidden]}>
        <UpcomingTimeline ref={upcomingRef} isActive={mode === 'upcoming'} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  switchRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.full,
    padding: 4,
  },
  switchButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    alignItems: 'center',
  },
  switchButtonActive: { backgroundColor: colors.accent },
  switchLabel: { ...typography.caption, fontWeight: '700', color: colors.textSecondary },
  switchLabelActive: { color: '#0A0A0D' },
  panel: { flex: 1 },
  hidden: { display: 'none' },
});
