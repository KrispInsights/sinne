import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getJourneys, getSessions, getIntegrations } from '@/lib/storage';
import type { Journey, Integration } from '@/lib/types';
import { COLORS, RADII, CARD_SHADOW, FONTS, getPracticeColor } from '@/lib/theme';

// Muted accent colours cycled across journey cards (throat, heart, sacral, third eye, root, solar)
const JOURNEY_ACCENT_COLORS = [COLORS.throat, COLORS.heart, COLORS.sacral, COLORS.thirdEye, COLORS.root, COLORS.solar];

// Practice type icon mapping
const PRACTICE_ICONS: Record<string, string> = {
  'Breathwork': 'weather-windy',
  'Dance / movement therapy': 'human-handsup',
  'IFS / Internal Family Systems': 'account-group-outline',
  'Meditation / Vipassana': 'meditation',
  'Qi Gong / Tai Chi': 'yin-yang',
  'Reiki / energy healing': 'hand-heart-outline',
  'Somatic Experiencing': 'human',
  'Sound healing': 'music-note-outline',
  'Trauma therapy (body-based)': 'heart-pulse',
  'Yoga': 'yoga',
  'Not sure yet': 'help-circle-outline',
  'Other': 'dots-horizontal-circle-outline',
};

function getPracticeIcon(practiceType: string): string {
  // Try exact match first
  if (PRACTICE_ICONS[practiceType]) return PRACTICE_ICONS[practiceType];
  // Try partial match
  const base = practiceType.split(':')[0].trim();
  for (const [key, icon] of Object.entries(PRACTICE_ICONS)) {
    if (base.startsWith(key) || key.startsWith(base)) return icon;
  }
  return 'circle-outline';
}

const INTEGRATION_NOTE_FIELDS: Array<keyof Integration> = [
  'free_text',
  'emotions_q1', 'emotions_q2', 'emotions_q3',
  'body_q1', 'body_q2', 'body_q3',
  'triggers_q1', 'triggers_q2', 'triggers_q3',
  'patterns_q1', 'patterns_q2', 'patterns_q3',
  'meaning_q1', 'meaning_q2', 'meaning_q3',
  'realizations_q1', 'realizations_q2', 'realizations_q3',
  'actions_q1', 'actions_q2', 'actions_q3',
  'gratitude_q1', 'gratitude_q2', 'gratitude_q3',
  'memories_q1', 'memories_q2', 'memories_q3',
];

function getIntegrationNote(integration: Integration): string | null {
  for (const field of INTEGRATION_NOTE_FIELDS) {
    const val = integration[field];
    if (typeof val === 'string' && val.trim()) return val;
  }
  return null;
}


function BottomSheet({ visible, onDismiss, children }: { visible: boolean; onDismiss: () => void; children: React.ReactNode }) {
  const slideAnim = useRef(new Animated.Value(400)).current;
  const { bottom: safeBottom } = useSafeAreaInsets();

  React.useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 18 }).start();
    } else {
      slideAnim.setValue(400);
    }
  }, [visible]);

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onDismiss}>
      <TouchableOpacity
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)' }}
        onPress={onDismiss}
        activeOpacity={1}
      />
      <Animated.View style={[s.sheet, { paddingBottom: Math.max(safeBottom, 16), transform: [{ translateY: slideAnim }] }]}>
        <View style={s.dragHandle} />
        {children}
      </Animated.View>
    </Modal>
  );
}

export default function JourneysScreen() {
  const router = useRouter();
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [sessionCounts, setSessionCounts] = useState<Record<string, number>>({});
  const [practiceTypes, setPracticeTypes] = useState<Record<string, string[]>>({});
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showEndedJourneys, setShowEndedJourneys] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const [js, sessions, integrations] = await Promise.all([getJourneys(), getSessions(), getIntegrations()]);
        if (cancelled) return;

        const counts: Record<string, number> = {};
        const types: Record<string, string[]> = {};
        sessions.forEach(({ session }) => {
          if (!session.journey_id) return;
          counts[session.journey_id] = (counts[session.journey_id] ?? 0) + 1;
          if (session.practice_type) {
            const list = types[session.journey_id] ?? (types[session.journey_id] = []);
            if (!list.includes(session.practice_type)) list.push(session.practice_type);
          }
        });

        const byJourney: Record<string, Integration[]> = {};
        integrations.forEach((i) => {
          if (!i.journey_id) return;
          (byJourney[i.journey_id] ??= []).push(i);
        });
        const descs: Record<string, string> = {};
        Object.entries(byJourney).forEach(([jid, list]) => {
          const sorted = [...list].sort((a, b) => a.note_date.localeCompare(b.note_date));
          for (const integ of sorted) {
            const note = getIntegrationNote(integ);
            if (note) { descs[jid] = note; break; }
          }
        });

        setJourneys(js);
        setSessionCounts(counts);
        setPracticeTypes(types);
        setDescriptions(descs);
      })();
      return () => { cancelled = true; };
    }, [])
  );

  const activeJourneys = journeys.filter((j) => j.status === 'active');
  const closedJourneys = journeys.filter((j) => j.status === 'closed');

  function renderJourneyCard(journey: Journey, idx: number) {
    const isActive = journey.status === 'active';
    const accent = JOURNEY_ACCENT_COLORS[idx % JOURNEY_ACCENT_COLORS.length];
    const types = practiceTypes[journey.id] ?? [];
    const description = descriptions[journey.id];

    // Calculate days elapsed
    let daysElapsed = 0;
    let totalDays = journey.duration_days;
    let pct = 0;
    if (journey.start_date && totalDays) {
      const start = new Date(journey.start_date + 'T00:00:00').getTime();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const elapsed = Math.floor((today.getTime() - start) / 86400000) + 1;
      daysElapsed = Math.min(Math.max(elapsed, 1), totalDays);
      pct = Math.min(1, Math.max(0, elapsed / totalDays));
    }

    return (
      <TouchableOpacity
        key={journey.id}
        style={[s.journeyCard, CARD_SHADOW]}
        onPress={() => router.push({ pathname: '/journey/[id]', params: { id: journey.id } } as any)}
        activeOpacity={0.85}
      >
        <View style={[s.accentBar, { backgroundColor: accent }, !isActive && s.faded]} />
        <View style={[s.cardBody, !isActive && s.faded]}>
          <Text style={s.journeyName} numberOfLines={2}>{journey.name}</Text>
          {description ? (
            <Text style={s.description} numberOfLines={2}>{description}</Text>
          ) : null}
          {types.length > 0 && (
            <View style={s.iconsRow}>
              {types.slice(0, 6).map((pt, idx) => {
                const icon = getPracticeIcon(pt);
                const color = getPracticeColor(pt);
                return (
                  <MaterialCommunityIcons key={`${pt}-${idx}`} name={icon as any} size={20} color={color} />
                );
              })}
              {types.length > 6 && (
                <Text style={s.iconOverflow}>+{types.length - 6}</Text>
              )}
            </View>
          )}
          {totalDays ? (
            <>
              <View style={s.progressRow}>
                <Text style={s.progressLabel}>Day {daysElapsed} of {totalDays}</Text>
                <Text style={[s.progressPct, { color: accent }]}>{Math.round(pct * 100)}%</Text>
              </View>
              <View style={s.progressTrack}>
                <View style={[s.progressFill, { width: `${pct * 100}%` as any, backgroundColor: accent }]} />
              </View>
            </>
          ) : null}
          {isActive && (
            <TouchableOpacity
              style={[s.logBtn, { backgroundColor: accent + '26' }]}
              onPress={() => router.push({ pathname: '/new-session', params: { journeyId: journey.id } } as any)}
              activeOpacity={0.8}
            >
              <Text style={[s.logBtnText, { color: accent }]}>Log next session</Text>
            </TouchableOpacity>
          )}
        </View>
        {!isActive && (
          <View style={s.endedBadge}>
            <Text style={s.endedBadgeText}>ENDED</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={s.safe}>
      <View style={s.header}>
        <View>
          <Text style={s.title}>Journeys</Text>
          <Text style={s.subtitle}>Curated arcs of practice over time.</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/settings' as any)} hitSlop={8}>
          <MaterialCommunityIcons name="cog-outline" size={24} color="#999999" />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {journeys.length === 0 ? (
          <View style={s.emptyCenter}>
            <Text style={s.emptyText}>Your journeys will appear here.</Text>
          </View>
        ) : (
          <>
            {activeJourneys.length > 0 && (
              <>
                <Text style={s.sectionLabel}>ACTIVE</Text>
                {activeJourneys.map(renderJourneyCard)}
              </>
            )}
            {closedJourneys.length > 0 && (
              <>
                <TouchableOpacity
                  style={s.endedToggle}
                  onPress={() => setShowEndedJourneys(!showEndedJourneys)}
                  activeOpacity={0.7}
                >
                  <Text style={s.sectionLabel}>ENDED</Text>
                  <MaterialCommunityIcons
                    name={showEndedJourneys ? 'chevron-up' : 'chevron-down'}
                    size={12}
                    color={COLORS.textTertiary}
                  />
                </TouchableOpacity>
                {showEndedJourneys && closedJourneys.map((j, i) => renderJourneyCard(j, activeJourneys.length + i))}
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={s.fab} onPress={() => setSheetOpen(true)} activeOpacity={0.85}>
        <MaterialCommunityIcons name="plus" size={26} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Bottom sheet */}
      <BottomSheet visible={sheetOpen} onDismiss={() => setSheetOpen(false)}>
        <View style={s.actionSheet}>
          <TouchableOpacity
            style={s.actionRow}
            onPress={() => { setSheetOpen(false); router.push('/new-session'); }}
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
            onPress={() => { setSheetOpen(false); router.push('/new-integration'); }}
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
            onPress={() => { setSheetOpen(false); router.push('/new-journey'); }}
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
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 120, gap: 12 },

  sectionLabel: {
    fontSize: 11, fontWeight: '600', color: COLORS.textTertiary,
    textTransform: 'uppercase', letterSpacing: 1.2,
  },

  journeyCard: {
    backgroundColor: COLORS.card, borderRadius: RADII.card, overflow: 'hidden',
  },
  accentBar: { height: 6, width: '100%' },
  cardBody: { padding: 20, gap: 10 },
  faded: { opacity: 0.4 },

  journeyName: { fontSize: 18, fontFamily: FONTS.display, color: COLORS.text },
  description: { fontSize: 13, fontWeight: '400', color: COLORS.textTertiary, lineHeight: 18 },

  iconsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  iconOverflow: { fontSize: 12, fontWeight: '400', color: COLORS.textTertiary, fontFamily: 'DMSans_400Regular' },

  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { fontSize: 13, fontWeight: '400', color: COLORS.textTertiary },
  progressPct: { fontSize: 13, fontWeight: '600' },
  progressTrack: { height: 6, borderRadius: 8, backgroundColor: COLORS.track, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 8 },

  logBtn: {
    height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  logBtnText: { fontSize: 15, fontWeight: '600' },

  endedBadge: {
    position: 'absolute', top: 16, right: 16,
    backgroundColor: COLORS.chipBg, borderRadius: 24,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  endedBadgeText: {
    fontSize: 10, fontWeight: '600', color: COLORS.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },

  endedToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 4, marginTop: 8,
  },

  emptyCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
  emptyText: { fontSize: 15, color: COLORS.textTertiary, textAlign: 'center' },

  fab: {
    position: 'absolute', bottom: 20, right: 24,
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: COLORS.accent,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.accent, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 6,
  },

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
  actionLabel: { fontSize: 16, fontWeight: '600', color: '#1A1A1A' },
  actionSubtitle: { fontSize: 12, color: '#999999', marginTop: 2 },
  actionDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#EEEEEC', marginHorizontal: 24 },
});
