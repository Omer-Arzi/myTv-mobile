import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getLibraryRefreshStatus, startLibraryRefresh } from '../api/endpoints/sync';
import { queryKeys } from '../api/queryKeys';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/SectionHeader';
import { UserSeriesStatus } from '../api/types';
import { colors, radii, spacing, typography } from '../theme/theme';
import { formatStatusLabel } from '../utils/format';
import { appAlert } from '../utils/appAlert';
import { getErrorMessage } from '../utils/errors';

// Every user-settable personal status (WATCHLIST included — unlike the
// Watch List panel's STATUS_FILTERS, there's no reason to exclude it here;
// "fetch just my watchlist's provider data" is a perfectly reasonable
// System-tab request even though it's not one of Watch List's browse tabs).
const STATUS_OPTIONS: UserSeriesStatus[] = ['WATCHING', 'CAUGHT_UP', 'COMPLETED', 'PAUSED', 'DROPPED', 'WATCHLIST'];

// Modest polling cadence while a job is running — see
// server/src/modules/sync/library-refresh-job.service.ts's own doc comment
// ("do not make the client poll excessively"). Disabled entirely once the
// job reaches a terminal status (see the refetchInterval function below).
const POLL_INTERVAL_MS = 2500;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

// The admin/utility tab (mobile/docs/tab-restructure-todo.md) — lets the
// user manually kick off a DB refresh scoped to whichever personal
// status(es) they pick, instead of waiting for the hourly automatic
// scheduler or opening every series page individually. Selecting zero
// statuses and pressing Fetch matches the server's own default (every
// tracked status), same as if the whole-library refresh had been
// requested directly.
export function SystemScreen() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<UserSeriesStatus>>(new Set());

  const { data: status } = useQuery({
    queryKey: queryKeys.syncStatus,
    queryFn: getLibraryRefreshStatus,
    // Only re-polls while the most recently observed job is still RUNNING —
    // a terminal status (COMPLETED/PARTIAL/FAILED) or no job at all stops
    // the interval entirely rather than polling forever in the background.
    refetchInterval: (query) => (query.state.data?.latestJob?.status === 'RUNNING' ? POLL_INTERVAL_MS : false),
  });

  const mutation = useMutation({
    mutationFn: () => startLibraryRefresh(Array.from(selected)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.syncStatus });
    },
    onError: (err: unknown) => {
      appAlert('Could Not Start Fetch', getErrorMessage(err));
    },
  });

  const toggleStatus = (target: UserSeriesStatus) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(target)) next.delete(target);
      else next.add(target);
      return next;
    });
  };

  const job = status?.latestJob ?? null;
  const isRunning = job?.status === 'RUNNING';
  const fetchDisabled = mutation.isPending || isRunning;

  return (
    <Screen edges={['top']}>
      <SectionHeader title="Fetch by status" subtitle="Choose which shows to check for updates, or none for everything." />
      <View style={styles.pillRow}>
        {STATUS_OPTIONS.map((option) => {
          const active = selected.has(option);
          return (
            <Pressable key={option} style={[styles.pill, active && styles.pillActive]} onPress={() => toggleStatus(option)}>
              <Text style={[styles.pillLabel, active && styles.pillLabelActive]}>{formatStatusLabel(option)}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.pressed, fetchDisabled && styles.disabled]}
          onPress={() => mutation.mutate()}
          disabled={fetchDisabled}
        >
          <Text style={styles.buttonText}>
            {isRunning ? 'Fetching…' : selected.size > 0 ? `Fetch ${selected.size} Selected` : 'Fetch All'}
          </Text>
        </Pressable>
      </View>

      {job ? (
        <>
          <SectionHeader title="Latest run" />
          <View style={styles.card}>
            <Row label="Status" value={formatStatusLabel(job.status)} />
            <Row label="Progress" value={`${job.checkedSeries} / ${job.totalSeries}`} />
            <Row label="New episodes found" value={String(job.seriesWithNewEpisodes)} />
            <Row label="New seasons found" value={String(job.seriesWithNewSeasons)} />
            <Row label="Needs manual review" value={String(job.seriesManualReview)} />
            <Row label="Failed" value={String(job.seriesFailed)} />
            {job.lastError ? <Text style={styles.errorText}>{job.lastError}</Text> : null}
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceElevated,
  },
  pillActive: { backgroundColor: colors.accent },
  pillLabel: { ...typography.caption, fontWeight: '600' },
  pillLabelActive: { color: '#0A0A0D' },
  actions: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  button: { paddingVertical: spacing.md, borderRadius: radii.md, alignItems: 'center', backgroundColor: colors.accent },
  buttonText: { ...typography.body, fontWeight: '700', color: '#0A0A0D' },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
  card: {
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { ...typography.bodySecondary },
  rowValue: { ...typography.body, fontWeight: '600' },
  errorText: { ...typography.bodySecondary, color: colors.warning },
});
