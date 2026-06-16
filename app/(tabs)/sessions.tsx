import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, Animated, useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getSessions, getJourneys, getProfile } from '@/lib/storage';
import type { SessionWithCheckin, Journey } from '@/lib/types';
import { BodyFigureEllipses } from '@/components/BodyFigure';
import { COLORS, RADII, CARD_SHADOW, FONTS, getStateColor, getEmotionColor, OPTION_TEXT } from '@/lib/theme';

function formatSessionDateTime(iso: string, durationMinutes?: number | null): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (durationMinutes != null && durationMinutes > 0) {
    return `${date} · ${durationMinutes} min`;
  }
  return date;
}

function formatDuration(minutes: number | null | undefined): string | null {
  if (minutes == null) return null;
  return `${minutes} min`;
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Emotion cluster mapping from new-session.tsx
const EMOTION_CLUSTERS = [
  { name: 'Anger',               text: '#C49A6C', tags: ['anger','frustration','irritation','rage','resentment'] },
  { name: 'Fear',                text: '#B5736A', tags: ['anxiety','dread','fear','panic','terror'] },
  { name: 'Grief',               text: '#6E9BB5', tags: ['grief','heartbreak','longing','loss','sadness'] },
  { name: 'Neutral / liminal',   text: '#9B7FBF', tags: ['confusion','dissociation','emptiness','numbness'] },
  { name: 'Positive / opening',  text: '#7AAE8A', tags: ['awe','bliss','gratitude','joy','love','warmth'] },
  { name: 'Release / movement',  text: '#C49A6C', tags: ['openness','release','relief','surrender'] },
  { name: 'Shame / contraction', text: '#B5736A', tags: ['guilt','shame','smallness','unworthiness'] },
];

function getEmotionClusterColor(tag: string): string {
  const cluster = EMOTION_CLUSTERS.find((c) => c.tags.includes(tag.toLowerCase()));
  return cluster ? cluster.text : '#9B7FBF';
}

// Vocabulary framework state name mapping
const VOCAB_NAMES: Record<string, Record<string, string>> = {
  plain: { grounded: 'Grounded', activated: 'Activated', shutdown: 'Shutdown' },
  polyvagal: { grounded: 'Ventral', activated: 'Sympathetic', shutdown: 'Dorsal' },
  ifs: { grounded: 'Self', activated: 'Activated part', shutdown: 'Blended' },
  somatic: { grounded: 'Grounded', activated: 'Activated', shutdown: 'Shutdown' },
};

function getStateName(framework: string, state: string): string {
  const map = VOCAB_NAMES[framework] ?? VOCAB_NAMES.plain;
  return map[state.toLowerCase()] ?? capitalize(state);
}

function getWeekStart(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1; // Mon = 0, Sun = 6
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getMonthStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
}

function computeStats(sessions: SessionWithCheckin[]): { thisWeek: number; thisMonth: number; total: number } {
  const weekStart = getWeekStart();
  const monthStart = getMonthStart();
  let thisWeek = 0;
  let thisMonth = 0;

  sessions.forEach(({ session }) => {
    const created = new Date(session.created_at);
    if (created >= weekStart) thisWeek += 1;
    if (created >= monthStart) thisMonth += 1;
  });

  return { thisWeek, thisMonth, total: sessions.length };
}

function getJourneyDay(sessionIso: string, journey: Journey): number | null {
  if (!journey.start_date) return null;
  const start = new Date(journey.start_date);
  start.setHours(0, 0, 0, 0);
  const sessionDay = new Date(sessionIso);
  sessionDay.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((sessionDay.getTime() - start.getTime()) / 86400000);
  if (diffDays < 0) return null;
  return diffDays + 1;
}


function BottomSheet({ visible, onDismiss, children }: { visible: boolean; onDismiss: () => void; children: React.ReactNode }) {
  const slideAnim = useRef(new Animated.Value(400)).current;
  const { bottom: safeBottom } = useSafeAreaInsets();
  React.useEffect(() => {
    if (visible) Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 18 }).start();
    else slideAnim.setValue(400);
  }, [visible]);
  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onDismiss}>
      <View style={{ flex: 1, flexDirection: 'column' }}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }}
          onPress={onDismiss}
          activeOpacity={1}
        />
        <Animated.View style={[s.sheet, { paddingBottom: Math.max(safeBottom, 16), transform: [{ translateY: slideAnim }] }]}>
          <View style={s.dragHandle} />
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

function SessionCard({ swc, journeyName, onPress }: { swc: SessionWithCheckin; journeyName: string | null; onPress: () => void }) {
  const { session, checkin } = swc;
  const tags = (checkin?.emotion_tags ?? []).slice(0, 2);
  const stateKey = checkin?.nervous_system_state?.toLowerCase();
  const stateChip = getStateColor(stateKey);

  return (
    <TouchableOpacity style={[s.card, CARD_SHADOW]} onPress={onPress} activeOpacity={0.7}>
      <View style={s.cardLeft}>
        {journeyName ? (
          <View style={s.journeyPill}>
            <Text style={s.journeyPillText}>{journeyName}</Text>
          </View>
        ) : null}
        <Text style={s.cardDate}>{formatSessionDateTime(session.created_at, session.duration_minutes)}</Text>
        <Text style={s.cardTitle}>{session.practice_type || 'Session'}</Text>
        <View style={s.chipsRow}>
          {stateKey ? (
            <View style={[s.stateChip, { backgroundColor: stateChip.bg }]}>
              <Text style={[s.stateChipText, { color: stateChip.text }]}>{capitalize(stateKey)}</Text>
            </View>
          ) : null}
          {tags.map((tag) => {
            const c = getEmotionColor(tag);
            return (
              <View key={tag} style={[s.emotionChip, { backgroundColor: c.bg }]}>
                <Text style={[s.emotionChipText, { color: c.text }]}>{capitalize(tag)}</Text>
              </View>
            );
          })}
        </View>
        {checkin?.elaboration_note ? (
          <Text style={s.cardNote} numberOfLines={2}>{checkin.elaboration_note}</Text>
        ) : null}
      </View>
      <View style={s.cardRight}>
        <BodyFigureEllipses width={72} bodySensations={checkin?.body_sensations ?? []} />
      </View>
    </TouchableOpacity>
  );
}

export default function SessionsScreen() {
  const router = useRouter();
  const { height: windowHeight } = useWindowDimensions();
  const [sessions, setSessions] = useState<SessionWithCheckin[]>([]);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [vocab, setVocab] = useState('plain');

  // Filter state
  const [activeNsStates, setActiveNsStates] = useState<string[]>([]);
  const [activePractices, setActivePractices] = useState<string[]>([]);
  const [activeEmotions, setActiveEmotions] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const [s, j, profile] = await Promise.all([getSessions(), getJourneys(), getProfile()]);
        if (!cancelled) {
          setSessions(s);
          setJourneys(j);
          setVocab(profile.vocabulary_framework);
        }
      })();
      return () => { cancelled = true; };
    }, [])
  );

  const journeyMap: Record<string, Journey> = {};
  journeys.forEach((j) => { journeyMap[j.id] = j; });

  const stats = computeStats(sessions);

  // All three NS states always shown
  const allNsStates = ['grounded', 'activated', 'shutdown'];

  // All practice types from session data, sorted alphabetically
  const practicesInData = Array.from(new Set(
    sessions
      .map((swc) => swc.session.practice_type)
      .filter((practice): practice is string => !!practice && practice.trim() !== '')
  )).sort();

  // Filter sessions
  const hasActiveFilters = activeNsStates.length > 0 || activePractices.length > 0 || activeEmotions.length > 0;
  const filteredSessions = hasActiveFilters
    ? sessions.filter((swc) => {
        // NS state filter (OR within group)
        if (activeNsStates.length > 0) {
          const matchesNs = swc.checkin?.nervous_system_state && activeNsStates.includes(swc.checkin.nervous_system_state);
          if (!matchesNs) return false;
        }
        // Practice filter (OR within group)
        if (activePractices.length > 0) {
          const matchesPractice = swc.session.practice_type && activePractices.includes(swc.session.practice_type);
          if (!matchesPractice) return false;
        }
        // Emotion filter (session must contain ALL active emotion tags - AND logic)
        if (activeEmotions.length > 0) {
          const sessionTags = swc.checkin?.emotion_tags ?? [];
          const matchesEmotions = activeEmotions.every((tag) => sessionTags.includes(tag));
          if (!matchesEmotions) return false;
        }
        return true;
      })
    : sessions;

  function toggleNsState(state: string) {
    setActiveNsStates((prev) =>
      prev.includes(state) ? prev.filter((s) => s !== state) : [...prev, state]
    );
  }

  function togglePractice(practice: string) {
    setActivePractices((prev) =>
      prev.includes(practice) ? prev.filter((p) => p !== practice) : [...prev, practice]
    );
  }

  function toggleEmotion(emotion: string) {
    setActiveEmotions((prev) =>
      prev.includes(emotion) ? prev.filter((e) => e !== emotion) : [...prev, emotion]
    );
  }

  function clearAllFilters() {
    setActiveNsStates([]);
    setActivePractices([]);
    setActiveEmotions([]);
  }

  function buildSessionRows() {
    let lastDayLabel: string | null = null;
    const rows: React.ReactNode[] = [];

    filteredSessions.forEach((swc) => {
      const { session } = swc;
      const journey = session.journey_id ? journeyMap[session.journey_id] : null;
      let dayLabel: string | null = null;

      if (journey?.start_date && session.journey_id) {
        const day = getJourneyDay(session.created_at, journey);
        if (day !== null) {
          const label = `Day ${day}`;
          if (label !== lastDayLabel) {
            lastDayLabel = label;
            dayLabel = label;
          }
        }
      }

      if (dayLabel) {
        rows.push(
          <View key={`day-${dayLabel}-${session.id}`} style={s.dayPillRow}>
            <View style={s.dayPill}>
              <Text style={s.dayPillText}>{dayLabel}</Text>
            </View>
          </View>
        );
      }

      rows.push(
        <SessionCard
          key={session.id}
          swc={swc}
          journeyName={journey ? journey.name : null}
          onPress={() => router.push({ pathname: '/session/[id]', params: { id: session.id } } as any)}
        />
      );
    });

    return rows;
  }

  return (
    <SafeAreaView edges={['top']} style={s.safe}>
      <LinearGradient
        colors={['rgba(176, 127, 255, 0.18)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: 200,
          zIndex: 0,
        }}
        pointerEvents="none"
      />
      <View style={s.header}>
        <View>
          <Text style={s.title}>Sessions</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity
            style={[
              s.filterHeaderPill,
              hasActiveFilters && s.filterHeaderPillActive,
            ]}
            onPress={() => setFilterSheetOpen(true)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name="tune-variant"
              size={14}
              color={hasActiveFilters ? '#B07FFF' : '#999999'}
            />
            <Text style={[s.filterHeaderPillText, hasActiveFilters && s.filterHeaderPillTextActive]}>
              Filter{hasActiveFilters ? ` · ${(activeNsStates.length + activePractices.length + activeEmotions.length)}` : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/settings' as any)} hitSlop={8}>
            <MaterialCommunityIcons name="cog-outline" size={20} color="#CCCCCC" />
          </TouchableOpacity>
        </View>
      </View>

      {sessions.length === 0 ? (
        <View style={s.emptyCenter}>
          <Text style={s.emptyText}>Your sessions will appear here.</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.listContent} showsVerticalScrollIndicator={false}>
          {/* Stats row */}
          <View style={s.statsRow}>
            <View style={[s.statBox, CARD_SHADOW]}>
              <Text style={[s.statCount, { color: COLORS.throat }]}>{stats.thisWeek}</Text>
              <Text style={s.statLabel}>This week</Text>
            </View>
            <View style={[s.statBox, CARD_SHADOW]}>
              <Text style={[s.statCount, { color: COLORS.heart }]}>{stats.thisMonth}</Text>
              <Text style={s.statLabel}>This month</Text>
            </View>
            <View style={[s.statBox, CARD_SHADOW]}>
              <Text style={[s.statCount, { color: COLORS.sacral }]}>{stats.total}</Text>
              <Text style={s.statLabel}>Total</Text>
            </View>
          </View>

          {buildSessionRows()}
        </ScrollView>
      )}

      <BottomSheet visible={actionSheetOpen} onDismiss={() => setActionSheetOpen(false)}>
        <View style={s.actionSheet}>
          <TouchableOpacity
            style={s.actionRow}
            onPress={() => { setActionSheetOpen(false); router.push('/new-session'); }}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="plus-circle-outline" size={26} color="#7AAE8A" />
            <View style={{ flex: 1 }}>
              <Text style={s.actionLabel}>New session</Text>
              <Text style={s.actionSubtitle}>Record what you noticed</Text>
            </View>
          </TouchableOpacity>
          <View style={s.actionDivider} />
          <TouchableOpacity
            style={s.actionRow}
            onPress={() => { setActionSheetOpen(false); router.push('/new-integration'); }}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="notebook-edit-outline" size={26} color="#6E9BB5" />
            <View style={{ flex: 1 }}>
              <Text style={s.actionLabel}>New integration</Text>
              <Text style={s.actionSubtitle}>{"Log what's still moving"}</Text>
            </View>
          </TouchableOpacity>
          <View style={s.actionDivider} />
          <TouchableOpacity
            style={s.actionRow}
            onPress={() => { setActionSheetOpen(false); router.push('/new-journey'); }}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="map-marker-path" size={26} color="#9B7FBF" />
            <View style={{ flex: 1 }}>
              <Text style={s.actionLabel}>New journey</Text>
              <Text style={s.actionSubtitle}>Set an intention or context</Text>
            </View>
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {/* Filter Bottom Sheet */}
      <BottomSheet visible={filterSheetOpen} onDismiss={() => setFilterSheetOpen(false)}>
        <View style={{ height: windowHeight * 0.92 - 60, flexDirection: 'column' }}>
          <ScrollView
            style={s.filterSheetScroll}
            contentContainerStyle={s.filterSheetScrollContent}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
          >
            <View style={s.filterSheet}>
              {/* Section 1: NS States — always show all three */}
              <View>
                <Text style={s.filterSectionLabel}>NERVOUS SYSTEM STATE</Text>
                <View style={s.filterChipWrap}>
                  {allNsStates.map((state) => {
                    const active = activeNsStates.includes(state);
                    const label = getStateName(vocab, state);
                    const wellnessTone = state === 'grounded' ? '#8FAE9A' : state === 'activated' ? '#D6C2A1' : '#A89ABF';
                    return (
                      <TouchableOpacity
                        key={state}
                        style={[
                          s.filterSheetChip,
                          active && {
                            backgroundColor: `${wellnessTone}26`,
                            borderColor: wellnessTone,
                            borderWidth: 1.5,
                          },
                        ]}
                        onPress={() => toggleNsState(state)}
                        activeOpacity={0.7}
                      >
                        <Text style={[s.filterSheetChipText, active && { color: wellnessTone, fontWeight: '500' }]}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {practicesInData.length > 0 && <View style={s.filterSectionDivider} />}

              {/* Section 2: Practice Types — sorted alphabetically */}
              {practicesInData.length > 0 && (
                <View>
                  <Text style={s.filterSectionLabel}>PRACTICE TYPE</Text>
                  <View style={s.filterChipWrap}>
                    {practicesInData.map((practice) => {
                      const active = activePractices.includes(practice);
                      return (
                        <TouchableOpacity
                          key={practice}
                          style={[
                            s.filterSheetChip,
                            active && {
                              backgroundColor: '#B07FFF26',
                              borderColor: '#B07FFF',
                              borderWidth: 1.5,
                            },
                          ]}
                          onPress={() => togglePractice(practice)}
                          activeOpacity={0.7}
                        >
                          <Text style={[s.filterSheetChipText, active && { color: '#B07FFF', fontWeight: '500' }]}>
                            {practice}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              <View style={s.filterSectionDivider} />

              {/* Section 3: Emotions — all clusters with labels */}
              <View>
                <Text style={s.filterSectionLabel}>EMOTIONS</Text>
                {EMOTION_CLUSTERS.map((cluster) => (
                  <View key={cluster.name} style={{ marginBottom: 16 }}>
                    <Text style={[s.filterClusterLabel, { color: cluster.text }]}>
                      {cluster.name.toUpperCase()}
                    </Text>
                    <View style={s.filterChipWrap}>
                      {cluster.tags.map((tag) => {
                        const active = activeEmotions.includes(tag);
                        return (
                          <TouchableOpacity
                            key={tag}
                            style={[
                              s.filterSheetChip,
                              active && {
                                backgroundColor: `${cluster.text}26`,
                                borderColor: cluster.text,
                                borderWidth: 1.5,
                              },
                            ]}
                            onPress={() => toggleEmotion(tag)}
                            activeOpacity={0.7}
                          >
                            <Text style={[s.filterSheetChipText, active && { color: cluster.text, fontWeight: '500' }]}>
                              {capitalize(tag)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>

          {/* Footer — pinned outside scroll */}
          <View style={s.filterSheetFooter}>
            <TouchableOpacity
              style={s.filterClearBtn}
              onPress={() => {
                clearAllFilters();
              }}
              disabled={!hasActiveFilters}
              activeOpacity={0.7}
            >
              <Text style={[s.filterClearText, !hasActiveFilters && { opacity: 0.3 }]}>
                Clear all
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.filterApplyBtn}
              onPress={() => setFilterSheetOpen(false)}
              activeOpacity={0.85}
            >
              <Text style={s.filterApplyText}>Show results</Text>
            </TouchableOpacity>
          </View>
        </View>
      </BottomSheet>

      {/* FAB */}
      <TouchableOpacity style={s.fab} onPress={() => setActionSheetOpen(true)} activeOpacity={0.85}>
        <MaterialCommunityIcons name="plus" size={28} color="#FFFFFF" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16,
  },
  title: { fontSize: 32, fontFamily: FONTS.display, color: COLORS.text },
  subtitle: { fontSize: 14, fontWeight: '400', color: COLORS.textTertiary, marginTop: 4 },

  listContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40, gap: 20 },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  statBox: {
    flex: 1, backgroundColor: COLORS.card, borderRadius: 12, padding: 14,
    alignItems: 'flex-start', position: 'relative',
  },
  statCount: { fontSize: 28, fontFamily: FONTS.display, marginBottom: 4, marginTop: 8 },
  statLabel: { fontFamily: 'Nunito_400Regular', fontSize: 12, fontWeight: '400', color: COLORS.textTertiary },

  // Filter header pill button
  filterHeaderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEEEEC',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    height: 32,
  },
  filterHeaderPillActive: {
    borderColor: '#B07FFF',
  },
  filterHeaderPillText: {
    fontFamily: 'Nunito_500Medium',
    fontSize: 13,
    fontWeight: '500',
    color: '#666666',
  },
  filterHeaderPillTextActive: {
    color: '#B07FFF',
  },

  // Filter bottom sheet
  filterSheetContainer: {
    flex: 1,
    flexDirection: 'column',
  },
  filterSheetScroll: {
    flex: 1,
  },
  filterSheetScrollContent: {
    paddingBottom: 16,
  },
  filterSheet: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  filterSectionLabel: {
    fontFamily: 'Nunito_500Medium',
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: '#999999',
    marginBottom: 12,
  },
  filterClusterLabel: {
    fontFamily: 'Nunito_500Medium',
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  filterChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterSheetChip: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: '#EEEEEC',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  filterSheetChipText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    fontWeight: '400',
    color: '#666666',
  },
  filterSectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#EEEEEC',
    marginVertical: 20,
  },
  filterSheetFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 12,
  },
  filterClearBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: COLORS.background,
  },
  filterClearText: {
    fontFamily: 'Nunito_500Medium',
    fontSize: 15,
    fontWeight: '500',
    color: '#999999',
  },
  filterApplyBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: '#B07FFF',
  },
  filterApplyText: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#B07FFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#B07FFF',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },

  emptyCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyText: { fontSize: 15, color: COLORS.textTertiary, textAlign: 'center' },

  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.card, borderRadius: RADII.card,
    padding: 20, gap: 12,
  },
  cardLeft: { flex: 1 },
  cardRight: { width: 72, alignItems: 'center', alignSelf: 'stretch', justifyContent: 'center', padding: 4 },

  journeyPill: {
    alignSelf: 'flex-start', backgroundColor: COLORS.crownTint,
    borderRadius: 24, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 6,
  },
  journeyPillText: { fontFamily: 'Nunito_500Medium', fontSize: 11, fontWeight: '500', color: COLORS.crown },

  cardDate: { fontFamily: 'Nunito_400Regular', fontSize: 12, fontWeight: '400', color: COLORS.textTertiary },
  cardTitle: { fontSize: 18, fontFamily: FONTS.display, color: COLORS.text, marginTop: 2, marginBottom: 8 },

  chipsRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  greyChip: { borderRadius: 24, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: COLORS.chipBg },
  greyChipText: { fontSize: 13, fontWeight: '500', color: COLORS.textSecondary },
  stateChip: { borderRadius: 24, paddingHorizontal: 12, paddingVertical: 6 },
  stateChipText: { fontFamily: 'Nunito_400Regular', fontSize: 13, fontWeight: '400' },
  emotionChip: { borderRadius: 24, paddingHorizontal: 12, paddingVertical: 6 },
  emotionChipText: { fontFamily: 'Nunito_400Regular', fontSize: 13, fontWeight: '400' },

  cardNote: { fontFamily: 'Nunito_400Regular', fontSize: 15, fontWeight: '400', color: '#999999', marginTop: 8, lineHeight: 22 },

  dayPillRow: {},
  dayPill: {
    alignSelf: 'flex-start', backgroundColor: COLORS.crownTint,
    borderRadius: 24, paddingHorizontal: 12, paddingVertical: 6,
  },
  dayPillText: { fontFamily: 'Nunito_500Medium', fontSize: 11, fontWeight: '500', color: COLORS.crown, letterSpacing: 1.2, textTransform: 'uppercase' },

  sheet: {
    maxHeight: '92%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
  },
  dragHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: '#E0E0E0',
    alignSelf: 'center', marginBottom: 12,
  },
  actionSheet: { paddingTop: 4 },
  actionRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 24, paddingVertical: 14, gap: 16, minHeight: 64,
  },
  actionLabel: { fontFamily: 'Nunito_500Medium', fontSize: 15, fontWeight: '500', color: '#1A1A1A' },
  actionSubtitle: { fontFamily: 'Nunito_400Regular', fontSize: 12, fontWeight: '400', color: '#999999', marginTop: 2 },
  actionDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#EEEEEC', marginHorizontal: 24 },
});
