import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { search as searchApi, addSearchResult } from '../api/endpoints/search';
import { queryKeys } from '../api/queryKeys';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/SectionHeader';
import { SearchResultCard, SearchResultAddState } from '../components/SearchResultCard';
import { SearchResultSkeletonList } from '../components/SearchResultSkeleton';
import { Toast } from '../components/Toast';
import { RootStackParamList } from '../navigation/types';
import { SeriesSearchResult } from '../api/types';
import { addRecentSearch, clearRecentSearches, getRecentSearches } from '../utils/recentSearches';
import { needsReviewTarget } from '../utils/searchResultCopy';
import { getErrorMessage } from '../utils/errors';
import { colors, radii, spacing, typography } from '../theme/theme';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;

// A "living, library-aware discovery screen" (per the approved UX plan),
// not a raw provider-results list. Every result already carries this
// user's local-library state; the card body navigates, a trailing icon
// (when present) is the only action. See SearchResultCard for the
// navigation-vs-action split this screen relies on.
export function SearchScreen() {
  const navigation = useNavigation<Navigation>();
  const queryClient = useQueryClient();

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [addingKeys, setAddingKeys] = useState<Set<string>>(new Set());
  const [treatedAsDifferent, setTreatedAsDifferent] = useState<Set<string>>(new Set());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    getRecentSearches().then(setRecentSearches);
  }, []);

  // Search-as-you-type: 300ms after the last keystroke, never one request
  // per keystroke. The in-flight query key itself (debouncedQuery) is what
  // makes a stale response impossible to apply — react-query only ever
  // resolves the LATEST query for a given key, and switching keys mid-flight
  // abandons the previous one rather than racing it.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const trimmedQuery = debouncedQuery.trim();
  const isQueryLongEnough = trimmedQuery.length >= MIN_QUERY_LENGTH;

  const resultsQuery = useInfiniteQuery({
    queryKey: queryKeys.search(trimmedQuery),
    queryFn: ({ pageParam }: { pageParam: string | null }) => searchApi(trimmedQuery, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: isQueryLongEnough,
  });

  // Refresh the local-library overlay when Search regains focus (e.g.
  // returning from Series Detail after a status change) — never
  // automatically re-runs the provider query otherwise.
  const isInitialFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (isInitialFocus.current) {
        isInitialFocus.current = false;
        return;
      }
      if (isQueryLongEnough) void resultsQuery.refetch();
      // resultsQuery itself is deliberately excluded — react-query returns
      // a new object identity every render, so including it here would
      // re-run this effect (and refetch) on every keystroke instead of
      // only on refocus. refetch is stable across renders for the same
      // query key, which is the only piece of resultsQuery this needs.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isQueryLongEnough, resultsQuery.refetch]),
  );

  const addMutation = useMutation({
    mutationFn: (params: { resultKey: string; provider: 'tmdb' | 'tvmaze'; providerId: string }) => addSearchResult(params.provider, params.providerId),
    onMutate: (params) => setAddingKeys((prev) => new Set(prev).add(params.resultKey)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['search'] });
    },
    onError: () => setToastMessage("Couldn't add — try again"),
    onSettled: (_data, _err, params) =>
      setAddingKeys((prev) => {
        const next = new Set(prev);
        next.delete(params.resultKey);
        return next;
      }),
  });

  const runSearch = useCallback((value: string) => {
    setQuery(value);
    setDebouncedQuery(value);
  }, []);

  const submitRecentSearch = useCallback(
    async (value: string) => {
      runSearch(value);
      setRecentSearches(await addRecentSearch(value));
    },
    [runSearch],
  );

  // Committed once results actually load for a long-enough query — typing
  // itself doesn't spam recent searches, only a query that actually ran.
  useEffect(() => {
    if (isQueryLongEnough && resultsQuery.data && !resultsQuery.isFetching) {
      addRecentSearch(trimmedQuery).then(setRecentSearches);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isQueryLongEnough, trimmedQuery, resultsQuery.isFetching]);

  const allResults = useMemo(() => resultsQuery.data?.pages.flatMap((p) => p.results) ?? [], [resultsQuery.data]);
  const hadProviderFailure = resultsQuery.data?.pages.some((p) => p.hadProviderFailure) ?? false;

  const effectiveResults = useMemo(
    () =>
      allResults.map((result): SeriesSearchResult => {
        if (result.libraryMatch.type === 'POSSIBLE' && treatedAsDifferent.has(result.resultKey)) {
          return { ...result, libraryMatch: { type: 'NONE' }, primaryAction: 'ADD_TO_WATCHLIST' };
        }
        return result;
      }),
    [allResults, treatedAsDifferent],
  );

  const sections = useMemo(() => {
    const inLibrary = effectiveResults.filter((r) => r.libraryMatch.type !== 'NONE');
    const external = effectiveResults.filter((r) => r.libraryMatch.type === 'NONE');
    return [
      ...(inLibrary.length > 0 ? [{ title: 'In Your Library', data: inLibrary }] : []),
      ...(external.length > 0 ? [{ title: 'Search Results', data: external }] : []),
    ];
  }, [effectiveResults]);

  const openSeries = useCallback(
    (seriesId: string, title: string) => navigation.navigate('SeriesDetail', { seriesId, title }),
    [navigation],
  );

  const reviewSeries = useCallback(
    (seriesId: string, title: string, attentionReasonCode: string | null) => {
      navigation.navigate(needsReviewTarget(attentionReasonCode), { seriesId, title });
    },
    [navigation],
  );

  const compareMatch = useCallback(
    (result: SeriesSearchResult) => {
      if (result.libraryMatch.type !== 'POSSIBLE') return;
      const match = result.libraryMatch;
      const candidate = result.providers[0];
      navigation.navigate('PossibleMatchComparison', {
        resultKey: result.resultKey,
        candidateTitle: result.title,
        candidateYear: result.year,
        candidatePosterUrl: result.posterUrl,
        candidateProvider: candidate.provider,
        candidateProviderId: candidate.providerId,
        possibleSeriesId: match.seriesId,
        possibleSeriesTitle: match.seriesTitle,
        possibleSeriesUserStatus: match.seriesUserStatus,
        confidence: match.confidence,
        reason: match.reason,
        onTreatAsDifferent: () => setTreatedAsDifferent((prev) => new Set(prev).add(result.resultKey)),
      });
    },
    [navigation],
  );

  const addResult = useCallback(
    (result: SeriesSearchResult) => {
      const candidate = result.providers[0];
      addMutation.mutate({ resultKey: result.resultKey, provider: candidate.provider, providerId: candidate.providerId });
    },
    [addMutation],
  );

  const renderResult = useCallback(
    ({ item }: { item: SeriesSearchResult }) => {
      const addState: SearchResultAddState = addingKeys.has(item.resultKey) ? 'adding' : 'idle';
      return (
        <SearchResultCard
          result={item}
          addState={addState}
          onOpenSeries={() => {
            if (item.libraryMatch.type === 'EXACT') openSeries(item.libraryMatch.seriesId, item.title);
          }}
          onReview={() => {
            if (item.libraryMatch.type === 'EXACT') reviewSeries(item.libraryMatch.seriesId, item.title, item.libraryMatch.attentionReasonCode);
          }}
          onCompare={() => compareMatch(item)}
          onAdd={() => addResult(item)}
        />
      );
    },
    [addingKeys, openSeries, reviewSeries, compareMatch, addResult],
  );

  return (
    <Screen scroll={false} contentContainerStyle={styles.screenContent}>
      <View style={styles.inputRow}>
        <Ionicons name="search" size={18} color={colors.textTertiary} style={styles.inputIcon} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => trimmedQuery.length >= MIN_QUERY_LENGTH && submitRecentSearch(query)}
          placeholder="Search for a series"
          placeholderTextColor={colors.textTertiary}
          style={styles.input}
          autoFocus
          returnKeyType="search"
          autoCorrect={false}
        />
        {query.length > 0 ? (
          <Pressable onPress={() => runSearch('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
          </Pressable>
        ) : null}
      </View>

      {!isQueryLongEnough ? (
        <RecentSearchesView
          recentSearches={recentSearches}
          onSelect={submitRecentSearch}
          onClearAll={async () => {
            await clearRecentSearches();
            setRecentSearches([]);
          }}
        />
      ) : (
        <View style={[styles.resultsContainer, query !== debouncedQuery && styles.dimmed]}>
          {resultsQuery.isLoading ? (
            <SearchResultSkeletonList />
          ) : resultsQuery.isError && sections.length === 0 ? (
            <SearchErrorInline message={getErrorMessage(resultsQuery.error)} onRetry={() => resultsQuery.refetch()} />
          ) : sections.length === 0 ? (
            <NoResultsView />
          ) : (
            <SectionList
              sections={sections}
              keyExtractor={(item) => item.resultKey}
              renderItem={renderResult}
              renderSectionHeader={({ section }) => <SectionHeader title={section.title} />}
              onEndReached={() => {
                if (resultsQuery.hasNextPage && !resultsQuery.isFetchingNextPage) void resultsQuery.fetchNextPage();
              }}
              onEndReachedThreshold={0.4}
              stickySectionHeadersEnabled={false}
              ListHeaderComponent={hadProviderFailure ? <ProviderFailureBanner onRetry={() => resultsQuery.refetch()} /> : null}
              ListFooterComponent={resultsQuery.isFetchingNextPage ? <SearchResultSkeletonList count={2} /> : null}
            />
          )}
        </View>
      )}

      <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
    </Screen>
  );
}

function RecentSearchesView({ recentSearches, onSelect, onClearAll }: { recentSearches: string[]; onSelect: (q: string) => void; onClearAll: () => void }) {
  if (recentSearches.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyStateText}>Search for a series by title</Text>
      </View>
    );
  }

  return (
    <View>
      <SectionHeader
        title="Recent Searches"
        action={
          <Pressable onPress={onClearAll} accessibilityRole="button" accessibilityLabel="Clear all recent searches">
            <Text style={styles.clearAll}>Clear all</Text>
          </Pressable>
        }
      />
      {recentSearches.map((q) => (
        <Pressable key={q} style={({ pressed }) => [styles.recentRow, pressed && styles.pressed]} onPress={() => onSelect(q)}>
          <Ionicons name="time-outline" size={16} color={colors.textTertiary} />
          <Text style={styles.recentText}>{q}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function NoResultsView() {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateTitle}>No series found</Text>
      <Text style={styles.emptyStateText}>Try another title, original title, or spelling.</Text>
    </View>
  );
}

function SearchErrorInline({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateTitle}>Some results may be missing.</Text>
      <Text style={styles.emptyStateText}>{message}</Text>
      <Pressable style={styles.retryButton} onPress={onRetry}>
        <Text style={styles.retryButtonText}>Retry</Text>
      </Pressable>
    </View>
  );
}

function ProviderFailureBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.banner}>
      <Text style={styles.bannerText}>Some results may be missing.</Text>
      <Pressable onPress={onRetry} hitSlop={8}>
        <Text style={styles.bannerRetry}>Retry</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContent: { flex: 1 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  inputIcon: { opacity: 0.8 },
  input: { flex: 1, ...typography.body, paddingVertical: 0 },
  resultsContainer: { flex: 1 },
  dimmed: { opacity: 0.6 },
  emptyState: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, gap: spacing.xs },
  emptyStateTitle: { ...typography.subheading },
  emptyStateText: { ...typography.bodySecondary, color: colors.textTertiary },
  clearAll: { ...typography.caption, color: colors.accent },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  recentText: { ...typography.body },
  pressed: { opacity: 0.6 },
  retryButton: { marginTop: spacing.sm, alignSelf: 'flex-start', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.md, backgroundColor: colors.accent },
  retryButtonText: { ...typography.caption, fontWeight: '700', color: '#0A0A0D' },
  banner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.warningSoft,
  },
  bannerText: { ...typography.caption, color: colors.warning },
  bannerRetry: { ...typography.caption, fontWeight: '700', color: colors.warning },
});
