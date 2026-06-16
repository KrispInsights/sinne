import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getJourneys, getSessions, getIntegrations, getPendingJourneyMirrorOffers } from '@/lib/storage';
import type { Journey, Integration, JourneyMirrorOffer } from '@/lib/types';
import { COLORS, RADII, CARD_SHADOW, FONTS } from '@/lib/theme';

// Muted accent colours cycled across journey cards (throat, heart, sacral, third eye, root, solar)
const JOURNEY_ACCENT_COLORS = [COLORS.throat, COLORS.heart, COLORS.sacral, COLORS.thirdEye, COLORS.root, COLORS.solar];

const PRACTICE_COLORS: Record<string, string> = {
  'Breathwork': '#6E9BB5',
  'Dance / movement therapy': '#C9B96A',
  'IFS / Internal Family Systems': '#9B7FBF',
  'Meditation / Vipassana': '#7B6BAE',
  'Qi Gong / Tai Chi': '#7AAE8A',
  'Reiki / energy healing': '#A89ABF',
  'Somatic Experiencing': '#7AAE8A',
  'Sound healing': '#6E9BB5',
  'Trauma therapy (body-based)': '#B5736A',
  'Yoga': '#C49A6C',
  'Not sure yet': '#BBBBBB',
  'Other': '#BBBBBB',
};

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

function getPracticeColorLocal(practiceType: string): string {
  // Try exact match first
  if (PRACTICE_COLORS[practiceType]) return PRACTICE_COLORS[practiceType];
  // Try partial match
  const base = practiceType.split(':')[0].trim();
  for (const [key, color] of Object.entries(PRACTICE_COLORS)) {
    if (base.startsWith(key) || key.startsWith(base)) return color;
  }
  return '#BBBBBB';
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
  const [journeyEntries, setJourneyEntries] = useState<Record<string, Array<{ type: 'session' | 'integration'; practiceType?: string; date: string }>>>({});
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showEndedJourneys, setShowEndedJourneys] = useState(false);
  const [pendingJourneyOffer, setPendingJourneyOffer] = useState<JourneyMirrorOffer | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const [js, sessions, integrations, pendingOffers] = await Promise.all([
          getJourneys(), getSessions(), getIntegrations(), getPendingJourneyMirrorOffers(),
        ]);
        if (cancelled) return;

        const counts: Record<string, number> = {};
        const types: Record<string, string[]> = {};
        const entries: Record<string, Array<{ type: 'session' | 'integration'; practiceType?: string; date: string }>> = {};

        // Process sessions
        sessions.forEach(({ session }) => {
          if (!session.journey_id) return;
          counts[session.journey_id] = (counts[session.journey_id] ?? 0) + 1;
          if (session.practice_type) {
            const list = types[session.journey_id] ?? (types[session.journey_id] = []);
            if (!list.includes(session.practice_type)) list.push(session.practice_type);
          }
          // Add to chronological entries
          const entryList = entries[session.journey_id] ?? (entries[session.journey_id] = []);
          entryList.push({ type: 'session', practiceType: session.practice_type, date: session.created_at });
        });

        // Process integrations
        integrations.forEach((i) => {
          if (!i.journey_id) return;
          const entryList = entries[i.journey_id] ?? (entries[i.journey_id] = []);
          entryList.push({ type: 'integration', date: i.note_date || i.created_at });
        });

        // Sort entries chronologically
        Object.keys(entries).forEach((jid) => {
          entries[jid].sort((a, b) => a.date.localeCompare(b.date));
        });

        setJourneys(js);
        setSessionCounts(counts);
        setPracticeTypes(types);
        setJourneyEntries(entries);
        setPendingJourneyOffer(pendingOffers[0] ?? null);
      })();
      return () => { cancelled = true; };
    }, [])
  );

  const activeJourneys = journeys.filter((j) => j.status === 'active');
  const closedJourneys = journeys.filter((j) => j.status === 'closed');

  function renderJourneyCard(journey: Journey, idx: number) {
    const isActive = journey.status === 'active';
    const accent = JOURNEY_ACCENT_COLORS[idx % JOURNEY_ACCENT_COLORS.length];
    const entries = journeyEntries[journey.id] ?? [];

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
          {entries.length > 0 && (
            <View style={s.iconsRow}>
              {entries.map((entry, idx) => {
                if (entry.type === 'integration') {
                  // Show integration icon (same as Integration tab)
                  return (
                    <MaterialCommunityIcons key={`integration-${idx}`} name="notebook-outline" size={20} color="#C9B96A" style={{ opacity: 0.7 }} />
                  );
                } else {
                  // Show session/practice icon
                  const icon = entry.practiceType ? getPracticeIcon(entry.practiceType) : 'circle-outline';
                  const color = entry.practiceType ? getPracticeColorLocal(entry.practiceType) : accent;
                  return (
                    <MaterialCommunityIcons key={`session-${idx}`} name={icon as any} size={20} color={color} style={{ opacity: 0.7 }} />
                  );
                }
              })}
             
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
          <Text style={s.title}>Journeys</Text>
          <Text style={s.subtitle}>Curated arcs of practice over time.</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/settings' as any)} hitSlop={8}>
          <MaterialCommunityIcons name="cog-outline" size={20} color="#CCCCCC" />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {pendingJourneyOffer && (
          <TouchableOpacity
            style={[s.mirrorOfferBanner, CARD_SHADOW]}
            onPress={() => router.push({ pathname: '/mirror', params: { journeyMirrorId: pendingJourneyOffer.journey_id, journeyMirrorName: pendingJourneyOffer.journey_name } } as any)}
            activeOpacity={0.85}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <MaterialCommunityIcons name="eye-outline" size={20} color={COLORS.accent} />
              <View style={{ flex: 1 }}>
                <Text style={s.mirrorOfferTitle}>{pendingJourneyOffer.journey_name} is complete.</Text>
                <Text style={s.mirrorOfferSubtitle}>Tap to reflect on this journey</Text>
              </View>
              <Text style={s.mirrorOfferReflect}>Reflect →</Text>
            </View>
          </TouchableOpacity>
        )}

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
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 120, gap: 20 },

  mirrorOfferBanner: {
    backgroundColor: COLORS.card, borderRadius: RADII.card, padding: 20, marginBottom: 4,
  },
  mirrorOfferTitle: {
    fontFamily: 'Nunito_600SemiBold', fontSize: 15, fontWeight: '600', color: COLORS.text, marginBottom: 2,
  },
  mirrorOfferSubtitle: {
    fontFamily: 'Nunito_400Regular', fontSize: 13, fontWeight: '400', color: COLORS.textTertiary,
  },
  mirrorOfferReflect: {
    fontFamily: 'Nunito_500Medium', fontSize: 13, fontWeight: '500', color: COLORS.accent,
  },

  sectionLabel: {
    fontFamily: 'Nunito_500Medium', fontSize: 11, fontWeight: '500', color: COLORS.textTertiary,
    textTransform: 'uppercase', letterSpacing: 1.2,
  },

  journeyCard: {
    backgroundColor: COLORS.card, borderRadius: RADII.card, overflow: 'hidden',
  },
  accentBar: { height: 4, width: '100%' },
  cardBody: { padding: 20, gap: 10 },
  faded: { opacity: 0.4 },

  journeyName: { fontSize: 18, fontFamily: FONTS.display, color: COLORS.text },

  iconsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 4 },
  iconOverflow: { fontSize: 12, fontWeight: '400', color: COLORS.textTertiary, fontFamily: 'Nunito_400Regular' },

  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { fontFamily: 'Nunito_400Regular', fontSize: 13, fontWeight: '400', color: COLORS.textTertiary },
  progressPct: { fontSize: 13, fontWeight: '600' },
  progressTrack: { height: 6, borderRadius: 8, backgroundColor: COLORS.track, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 8 },

  logBtn: {
    height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  logBtnText: { fontFamily: 'Nunito_600SemiBold', fontSize: 15, fontWeight: '600' },

  endedBadge: {
    position: 'absolute', top: 16, right: 16,
    backgroundColor: COLORS.chipBg, borderRadius: 24,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  endedBadgeText: {
    fontFamily: 'Nunito_500Medium', fontSize: 11, fontWeight: '500', color: COLORS.textTertiary,
    textTransform: 'uppercase', letterSpacing: 1.2,
  },

  endedToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 4, marginTop: 8,
  },

  emptyCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
  emptyText: { fontSize: 15, color: COLORS.textTertiary, textAlign: 'center' },

  fab: {
    position: 'absolute', bottom: 20, right: 24,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: COLORS.accent,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 4,
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
  actionLabel: { fontFamily: 'Nunito_500Medium', fontSize: 15, fontWeight: '500', color: '#1A1A1A' },
  actionSubtitle: { fontFamily: 'Nunito_400Regular', fontSize: 12, fontWeight: '400', color: '#999999', marginTop: 2 },
  actionDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#EEEEEC', marginHorizontal: 24 },
});
