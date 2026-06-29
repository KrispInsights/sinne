import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Animated, Easing, Modal, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import {
  getMirrors, getSessions, getIntegrations, getProfile,
  shouldShowWeeklyMirror, shouldShowMonthlyMirror, saveMirror, uid,
  getMirrorUnlockStatus, getPendingJourneyMirrorOffers, getJourneys,
  getEntitlement,
} from '@/lib/storage';
import type { Mirror, MirrorPromptType, SessionWithCheckin, JourneyMirrorOffer, Integration, Journey, Profile, BodySensation } from '@/lib/types';
import { COLORS, RADII, CARD_SHADOW, FONTS, getEmotionColor, getRegionColor, CHAKRA_COLORS } from '@/lib/theme';
import { BodyFigureEllipses } from '@/components/BodyFigure';

function buildWeeklyResponse(goals: string[]): string {
  const goalLine = goals.length > 0
    ? ` Based on your focus on ${goals[0].toLowerCase()}, this week's patterns suggest the nervous system is doing the groundwork before settling becomes possible.`
    : '';
  return `Grief appeared in three of your five sessions this week, most often alongside throat activation and a shutdown nervous system state. Your integration notes from Tuesday and Thursday both circled back to the same memory. By Friday something shifted — your state moved to grounded and the body sensations moved from chest heaviness to warmth. The pattern across this week suggests something is completing rather than repeating.${goalLine}`;
}

function buildMonthlyResponse(goals: string[]): string {
  const goalLine = goals.length > 0
    ? ` Based on your focus on ${goals[0].toLowerCase()}, this month's arc points toward a deepening capacity to stay with difficult states rather than move away from them.`
    : '';
  return `Across this month, your nervous system spent most of its time between activation and shutdown in weeks one and two, then shifted noticeably toward grounded in weeks three and four. Grief was the dominant charge in 11 of 18 sessions. Your integration notes were most active in the days following your longer sessions. The body regions that appeared most consistently were throat, chest, and solar plexus — often together. Something in the throat-chest-gut line seems to be the current edge of your work.${goalLine}`;
}

function buildJourneyResponse(journeyName: string, goals: string[]): string {
  const goalLine = goals.length > 0
    ? ` Something in this arc seems to be doing the slow work of ${goals[0].toLowerCase()}.`
    : '';
  return `${journeyName} held a thread across its full span, the early sessions carrying significant activation in the solar plexus and chest, grief recurring as the most consistent charge. By the midpoint something began to shift, not resolve, but move. The body started logging throat and arms alongside the earlier gut-and-chest pattern. The final sessions showed less shutdown and more movement between activation and settling. Whatever this journey was holding space for, it is still in motion.${goalLine} The container closes, the integration continues.`;
}

// ---- Helpers ----

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function daysAgoDate(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function summarize(text: string): string {
  const firstSentence = text.split(/(?<=[.!?])\s/)[0] ?? text;
  return firstSentence.length > 120 ? firstSentence.slice(0, 117) + '…' : firstSentence;
}

function formatDateRange(mirror: Mirror): string {
  const start = new Date(mirror.period_start + 'T00:00:00');
  const end = new Date(mirror.period_end + 'T00:00:00');
  if (mirror.type === 'journey') {
    const startStr = start.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    const endStr = end.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${startStr} → ${endStr}`;
  }
  if (mirror.type === 'monthly') {
    return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
  const year = end.getFullYear();
  if (startMonth === endMonth) {
    return `${startMonth} ${start.getDate()}–${end.getDate()}, ${year}`;
  }
  return `${startMonth} ${start.getDate()} – ${endMonth} ${end.getDate()}, ${year}`;
}

function currentWeekRangeLabel(): string {
  const start = daysAgoDate(6);
  const end = new Date();
  const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
  if (startMonth === endMonth) {
    return `${startMonth} ${start.getDate()}–${end.getDate()}`;
  }
  return `${startMonth} ${start.getDate()} – ${endMonth} ${end.getDate()}`;
}

function currentMonthLabel(): string {
  return new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function compileExportText(mirrors: Mirror[]): string {
  const lines: string[] = ['SINNE — MY MIRRORS', ''];
  for (const m of mirrors) {
    let label: string;
    if (m.type === 'journey') {
      label = `JOURNEY MIRROR — ${m.journey_name ?? 'Journey'} — ${formatDateRange(m)}`;
    } else if (m.type === 'monthly') {
      label = `MONTHLY MIRROR — ${formatDateRange(m)}`;
    } else {
      label = `WEEKLY MIRROR — ${formatDateRange(m)}`;
    }
    lines.push(label);
    lines.push(m.content);
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

// ---- Explore sub-tab content ----

type ExploreView = 'overview' | 'emotion' | 'body' | 'chakra' | 'practice' | 'practice-detail' | 'nsstate' | 'ns-grounded' | 'ns-activated' | 'ns-shutdown' | 'chakra-detail';

function ExploreContent() {
  const [sessions, setSessions] = useState<SessionWithCheckin[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [exploreView, setExploreView] = useState<ExploreView>('overview');
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [selectedEmotion, setSelectedEmotion] = useState<string>('');
  const [selectedChakra, setSelectedChakra] = useState<string>('');
  const [selectedNSState, setSelectedNSState] = useState<string>('');
  const [selectedPractice, setSelectedPractice] = useState<string>('');

  const load = useCallback(async () => {
    const [s, i, j, p] = await Promise.all([
      getSessions(),
      getIntegrations(),
      getJourneys(),
      getProfile(),
    ]);
    setSessions(s);
    setIntegrations(i);
    setJourneys(j);
    setProfile(p);
  }, []);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    (async () => { await load(); })();
    return () => { cancelled = true; };
  }, [load]));

  // Filter sessions based on selected journey
  const filteredSessions = selectedFilter === 'all'
    ? sessions
    : sessions.filter(s => s.session.journey_id === selectedFilter);

  if (exploreView === 'overview') {
    return (
      <ExploreOverview
        sessions={filteredSessions}
        journeys={journeys}
        selectedFilter={selectedFilter}
        onFilterChange={setSelectedFilter}
        onEmotionPress={(emotion) => {
          setSelectedEmotion(emotion);
          setExploreView('emotion');
        }}
        onBodyPress={() => setExploreView('body')}
        onChakraPress={() => setExploreView('chakra')}
        onNSStatePress={() => setExploreView('nsstate')}
        onPracticePress={() => setExploreView('practice')}
      />
    );
  }

  if (exploreView === 'emotion') {
    return (
      <EmotionDetailView
        emotion={selectedEmotion}
        sessions={filteredSessions}
        integrations={integrations}
        journeys={journeys}
        onBack={() => setExploreView('overview')}
      />
    );
  }

  if (exploreView === 'body') {
    return (
      <BodyRegionView
        sessions={filteredSessions}
        onBack={() => setExploreView('overview')}
      />
    );
  }

  if (exploreView === 'chakra') {
    return (
      <ChakraView
        sessions={filteredSessions}
        onBack={() => setExploreView('overview')}
        onChakraSelect={(chakra) => {
          setSelectedChakra(chakra);
          setExploreView('chakra-detail');
        }}
      />
    );
  }

  if (exploreView === 'chakra-detail') {
    return (
      <ChakraDetailView
        chakra={selectedChakra}
        sessions={filteredSessions}
        integrations={integrations}
        journeys={journeys}
        onBack={() => setExploreView('chakra')}
      />
    );
  }

  if (exploreView === 'nsstate') {
    return (
      <NSStateView
        sessions={filteredSessions}
        onBack={() => setExploreView('overview')}
        onStateSelect={(state) => {
          setSelectedNSState(state);
          setExploreView(state as ExploreView);
        }}
      />
    );
  }

  if (exploreView === 'ns-grounded' || exploreView === 'ns-activated' || exploreView === 'ns-shutdown') {
    return (
      <NSStateDetailView
        state={selectedNSState}
        sessions={filteredSessions}
        integrations={integrations}
        journeys={journeys}
        onBack={() => setExploreView('nsstate')}
      />
    );
  }

  if (exploreView === 'practice') {
    return (
      <PracticeTypeView
        sessions={filteredSessions}
        onBack={() => setExploreView('overview')}
        onPracticeSelect={(practice) => {
          setSelectedPractice(practice);
          setExploreView('practice-detail');
        }}
      />
    );
  }

  if (exploreView === 'practice-detail') {
    return (
      <PracticeTypeDetailView
        practice={selectedPractice}
        sessions={filteredSessions}
        integrations={integrations}
        journeys={journeys}
        onBack={() => setExploreView('practice')}
      />
    );
  }

  // Other detail views will be added in subsequent phases
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: FONTS.body, fontSize: 14, color: COLORS.textSecondary }}>
        Detail view coming soon
      </Text>
    </View>
  );
}

function ExploreOverview({ sessions, journeys, selectedFilter, onFilterChange, onEmotionPress, onBodyPress, onChakraPress, onNSStatePress, onPracticePress }: {
  sessions: SessionWithCheckin[];
  journeys: Journey[];
  selectedFilter: string;
  onFilterChange: (filter: string) => void;
  onEmotionPress: (emotion: string) => void;
  onBodyPress: () => void;
  onChakraPress: () => void;
  onNSStatePress: () => void;
  onPracticePress: () => void;
}) {
  // Compute top 8 emotions
  const emotionCounts = new Map<string, number>();
  for (const s of sessions) {
    if (!s.checkin) continue;
    for (const tag of s.checkin.emotion_tags) {
      emotionCounts.set(tag, (emotionCounts.get(tag) || 0) + 1);
    }
  }
  const topEmotions = Array.from(emotionCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tag]) => tag);

  // Compute body region frequencies
  const regionCounts = new Map<string, number>();
  for (const s of sessions) {
    if (!s.checkin) continue;
    for (const bs of s.checkin.body_sensations) {
      regionCounts.set(bs.region, (regionCounts.get(bs.region) || 0) + 1);
    }
  }
  const top4Regions = Array.from(regionCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  // Compute practice type counts
  const practiceCounts = new Map<string, number>();
  for (const s of sessions) {
    const pt = s.session.practice_type ?? 'Other';
    practiceCounts.set(pt, (practiceCounts.get(pt) || 0) + 1);
  }
  const totalSessions = sessions.length;

  // Compute NS state counts
  const stateCounts = { grounded: 0, activated: 0, shutdown: 0 };
  for (const s of sessions) {
    if (!s.checkin?.nervous_system_state) continue;
    const state = s.checkin.nervous_system_state.toLowerCase();
    if (state.includes('grounded') || state.includes('ventral') || state.includes('self')) {
      stateCounts.grounded++;
    } else if (state.includes('activated') || state.includes('sympathetic')) {
      stateCounts.activated++;
    } else if (state.includes('shutdown') || state.includes('dorsal') || state.includes('blended')) {
      stateCounts.shutdown++;
    }
  }
  const totalStates = stateCounts.grounded + stateCounts.activated + stateCounts.shutdown;
  const dominantState = totalStates > 0
    ? (stateCounts.grounded >= stateCounts.activated && stateCounts.grounded >= stateCounts.shutdown ? 'Grounded'
      : stateCounts.activated >= stateCounts.shutdown ? 'Activated' : 'Shutdown')
    : 'None';

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={s.exploreContent} showsVerticalScrollIndicator={false}>
      {/* Filter bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterBar}>
        <TouchableOpacity
          style={[s.filterPill, selectedFilter === 'all' && s.filterPillActive]}
          onPress={() => onFilterChange('all')}
          activeOpacity={0.7}
        >
          <Text style={[s.filterPillText, selectedFilter === 'all' && s.filterPillTextActive]}>All time</Text>
        </TouchableOpacity>
        {journeys.map(j => (
          <TouchableOpacity
            key={j.id}
            style={[s.filterPill, selectedFilter === j.id && s.filterPillActive]}
            onPress={() => onFilterChange(j.id)}
            activeOpacity={0.7}
          >
            <Text style={[s.filterPillText, selectedFilter === j.id && s.filterPillTextActive]}>
              {j.name.length > 20 ? j.name.slice(0, 20) + '…' : j.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Emotion Timeline section */}
      <Text style={s.exploreSectionLabel}>EMOTION TIMELINE</Text>
      <View style={s.emotionTimelineContainer}>
        {/* Fixed left column */}
        <View style={s.emotionLeftColumn}>
          {topEmotions.map((tag, idx) => (
            <TouchableOpacity
              key={tag}
              style={s.emotionRow}
              onPress={() => onEmotionPress(tag)}
              activeOpacity={0.7}
            >
              <Text style={s.emotionName}>{tag}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Scrollable grid */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
          <View>
            {/* Column headers */}
            <View style={s.emotionHeaderRow}>
              {sessions.map((_, idx) => (
                <View key={idx} style={s.emotionCell}>
                  <Text style={s.emotionHeaderText}>{idx + 1}</Text>
                </View>
              ))}
            </View>

            {/* Emotion rows */}
            {topEmotions.map((tag) => (
              <View key={tag} style={s.emotionGridRow}>
                {sessions.map((sess, idx) => {
                  const present = sess.checkin?.emotion_tags.includes(tag) ?? false;
                  const color = getEmotionColor(tag).text;
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={s.emotionCell}
                      onPress={() => onEmotionPress(tag)}
                      activeOpacity={0.7}
                    >
                      <View style={[s.emotionDot, { backgroundColor: color, opacity: present ? 1.0 : 0.1 }]} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      <Text style={s.emotionHint}>Tap any row to explore connections →</Text>

      {/* Explore By section */}
      <Text style={[s.exploreSectionLabel, { paddingHorizontal: 20, marginTop: 20 }]}>EXPLORE BY</Text>
      <View style={s.exploreGrid}>
        {/* Card 1 - Body Region */}
        <TouchableOpacity style={s.exploreCard} activeOpacity={0.7} onPress={onBodyPress}>
          <Text style={s.exploreCardLabel}>BODY REGION</Text>
          <View style={s.exploreCardDots}>
            {top4Regions.map(([region], idx) => (
              <View key={idx} style={[s.exploreCardDot, { backgroundColor: getRegionColor(region) }]} />
            ))}
          </View>
          <Text style={s.exploreCardText} numberOfLines={1}>
            {top4Regions.slice(0, 3).map(([r]) => r).join(', ')}
          </Text>
        </TouchableOpacity>

        {/* Card 2 - Chakra */}
        <TouchableOpacity style={s.exploreCard} activeOpacity={0.7} onPress={onChakraPress}>
          <Text style={s.exploreCardLabel}>CHAKRA</Text>
          <View style={s.exploreCardDots}>
            {CHAKRA_COLORS.map((color, idx) => (
              <View key={idx} style={[s.exploreCardDot, { backgroundColor: color }]} />
            ))}
          </View>
          <Text style={s.exploreCardText}>7 energy centers</Text>
        </TouchableOpacity>

        {/* Card 3 - Practice Type */}
        <TouchableOpacity style={s.exploreCard} activeOpacity={0.7} onPress={onPracticePress}>
          <Text style={s.exploreCardLabel}>PRACTICE TYPE</Text>
          <View style={s.practiceBar}>
            {Array.from(practiceCounts.entries()).map(([pt, count], idx) => (
              <View
                key={idx}
                style={{
                  flex: count,
                  height: 5,
                  backgroundColor: idx === 0 ? COLORS.heart : idx === 1 ? COLORS.activated : COLORS.shutdown,
                }}
              />
            ))}
          </View>
          <Text style={s.exploreCardText} numberOfLines={2}>
            {Array.from(practiceCounts.keys()).join(', ')}
          </Text>
        </TouchableOpacity>

        {/* Card 4 - NS State */}
        <TouchableOpacity style={s.exploreCard} activeOpacity={0.7} onPress={onNSStatePress}>
          <Text style={s.exploreCardLabel}>NS STATE</Text>
          <View style={s.practiceBar}>
            {stateCounts.grounded > 0 && (
              <View style={{ flex: stateCounts.grounded, height: 5, backgroundColor: COLORS.grounded }} />
            )}
            {stateCounts.activated > 0 && (
              <View style={{ flex: stateCounts.activated, height: 5, backgroundColor: COLORS.activated }} />
            )}
            {stateCounts.shutdown > 0 && (
              <View style={{ flex: stateCounts.shutdown, height: 5, backgroundColor: COLORS.shutdown }} />
            )}
          </View>
          <Text style={s.exploreCardText}>{dominantState}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ---- Emotion Detail View ----

function EmotionDetailView({ emotion, sessions, integrations, journeys, onBack }: {
  emotion: string;
  sessions: SessionWithCheckin[];
  integrations: Integration[];
  journeys: Journey[];
  onBack: () => void;
}) {
  const emotionColor = getEmotionColor(emotion);

  // Sessions where emotion appears
  const emotionSessions = sessions.filter(s => s.checkin?.emotion_tags.includes(emotion));
  const totalSessions = sessions.length;
  const emotionCount = emotionSessions.length;

  // Generate narrative
  let narrative = '';
  if (emotionCount / totalSessions > 0.8) {
    narrative = `${emotion} has been present across almost every session in this arc.`;
  } else {
    const firstQuarter = sessions.slice(0, Math.floor(sessions.length / 4));
    const lastQuarter = sessions.slice(Math.floor(sessions.length * 0.75));
    const inFirstQuarter = firstQuarter.some(s => s.checkin?.emotion_tags.includes(emotion));
    const inLastQuarter = lastQuarter.some(s => s.checkin?.emotion_tags.includes(emotion));

    if (inFirstQuarter && !inLastQuarter) {
      narrative = `${emotion} was prominent early and has been fading — something may be moving.`;
    } else if (!inFirstQuarter && inLastQuarter) {
      narrative = `${emotion} has only begun appearing recently — something is opening.`;
    } else {
      narrative = `${emotion} has been consistently present throughout this arc.`;
    }
  }
  narrative += ` Present in ${emotionCount} of ${totalSessions} session${totalSessions === 1 ? '' : 's'}.`;

  // Co-occurring body regions
  const regionCounts = new Map<string, number>();
  for (const sess of emotionSessions) {
    if (!sess.checkin) continue;
    for (const bs of sess.checkin.body_sensations) {
      regionCounts.set(bs.region, (regionCounts.get(bs.region) || 0) + 1);
    }
  }
  const coOccurringRegions = Array.from(regionCounts.entries()).sort((a, b) => b[1] - a[1]);

  // Co-occurring emotions
  const emotionCoOccurs = new Map<string, number>();
  for (const sess of emotionSessions) {
    if (!sess.checkin) continue;
    for (const tag of sess.checkin.emotion_tags) {
      if (tag !== emotion) {
        emotionCoOccurs.set(tag, (emotionCoOccurs.get(tag) || 0) + 1);
      }
    }
  }
  const coOccurringEmotions = Array.from(emotionCoOccurs.entries()).sort((a, b) => b[1] - a[1]);

  // Practice types
  const practiceCounts = new Map<string, number>();
  for (const sess of emotionSessions) {
    const pt = sess.session.practice_type ?? 'Other';
    practiceCounts.set(pt, (practiceCounts.get(pt) || 0) + 1);
  }
  const practiceTypes = Array.from(practiceCounts.entries()).sort((a, b) => b[1] - a[1]);

  // NS states
  const stateBreakdown = { grounded: 0, activated: 0, shutdown: 0 };
  for (const sess of emotionSessions) {
    if (!sess.checkin?.nervous_system_state) continue;
    const state = sess.checkin.nervous_system_state.toLowerCase();
    if (state.includes('grounded') || state.includes('ventral') || state.includes('self')) {
      stateBreakdown.grounded++;
    } else if (state.includes('activated') || state.includes('sympathetic')) {
      stateBreakdown.activated++;
    } else if (state.includes('shutdown') || state.includes('dorsal') || state.includes('blended')) {
      stateBreakdown.shutdown++;
    }
  }
  const totalStates = stateBreakdown.grounded + stateBreakdown.activated + stateBreakdown.shutdown;

  // Journeys
  const journeyCounts = new Map<string, number>();
  for (const sess of emotionSessions) {
    if (sess.session.journey_id) {
      journeyCounts.set(sess.session.journey_id, (journeyCounts.get(sess.session.journey_id) || 0) + 1);
    }
  }

  // Integration notes within 7 days
  const followingIntegrations: Integration[] = [];
  for (const sess of emotionSessions) {
    const sessionDate = new Date(sess.session.created_at).getTime();
    for (const integ of integrations) {
      const integDate = new Date(integ.note_date + 'T00:00:00').getTime();
      const daysDiff = (integDate - sessionDate) / (1000 * 60 * 60 * 24);
      if (daysDiff >= 0 && daysDiff <= 7) {
        if (!followingIntegrations.find(i => i.id === integ.id)) {
          followingIntegrations.push(integ);
        }
      }
    }
  }
  const topIntegrations = followingIntegrations.slice(0, 3);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={s.detailContent} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={s.detailHeader}>
        <TouchableOpacity onPress={onBack} hitSlop={8} activeOpacity={0.7}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={s.detailTitle}>{emotion}</Text>
          <Text style={s.detailSubtitle}>Present in {emotionCount} of {totalSessions} session{totalSessions === 1 ? '' : 's'}</Text>
        </View>
        <View style={[s.emotionDetailDot, { backgroundColor: emotionColor.text }]} />
      </View>

      {/* Narrative card */}
      <View style={s.narrativeCard}>
        <Text style={s.narrativeText}>{narrative}</Text>
      </View>

      {/* Across your arc */}
      <Text style={s.detailSectionLabel}>ACROSS YOUR ARC</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 20 }}>
          {sessions.map((sess, idx) => {
            const present = sess.checkin?.emotion_tags.includes(emotion) ?? false;
            return (
              <View
                key={idx}
                style={[s.arcDot, { backgroundColor: emotionColor.text, opacity: present ? 1.0 : 0.1 }]}
              />
            );
          })}
        </View>
      </ScrollView>

      {/* Body regions */}
      {coOccurringRegions.length > 0 && (
        <>
          <Text style={s.detailSectionLabel}>BODY REGIONS ALONGSIDE THIS EMOTION</Text>
          <View style={s.chipContainer}>
            {coOccurringRegions.map(([region, count]) => (
              <View key={region} style={s.bodyChip}>
                <View style={[s.bodyChipDot, { backgroundColor: getRegionColor(region) }]} />
                <Text style={s.bodyChipText}>{region} · {count}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Co-occurring emotions */}
      {coOccurringEmotions.length > 0 && (
        <>
          <Text style={s.detailSectionLabel}>EMOTIONS THAT APPEAR WITH IT</Text>
          <View style={s.chipContainer}>
            {coOccurringEmotions.map(([tag, count]) => {
              const tagColor = getEmotionColor(tag);
              return (
                <View key={tag} style={[s.emotionChip, { backgroundColor: tagColor.bg }]}>
                  <Text style={[s.emotionChipText, { color: tagColor.text }]}>{tag} · {count}</Text>
                </View>
              );
            })}
          </View>
        </>
      )}

      {/* Practice types */}
      {practiceTypes.length > 0 && (
        <>
          <Text style={s.detailSectionLabel}>PRACTICE TYPES WHERE IT APPEARS</Text>
          <View style={s.chipContainer}>
            {practiceTypes.map(([pt, count]) => (
              <View key={pt} style={s.greyChip}>
                <Text style={s.greyChipText}>{pt} · {count} session{count === 1 ? '' : 's'}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* NS state breakdown */}
      {totalStates > 0 && (
        <>
          <Text style={s.detailSectionLabel}>NS STATE WHEN PRESENT</Text>
          <View style={{ paddingHorizontal: 20, gap: 8, marginBottom: 24 }}>
            {stateBreakdown.grounded > 0 && (
              <View style={s.stateRow}>
                <Text style={s.stateName}>Grounded</Text>
                <View style={s.stateTrack}>
                  <View style={[s.stateBar, { width: `${(stateBreakdown.grounded / totalStates) * 100}%`, backgroundColor: COLORS.grounded }]} />
                </View>
                <Text style={s.statePercent}>{Math.round((stateBreakdown.grounded / totalStates) * 100)}%</Text>
              </View>
            )}
            {stateBreakdown.activated > 0 && (
              <View style={s.stateRow}>
                <Text style={s.stateName}>Activated</Text>
                <View style={s.stateTrack}>
                  <View style={[s.stateBar, { width: `${(stateBreakdown.activated / totalStates) * 100}%`, backgroundColor: COLORS.activated }]} />
                </View>
                <Text style={s.statePercent}>{Math.round((stateBreakdown.activated / totalStates) * 100)}%</Text>
              </View>
            )}
            {stateBreakdown.shutdown > 0 && (
              <View style={s.stateRow}>
                <Text style={s.stateName}>Shutdown</Text>
                <View style={s.stateTrack}>
                  <View style={[s.stateBar, { width: `${(stateBreakdown.shutdown / totalStates) * 100}%`, backgroundColor: COLORS.shutdown }]} />
                </View>
                <Text style={s.statePercent}>{Math.round((stateBreakdown.shutdown / totalStates) * 100)}%</Text>
              </View>
            )}
          </View>
        </>
      )}

      {/* Journeys */}
      {journeyCounts.size > 0 && (
        <>
          <Text style={s.detailSectionLabel}>JOURNEYS IT APPEARED IN</Text>
          <View style={s.chipContainer}>
            {Array.from(journeyCounts.entries()).map(([journeyId, count]) => {
              const journey = journeys.find(j => j.id === journeyId);
              return (
                <View key={journeyId} style={s.journeyBadge}>
                  <Text style={s.journeyBadgeText}>{journey?.name ?? 'Journey'} · {count}</Text>
                </View>
              );
            })}
          </View>
        </>
      )}

      {/* Integration notes */}
      <Text style={s.detailSectionLabel}>INTEGRATION NOTES THAT FOLLOWED</Text>
      {topIntegrations.length === 0 ? (
        <Text style={s.noIntegrations}>No integration notes followed sessions where {emotion} appeared.</Text>
      ) : (
        <View style={{ paddingHorizontal: 20, gap: 12, marginBottom: 24 }}>
          {topIntegrations.map((integ) => {
            const noteText = integ.free_text
              || integ.triggers_q1 || integ.memories_q1 || integ.emotions_q1
              || integ.body_q1 || integ.patterns_q1 || integ.meaning_q1
              || integ.realizations_q1 || integ.actions_q1 || integ.gratitude_q1
              || '';
            const dateLabel = new Date(integ.note_date + 'T00:00:00').toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
            return (
              <View key={integ.id} style={s.integrationCard}>
                <Text style={s.integrationDate}>{dateLabel.toUpperCase()}</Text>
                <Text style={s.integrationText} numberOfLines={3}>{noteText}</Text>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

// ---- Body Region View ----

function BodyRegionView({ sessions, onBack }: {
  sessions: SessionWithCheckin[];
  onBack: () => void;
}) {
  const screenWidth = Dimensions.get('window').width;

  // Compute region frequencies
  const regionCounts = new Map<string, number>();
  for (const sess of sessions) {
    if (!sess.checkin) continue;
    for (const bs of sess.checkin.body_sensations) {
      regionCounts.set(bs.region, (regionCounts.get(bs.region) || 0) + 1);
    }
  }

  const sortedRegions = Array.from(regionCounts.entries()).sort((a, b) => b[1] - a[1]);
  const maxCount = sortedRegions[0]?.[1] ?? 1;

  // Top 2 regions for narrative
  const top2 = sortedRegions.slice(0, 2);

  // Chakra mapping
  const regionToChakra: Record<string, string> = {
    head: 'crown',
    eyes: 'third eye',
    jaw: 'throat',
    throat: 'throat',
    chest: 'heart',
    shoulders: 'heart',
    arms: 'heart',
    solar_plexus: 'solar plexus',
    pelvis: 'sacral',
    hips: 'sacral',
    legs: 'root',
    feet: 'root',
    spine: 'all centers',
    full_body: 'all centers',
  };

  // Generate narrative
  let narrative = '';
  if (top2.length === 2) {
    const [r1, r2] = top2;
    const c1 = regionToChakra[r1[0]] ?? 'unknown';
    const c2 = regionToChakra[r2[0]] ?? 'unknown';
    if (c1 === c2) {
      narrative = `${r1[0]} and ${r2[0]} have been most consistently activated — both mapped to the ${c1} chakra.`;
    } else {
      narrative = `${r1[0]} and ${r2[0]} have been most consistently activated — mapped to the ${c1} and ${c2} chakras.`;
    }
  } else if (top2.length === 1) {
    const [r1] = top2;
    const c1 = regionToChakra[r1[0]] ?? 'unknown';
    narrative = `${r1[0]} has been the most consistently activated region — mapped to the ${c1} chakra.`;
  } else {
    narrative = 'No body regions have been logged yet.';
  }

  // Split sessions into thirds for body over time
  const thirdSize = Math.ceil(sessions.length / 3);
  const early = sessions.slice(0, thirdSize);
  const mid = sessions.slice(thirdSize, thirdSize * 2);
  const recent = sessions.slice(thirdSize * 2);

  const extractBodySensations = (sessSlice: SessionWithCheckin[]): BodySensation[] => {
    const all: BodySensation[] = [];
    for (const sess of sessSlice) {
      if (sess.checkin) {
        all.push(...sess.checkin.body_sensations);
      }
    }
    return all;
  };

  const earlyBS = extractBodySensations(early);
  const midBS = extractBodySensations(mid);
  const recentBS = extractBodySensations(recent);

  const figureWidth = (screenWidth - 64) / 3;

  return (
    <ScrollView style={s.detailContent} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header */}
      <View style={s.detailHeader}>
        <TouchableOpacity onPress={onBack} hitSlop={12}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={{ fontFamily: FONTS.display, fontSize: 24, color: COLORS.text }}>Body Regions</Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.textSecondary, marginTop: 2 }}>
            Tap a region to see its connections
          </Text>
        </View>
      </View>

      {/* Narrative card */}
      <View style={s.narrativeCard}>
        <Text style={{ fontFamily: FONTS.body, fontSize: 14, color: COLORS.text, lineHeight: 20 }}>
          {narrative}
        </Text>
      </View>

      {/* Most activated regions list */}
      <Text style={[s.exploreSectionLabel, { paddingHorizontal: 20, marginTop: 20 }]}>
        MOST ACTIVATED REGIONS
      </Text>
      <View style={{ paddingHorizontal: 20, marginTop: 12, gap: 8 }}>
        {sortedRegions.map(([region, count]) => {
          const barWidth = (count / maxCount) * 100;
          return (
            <View key={region} style={s.regionRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <View style={[s.regionDot, { backgroundColor: getRegionColor(region) }]} />
                <Text style={s.regionName}>{region}</Text>
              </View>
              <View style={s.regionBarContainer}>
                <View style={[s.regionBar, { width: `${barWidth}%` }]} />
              </View>
              <Text style={s.regionCount}>{count}</Text>
            </View>
          );
        })}
      </View>

      {/* Body over time */}
      <Text style={[s.exploreSectionLabel, { paddingHorizontal: 20, marginTop: 28 }]}>
        BODY OVER TIME — EARLY / MID / RECENT
      </Text>
      <View style={{ flexDirection: 'row', paddingHorizontal: 20, marginTop: 16, justifyContent: 'space-between' }}>
        <View style={{ alignItems: 'center' }}>
          <Text style={s.bodyTimeLabel}>EARLY</Text>
          <BodyFigureEllipses width={figureWidth} bodySensations={earlyBS} />
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text style={s.bodyTimeLabel}>MID</Text>
          <BodyFigureEllipses width={figureWidth} bodySensations={midBS} />
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text style={s.bodyTimeLabel}>RECENT</Text>
          <BodyFigureEllipses width={figureWidth} bodySensations={recentBS} />
        </View>
      </View>
    </ScrollView>
  );
}

// ---- Chakra View ----

// Chakra mapping constant
const CHAKRA_MAP: Record<string, { regions: string[]; color: string; emoji: string; name: string }> = {
  root: { regions: ['pelvis', 'legs', 'feet'], color: COLORS.chakraRoot, emoji: '🔴', name: 'Root' },
  sacral: { regions: ['lower_belly', 'hips'], color: COLORS.chakraSacral, emoji: '🟠', name: 'Sacral' },
  solar: { regions: ['solar_plexus', 'belly', 'jaw'], color: COLORS.chakraSolar, emoji: '🔶', name: 'Solar Plexus' },
  heart: { regions: ['chest', 'upper_back', 'shoulders'], color: COLORS.chakraHeart, emoji: '💚', name: 'Heart' },
  throat: { regions: ['throat', 'neck', 'jaw'], color: COLORS.chakraThroat, emoji: '🔵', name: 'Throat' },
  thirdEye: { regions: ['head', 'brow'], color: COLORS.chakraThirdEye, emoji: '👁', name: 'Third Eye' },
  crown: { regions: ['crown'], color: COLORS.chakraCrown, emoji: '✨', name: 'Crown' },
};

function ChakraView({ sessions, onBack, onChakraSelect }: {
  sessions: SessionWithCheckin[];
  onBack: () => void;
  onChakraSelect: (chakra: string) => void;
}) {
  // Compute activations per chakra
  const chakraActivations = new Map<string, number>();

  for (const chakraKey of Object.keys(CHAKRA_MAP)) {
    const chakra = CHAKRA_MAP[chakraKey];
    let count = 0;
    for (const sess of sessions) {
      if (!sess.checkin) continue;
      for (const bs of sess.checkin.body_sensations) {
        if (chakra.regions.includes(bs.region)) {
          count++;
        }
      }
    }
    chakraActivations.set(chakraKey, count);
  }

  // Sort chakras by activation count
  const sortedChakras = Array.from(chakraActivations.entries())
    .sort((a, b) => b[1] - a[1]);

  const maxCount = sortedChakras[0]?.[1] ?? 1;

  // Generate narrative
  const top2 = sortedChakras.slice(0, 2);
  const bottom2 = sortedChakras.slice(-2).reverse();

  let narrative = '';
  if (top2.length >= 2) {
    const t1 = CHAKRA_MAP[top2[0][0]];
    const t2 = CHAKRA_MAP[top2[1][0]];
    const b1 = CHAKRA_MAP[bottom2[0][0]];
    const b2 = CHAKRA_MAP[bottom2[1][0]];

    if (bottom2[0][1] === 0 && bottom2[1][1] === 0) {
      narrative = `Most of your work has concentrated in the ${t1.name.toLowerCase()} and ${t2.name.toLowerCase()} centers. ${b1.name} and ${b2.name} have been quieter.`;
    } else {
      narrative = `Most of your work has concentrated in the ${t1.name.toLowerCase()} and ${t2.name.toLowerCase()} centers.`;
    }
  } else {
    narrative = 'No chakra activations have been logged yet.';
  }

  return (
    <ScrollView style={s.detailContent} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header */}
      <View style={s.detailHeader}>
        <TouchableOpacity onPress={onBack} hitSlop={12}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={{ fontFamily: FONTS.display, fontSize: 24, color: COLORS.text }}>Chakra Lens</Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.textSecondary, marginTop: 2 }}>
            Your practice mapped to energy centers
          </Text>
        </View>
      </View>

      {/* Narrative card */}
      <View style={s.narrativeCard}>
        <Text style={{ fontFamily: FONTS.body, fontSize: 14, color: COLORS.text, lineHeight: 20 }}>
          {narrative}
        </Text>
      </View>

      {/* Chakra list */}
      <Text style={[s.exploreSectionLabel, { paddingHorizontal: 20, marginTop: 20 }]}>
        ENERGY CENTERS
      </Text>
      <View style={{ paddingHorizontal: 20, marginTop: 12, gap: 8 }}>
        {sortedChakras.map(([chakraKey, count]) => {
          const chakra = CHAKRA_MAP[chakraKey];
          const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0;
          const isInactive = count === 0;

          return (
            <TouchableOpacity
              key={chakraKey}
              style={[s.chakraRow, isInactive && { opacity: 0.25 }]}
              onPress={() => onChakraSelect(chakraKey)}
              activeOpacity={0.7}
            >
              <View style={[s.chakraIconCircle, { backgroundColor: `${chakra.color}22` }]}>
                <Text style={s.chakraEmoji}>{chakra.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.chakraName}>{chakra.name}</Text>
                <Text style={s.chakraRegions}>{chakra.regions.join(', ')}</Text>
              </View>
              <View style={s.chakraBarContainer}>
                <View style={[s.chakraBar, { width: `${barWidth}%`, backgroundColor: chakra.color }]} />
              </View>
              <Text style={s.chakraCount}>{count}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ---- Chakra Detail View ----

function ChakraDetailView({ chakra, sessions, integrations, journeys, onBack }: {
  chakra: string;
  sessions: SessionWithCheckin[];
  integrations: Integration[];
  journeys: Journey[];
  onBack: () => void;
}) {
  const chakraData = CHAKRA_MAP[chakra];
  if (!chakraData) return null;

  // Sessions where this chakra's regions appear
  const chakraSessions = sessions.filter(sess => {
    if (!sess.checkin) return false;
    return sess.checkin.body_sensations.some(bs => chakraData.regions.includes(bs.region));
  });

  // Body regions in this center with counts
  const regionCounts = new Map<string, number>();
  for (const sess of chakraSessions) {
    if (!sess.checkin) continue;
    for (const bs of sess.checkin.body_sensations) {
      if (chakraData.regions.includes(bs.region)) {
        regionCounts.set(bs.region, (regionCounts.get(bs.region) || 0) + 1);
      }
    }
  }
  const sortedRegions = Array.from(regionCounts.entries()).sort((a, b) => b[1] - a[1]);

  // Emotions clustered here
  const emotionCounts = new Map<string, number>();
  for (const sess of chakraSessions) {
    if (!sess.checkin) continue;
    for (const tag of sess.checkin.emotion_tags) {
      emotionCounts.set(tag, (emotionCounts.get(tag) || 0) + 1);
    }
  }
  const sortedEmotions = Array.from(emotionCounts.entries()).sort((a, b) => b[1] - a[1]);

  // Practice types that activate this center
  const practiceCounts = new Map<string, number>();
  for (const sess of chakraSessions) {
    const pt = sess.session.practice_type ?? 'Other';
    practiceCounts.set(pt, (practiceCounts.get(pt) || 0) + 1);
  }
  const sortedPractices = Array.from(practiceCounts.entries()).sort((a, b) => b[1] - a[1]);

  // NS state distribution
  const stateBreakdown = { grounded: 0, activated: 0, shutdown: 0 };
  for (const sess of chakraSessions) {
    if (!sess.checkin?.nervous_system_state) continue;
    const state = sess.checkin.nervous_system_state.toLowerCase();
    if (state.includes('grounded') || state.includes('ventral') || state.includes('self')) {
      stateBreakdown.grounded++;
    } else if (state.includes('activated') || state.includes('sympathetic')) {
      stateBreakdown.activated++;
    } else if (state.includes('shutdown') || state.includes('dorsal') || state.includes('blended')) {
      stateBreakdown.shutdown++;
    }
  }
  const totalStates = stateBreakdown.grounded + stateBreakdown.activated + stateBreakdown.shutdown;

  // Journeys where it appeared
  const journeyCounts = new Map<string, number>();
  for (const sess of chakraSessions) {
    if (sess.session.journey_id) {
      journeyCounts.set(sess.session.journey_id, (journeyCounts.get(sess.session.journey_id) || 0) + 1);
    }
  }

  // Early/mid/recent shift - dominant emotion in first third vs recent third
  const thirdSize = Math.ceil(sessions.length / 3);
  const firstThird = sessions.slice(0, thirdSize);
  const recentThird = sessions.slice(-thirdSize);

  const emotionsInFirst = new Map<string, number>();
  const emotionsInRecent = new Map<string, number>();

  for (const sess of firstThird) {
    if (!sess.checkin) continue;
    const hasChakraRegion = sess.checkin.body_sensations.some(bs => chakraData.regions.includes(bs.region));
    if (hasChakraRegion) {
      for (const tag of sess.checkin.emotion_tags) {
        emotionsInFirst.set(tag, (emotionsInFirst.get(tag) || 0) + 1);
      }
    }
  }

  for (const sess of recentThird) {
    if (!sess.checkin) continue;
    const hasChakraRegion = sess.checkin.body_sensations.some(bs => chakraData.regions.includes(bs.region));
    if (hasChakraRegion) {
      for (const tag of sess.checkin.emotion_tags) {
        emotionsInRecent.set(tag, (emotionsInRecent.get(tag) || 0) + 1);
      }
    }
  }

  const topFirstEmotion = Array.from(emotionsInFirst.entries()).sort((a, b) => b[1] - a[1])[0];
  const topRecentEmotion = Array.from(emotionsInRecent.entries()).sort((a, b) => b[1] - a[1])[0];

  let shiftNarrative = '';
  if (topFirstEmotion && topRecentEmotion) {
    if (topFirstEmotion[0] === topRecentEmotion[0]) {
      shiftNarrative = `${topFirstEmotion[0]} has remained the dominant emotion in this center throughout your arc.`;
    } else {
      shiftNarrative = `Early sessions carried ${topFirstEmotion[0]} in this center. Recent sessions show ${topRecentEmotion[0]} — something has shifted.`;
    }
  } else {
    shiftNarrative = 'Not enough data to detect emotional shifts in this center.';
  }

  // Integration notes mentioning these body regions
  const relevantIntegrations: Integration[] = [];
  for (const integ of integrations) {
    const allText = [
      integ.free_text, integ.triggers_q1, integ.triggers_q2, integ.triggers_q3,
      integ.memories_q1, integ.memories_q2, integ.memories_q3,
      integ.emotions_q1, integ.emotions_q2, integ.emotions_q3,
      integ.body_q1, integ.body_q2, integ.body_q3,
      integ.patterns_q1, integ.patterns_q2, integ.patterns_q3,
      integ.meaning_q1, integ.meaning_q2, integ.meaning_q3,
      integ.realizations_q1, integ.realizations_q2, integ.realizations_q3,
      integ.actions_q1, integ.actions_q2, integ.actions_q3,
      integ.gratitude_q1, integ.gratitude_q2, integ.gratitude_q3,
    ].filter(Boolean).join(' ').toLowerCase();

    const mentionsRegion = chakraData.regions.some(region => allText.includes(region.toLowerCase()));
    if (mentionsRegion) {
      relevantIntegrations.push(integ);
    }
  }
  const topIntegrations = relevantIntegrations.slice(0, 3);

  // Generate narrative
  const totalActivations = sortedRegions.reduce((sum, [_, count]) => sum + count, 0);
  const narrative = `${chakraData.name} has been activated ${totalActivations} time${totalActivations === 1 ? '' : 's'} across ${chakraSessions.length} session${chakraSessions.length === 1 ? '' : 's'}.`;

  return (
    <ScrollView style={s.detailContent} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header */}
      <View style={s.detailHeader}>
        <TouchableOpacity onPress={onBack} hitSlop={12}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={{ fontFamily: FONTS.display, fontSize: 24, color: COLORS.text }}>{chakraData.name}</Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.textSecondary, marginTop: 2 }}>
            {chakraData.regions.join(', ')}
          </Text>
        </View>
        <View style={[s.chakraDetailIconCircle, { backgroundColor: `${chakraData.color}22` }]}>
          <Text style={s.chakraDetailEmoji}>{chakraData.emoji}</Text>
        </View>
      </View>

      {/* Narrative card */}
      <View style={s.narrativeCard}>
        <Text style={{ fontFamily: FONTS.body, fontSize: 14, color: COLORS.text, lineHeight: 20 }}>
          {narrative}
        </Text>
      </View>

      {/* Body regions in this center */}
      {sortedRegions.length > 0 && (
        <>
          <Text style={[s.exploreSectionLabel, { paddingHorizontal: 20, marginTop: 20 }]}>
            BODY REGIONS IN THIS CENTER
          </Text>
          <View style={s.chipContainer}>
            {sortedRegions.map(([region, count]) => (
              <View key={region} style={s.bodyChip}>
                <View style={[s.bodyChipDot, { backgroundColor: chakraData.color }]} />
                <Text style={s.bodyChipText}>{region} · {count}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Emotions clustered here */}
      {sortedEmotions.length > 0 && (
        <>
          <Text style={s.detailSectionLabel}>EMOTIONS CLUSTERED HERE</Text>
          <View style={s.chipContainer}>
            {sortedEmotions.map(([tag, count]) => {
              const tagColor = getEmotionColor(tag);
              return (
                <View key={tag} style={[s.emotionChip, { backgroundColor: tagColor.bg }]}>
                  <Text style={[s.emotionChipText, { color: tagColor.text }]}>{tag} · {count}</Text>
                </View>
              );
            })}
          </View>
        </>
      )}

      {/* Practice types */}
      {sortedPractices.length > 0 && (
        <>
          <Text style={s.detailSectionLabel}>PRACTICE TYPES THAT ACTIVATE THIS CENTER</Text>
          <View style={s.chipContainer}>
            {sortedPractices.map(([pt, count]) => (
              <View key={pt} style={s.greyChip}>
                <Text style={s.greyChipText}>{pt} · {count} session{count === 1 ? '' : 's'}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* NS state distribution */}
      {totalStates > 0 && (
        <>
          <Text style={s.detailSectionLabel}>NS STATE WHEN THIS CENTER IS ACTIVE</Text>
          <View style={{ paddingHorizontal: 20, gap: 8, marginBottom: 24 }}>
            {stateBreakdown.grounded > 0 && (
              <View style={s.stateRow}>
                <Text style={s.stateName}>Grounded</Text>
                <View style={s.stateTrack}>
                  <View style={[s.stateBar, { width: `${(stateBreakdown.grounded / totalStates) * 100}%`, backgroundColor: COLORS.grounded }]} />
                </View>
                <Text style={s.statePercent}>{Math.round((stateBreakdown.grounded / totalStates) * 100)}%</Text>
              </View>
            )}
            {stateBreakdown.activated > 0 && (
              <View style={s.stateRow}>
                <Text style={s.stateName}>Activated</Text>
                <View style={s.stateTrack}>
                  <View style={[s.stateBar, { width: `${(stateBreakdown.activated / totalStates) * 100}%`, backgroundColor: COLORS.activated }]} />
                </View>
                <Text style={s.statePercent}>{Math.round((stateBreakdown.activated / totalStates) * 100)}%</Text>
              </View>
            )}
            {stateBreakdown.shutdown > 0 && (
              <View style={s.stateRow}>
                <Text style={s.stateName}>Shutdown</Text>
                <View style={s.stateTrack}>
                  <View style={[s.stateBar, { width: `${(stateBreakdown.shutdown / totalStates) * 100}%`, backgroundColor: COLORS.shutdown }]} />
                </View>
                <Text style={s.statePercent}>{Math.round((stateBreakdown.shutdown / totalStates) * 100)}%</Text>
              </View>
            )}
          </View>
        </>
      )}

      {/* Journeys */}
      {journeyCounts.size > 0 && (
        <>
          <Text style={s.detailSectionLabel}>JOURNEYS WHERE IT APPEARED</Text>
          <View style={s.chipContainer}>
            {Array.from(journeyCounts.entries()).map(([journeyId, count]) => {
              const journey = journeys.find(j => j.id === journeyId);
              return (
                <View key={journeyId} style={s.journeyBadge}>
                  <Text style={s.journeyBadgeText}>{journey?.name ?? 'Journey'} · {count}</Text>
                </View>
              );
            })}
          </View>
        </>
      )}

      {/* Early/mid/recent shift */}
      <Text style={s.detailSectionLabel}>EARLY → RECENT SHIFT</Text>
      <View style={[s.narrativeCard, { marginBottom: 24 }]}>
        <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.narrativeAccent, fontStyle: 'italic', lineHeight: 20 }}>
          {shiftNarrative}
        </Text>
      </View>

      {/* Integration notes */}
      <Text style={s.detailSectionLabel}>INTEGRATION NOTES MENTIONING THESE REGIONS</Text>
      {topIntegrations.length === 0 ? (
        <Text style={s.noIntegrations}>No integration notes mentioned these regions.</Text>
      ) : (
        <View style={{ paddingHorizontal: 20, gap: 12, marginBottom: 24 }}>
          {topIntegrations.map((integ) => {
            const noteText = integ.free_text
              || integ.triggers_q1 || integ.memories_q1 || integ.emotions_q1
              || integ.body_q1 || integ.patterns_q1 || integ.meaning_q1
              || integ.realizations_q1 || integ.actions_q1 || integ.gratitude_q1
              || '';
            const dateLabel = new Date(integ.note_date + 'T00:00:00').toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
            return (
              <View key={integ.id} style={s.integrationCard}>
                <Text style={s.integrationDate}>{dateLabel.toUpperCase()}</Text>
                <Text style={s.integrationText} numberOfLines={3}>{noteText}</Text>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

// ---- NS State View ----

// Helper to get state color
const getStateColor = (state: string): string => {
  if (state === 'grounded' || state === 'ns-grounded') return COLORS.grounded;
  if (state === 'activated' || state === 'ns-activated') return COLORS.activated;
  if (state === 'shutdown' || state === 'ns-shutdown') return COLORS.shutdown;
  return COLORS.textSecondary;
};

const getStateName = (state: string): string => {
  if (state === 'ns-grounded') return 'Grounded';
  if (state === 'ns-activated') return 'Activated';
  if (state === 'ns-shutdown') return 'Shutdown';
  return state;
};

function NSStateView({ sessions, onBack, onStateSelect }: {
  sessions: SessionWithCheckin[];
  onBack: () => void;
  onStateSelect: (state: string) => void;
}) {
  // Compute state counts
  const stateCounts = { grounded: 0, activated: 0, shutdown: 0 };
  for (const sess of sessions) {
    if (!sess.checkin?.nervous_system_state) continue;
    const state = sess.checkin.nervous_system_state.toLowerCase();
    if (state.includes('grounded') || state.includes('ventral') || state.includes('self')) {
      stateCounts.grounded++;
    } else if (state.includes('activated') || state.includes('sympathetic')) {
      stateCounts.activated++;
    } else if (state.includes('shutdown') || state.includes('dorsal') || state.includes('blended')) {
      stateCounts.shutdown++;
    }
  }

  // First third vs recent third
  const thirdSize = Math.ceil(sessions.length / 3);
  const firstThird = sessions.slice(0, thirdSize);
  const recentThird = sessions.slice(-thirdSize);

  const firstCounts = { grounded: 0, activated: 0, shutdown: 0 };
  const recentCounts = { grounded: 0, activated: 0, shutdown: 0 };

  for (const sess of firstThird) {
    if (!sess.checkin?.nervous_system_state) continue;
    const state = sess.checkin.nervous_system_state.toLowerCase();
    if (state.includes('grounded') || state.includes('ventral') || state.includes('self')) {
      firstCounts.grounded++;
    } else if (state.includes('activated') || state.includes('sympathetic')) {
      firstCounts.activated++;
    } else if (state.includes('shutdown') || state.includes('dorsal') || state.includes('blended')) {
      firstCounts.shutdown++;
    }
  }

  for (const sess of recentThird) {
    if (!sess.checkin?.nervous_system_state) continue;
    const state = sess.checkin.nervous_system_state.toLowerCase();
    if (state.includes('grounded') || state.includes('ventral') || state.includes('self')) {
      recentCounts.grounded++;
    } else if (state.includes('activated') || state.includes('sympathetic')) {
      recentCounts.activated++;
    } else if (state.includes('shutdown') || state.includes('dorsal') || state.includes('blended')) {
      recentCounts.shutdown++;
    }
  }

  // Determine dominant in each period
  const firstDominant = firstCounts.grounded >= firstCounts.activated && firstCounts.grounded >= firstCounts.shutdown ? 'grounded'
    : firstCounts.activated >= firstCounts.shutdown ? 'activated' : 'shutdown';
  const recentDominant = recentCounts.grounded >= recentCounts.activated && recentCounts.grounded >= recentCounts.shutdown ? 'grounded'
    : recentCounts.activated >= recentCounts.shutdown ? 'activated' : 'shutdown';

  // Generate narrative
  let narrative = '';
  if (firstDominant === 'shutdown' && recentDominant === 'grounded') {
    const increase = recentCounts.grounded - firstCounts.grounded;
    narrative = `Your nervous system has been shifting toward regulation. Grounded has${increase > 0 ? ` increased by ${increase} sessions` : ' become more present'} across this arc.`;
  } else if (recentDominant === 'grounded' && stateCounts.grounded > stateCounts.activated && stateCounts.grounded > stateCounts.shutdown) {
    narrative = `Your nervous system has been trending toward regulation. Grounded is now your dominant state.`;
  } else if (firstDominant !== recentDominant) {
    narrative = `Your nervous system state has shifted from ${firstDominant} to ${recentDominant} across this arc.`;
  } else {
    narrative = `${firstDominant.charAt(0).toUpperCase() + firstDominant.slice(1)} has remained your most consistent state throughout this arc.`;
  }

  const totalStates = stateCounts.grounded + stateCounts.activated + stateCounts.shutdown;

  return (
    <ScrollView style={s.detailContent} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header */}
      <View style={s.detailHeader}>
        <TouchableOpacity onPress={onBack} hitSlop={12}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={{ fontFamily: FONTS.display, fontSize: 24, color: COLORS.text }}>Nervous System</Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.textSecondary, marginTop: 2 }}>
            Your state across this arc
          </Text>
        </View>
      </View>

      {/* Narrative card */}
      <View style={s.narrativeCard}>
        <Text style={{ fontFamily: FONTS.body, fontSize: 14, color: COLORS.text, lineHeight: 20 }}>
          {narrative}
        </Text>
      </View>

      {/* Then vs Now bars */}
      <Text style={[s.exploreSectionLabel, { paddingHorizontal: 20, marginTop: 20 }]}>
        THEN VS NOW
      </Text>
      <View style={{ paddingHorizontal: 20, marginTop: 12, gap: 10, marginBottom: 24 }}>
        {/* Grounded */}
        <View style={s.thenNowRow}>
          <View style={[s.stateDot, { backgroundColor: COLORS.grounded }]} />
          <Text style={s.thenNowName}>Grounded</Text>
          <View style={s.thenNowBars}>
            <View style={[s.thenBar, { width: totalStates > 0 ? `${(firstCounts.grounded / totalStates) * 100}%` : '0%', backgroundColor: COLORS.grounded }]} />
            <View style={s.thenNowDivider} />
            <View style={[s.nowBar, { width: totalStates > 0 ? `${(recentCounts.grounded / totalStates) * 100}%` : '0%', backgroundColor: COLORS.grounded }]} />
          </View>
          <Text style={[s.thenNowDelta, recentCounts.grounded > firstCounts.grounded && { color: COLORS.grounded }]}>
            {recentCounts.grounded - firstCounts.grounded >= 0 ? '+' : ''}{recentCounts.grounded - firstCounts.grounded}
          </Text>
        </View>

        {/* Activated */}
        <View style={s.thenNowRow}>
          <View style={[s.stateDot, { backgroundColor: COLORS.activated }]} />
          <Text style={s.thenNowName}>Activated</Text>
          <View style={s.thenNowBars}>
            <View style={[s.thenBar, { width: totalStates > 0 ? `${(firstCounts.activated / totalStates) * 100}%` : '0%', backgroundColor: COLORS.activated }]} />
            <View style={s.thenNowDivider} />
            <View style={[s.nowBar, { width: totalStates > 0 ? `${(recentCounts.activated / totalStates) * 100}%` : '0%', backgroundColor: COLORS.activated }]} />
          </View>
          <Text style={s.thenNowDelta}>
            {recentCounts.activated - firstCounts.activated >= 0 ? '+' : ''}{recentCounts.activated - firstCounts.activated}
          </Text>
        </View>

        {/* Shutdown */}
        <View style={s.thenNowRow}>
          <View style={[s.stateDot, { backgroundColor: COLORS.shutdown }]} />
          <Text style={s.thenNowName}>Shutdown</Text>
          <View style={s.thenNowBars}>
            <View style={[s.thenBar, { width: totalStates > 0 ? `${(firstCounts.shutdown / totalStates) * 100}%` : '0%', backgroundColor: COLORS.shutdown }]} />
            <View style={s.thenNowDivider} />
            <View style={[s.nowBar, { width: totalStates > 0 ? `${(recentCounts.shutdown / totalStates) * 100}%` : '0%', backgroundColor: COLORS.shutdown }]} />
          </View>
          <Text style={s.thenNowDelta}>
            {recentCounts.shutdown - firstCounts.shutdown >= 0 ? '+' : ''}{recentCounts.shutdown - firstCounts.shutdown}
          </Text>
        </View>
      </View>

      {/* Three state cards */}
      <View style={{ paddingHorizontal: 20, gap: 12 }}>
        {/* Grounded */}
        <TouchableOpacity
          style={[s.stateCard, { backgroundColor: 'rgba(106,158,127,0.1)', borderColor: 'rgba(106,158,127,0.2)' }]}
          onPress={() => onStateSelect('ns-grounded')}
          activeOpacity={0.7}
        >
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={[s.stateDot, { backgroundColor: COLORS.grounded }]} />
            <View style={{ flex: 1 }}>
              <Text style={s.stateCardName}>Grounded</Text>
              <Text style={s.stateCardSubtitle}>
                {stateCounts.grounded} of last {totalStates} session{totalStates === 1 ? '' : 's'}
              </Text>
            </View>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.textTertiary} />
        </TouchableOpacity>

        {/* Activated */}
        <TouchableOpacity
          style={[s.stateCard, { backgroundColor: 'rgba(192,138,62,0.1)', borderColor: 'rgba(192,138,62,0.2)' }]}
          onPress={() => onStateSelect('ns-activated')}
          activeOpacity={0.7}
        >
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={[s.stateDot, { backgroundColor: COLORS.activated }]} />
            <View style={{ flex: 1 }}>
              <Text style={s.stateCardName}>Activated</Text>
              <Text style={s.stateCardSubtitle}>
                {stateCounts.activated} of last {totalStates} session{totalStates === 1 ? '' : 's'}
              </Text>
            </View>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.textTertiary} />
        </TouchableOpacity>

        {/* Shutdown */}
        <TouchableOpacity
          style={[s.stateCard, { backgroundColor: 'rgba(92,122,148,0.1)', borderColor: 'rgba(92,122,148,0.2)' }]}
          onPress={() => onStateSelect('ns-shutdown')}
          activeOpacity={0.7}
        >
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={[s.stateDot, { backgroundColor: COLORS.shutdown }]} />
            <View style={{ flex: 1 }}>
              <Text style={s.stateCardName}>Shutdown</Text>
              <Text style={s.stateCardSubtitle}>
                {stateCounts.shutdown} of last {totalStates} session{totalStates === 1 ? '' : 's'}
              </Text>
            </View>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.textTertiary} />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ---- NS State Detail View ----

function NSStateDetailView({ state, sessions, integrations, journeys, onBack }: {
  state: string;
  sessions: SessionWithCheckin[];
  integrations: Integration[];
  journeys: Journey[];
  onBack: () => void;
}) {
  const router = useRouter();
  const stateName = getStateName(state);
  const stateColor = getStateColor(state);

  // Filter sessions where this is the state
  const stateSessions = sessions.filter(sess => {
    if (!sess.checkin?.nervous_system_state) return false;
    const s = sess.checkin.nervous_system_state.toLowerCase();
    if (state === 'ns-grounded') return s.includes('grounded') || s.includes('ventral') || s.includes('self');
    if (state === 'ns-activated') return s.includes('activated') || s.includes('sympathetic');
    if (state === 'ns-shutdown') return s.includes('shutdown') || s.includes('dorsal') || s.includes('blended');
    return false;
  });

  const totalSessions = sessions.length;
  const stateCount = stateSessions.length;

  // Generate narrative
  const percentage = totalSessions > 0 ? Math.round((stateCount / totalSessions) * 100) : 0;
  const narrative = `${stateName} appeared in ${stateCount} of ${totalSessions} session${totalSessions === 1 ? '' : 's'} (${percentage}%) across this arc.`;

  // Before→after transitions (if nervous_system_state_before is available - we'll skip this for now as it's not in our types)

  // Practice types
  const practiceCounts = new Map<string, { count: number; stateCount: number }>();
  for (const sess of sessions) {
    const pt = sess.session.practice_type ?? 'Other';
    if (!practiceCounts.has(pt)) {
      practiceCounts.set(pt, { count: 0, stateCount: 0 });
    }
    practiceCounts.get(pt)!.count++;
  }
  for (const sess of stateSessions) {
    const pt = sess.session.practice_type ?? 'Other';
    if (practiceCounts.has(pt)) {
      practiceCounts.get(pt)!.stateCount++;
    }
  }
  const practicePercentages = Array.from(practiceCounts.entries())
    .map(([pt, data]) => ({
      practice: pt,
      percentage: data.count > 0 ? Math.round((data.stateCount / data.count) * 100) : 0,
      count: data.stateCount,
    }))
    .filter(p => p.count > 0)
    .sort((a, b) => b.percentage - a.percentage);

  // Emotions
  const emotionCounts = new Map<string, number>();
  for (const sess of stateSessions) {
    if (!sess.checkin) continue;
    for (const tag of sess.checkin.emotion_tags) {
      emotionCounts.set(tag, (emotionCounts.get(tag) || 0) + 1);
    }
  }
  const sortedEmotions = Array.from(emotionCounts.entries()).sort((a, b) => b[1] - a[1]);

  // Body regions
  const regionCounts = new Map<string, number>();
  for (const sess of stateSessions) {
    if (!sess.checkin) continue;
    for (const bs of sess.checkin.body_sensations) {
      regionCounts.set(bs.region, (regionCounts.get(bs.region) || 0) + 1);
    }
  }
  const sortedRegions = Array.from(regionCounts.entries()).sort((a, b) => b[1] - a[1]);

  // Journeys
  const journeyCounts = new Map<string, number>();
  for (const sess of stateSessions) {
    if (sess.session.journey_id) {
      journeyCounts.set(sess.session.journey_id, (journeyCounts.get(sess.session.journey_id) || 0) + 1);
    }
  }

  // Integration notes after sessions in this state (within 7 days)
  const relevantIntegrations: Integration[] = [];
  for (const sess of stateSessions) {
    const sessionDate = new Date(sess.session.created_at).getTime();
    for (const integ of integrations) {
      const integDate = new Date(integ.note_date + 'T00:00:00').getTime();
      const daysDiff = (integDate - sessionDate) / (1000 * 60 * 60 * 24);
      if (daysDiff >= 0 && daysDiff <= 7) {
        if (!relevantIntegrations.find(i => i.id === integ.id)) {
          relevantIntegrations.push(integ);
        }
      }
    }
  }
  const topIntegrations = relevantIntegrations.slice(0, 3);

  return (
    <ScrollView style={s.detailContent} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header */}
      <View style={s.detailHeader}>
        <TouchableOpacity onPress={onBack} hitSlop={12}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={[{ fontFamily: FONTS.display, fontSize: 22 }, { color: stateColor }]}>{stateName}</Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: COLORS.textSecondary, marginTop: 2 }}>
            {stateCount} session{stateCount === 1 ? '' : 's'} in this state
          </Text>
        </View>
        <View style={[s.stateDot, { backgroundColor: stateColor }]} />
      </View>

      {/* Narrative card */}
      <View style={s.narrativeCard}>
        <Text style={{ fontFamily: FONTS.body, fontSize: 14, color: COLORS.text, lineHeight: 20 }}>
          {narrative}
        </Text>
      </View>

      {/* What brings you here most reliably */}
      {practicePercentages.length > 0 && (
        <>
          <Text style={s.detailSectionLabel}>WHAT BRINGS YOU HERE MOST RELIABLY</Text>
          <View style={s.chipContainer}>
            {practicePercentages.map(({ practice, percentage, count }) => (
              <View key={practice} style={s.greyChip}>
                <Text style={s.greyChipText}>{practice} · {percentage}% ({count})</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Emotions present in this state */}
      {sortedEmotions.length > 0 && (
        <>
          <Text style={s.detailSectionLabel}>EMOTIONS PRESENT IN THIS STATE</Text>
          <View style={s.chipContainer}>
            {sortedEmotions.map(([tag, count]) => {
              const tagColor = getEmotionColor(tag);
              return (
                <View key={tag} style={[s.emotionChip, { backgroundColor: tagColor.bg }]}>
                  <Text style={[s.emotionChipText, { color: tagColor.text }]}>{tag} · {count}</Text>
                </View>
              );
            })}
          </View>
        </>
      )}

      {/* Body regions in this state */}
      {sortedRegions.length > 0 && (
        <>
          <Text style={s.detailSectionLabel}>BODY REGIONS IN THIS STATE</Text>
          <View style={s.chipContainer}>
            {sortedRegions.map(([region, count]) => (
              <View key={region} style={s.bodyChip}>
                <View style={[s.bodyChipDot, { backgroundColor: getRegionColor(region) }]} />
                <Text style={s.bodyChipText}>{region} · {count}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Sessions in this state (up to 6) */}
      {stateSessions.length > 0 && (
        <>
          <Text style={s.detailSectionLabel}>SESSIONS IN THIS STATE</Text>
          <View style={{ paddingHorizontal: 20, gap: 8, marginBottom: 24 }}>
            {stateSessions.slice(0, 6).map((sess) => {
              const date = new Date(sess.session.created_at);
              const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
              const practiceType = sess.session.practice_type ?? 'Session';
              const top2Emotions = sess.checkin?.emotion_tags.slice(0, 2) ?? [];

              return (
                <TouchableOpacity
                  key={sess.session.id}
                  style={s.sessionListRow}
                  onPress={() => router.push(`/session/${sess.session.id}` as any)}
                  activeOpacity={0.7}
                >
                  <View style={[s.stateDot, { backgroundColor: stateColor }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.sessionListDate}>{dateStr} · {practiceType}</Text>
                    {top2Emotions.length > 0 && (
                      <Text style={s.sessionListEmotions}>{top2Emotions.join(', ')}</Text>
                    )}
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.textTertiary} />
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      {/* Journeys */}
      {journeyCounts.size > 0 && (
        <>
          <Text style={s.detailSectionLabel}>JOURNEYS</Text>
          <View style={s.chipContainer}>
            {Array.from(journeyCounts.entries()).map(([journeyId, count]) => {
              const journey = journeys.find(j => j.id === journeyId);
              return (
                <View key={journeyId} style={s.journeyBadge}>
                  <Text style={s.journeyBadgeText}>{journey?.name ?? 'Journey'} · {count}</Text>
                </View>
              );
            })}
          </View>
        </>
      )}

      {/* Integration notes after sessions in this state */}
      <Text style={s.detailSectionLabel}>INTEGRATION NOTES AFTER SESSIONS IN THIS STATE</Text>
      {topIntegrations.length === 0 ? (
        <Text style={s.noIntegrations}>No integration notes followed sessions in this state.</Text>
      ) : (
        <View style={{ paddingHorizontal: 20, gap: 12, marginBottom: 24 }}>
          {topIntegrations.map((integ) => {
            const noteText = integ.free_text
              || integ.triggers_q1 || integ.memories_q1 || integ.emotions_q1
              || integ.body_q1 || integ.patterns_q1 || integ.meaning_q1
              || integ.realizations_q1 || integ.actions_q1 || integ.gratitude_q1
              || '';
            const dateLabel = new Date(integ.note_date + 'T00:00:00').toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
            return (
              <View key={integ.id} style={s.integrationCard}>
                <Text style={s.integrationDate}>{dateLabel.toUpperCase()}</Text>
                <Text style={s.integrationText} numberOfLines={3}>{noteText}</Text>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

// ---- Practice Type View ----

// Fallback practice icon mapping
const getPracticeIcon = (practice: string): string => {
  const p = practice.toLowerCase();
  if (p.includes('breath')) return 'lungs';
  if (p.includes('yoga')) return 'yoga';
  if (p.includes('meditat')) return 'meditation';
  if (p.includes('journa')) return 'book-open-variant';
  if (p.includes('walk')) return 'walk';
  if (p.includes('run')) return 'run';
  if (p.includes('dance')) return 'human-handsup';
  if (p.includes('sound')) return 'music';
  if (p.includes('somatic')) return 'hand-heart';
  return 'star-circle';
};

function PracticeTypeView({ sessions, onBack, onPracticeSelect }: {
  sessions: SessionWithCheckin[];
  onBack: () => void;
  onPracticeSelect: (practice: string) => void;
}) {
  // Compute practice types with session counts and state breakdown
  const practiceData = new Map<string, { sessions: number; grounded: number; activated: number; shutdown: number }>();

  for (const sess of sessions) {
    const pt = sess.session.practice_type ?? 'Other';
    if (!practiceData.has(pt)) {
      practiceData.set(pt, { sessions: 0, grounded: 0, activated: 0, shutdown: 0 });
    }
    const data = practiceData.get(pt)!;
    data.sessions++;

    if (sess.checkin?.nervous_system_state) {
      const state = sess.checkin.nervous_system_state.toLowerCase();
      if (state.includes('grounded') || state.includes('ventral') || state.includes('self')) {
        data.grounded++;
      } else if (state.includes('activated') || state.includes('sympathetic')) {
        data.activated++;
      } else if (state.includes('shutdown') || state.includes('dorsal') || state.includes('blended')) {
        data.shutdown++;
      }
    }
  }

  const sortedPractices = Array.from(practiceData.entries())
    .filter(([_, data]) => data.sessions > 0)
    .sort((a, b) => b[1].sessions - a[1].sessions);

  return (
    <ScrollView style={s.detailContent} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header */}
      <View style={s.detailHeader}>
        <TouchableOpacity onPress={onBack} hitSlop={12}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={{ fontFamily: FONTS.display, fontSize: 24, color: COLORS.text }}>Practice Types</Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.textSecondary, marginTop: 2 }}>
            Tap a practice to explore its connections
          </Text>
        </View>
      </View>

      {/* Practice list */}
      <View style={{ paddingHorizontal: 20, marginTop: 20, gap: 12 }}>
        {sortedPractices.map(([practice, data]) => {
          const groundedPercent = data.sessions > 0 ? Math.round((data.grounded / data.sessions) * 100) : 0;
          const activatedPercent = data.sessions > 0 ? Math.round((data.activated / data.sessions) * 100) : 0;
          const shutdownPercent = data.sessions > 0 ? Math.round((data.shutdown / data.sessions) * 100) : 0;

          return (
            <TouchableOpacity
              key={practice}
              style={s.practiceRow}
              onPress={() => onPracticeSelect(practice)}
              activeOpacity={0.7}
            >
              <View style={s.practiceIconSquare}>
                <MaterialCommunityIcons name={getPracticeIcon(practice) as any} size={20} color={COLORS.text} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.practiceName}>{practice}</Text>
                <View style={s.practiceStateBar}>
                  {data.grounded > 0 && (
                    <View style={{ flex: data.grounded, height: 7, backgroundColor: COLORS.grounded }} />
                  )}
                  {data.activated > 0 && (
                    <View style={{ flex: data.activated, height: 7, backgroundColor: COLORS.activated }} />
                  )}
                  {data.shutdown > 0 && (
                    <View style={{ flex: data.shutdown, height: 7, backgroundColor: COLORS.shutdown }} />
                  )}
                </View>
                <Text style={s.practiceSessionCount}>{data.sessions} session{data.sessions === 1 ? '' : 's'}</Text>
              </View>
              <Text style={[s.practiceGroundedPercent, { color: COLORS.grounded }]}>{groundedPercent}%</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ---- Practice Type Detail View ----

function PracticeTypeDetailView({ practice, sessions, integrations, journeys, onBack }: {
  practice: string;
  sessions: SessionWithCheckin[];
  integrations: Integration[];
  journeys: Journey[];
  onBack: () => void;
}) {
  const router = useRouter();

  // Filter sessions for this practice type
  const practiceSessions = sessions.filter(sess => (sess.session.practice_type ?? 'Other') === practice);

  // State breakdown
  const stateBreakdown = { grounded: 0, activated: 0, shutdown: 0 };
  for (const sess of practiceSessions) {
    if (!sess.checkin?.nervous_system_state) continue;
    const state = sess.checkin.nervous_system_state.toLowerCase();
    if (state.includes('grounded') || state.includes('ventral') || state.includes('self')) {
      stateBreakdown.grounded++;
    } else if (state.includes('activated') || state.includes('sympathetic')) {
      stateBreakdown.activated++;
    } else if (state.includes('shutdown') || state.includes('dorsal') || state.includes('blended')) {
      stateBreakdown.shutdown++;
    }
  }

  const totalStates = stateBreakdown.grounded + stateBreakdown.activated + stateBreakdown.shutdown;
  const groundedPercent = totalStates > 0 ? Math.round((stateBreakdown.grounded / totalStates) * 100) : 0;
  const activatedPercent = totalStates > 0 ? Math.round((stateBreakdown.activated / totalStates) * 100) : 0;
  const shutdownPercent = totalStates > 0 ? Math.round((stateBreakdown.shutdown / totalStates) * 100) : 0;

  // Generate narrative
  let narrative = '';
  if (groundedPercent > 60) {
    narrative = 'This is where your deepest regulation tends to happen.';
  } else if (activatedPercent > stateBreakdown.grounded && activatedPercent > stateBreakdown.shutdown) {
    narrative = 'This practice tends to activate before it settles — the charge is part of the process.';
  } else {
    narrative = 'Outcomes have been varied across these sessions.';
  }

  // Emotions
  const emotionCounts = new Map<string, number>();
  for (const sess of practiceSessions) {
    if (!sess.checkin) continue;
    for (const tag of sess.checkin.emotion_tags) {
      emotionCounts.set(tag, (emotionCounts.get(tag) || 0) + 1);
    }
  }
  const sortedEmotions = Array.from(emotionCounts.entries()).sort((a, b) => b[1] - a[1]);

  // Body regions
  const regionCounts = new Map<string, number>();
  for (const sess of practiceSessions) {
    if (!sess.checkin) continue;
    for (const bs of sess.checkin.body_sensations) {
      regionCounts.set(bs.region, (regionCounts.get(bs.region) || 0) + 1);
    }
  }
  const sortedRegions = Array.from(regionCounts.entries()).sort((a, b) => b[1] - a[1]);

  // Journeys
  const journeyCounts = new Map<string, number>();
  for (const sess of practiceSessions) {
    if (sess.session.journey_id) {
      journeyCounts.set(sess.session.journey_id, (journeyCounts.get(sess.session.journey_id) || 0) + 1);
    }
  }

  // Integration notes (within 7 days)
  const relevantIntegrations: Integration[] = [];
  for (const sess of practiceSessions) {
    const sessionDate = new Date(sess.session.created_at).getTime();
    for (const integ of integrations) {
      const integDate = new Date(integ.note_date + 'T00:00:00').getTime();
      const daysDiff = (integDate - sessionDate) / (1000 * 60 * 60 * 24);
      if (daysDiff >= 0 && daysDiff <= 7) {
        if (!relevantIntegrations.find(i => i.id === integ.id)) {
          relevantIntegrations.push(integ);
        }
      }
    }
  }
  const topIntegrations = relevantIntegrations.slice(0, 3);

  return (
    <ScrollView style={s.detailContent} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header */}
      <View style={s.detailHeader}>
        <TouchableOpacity onPress={onBack} hitSlop={12}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={{ fontFamily: FONTS.display, fontSize: 22, color: COLORS.text }}>{practice}</Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: COLORS.textSecondary, marginTop: 2 }}>
            {practiceSessions.length} session{practiceSessions.length === 1 ? '' : 's'}
          </Text>
        </View>
        <View style={s.practiceIconSquare}>
          <MaterialCommunityIcons name={getPracticeIcon(practice) as any} size={20} color={COLORS.text} />
        </View>
      </View>

      {/* Narrative card */}
      <View style={s.narrativeCard}>
        <Text style={{ fontFamily: FONTS.body, fontSize: 14, color: COLORS.text, lineHeight: 20 }}>
          {narrative}
        </Text>
      </View>

      {/* Outcomes */}
      {totalStates > 0 && (
        <>
          <Text style={[s.exploreSectionLabel, { paddingHorizontal: 20, marginTop: 20 }]}>
            OUTCOMES
          </Text>
          <View style={{ paddingHorizontal: 20, gap: 8, marginBottom: 24 }}>
            {stateBreakdown.grounded > 0 && (
              <View style={s.stateRow}>
                <Text style={s.stateName}>Grounded</Text>
                <View style={s.stateTrack}>
                  <View style={[s.stateBar, { width: `${groundedPercent}%`, backgroundColor: COLORS.grounded }]} />
                </View>
                <Text style={s.statePercent}>{groundedPercent}%</Text>
              </View>
            )}
            {stateBreakdown.activated > 0 && (
              <View style={s.stateRow}>
                <Text style={s.stateName}>Activated</Text>
                <View style={s.stateTrack}>
                  <View style={[s.stateBar, { width: `${activatedPercent}%`, backgroundColor: COLORS.activated }]} />
                </View>
                <Text style={s.statePercent}>{activatedPercent}%</Text>
              </View>
            )}
            {stateBreakdown.shutdown > 0 && (
              <View style={s.stateRow}>
                <Text style={s.stateName}>Shutdown</Text>
                <View style={s.stateTrack}>
                  <View style={[s.stateBar, { width: `${shutdownPercent}%`, backgroundColor: COLORS.shutdown }]} />
                </View>
                <Text style={s.statePercent}>{shutdownPercent}%</Text>
              </View>
            )}
          </View>
        </>
      )}

      {/* Emotions that appear */}
      {sortedEmotions.length > 0 && (
        <>
          <Text style={s.detailSectionLabel}>EMOTIONS THAT APPEAR</Text>
          <View style={s.chipContainer}>
            {sortedEmotions.map(([tag, count]) => {
              const tagColor = getEmotionColor(tag);
              return (
                <View key={tag} style={[s.emotionChip, { backgroundColor: tagColor.bg }]}>
                  <Text style={[s.emotionChipText, { color: tagColor.text }]}>{tag} · {count}</Text>
                </View>
              );
            })}
          </View>
        </>
      )}

      {/* Body regions activated */}
      {sortedRegions.length > 0 && (
        <>
          <Text style={s.detailSectionLabel}>BODY REGIONS ACTIVATED</Text>
          <View style={s.chipContainer}>
            {sortedRegions.map(([region, count]) => (
              <View key={region} style={s.bodyChip}>
                <View style={[s.bodyChipDot, { backgroundColor: getRegionColor(region) }]} />
                <Text style={s.bodyChipText}>{region} · {count}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Journeys */}
      {journeyCounts.size > 0 && (
        <>
          <Text style={s.detailSectionLabel}>JOURNEYS</Text>
          <View style={s.chipContainer}>
            {Array.from(journeyCounts.entries()).map(([journeyId, count]) => {
              const journey = journeys.find(j => j.id === journeyId);
              return (
                <View key={journeyId} style={s.journeyBadge}>
                  <Text style={s.journeyBadgeText}>{journey?.name ?? 'Journey'} · {count}</Text>
                </View>
              );
            })}
          </View>
        </>
      )}

      {/* Sessions list (up to 6 most recent) */}
      {practiceSessions.length > 0 && (
        <>
          <Text style={s.detailSectionLabel}>SESSIONS</Text>
          <View style={{ paddingHorizontal: 20, gap: 8, marginBottom: 24 }}>
            {practiceSessions.slice(0, 6).map((sess) => {
              const date = new Date(sess.session.created_at);
              const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
              const top2Emotions = sess.checkin?.emotion_tags.slice(0, 2) ?? [];
              const state = sess.checkin?.nervous_system_state ?? '';
              const stateColor = getStateColor(state.toLowerCase().includes('grounded') ? 'grounded' : state.toLowerCase().includes('activated') ? 'activated' : 'shutdown');

              return (
                <TouchableOpacity
                  key={sess.session.id}
                  style={s.sessionListRow}
                  onPress={() => router.push(`/session/${sess.session.id}` as any)}
                  activeOpacity={0.7}
                >
                  <View style={[s.stateDot, { backgroundColor: stateColor }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.sessionListDate}>{dateStr}</Text>
                    {top2Emotions.length > 0 && (
                      <Text style={s.sessionListEmotions}>{top2Emotions.join(', ')}</Text>
                    )}
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.textTertiary} />
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      {/* Integration notes */}
      <Text style={s.detailSectionLabel}>INTEGRATION NOTES</Text>
      {topIntegrations.length === 0 ? (
        <Text style={s.noIntegrations}>No integration notes followed these sessions.</Text>
      ) : (
        <View style={{ paddingHorizontal: 20, gap: 12, marginBottom: 24 }}>
          {topIntegrations.map((integ) => {
            const noteText = integ.free_text
              || integ.triggers_q1 || integ.memories_q1 || integ.emotions_q1
              || integ.body_q1 || integ.patterns_q1 || integ.meaning_q1
              || integ.realizations_q1 || integ.actions_q1 || integ.gratitude_q1
              || '';
            const dateLabel = new Date(integ.note_date + 'T00:00:00').toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
            return (
              <View key={integ.id} style={s.integrationCard}>
                <Text style={s.integrationDate}>{dateLabel.toUpperCase()}</Text>
                <Text style={s.integrationText} numberOfLines={3}>{noteText}</Text>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

// ---- Generation loading view ----

function GenerationView({ type, journeyName }: { type: MirrorPromptType; journeyName?: string }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const barAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    const barLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(barAnim, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(barAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    pulseLoop.start();
    barLoop.start();
    return () => { pulseLoop.stop(); barLoop.stop(); };
  }, []);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });
  const translateX = barAnim.interpolate({ inputRange: [0, 1], outputRange: [-120, 220] });

  const label = type === 'monthly'
    ? 'Reflecting on your month…'
    : type === 'journey'
    ? `Reflecting on ${journeyName ?? 'your journey'}…`
    : 'Reflecting on your week…';

  return (
    <View style={s.genContainer}>
      <Animated.View style={{ transform: [{ scale }], opacity }}>
        <MaterialCommunityIcons name="eye-outline" size={56} color={COLORS.accent} />
      </Animated.View>
      <Text style={s.genText}>{label}</Text>
      <View style={s.genBarTrack}>
        <Animated.View style={[s.genBarFill, { transform: [{ translateX }] }]} />
      </View>
    </View>
  );
}

// ---- Mirror card ----

function MirrorCard({ mirror, onPress, onCopy }: { mirror: Mirror; onPress: () => void; onCopy: () => void }) {
  const isJourney = mirror.type === 'journey';
  const isMonthly = mirror.type === 'monthly';
  const pillLabel = isJourney
    ? `Journey · ${mirror.journey_name ?? ''}`
    : mirror.type === 'weekly' ? 'Weekly' : 'Monthly';

  const pillBg = isJourney ? '#F7F0E7' : (isMonthly ? COLORS.heartTint : COLORS.purpleTint);
  const pillText = isJourney ? COLORS.journey3 : (isMonthly ? COLORS.heart : COLORS.accent);

  return (
    <TouchableOpacity style={[s.mirrorCard, CARD_SHADOW]} onPress={onPress} activeOpacity={0.85}>
      <View style={s.cardTopRow}>
        <View style={[s.typePill, { backgroundColor: pillBg }]}>
          <Text style={[s.typePillText, { color: pillText }]}>{pillLabel}</Text>
        </View>
        <TouchableOpacity onPress={onCopy} hitSlop={8} activeOpacity={0.6}>
          <MaterialCommunityIcons name="content-copy" size={24} color={COLORS.textTertiary} />
        </TouchableOpacity>
      </View>
      <Text style={s.cardDateRange}>{formatDateRange(mirror)}</Text>
      <Text style={s.cardContent} numberOfLines={2}>{mirror.content}</Text>
    </TouchableOpacity>
  );
}

// ---- Mirror sub-tab content ----

function MirrorContent() {
  const router = useRouter();
  const { autogenerate, journeyMirrorId, journeyMirrorName } = useLocalSearchParams<{
    autogenerate?: string;
    journeyMirrorId?: string;
    journeyMirrorName?: string;
  }>();
  const [mirrors, setMirrors] = useState<Mirror[]>([]);
  const [promptType, setPromptType] = useState<MirrorPromptType>(null);
  const [generating, setGenerating] = useState<MirrorPromptType>(null);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [unlockStatus, setUnlockStatus] = useState({ unlocked: true, daysSinceSignup: 0, totalSessions: 0, sessionsNeeded: 0 });
  const [pendingJourneyOffer, setPendingJourneyOffer] = useState<JourneyMirrorOffer | null>(null);
  const [pendingJourneyDateRange, setPendingJourneyDateRange] = useState<string>('');
  const toastAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    const [m, weekly, monthly, status, pendingOffers, journeys] = await Promise.all([
      getMirrors(), shouldShowWeeklyMirror(), shouldShowMonthlyMirror(), getMirrorUnlockStatus(), getPendingJourneyMirrorOffers(), getJourneys(),
    ]);
    setMirrors(m);
    setPromptType(monthly ? 'monthly' : weekly ? 'weekly' : null);
    setUnlockStatus(status);
    const offer = pendingOffers[0] ?? null;
    setPendingJourneyOffer(offer);

    // Calculate journey date range for the offer banner
    if (offer) {
      const journey = journeys.find((j) => j.id === offer.journey_id);
      if (journey && journey.start_date && journey.duration_days) {
        const startDate = new Date(journey.start_date + 'T00:00:00');
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + journey.duration_days);
        const startStr = startDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
        const endStr = endDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
        setPendingJourneyDateRange(`${startStr} → ${endStr}`);
      }
    }
  }, []);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    (async () => { await load(); })();
    return () => { cancelled = true; };
  }, [load]));

  useEffect(() => {
    if (autogenerate === 'weekly' || autogenerate === 'monthly') {
      router.setParams({ autogenerate: undefined } as any);
      handleGenerate(autogenerate);
    }
  }, [autogenerate]);

  useEffect(() => {
    if (!journeyMirrorId) return;
    const existing = mirrors.find((m) => m.type === 'journey' && m.journey_id === journeyMirrorId);
    if (!existing) {
      router.setParams({ journeyMirrorId: undefined, journeyMirrorName: undefined } as any);
      handleGenerateJourneyMirror(journeyMirrorId, journeyMirrorName ?? '');
    }
  }, [journeyMirrorId, mirrors]);

  async function handleGenerate(type: 'weekly' | 'monthly') {
    setGenerating(type);

    const today = new Date();
    const periodStart = type === 'weekly' ? isoDate(daysAgoDate(6)) : isoDate(startOfMonth(today));
    const periodEnd = isoDate(today);

    const [sessions, integrations, profile] = await Promise.all([getSessions(), getIntegrations(), getProfile()]);
    const startTime = new Date(periodStart + 'T00:00:00').getTime();
    const endTime = new Date(periodEnd + 'T23:59:59').getTime();
    const sessionCount = sessions.filter((s) => {
      const t = new Date(s.session.created_at).getTime();
      return t >= startTime && t <= endTime;
    }).length;
    const integrationCount = integrations.filter((i) => {
      const t = new Date(i.note_date + 'T00:00:00').getTime();
      return t >= startTime && t <= endTime;
    }).length;

    const id = uid();
    const generatingMirror: Mirror = {
      id,
      type,
      journey_id: null,
      journey_name: null,
      period_start: periodStart,
      period_end: periodEnd,
      generated_at: new Date().toISOString(),
      content: '',
      summary: '',
      session_count: sessionCount,
      integration_count: integrationCount,
      status: 'generating',
    };
    await saveMirror(generatingMirror);

    setTimeout(async () => {
      const goals = profile?.goals ?? [];

      // Check for insufficient data: minimum 3 sessions for weekly, 5 for monthly
      const minSessions = type === 'weekly' ? 3 : 5;
      if (sessionCount < minSessions) {
        const errorMirror: Mirror = {
          ...generatingMirror,
          generated_at: new Date().toISOString(),
          content: '',
          summary: '',
          status: 'error',
          error_reason: 'insufficient_data',
        };
        await saveMirror(errorMirror);
        setGenerating(null);
        await load();
        router.push({ pathname: '/mirror/[id]', params: { id } } as any);
        return;
      }

      const content = type === 'weekly' ? buildWeeklyResponse(goals) : buildMonthlyResponse(goals);
      const readyMirror: Mirror = {
        ...generatingMirror,
        generated_at: new Date().toISOString(),
        content,
        summary: summarize(content),
        status: 'ready',
      };
      await saveMirror(readyMirror);
      setGenerating(null);
      await load();
      router.push({ pathname: '/mirror/[id]', params: { id } } as any);
    }, 2000);
  }

  async function handleGenerateJourneyMirror(journeyId: string, journeyName: string) {
    setGenerating('journey');
    try {
      const [profile, allSessions, allIntegrations, journeys] = await Promise.all([
        getProfile(), getSessions(), getIntegrations(), getJourneys(),
      ]);
      const goals = profile.goals ?? [];

      const journeySessions = allSessions.filter((s) => s.session.journey_id === journeyId);
      const journeyIntegrations = allIntegrations.filter((i) => i.journey_id === journeyId);

      const journey = journeys.find((j) => j.id === journeyId);
      const today = new Date();
      const todayStr = isoDate(today);
      const periodStart = journey?.start_date ?? todayStr;
      const periodEnd = journey?.closed_at ? journey.closed_at.split('T')[0] : todayStr;

      // Check for insufficient data: minimum 3 sessions for journey mirrors
      if (journeySessions.length < 3) {
        const errorMirror: Mirror = {
          id: uid(),
          type: 'journey',
          journey_id: journeyId,
          journey_name: journeyName,
          period_start: periodStart,
          period_end: periodEnd,
          generated_at: new Date().toISOString(),
          content: '',
          summary: '',
          session_count: journeySessions.length,
          integration_count: journeyIntegrations.length,
          status: 'error',
          error_reason: 'insufficient_data',
        };
        await saveMirror(errorMirror);
        await load();
        router.push({ pathname: '/mirror/[id]', params: { id: errorMirror.id } } as any);
        return;
      }

      const content = buildJourneyResponse(journeyName, goals);

      const mirror: Mirror = {
        id: uid(),
        type: 'journey',
        journey_id: journeyId,
        journey_name: journeyName,
        period_start: periodStart,
        period_end: periodEnd,
        generated_at: new Date().toISOString(),
        content,
        summary: summarize(content),
        session_count: journeySessions.length,
        integration_count: journeyIntegrations.length,
        status: 'ready',
      };

      await saveMirror(mirror);
      await load();
      router.push({ pathname: '/mirror/[id]', params: { id: mirror.id } } as any);
    } finally {
      setGenerating(null);
    }
  }

  async function handleExportAll() {
    const text = compileExportText(mirrors);
    await Clipboard.setStringAsync(text);
    setExportModalVisible(true);
  }

  async function handleCopyMirror(mirror: Mirror) {
    await Clipboard.setStringAsync(mirror.content);
    toastAnim.setValue(1);
    Animated.timing(toastAnim, { toValue: 0, duration: 600, delay: 1500, useNativeDriver: true }).start();
  }

  if (generating) {
    return <GenerationView type={generating} journeyName={pendingJourneyOffer?.journey_name ?? journeyMirrorName} />;
  }

  return (
    <>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.mirrorContent} showsVerticalScrollIndicator={false}>
        {!unlockStatus.unlocked ? (
          <View style={s.lockedState}>
            <MaterialCommunityIcons name="eye-off-outline" size={64} color={COLORS.gray300} style={{ marginBottom: 16 }} />
            <Text style={s.lockedTitle}>Your Mirror is resting</Text>
            <Text style={s.lockedMessage}>
              {unlockStatus.sessionsNeeded > 0
                ? `Log ${unlockStatus.sessionsNeeded} more ${unlockStatus.sessionsNeeded === 1 ? 'session' : 'sessions'} to unlock your weekly synthesis.`
                : 'Your Mirror will be available soon.'}
            </Text>
            <View style={s.lockedStats}>
              <View style={s.lockedStatRow}>
                <MaterialCommunityIcons name="check-circle" size={20} color={unlockStatus.totalSessions >= 7 ? COLORS.heart : COLORS.gray300} />
                <Text style={s.lockedStatText}>{unlockStatus.totalSessions} / 7 sessions logged</Text>
              </View>
              <View style={s.lockedStatRow}>
                <MaterialCommunityIcons name="check-circle" size={20} color={unlockStatus.daysSinceSignup >= 7 ? COLORS.heart : COLORS.gray300} />
                <Text style={s.lockedStatText}>{unlockStatus.daysSinceSignup} / 7 days since sign-up</Text>
              </View>
            </View>
          </View>
        ) : (
          <>
            {promptType && (
              <ExpoLinearGradient
                colors={[COLORS.purple, '#8B5CF6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.banner}
              >
                <MaterialCommunityIcons name="eye-outline" size={28} color={COLORS.white} style={{ marginBottom: 10 }} />
                <Text style={s.bannerTitle}>
                  {promptType === 'monthly' ? 'Your month in the Mirror' : 'Your week in the Mirror'}
                </Text>
                <Text style={s.bannerSubtitle}>
                  {promptType === 'monthly' ? currentMonthLabel() : currentWeekRangeLabel()}
                </Text>
                <TouchableOpacity
                  style={s.bannerBtn}
                  onPress={() => handleGenerate(promptType)}
                  activeOpacity={0.85}
                >
                  <Text style={s.bannerBtnText}>View</Text>
                </TouchableOpacity>
              </ExpoLinearGradient>
            )}

            {pendingJourneyOffer && !generating && (
              <TouchableOpacity
                style={[s.journeyOfferCard, CARD_SHADOW]}
                onPress={() => handleGenerateJourneyMirror(pendingJourneyOffer.journey_id, pendingJourneyOffer.journey_name)}
                activeOpacity={0.85}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <MaterialCommunityIcons name="eye-outline" size={20} color={COLORS.accent} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.journeyOfferTitle}>{pendingJourneyOffer.journey_name} is complete.</Text>
                    {pendingJourneyDateRange ? (
                      <Text style={s.journeyOfferDateRange}>{pendingJourneyDateRange}</Text>
                    ) : null}
                    <Text style={s.journeyOfferSubtitle}>Tap to reflect on this journey</Text>
                  </View>
                  <Text style={s.journeyOfferReflect}>Reflect →</Text>
                </View>
              </TouchableOpacity>
            )}

            {mirrors.length > 0 && (
              <View style={s.sectionHeader}>
                <View style={{ flex: 1 }} />
                <TouchableOpacity onPress={handleExportAll} activeOpacity={0.7}>
                  <Text style={s.exportLinkText}>Export all mirrors</Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={s.sectionLabel}>REFLECTIONS</Text>

            {mirrors.length === 0 ? (
              <View style={s.emptyState}>
                <MaterialCommunityIcons name="eye-outline" size={48} color={COLORS.gray300} />
                <Text style={s.emptyPrimary}>Your first Mirror arrives at the end of this week.</Text>
                <Text style={s.emptySecondary}>Keep logging your sessions and integrations.</Text>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {mirrors.map((m) => (
                  <MirrorCard
                    key={m.id}
                    mirror={m}
                    onPress={() => router.push({ pathname: '/mirror/[id]', params: { id: m.id } } as any)}
                    onCopy={() => handleCopyMirror(m)}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <Animated.View style={[s.toast, { opacity: toastAnim }]} pointerEvents="none">
        <Text style={s.toastText}>Copied</Text>
      </Animated.View>

      <Modal
        transparent
        visible={exportModalVisible}
        animationType="fade"
        onRequestClose={() => setExportModalVisible(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}
          onPress={() => setExportModalVisible(false)}
          activeOpacity={1}
        >
          <TouchableOpacity
            style={s.exportModal}
            activeOpacity={1}
            onPress={() => {}}
          >
            <MaterialCommunityIcons name="content-copy" size={36} color={COLORS.accent} style={{ marginBottom: 16 }} />
            <Text style={s.exportModalTitle}>All mirrors copied</Text>
            <Text style={s.exportModalBody}>
              Your reflections are on your clipboard. Paste them into any journal, notes app, or AI tool.
            </Text>
            <TouchableOpacity
              style={s.exportModalBtn}
              onPress={() => setExportModalVisible(false)}
              activeOpacity={0.85}
            >
              <Text style={s.exportModalBtnText}>Got it</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// ---- Main screen with sub-tabs ----

export default function ReflectScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'mirror' | 'explore'>('mirror');
  const [isSubscribed, setIsSubscribed] = useState(true); // TODO Phase B: wire to StoreKit subscription check

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    (async () => {
      const entitlement = await getEntitlement();
      // TODO Phase B: wire to StoreKit subscription check
      // For now, check if status is 'active' or 'grace_period'
      if (!cancelled) {
        setIsSubscribed(entitlement.status === 'active' || entitlement.status === 'grace_period');
      }
    })();
    return () => { cancelled = true; };
  }, []));

  // Paywall placeholder
  if (!isSubscribed) {
    return (
      <SafeAreaView edges={['top']} style={s.safe}>
        <View style={s.header}>
          <Text style={s.title}>Reflect</Text>
          <TouchableOpacity onPress={() => router.push('/settings' as any)} hitSlop={8}>
            <MaterialCommunityIcons name="cog-outline" size={20} color={COLORS.gray300} />
          </TouchableOpacity>
        </View>
        <View style={s.paywallContainer}>
          <View style={s.paywallCard}>
            <MaterialCommunityIcons name="eye-outline" size={64} color={COLORS.accent} style={{ marginBottom: 20 }} />
            <Text style={s.paywallTitle}>Reflect is part of Sinne's subscription.</Text>
            <TouchableOpacity style={s.paywallButton} onPress={() => router.push('/settings' as any)} activeOpacity={0.8}>
              <Text style={s.paywallButtonText}>Learn more</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Reflect</Text>
        <TouchableOpacity onPress={() => router.push('/settings' as any)} hitSlop={8}>
          <MaterialCommunityIcons name="cog-outline" size={20} color={COLORS.gray300} />
        </TouchableOpacity>
      </View>

      {/* Sub-tab bar */}
      <View style={s.subTabBar}>
        <TouchableOpacity
          style={[s.subTab, activeTab === 'mirror' && s.subTabActive]}
          onPress={() => setActiveTab('mirror')}
          activeOpacity={0.7}
        >
          <Text style={[s.subTabText, activeTab === 'mirror' && s.subTabTextActive]}>Mirror</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.subTab, activeTab === 'explore' && s.subTabActive]}
          onPress={() => setActiveTab('explore')}
          activeOpacity={0.7}
        >
          <Text style={[s.subTabText, activeTab === 'explore' && s.subTabTextActive]}>Explore</Text>
        </TouchableOpacity>
      </View>

      {/* Content area */}
      {activeTab === 'mirror' ? (
        <MirrorContent />
      ) : (
        <ExploreContent />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 0,
  },
  title: { fontSize: 28, fontFamily: FONTS.display, color: COLORS.text },

  // Sub-tab bar
  subTabBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16,
  },
  subTab: {
    paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20,
    backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.border,
  },
  subTabActive: {
    backgroundColor: COLORS.text, borderColor: COLORS.text,
  },
  subTabText: {
    fontFamily: FONTS.bodyMedium, fontSize: 13, fontWeight: '500', color: COLORS.textTertiary,
  },
  subTabTextActive: {
    color: COLORS.background,
  },

  // Mirror content
  mirrorContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 60, gap: 20 },

  banner: {
    borderRadius: RADII.card, padding: 24,
  },
  bannerTitle: { fontSize: 18, fontWeight: '600', color: COLORS.white, marginBottom: 4 },
  bannerSubtitle: { fontSize: 13, fontWeight: '400', color: 'rgba(255,255,255,0.85)', marginBottom: 20 },
  bannerBtn: {
    alignSelf: 'flex-start', backgroundColor: COLORS.white,
    borderRadius: 24, paddingHorizontal: 28, height: 48,
    alignItems: 'center', justifyContent: 'center',
  },
  bannerBtnText: { fontFamily: FONTS.bodyMedium, fontSize: 15, fontWeight: '500', color: COLORS.accent },

  journeyOfferCard: {
    backgroundColor: COLORS.card, borderRadius: RADII.card, padding: 20,
  },
  journeyOfferTitle: {
    fontFamily: FONTS.bodySemiBold, fontSize: 15, fontWeight: '600', color: COLORS.text, marginBottom: 2,
  },
  journeyOfferDateRange: {
    fontFamily: FONTS.body, fontSize: 12, fontWeight: '400', color: COLORS.gray400, marginBottom: 4,
  },
  journeyOfferSubtitle: {
    fontFamily: FONTS.body, fontSize: 13, fontWeight: '400', color: COLORS.textTertiary,
  },
  journeyOfferReflect: {
    fontFamily: FONTS.bodyMedium, fontSize: 13, fontWeight: '500', color: COLORS.accent,
  },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12,
  },
  sectionLabel: {
    fontFamily: FONTS.bodyMedium, fontSize: 11, fontWeight: '500',
    textTransform: 'uppercase', letterSpacing: 1.2, color: COLORS.gray400,
  },
  exportLinkText: { fontSize: 13, fontWeight: '500', color: COLORS.accent },

  mirrorCard: {
    backgroundColor: COLORS.card, borderRadius: RADII.card, padding: 20,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  typePill: {
    backgroundColor: COLORS.purpleTint, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  typePillText: { fontSize: 11, fontWeight: '500', color: COLORS.accent },
  cardDateRange: { fontFamily: FONTS.body, fontSize: 12, fontWeight: '400', color: COLORS.gray400, marginBottom: 12 },
  cardContent: { fontFamily: FONTS.body, fontSize: 15, fontWeight: '400', lineHeight: 22, color: COLORS.gray500 },

  lockedState: {
    alignItems: 'center', justifyContent: 'center',
    paddingTop: 80, paddingHorizontal: 32, gap: 16
  },
  lockedTitle: {
    fontSize: 20, fontWeight: '600', color: COLORS.text, textAlign: 'center'
  },
  lockedMessage: {
    fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22
  },
  lockedStats: {
    marginTop: 16, gap: 12, alignSelf: 'stretch', paddingHorizontal: 16
  },
  lockedStatRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12
  },
  lockedStatText: {
    fontSize: 14, color: COLORS.textSecondary, fontWeight: '500'
  },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingHorizontal: 40, gap: 12 },
  emptyPrimary: { fontSize: 15, color: COLORS.textTertiary, textAlign: 'center' },
  emptySecondary: { fontSize: 13, color: COLORS.textTertiary, textAlign: 'center' },

  toast: {
    position: 'absolute', bottom: 40, alignSelf: 'center',
    backgroundColor: COLORS.gray600, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  toastText: { fontSize: 13, fontWeight: '500', color: COLORS.white },

  exportModal: {
    width: '100%', backgroundColor: COLORS.card, borderRadius: RADII.card, padding: 32,
    alignItems: 'center',
    shadowColor: COLORS.black, shadowOpacity: 0.18, shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 }, elevation: 12,
  },
  exportModalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 10, textAlign: 'center' },
  exportModalBody: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  exportModalBtn: {
    width: '100%', height: 48, backgroundColor: COLORS.accent,
    borderRadius: 24, alignItems: 'center', justifyContent: 'center',
  },
  exportModalBtnText: { fontFamily: FONTS.bodySemiBold, fontSize: 15, fontWeight: '600', color: COLORS.white },

  // Generation loading view
  genContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, paddingHorizontal: 40 },
  genText: { fontSize: 16, color: COLORS.text, textAlign: 'center' },
  genBarTrack: {
    width: 160, height: 4, borderRadius: 2,
    backgroundColor: COLORS.chipBg, overflow: 'hidden',
  },
  genBarFill: {
    width: 80, height: 4, borderRadius: 2, backgroundColor: COLORS.accent,
  },

  // Explore overview
  exploreContent: {
    paddingTop: 0,
    paddingBottom: 60,
  },
  filterBar: {
    paddingHorizontal: 20,
    gap: 8,
    paddingBottom: 16,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterPillActive: {
    backgroundColor: COLORS.text,
    borderColor: COLORS.text,
  },
  filterPillText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    fontWeight: '400',
    color: COLORS.textSecondary,
  },
  filterPillTextActive: {
    color: COLORS.background,
  },

  exploreSectionLabel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: COLORS.textTertiary,
    marginBottom: 12,
  },

  // Emotion Timeline
  emotionTimelineContainer: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  emotionLeftColumn: {
    width: 76,
  },
  emotionRow: {
    height: 22,
    justifyContent: 'center',
    paddingRight: 8,
  },
  emotionName: {
    fontFamily: FONTS.body,
    fontSize: 11,
    fontWeight: '400',
    color: COLORS.textSecondary,
    textAlign: 'right',
  },
  emotionHeaderRow: {
    flexDirection: 'row',
    height: 22,
    marginBottom: 0,
  },
  emotionGridRow: {
    flexDirection: 'row',
    height: 22,
  },
  emotionCell: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emotionHeaderText: {
    fontFamily: FONTS.body,
    fontSize: 9,
    fontWeight: '400',
    color: COLORS.textTertiary,
  },
  emotionDot: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
  },
  emotionHint: {
    fontFamily: FONTS.body,
    fontSize: 11,
    fontWeight: '400',
    color: COLORS.textTertiary,
    fontStyle: 'italic',
    paddingHorizontal: 20,
    marginBottom: 4,
  },

  // Explore By grid
  exploreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 8,
  },
  exploreCard: {
    width: '48.5%',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 13,
    minHeight: 90,
  },
  exploreCardLabel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.0,
    color: COLORS.textTertiary,
    marginBottom: 10,
  },
  exploreCardDots: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 8,
  },
  exploreCardDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  exploreCardText: {
    fontFamily: FONTS.body,
    fontSize: 11,
    fontWeight: '400',
    color: COLORS.textSecondary,
  },
  practiceBar: {
    flexDirection: 'row',
    height: 5,
    borderRadius: 2.5,
    overflow: 'hidden',
    marginBottom: 8,
  },

  // Emotion detail view
  detailContent: {
    paddingTop: 0,
    paddingBottom: 60,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  detailTitle: {
    fontFamily: FONTS.display,
    fontSize: 22,
    fontWeight: '400',
    color: COLORS.text,
  },
  detailSubtitle: {
    fontFamily: FONTS.body,
    fontSize: 12,
    fontWeight: '400',
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  emotionDetailDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  narrativeCard: {
    backgroundColor: 'rgba(62,107,106,0.08)',
    borderLeftWidth: 2,
    borderLeftColor: COLORS.narrativeAccent,
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 24,
  },
  narrativeText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    fontWeight: '400',
    color: COLORS.narrativeAccent,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  detailSectionLabel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: COLORS.textTertiary,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  arcDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  bodyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(34,30,26,0.05)',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  bodyChipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bodyChipText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    fontWeight: '400',
    color: COLORS.textSecondary,
  },
  emotionChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  emotionChipText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    fontWeight: '400',
  },
  greyChip: {
    backgroundColor: 'rgba(34,30,26,0.05)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  greyChipText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    fontWeight: '400',
    color: COLORS.textSecondary,
  },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stateName: {
    fontFamily: FONTS.body,
    fontSize: 13,
    fontWeight: '400',
    color: COLORS.text,
    width: 70,
  },
  stateTrack: {
    flex: 1,
    height: 6,
    backgroundColor: COLORS.chipBg,
    borderRadius: 3,
    overflow: 'hidden',
  },
  stateBar: {
    height: 6,
    borderRadius: 3,
  },
  statePercent: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textSecondary,
    width: 40,
    textAlign: 'right',
  },
  journeyBadge: {
    backgroundColor: 'rgba(126,107,158,0.1)',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  journeyBadgeText: {
    fontFamily: FONTS.body,
    fontSize: 11,
    fontWeight: '400',
    color: COLORS.journey4,
  },
  noIntegrations: {
    fontFamily: FONTS.body,
    fontSize: 13,
    fontWeight: '400',
    color: COLORS.textTertiary,
    fontStyle: 'italic',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  integrationCard: {
    backgroundColor: COLORS.white,
    borderRadius: 11,
    padding: 13,
  },
  integrationDate: {
    fontFamily: FONTS.body,
    fontSize: 10,
    fontWeight: '400',
    color: COLORS.textTertiary,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  integrationText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    fontWeight: '400',
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    lineHeight: 19.2,
  },

  // Body Region styles
  regionRow: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  regionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  regionName: {
    fontFamily: FONTS.body,
    fontSize: 13,
    fontWeight: '400',
    color: COLORS.text,
  },
  regionBarContainer: {
    flex: 1,
    height: 4,
    backgroundColor: COLORS.gray100,
    borderRadius: 2,
    overflow: 'hidden',
  },
  regionBar: {
    height: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: 2,
  },
  regionCount: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    minWidth: 24,
    textAlign: 'right',
  },
  bodyTimeLabel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 9,
    fontWeight: '600',
    color: COLORS.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },

  // Chakra styles
  chakraRow: {
    backgroundColor: COLORS.card,
    borderRadius: 11,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chakraIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chakraEmoji: {
    fontSize: 16,
  },
  chakraName: {
    fontFamily: FONTS.body,
    fontSize: 13,
    fontWeight: '400',
    color: COLORS.text,
  },
  chakraRegions: {
    fontFamily: FONTS.body,
    fontSize: 10,
    fontWeight: '400',
    color: COLORS.textTertiary,
    marginTop: 2,
  },
  chakraBarContainer: {
    width: 60,
    height: 4,
    backgroundColor: COLORS.gray100,
    borderRadius: 2,
    overflow: 'hidden',
  },
  chakraBar: {
    height: '100%',
    borderRadius: 2,
  },
  chakraCount: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    minWidth: 24,
    textAlign: 'right',
  },
  chakraDetailIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chakraDetailEmoji: {
    fontSize: 20,
  },

  // NS State styles
  stateDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  thenNowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  thenNowName: {
    fontFamily: FONTS.body,
    fontSize: 13,
    fontWeight: '400',
    color: COLORS.text,
    width: 70,
  },
  thenNowBars: {
    flex: 1,
    flexDirection: 'row',
    height: 6,
    alignItems: 'center',
  },
  thenBar: {
    height: 6,
    opacity: 0.4,
    borderRadius: 3,
  },
  thenNowDivider: {
    width: 1,
    height: 12,
    backgroundColor: COLORS.border,
    marginHorizontal: 1,
  },
  nowBar: {
    height: 6,
    borderRadius: 3,
  },
  thenNowDelta: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    width: 40,
    textAlign: 'right',
  },
  stateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 11,
    borderWidth: 1,
    padding: 13,
    gap: 12,
  },
  stateCardName: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  stateCardSubtitle: {
    fontFamily: FONTS.body,
    fontSize: 12,
    fontWeight: '400',
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  sessionListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 12,
  },
  sessionListDate: {
    fontFamily: FONTS.body,
    fontSize: 13,
    fontWeight: '400',
    color: COLORS.text,
  },
  sessionListEmotions: {
    fontFamily: FONTS.body,
    fontSize: 11,
    fontWeight: '400',
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  // Practice Type styles
  practiceRow: {
    backgroundColor: COLORS.card,
    borderRadius: 11,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  practiceIconSquare: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  practiceName: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  practiceStateBar: {
    width: '100%',
    height: 7,
    borderRadius: 3.5,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 4,
  },
  practiceSessionCount: {
    fontFamily: FONTS.body,
    fontSize: 11,
    fontWeight: '400',
    color: COLORS.textTertiary,
  },
  practiceGroundedPercent: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
    fontWeight: '600',
  },

  // Paywall placeholder styles
  paywallContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  paywallCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    ...CARD_SHADOW,
  },
  paywallTitle: {
    fontFamily: FONTS.display,
    fontSize: 18,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 26,
  },
  paywallButton: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 24,
  },
  paywallButtonText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },
});
