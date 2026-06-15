import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getSessions, getJourneys } from '@/lib/storage';
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
      <TouchableOpacity
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)' }}
        onPress={onDismiss} activeOpacity={1}
      />
      <Animated.View style={[s.sheet, { paddingBottom: Math.max(safeBottom, 16), transform: [{ translateY: slideAnim }] }]}>
        <View style={s.dragHandle} />
        {children}
      </Animated.View>
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
  const [sessions, setSessions] = useState<SessionWithCheckin[]>([]);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const [s, j] = await Promise.all([getSessions(), getJourneys()]);
        if (!cancelled) { setSessions(s); setJourneys(j); }
      })();
      return () => { cancelled = true; };
    }, [])
  );

  const journeyMap: Record<string, Journey> = {};
  journeys.forEach((j) => { journeyMap[j.id] = j; });

  const stats = computeStats(sessions);

  function buildSessionRows() {
    let lastDayLabel: string | null = null;
    const rows: React.ReactNode[] = [];

    sessions.forEach((swc) => {
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
      <View style={s.header}>
        <View>
          <Text style={s.title}>Sessions</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/settings' as any)} hitSlop={8}>
          <MaterialCommunityIcons name="cog-outline" size={20} color="#CCCCCC" />
        </TouchableOpacity>
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
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
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
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12,
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
