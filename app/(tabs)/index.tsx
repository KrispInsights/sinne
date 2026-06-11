import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Modal, Animated, StyleSheet, Dimensions, TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import Svg, { Circle, Path, Rect, Defs, LinearGradient as SvgLinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSessions, getActiveJourneys, getJourneys, getProfile, getIntegrations, closeJourney, updateJourney, getMirrors } from '@/lib/storage';
import { consumeSessionSaved } from '@/lib/events';
import type { SessionWithCheckin, Journey, Profile, Integration, Mirror } from '@/lib/types';
import { BodyFigureEllipses, REGION_CHAKRA_COLORS } from '@/components/BodyFigure';

const IS_DEV = process.env.EXPO_PUBLIC_DEV_MODE === 'true';
const { width: SCREEN_W } = Dimensions.get('window');

const CARD_SHADOW = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.05,
  shadowRadius: 16,
  elevation: 3,
} as const;

// ---- Constants ----

const STATE_COLORS: Record<string, string> = {
  settled: '#7AAE8A',
  activated: '#C9B96A',
  shutdown: '#7E6B9E',
};

// Muted polyvagal "wellness tone" palette — used only for the arc chart bands,
// the breakdown nervous-system bars, and the session list state dots.
const WELLNESS_TONES: Record<string, string> = {
  settled: '#8FAE9A',   // Ventral — Sage Green
  activated: '#D6C2A1', // Sympathetic — Warm Sand
  shutdown: '#A89ABF',  // Dorsal — Dusty Lavender
};

const ACTIVATED_LABEL = '#B8A080';

function getWellnessChipColors(state?: string | null): { bg: string; text: string } {
  if (state === 'activated') return { bg: WELLNESS_TONES.activated + '26', text: ACTIVATED_LABEL };
  if (state === 'shutdown') return { bg: WELLNESS_TONES.shutdown + '26', text: WELLNESS_TONES.shutdown };
  return { bg: WELLNESS_TONES.settled + '26', text: WELLNESS_TONES.settled };
}

function getWellnessDotColor(state?: string | null): string {
  if (state === 'activated') return WELLNESS_TONES.activated;
  if (state === 'shutdown') return WELLNESS_TONES.shutdown;
  if (state === 'settled') return WELLNESS_TONES.settled;
  return '#CCCCCC';
}

type SomaView = 'arc' | 'calendar' | 'breakdown';

const SOMA_TABS: Array<{ key: SomaView; icon: string }> = [
  { key: 'arc', icon: 'chart-bell-curve-cumulative' },
  { key: 'calendar', icon: 'calendar-month-outline' },
  { key: 'breakdown', icon: 'chart-donut' },
];

type SomaFilter = 'week' | 'month' | '30d' | '90d' | 'all';

const SOMA_FILTERS: Array<{ key: SomaFilter; label: string }> = [
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: '30d', label: 'Past 30 days' },
  { key: '90d', label: 'Past 90 days' },
  { key: 'all', label: 'All time' },
];

const VOCAB_NAMES: Record<string, Record<string, string>> = {
  plain:     { settled: 'Grounded',   activated: 'Activated',      shutdown: 'Shutdown' },
  polyvagal: { settled: 'Ventral',   activated: 'Sympathetic',    shutdown: 'Dorsal' },
  ifs:       { settled: 'Self',      activated: 'Activated part', shutdown: 'Blended' },
  somatic:   { settled: 'Grounded',   activated: 'Activated',      shutdown: 'Shutdown' },
};

const EMOTION_TAG_COLOR: Record<string, string> = {
  grief: '#6E9BB5', sadness: '#6E9BB5', longing: '#6E9BB5', loss: '#6E9BB5', heartbreak: '#6E9BB5',
  fear: '#B5736A', dread: '#B5736A', anxiety: '#B5736A', terror: '#B5736A', panic: '#B5736A',
  anger: '#C49A6C', rage: '#C49A6C', frustration: '#C49A6C', irritation: '#C49A6C', resentment: '#C49A6C',
  shame: '#7E6B9E', guilt: '#7E6B9E', unworthiness: '#7E6B9E', smallness: '#7E6B9E',
  joy: '#7AAE8A', gratitude: '#7AAE8A', love: '#7AAE8A', warmth: '#7AAE8A', bliss: '#7AAE8A', awe: '#7AAE8A',
  confusion: '#9B7FBF', numbness: '#9B7FBF', emptiness: '#9B7FBF', dissociation: '#9B7FBF',
  release: '#C49A6C', openness: '#C49A6C', relief: '#C49A6C', surrender: '#C49A6C',
};

const CATEGORY_COLORS: Record<string, string> = {
  emotions: '#6E9BB5', body: '#7AAE8A', triggers: '#B5736A', patterns: '#7E6B9E',
  meaning: '#9B7FBF', realizations: '#9B7FBF', gratitude: '#7AAE8A',
  memories: '#6E9BB5', actions: '#C9B96A', free_text: '#999999',
};

// Muted accent colours cycled across active journey cards
const JOURNEY_ACCENT_COLORS = ['#6E9BB5', '#7AAE8A', '#C49A6C', '#7E6B9E', '#B5736A', '#C9B96A'];

const SOMA_TITLES: Record<SomaView, string> = {
  arc: '',
  calendar: 'Calendar',
  breakdown: 'Practice stats',
};

// ---- Helpers ----

function getDominantEmotionColor(swc: SessionWithCheckin): string {
  const tags = swc.checkin?.emotion_tags ?? [];
  for (const tag of tags) {
    const color = EMOTION_TAG_COLOR[tag];
    if (color) return color;
  }
  const state = swc.checkin?.nervous_system_state;
  if (state && STATE_COLORS[state]) return STATE_COLORS[state];
  return '#DDDDDD';
}

function getDominantEmotionLabel(swc: SessionWithCheckin): string | null {
  const tags = swc.checkin?.emotion_tags ?? [];
  for (const tag of tags) {
    if (EMOTION_TAG_COLOR[tag]) return tag.charAt(0).toUpperCase() + tag.slice(1);
  }
  return null;
}

function getGreeting(name?: string): string {
  const h = new Date().getHours();
  const time = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  return name ? `Good ${time}, ${name}` : `Good ${time}`;
}

function formatHeaderDate(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function getRelativeDate(iso: string): string {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(iso); d.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return `${diff} days ago`;
}

function getStateName(framework: string, state: string): string {
  return (VOCAB_NAMES[framework] ?? VOCAB_NAMES.plain)[state] ?? state;
}

const GRIEF_TAGS = new Set(['grief','sadness','longing','loss','heartbreak']);
const FEAR_TAGS = new Set(['fear','dread','anxiety','terror','panic']);
const ANGER_TAGS = new Set(['anger','rage','frustration','irritation','resentment']);
const SHAME_TAGS = new Set(['shame','guilt','unworthiness','smallness']);
const POSITIVE_TAGS = new Set(['joy','gratitude','love','warmth','bliss','awe']);
const NEUTRAL_TAGS = new Set(['confusion','numbness','emptiness','dissociation']);
const RELEASE_TAGS = new Set(['release','openness','relief','surrender']);

const PRACTICE_ICON_KEYS: Array<[string, string]> = [
  ['Breathwork',  'weather-windy'],
  ['Dance',       'human-handsup'],
  ['IFS',         'account-group-outline'],
  ['Meditation',  'meditation'],
  ['Qi Gong',     'yin-yang'],
  ['Reiki',       'hands-pray'],
  ['Somatic',     'heart-pulse'],
  ['Sound',       'music-note-outline'],
  ['Trauma',      'shield-heart-outline'],
  ['Yoga',        'yoga'],
];

function getPracticeTypeColor(practiceType: string | null | undefined): string {
  if (!practiceType) return '#CCCCCC';
  const base = practiceType.split(':')[0].trim().toLowerCase();
  if (base.startsWith('breathwork') || base.includes('breath')) return '#6E9BB5';
  if (base.startsWith('somatic')) return '#7AAE8A';
  if (base.startsWith('meditation')) return '#9B7FBF';
  if (base.startsWith('yoga')) return '#C49A6C';
  if (base.startsWith('dance') || base.includes('movement')) return '#C9B96A';
  return '#CCCCCC';
}

function getSessionIcon(swc: SessionWithCheckin): { icon: string; color: string } {
  const color = getDominantEmotionColor(swc);
  const practice = swc.session.practice_type;
  if (practice) {
    const base = practice.split(':')[0].trim();
    for (const [key, icon] of PRACTICE_ICON_KEYS) {
      if (base.startsWith(key)) return { icon, color };
    }
    return { icon: 'circle-outline', color };
  }
  return { icon: 'circle-outline', color };
}

function buildMonthCalendar(year: number, month: number): (Date | null)[][] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  let startDow = firstDay.getDay(); // Sun=0
  const weeks: (Date | null)[][] = [];
  let week: (Date | null)[] = Array(startDow).fill(null);
  for (let d = 1; d <= lastDay.getDate(); d++) {
    week.push(new Date(year, month, d));
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}

function journeyDateRange(journey: Journey): [Date, Date] | null {
  if (!journey.start_date) return null;
  const start = new Date(journey.start_date);
  start.setHours(0, 0, 0, 0);
  let end: Date;
  if (journey.duration_days) {
    end = new Date(journey.start_date);
    end.setDate(end.getDate() + journey.duration_days - 1);
  } else if (journey.closed_at) {
    end = new Date(journey.closed_at);
  } else {
    end = new Date();
  }
  end.setHours(0, 0, 0, 0);
  if (end < start) end = start;
  return [start, end];
}

function getMonthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
}

function filterByWindow(
  sessions: SessionWithCheckin[],
  integrations: Integration[],
  filter: SomaFilter,
): { sessions: SessionWithCheckin[]; integrations: Integration[] } {
  if (filter === 'all') return { sessions, integrations };
  const now = new Date();
  let cutoff: Date;
  if (filter === 'week') {
    const day = now.getDay();
    const diffToMon = day === 0 ? -6 : 1 - day;
    cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMon);
  } else if (filter === 'month') {
    cutoff = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (filter === '30d') {
    cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
  } else {
    cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 89);
  }
  cutoff.setHours(0, 0, 0, 0);
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  return {
    sessions: sessions.filter((s) => s.session.created_at.slice(0, 10) >= cutoffIso),
    integrations: integrations.filter((i) => i.note_date >= cutoffIso),
  };
}

function computeTopEmotionColors(sessions: SessionWithCheckin[], n: number): string[] {
  const colorCount: Record<string, number> = {};
  for (const swc of sessions) {
    const color = getDominantEmotionColor(swc);
    colorCount[color] = (colorCount[color] ?? 0) + 1;
  }
  return Object.entries(colorCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([c]) => c);
}

function computeBreakdown(sessions: SessionWithCheckin[]) {
  const total = sessions.length;
  const nsCounts: Record<string, number> = {};
  const tagCounts: Record<string, number> = {};
  const regionCounts: Record<string, number> = {};
  for (const swc of sessions) {
    const st = swc.checkin?.nervous_system_state;
    if (st) nsCounts[st] = (nsCounts[st] ?? 0) + 1;
    for (const tag of swc.checkin?.emotion_tags ?? []) {
      tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
    }
    for (const bs of swc.checkin?.body_sensations ?? []) {
      regionCounts[bs.region] = (regionCounts[bs.region] ?? 0) + 1;
    }
  }
  const nsPercents = Object.fromEntries(
    Object.entries(nsCounts).map(([k, v]) => [k, Math.round((v / total) * 100)])
  );
  const topEmotions = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([tag, count]) => ({ tag, count }));
  const topRegions = Object.entries(regionCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([region, count]) => ({ region, count }));
  return { nsPercents, topEmotions, topRegions };
}

// ---- Calendar grid ----

const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const CAL_CELL_H = 64;
const CAL_CELL_SIZE = 32;

const JOURNEY_BAR_H = 4;
const JOURNEY_BAR_GAP = 3;

function CalendarGrid({
  year, month, cellSize, sessions, integrations, onDayPress,
}: {
  year: number; month: number; cellSize: number;
  sessions: SessionWithCheckin[]; integrations: Integration[];
  onDayPress?: (iso: string, sessions: SessionWithCheckin[], integrations: Integration[]) => void;
}) {
  const weeks = buildMonthCalendar(year, month);
  const todayIso = new Date().toISOString().slice(0, 10);

  const sessionDateMap = new Map<string, SessionWithCheckin[]>();
  const integDateMap = new Map<string, Integration[]>();
  sessions.forEach((swc) => {
    const d = swc.session.created_at.slice(0, 10);
    sessionDateMap.set(d, [...(sessionDateMap.get(d) ?? []), swc]);
  });
  integrations.forEach((i) => integDateMap.set(i.note_date, [...(integDateMap.get(i.note_date) ?? []), i]));
  const integDateSet = new Set(integDateMap.keys());

  return (
    <View>
      {/* Day headers */}
      <View style={{ flexDirection: 'row' }}>
        {DAY_HEADERS.map((d, i) => (
          <View
            key={i}
            style={{
              width: cellSize, height: 24, alignItems: 'center', justifyContent: 'center',
              borderRightWidth: i < 6 ? StyleSheet.hairlineWidth : 0,
              borderRightColor: '#F0F0F0',
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '500', color: '#999999' }}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Week rows */}
      {weeks.map((week, wi) => {
        return (
        <View key={wi} style={{ flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F0F0F0', position: 'relative' }}>
          {week.map((date, di) => {
            const isLast = di === 6;
            if (!date) {
              return (
                <View
                  key={di}
                  style={{
                    width: cellSize, height: CAL_CELL_H,
                    borderRightWidth: isLast ? 0 : StyleSheet.hairlineWidth,
                    borderRightColor: '#F0F0F0',
                  }}
                />
              );
            }

            const iso = date.toISOString().slice(0, 10);
            const dateNum = date.getDate();
            const daySessions = sessionDateMap.get(iso) ?? [];
            const hasSession = daySessions.length > 0;
            const hasInteg = integDateSet.has(iso);
            const isToday = iso === todayIso;
            const isPast = iso < todayIso;

            const numColor = isToday ? '#FFFFFF'
              : hasSession ? '#1A1A1A'
              : isPast ? '#CCCCCC'
              : '#999999';

            return (
              <TouchableOpacity
                key={di}
                style={{
                  width: cellSize, height: CAL_CELL_H,
                  borderRightWidth: isLast ? 0 : StyleSheet.hairlineWidth,
                  borderRightColor: '#F0F0F0',
                  alignItems: 'center', paddingTop: 6,
                }}
                onPress={() => {
                  if (hasSession || hasInteg) {
                    const dayIntegrations = integDateMap.get(iso) ?? [];
                    onDayPress?.(iso, daySessions, dayIntegrations);
                  }
                }}
                activeOpacity={hasSession || hasInteg ? 0.6 : 0.2}
              >
                {isToday ? (
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#B07FFF', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>{dateNum}</Text>
                  </View>
                ) : (
                  <View style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 13, fontWeight: hasSession ? '600' : '400', color: numColor }}>{dateNum}</Text>
                  </View>
                )}
                <View style={{ flexDirection: 'row', gap: 3, marginTop: 4, height: 8 }}>
                  {daySessions.slice(0, 3).map((swc, si) => (
                    <View
                      key={si}
                      style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: getPracticeTypeColor(swc.session.practice_type) }}
                    />
                  ))}
                </View>
                <View style={{ height: 12, marginTop: 2 }}>
                  {hasInteg && (
                    <MaterialCommunityIcons name="notebook-outline" size={12} color="#9B7FBF" />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
        );
      })}
    </View>
  );
}

const CALENDAR_LEGEND = [
  { color: '#6E9BB5', label: 'Breathwork' },
  { color: '#7AAE8A', label: 'Somatic' },
  { color: '#9B7FBF', label: 'Meditation' },
  { color: '#C49A6C', label: 'Yoga' },
  { color: '#C9B96A', label: 'Movement' },
  { color: '#CCCCCC', label: 'Other' },
] as const;

function CalendarView({
  sessions, integrations, onDayPress,
}: {
  sessions: SessionWithCheckin[]; integrations: Integration[];
  onDayPress?: (iso: string, sessions: SessionWithCheckin[], integrations: Integration[]) => void;
}) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [gridWidth, setGridWidth] = useState(0);

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (year === now.getFullYear() && month === now.getMonth()) return;
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  }

  const cellSize = gridWidth > 0 ? gridWidth / 7 : CAL_CELL_SIZE;

  return (
    <View>
      <View style={s.calNavRow}>
        <Text style={s.calNavMonth}>{getMonthLabel(year, month)}</Text>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <TouchableOpacity onPress={prevMonth} style={s.calNavBtn} activeOpacity={0.6}>
            <MaterialCommunityIcons name="chevron-left" size={18} color="#B07FFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={nextMonth} style={s.calNavBtn} activeOpacity={0.6}>
            <MaterialCommunityIcons name="chevron-right" size={18} color="#B07FFF" />
          </TouchableOpacity>
        </View>
      </View>

      <View onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
        <CalendarGrid
          year={year} month={month} cellSize={cellSize}
          sessions={sessions} integrations={integrations}
          onDayPress={onDayPress}
        />
      </View>

      {/* Practice type legend row */}
      <View style={[s.iconLegend, { marginTop: 12 }]}>
        {CALENDAR_LEGEND.map(({ color, label }) => (
          <View key={label} style={s.legendIconItem}>
            <View style={[s.legendDot, { backgroundColor: color }]} />
            <Text style={s.legendIconText}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ---- Arc chart ----

const ARC_BAND_COLORS = ['#8FAE9A', '#B8A080', '#A89ABF'];

function getArcBandLabels(framework: string): Array<{ label: string; color: string }> {
  const vocabMap = VOCAB_NAMES[framework] ?? VOCAB_NAMES.plain;
  return [
    { label: vocabMap.settled,   color: ARC_BAND_COLORS[0] },
    { label: vocabMap.activated, color: ARC_BAND_COLORS[1] },
    { label: vocabMap.shutdown,  color: ARC_BAND_COLORS[2] },
  ];
}

function buildSmoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const cx = (p1.x + p2.x) / 2;
    d += ` C ${cx} ${p1.y}, ${cx} ${p2.y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

function ArcChart({ sessions, integrations, framework }: { sessions: SessionWithCheckin[]; integrations: Integration[]; framework: string }) {
  const [rowW, setRowW] = useState(SCREEN_W - 80);
  const [selected, setSelected] = useState<number | null>(null);

  const CHART_H = 200;
  const DATE_LABEL_H = 20;
  const NOTE_ROW_H = 18;
  const PX = 56;

  const integDateSet = new Set(integrations.map((i) => i.note_date));
  const sorted = [...sessions].sort((a, b) => a.session.created_at.localeCompare(b.session.created_at));

  const BAND_H = CHART_H / 3;

  function nsY(state?: string | null): number {
    if (state === 'settled')   return BAND_H * 0.5;
    if (state === 'activated') return BAND_H * 1.5;
    return BAND_H * 2.5;
  }

  // Group sessions by date (YYYY-MM-DD)
  const groupedByDate = new Map<string, SessionWithCheckin[]>();
  sorted.forEach((swc) => {
    const dateKey = swc.session.created_at.slice(0, 10);
    const existing = groupedByDate.get(dateKey) ?? [];
    groupedByDate.set(dateKey, [...existing, swc]);
  });

  // Create one point per date
  const dateEntries = Array.from(groupedByDate.entries());
  const chartW = Math.max(dateEntries.length * PX + 40, rowW);

  const points = dateEntries.map(([dateKey, sessionsOnDate], i) => {
    // For multiple sessions on same date, use the most recent state and show count
    const primarySession = sessionsOnDate[sessionsOnDate.length - 1];
    const sessionCount = sessionsOnDate.length;

    // Calculate average Y position for multiple sessions
    let avgY = 0;
    if (sessionCount > 1) {
      const sum = sessionsOnDate.reduce((acc, swc) => acc + nsY(swc.checkin?.nervous_system_state), 0);
      avgY = sum / sessionCount;
    } else {
      avgY = nsY(primarySession.checkin?.nervous_system_state);
    }

    return {
      x: 24 + i * PX,
      y: avgY,
      dotColor: getWellnessDotColor(primarySession.checkin?.nervous_system_state),
      color: getDominantEmotionColor(primarySession),
      hasInteg: integDateSet.has(dateKey),
      dateLabel: new Date(dateKey + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      fullDate: new Date(dateKey + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      stateName: primarySession.checkin?.nervous_system_state ? getStateName(framework, primarySession.checkin.nervous_system_state) : null,
      emotion: getDominantEmotionLabel(primarySession),
      duration: primarySession.session.duration_minutes,
      practiceType: primarySession.session.practice_type ?? null,
      sessionCount,
      sessionsOnDate,
    };
  });

  const linePath = buildSmoothPath(points);
  const sel = selected !== null ? points[selected] : null;
  const TIP_W = 170;
  let tipLeft = sel ? sel.x - TIP_W / 2 : 0;
  if (tipLeft < 4) tipLeft = 4;
  if (sel && tipLeft + TIP_W > chartW - 4) tipLeft = chartW - 4 - TIP_W;
  const tipAbove = sel ? sel.y > 50 : true;

  // Unique practice types present, for the legend row below the chart
  const practiceLegend = (() => {
    const seen = new Map<string, { icon: string; color: string; label: string }>();
    sorted.forEach((swc) => {
      const pt = swc.session.practice_type;
      if (!pt) return;
      const label = pt.split(':')[0].trim();
      if (seen.has(label)) return;
      const { icon } = getSessionIcon(swc);
      seen.set(label, { icon, color: getPracticeTypeColor(pt), label });
    });
    return Array.from(seen.values());
  })();

  return (
    <View>
      {sessions.length === 0 ? (
        <View style={{ height: CHART_H, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 13, color: '#999999' }}>No sessions yet.</Text>
        </View>
      ) : (
        <>
          {/* State legend row */}
          <View style={s.arcLegendRow}>
            {getArcBandLabels(framework).map(({ label, color }) => (
              <View key={label} style={s.arcLegendItem}>
                <View style={[s.arcLegendDot, { backgroundColor: color }]} />
                <Text style={s.arcLegendText}>{label}</Text>
              </View>
            ))}
          </View>

          {/* Scrollable chart */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} onLayout={(e) => setRowW(e.nativeEvent.layout.width)}>
            <View style={{ width: chartW }}>
              <Svg width={chartW} height={CHART_H + DATE_LABEL_H}>
                <Defs>
                  <SvgLinearGradient id="arcBands" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#8FAE9A" stopOpacity={0.1} />
                    <Stop offset="0.5" stopColor="#D6C2A1" stopOpacity={0.1} />
                    <Stop offset="1" stopColor="#A89ABF" stopOpacity={0.1} />
                  </SvgLinearGradient>
                </Defs>

                {/* Soft polyvagal bands, blended */}
                <Rect x={0} y={0} width={chartW} height={CHART_H} fill="url(#arcBands)" />

                {/* Connecting line */}
                <Path d={linePath} stroke="#B07FFF" strokeOpacity={0.5} strokeWidth={1.5} fill="none" strokeLinecap="round" />

                {/* Data points, selection halo + invisible tap targets */}
                {points.map((p, i) => {
                  // Get practice type symbol
                  const getPracticeSymbol = (practiceType: string | null): string => {
                    if (!practiceType) return '◯';
                    const base = practiceType.toLowerCase();
                    if (base.includes('breathwork') || base.includes('breath')) return '◯';
                    if (base.includes('somatic')) return '◉';
                    if (base.includes('meditation')) return '◈';
                    if (base.includes('movement') || base.includes('dance') || base.includes('yoga')) return '◇';
                    return '◯';
                  };
                  const symbol = getPracticeSymbol(p.practiceType);

                  return (
                    <React.Fragment key={i}>
                      {/* Selection halo */}
                      <Circle cx={p.x} cy={p.y} r={16} fill="#B07FFF" fillOpacity={selected === i ? 0.16 : 0} />

                      {/* Outer glow ring */}
                      <Circle cx={p.x} cy={p.y} r={11} fill={p.dotColor} fillOpacity={0.18} />

                      {/* Solid inner circle */}
                      <Circle cx={p.x} cy={p.y} r={7} fill={p.dotColor} fillOpacity={0.85} />

                      {/* Practice type symbol */}
                      <SvgText
                        x={p.x}
                        y={p.y + 3.5}
                        textAnchor="middle"
                        fontSize={9}
                        fill="#FFFFFF"
                        fontWeight="600"
                      >
                        {symbol}
                      </SvgText>

                      {/* Invisible tap target */}
                      <Circle
                        cx={p.x} cy={p.y} r={20} fill="#000000" fillOpacity={0}
                        onPress={() => setSelected((cur) => (cur === i ? null : i))}
                      />
                    </React.Fragment>
                  );
                })}

                {/* X-axis date labels */}
                {points.map((p, i) => (
                  (points.length <= 8 || i % 3 === 0) ? (
                    <SvgText key={i} x={p.x} y={CHART_H + 14} textAnchor="middle" fontSize={10} fill="#CCCCCC">
                      {p.dateLabel}
                    </SvgText>
                  ) : null
                ))}
              </Svg>

              {/* Tooltip for selected point */}
              {sel && (
                <View
                  pointerEvents="none"
                  style={[
                    s.arcTooltip,
                    {
                      width: TIP_W,
                      left: tipLeft,
                      top: tipAbove ? sel.y - 14 - 100 : sel.y + 14,
                    },
                  ]}
                >
                  <Text style={s.arcTooltipDate}>
                    {sel.fullDate}
                    {sel.sessionCount > 1 ? ` (${sel.sessionCount} sessions)` : ''}
                  </Text>
                  {(sel.practiceType || sel.stateName) ? (
                    <Text style={s.arcTooltipRow}>
                      {[sel.practiceType, sel.stateName].filter(Boolean).join(' · ')}
                    </Text>
                  ) : null}
                  {sel.emotion ? <Text style={[s.arcTooltipEmotion, { color: sel.color }]}>{sel.emotion}</Text> : null}
                </View>
              )}

              {/* Integration note markers, below the x-axis */}
              <View style={{ height: NOTE_ROW_H }}>
                {points.filter((p) => p.hasInteg).map((p, i) => (
                  <View key={i} style={{ position: 'absolute', left: p.x - 6, top: 2 }}>
                    <MaterialCommunityIcons name="notebook-outline" size={12} color="#9B7FBF" />
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>

          {/* Practice type legend */}
          {practiceLegend.length > 0 && (
            <View style={[s.iconLegend, { marginTop: 12 }]}>
              {practiceLegend.map(({ icon, color, label }) => (
                <View key={label} style={s.legendIconItem}>
                  <MaterialCommunityIcons name={icon as any} size={12} color={color} />
                  <Text style={s.legendIconText}>{label}</Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}

      <Text style={s.arcCaption}>
        Tap any point to see session details. Position shows nervous system state.
      </Text>
    </View>
  );
}

// ---- Breakdown view ----

function BreakdownView({ sessions, framework }: { sessions: SessionWithCheckin[]; framework: string }) {
  if (sessions.length === 0) return <Text style={{ fontSize: 13, color: '#999999', textAlign: 'center', paddingTop: 20 }}>No sessions yet.</Text>;
  const { nsPercents, topEmotions, topRegions } = computeBreakdown(sessions);
  const nsOrdered = ['settled', 'activated', 'shutdown'];
  const vocabMap = VOCAB_NAMES[framework] ?? VOCAB_NAMES.plain;
  const maxRegionCount = topRegions[0]?.count ?? 1;
  const featuredEmotion = topEmotions[0] ?? null;

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Nervous system cards */}
      <View style={s.bkSection}>
        <View style={s.bkNsCards}>
          {nsOrdered.map((key) => {
            const pct = nsPercents[key] ?? 0;
            const tone = WELLNESS_TONES[key];
            return (
              <View key={key} style={[s.bkNsCard, { backgroundColor: tone + '1A' }]}>
                <View style={s.bkNsCardHeader}>
                  <View style={[s.bkNsCardDot, { backgroundColor: tone }]} />
                  <Text style={s.bkNsCardName}>{vocabMap[key]}</Text>
                </View>
                <Text style={[s.bkNsCardPct, { color: tone }]}>{pct}%</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Dominant emotion */}
      {featuredEmotion && (
        <View style={s.bkSection}>
          <Text style={[s.bkLabel, { textAlign: 'center' }]}>DOMINANT EMOTION</Text>
          <View style={s.bkDominantCard}>
            <Text style={s.bkDominantEmotion}>
              {featuredEmotion.tag.charAt(0).toUpperCase() + featuredEmotion.tag.slice(1)}
            </Text>
          </View>
        </View>
      )}

      {/* Body regions with frequency bar */}
      {topRegions.length > 0 && (
        <View style={s.bkSection}>
          <Text style={s.bkLabel}>BODY REGIONS</Text>
          {topRegions.map(({ region, count }) => {
            const barColor = REGION_CHAKRA_COLORS[region] ?? '#9B7FBF';
            const barWidth = `${Math.round((count / maxRegionCount) * 100)}%`;
            return (
              <View key={region} style={s.bkRegionRow}>
                <View style={[s.bkRegionDot, { backgroundColor: barColor }]} />
                <Text style={s.bkRegionName} numberOfLines={1}>{region.replace('_', ' / ')}</Text>
                <View style={s.bkRegionTrack}>
                  <View style={[s.bkRegionBar, { width: barWidth as any, backgroundColor: barColor }]} />
                </View>
                <Text style={s.bkRegionCount}>{count}</Text>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

// ---- Session detail sheet ----

function SessionDetailSheet({
  visible, onDismiss, sessions: sessionList, framework,
}: {
  visible: boolean; onDismiss: () => void;
  sessions: SessionWithCheckin[]; framework: string;
}) {
  const slideAnim = useRef(new Animated.Value(700)).current;
  const { bottom: safeBottom } = useSafeAreaInsets();

  React.useEffect(() => {
    if (visible) Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 16 }).start();
    else slideAnim.setValue(700);
  }, [visible]);

  const swc = sessionList[0];
  if (!swc) return null;
  const { checkin } = swc;
  const nsColor = checkin?.nervous_system_state ? STATE_COLORS[checkin.nervous_system_state] : '#999999';
  const nsName = checkin?.nervous_system_state ? getStateName(framework, checkin.nervous_system_state) : '';

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onDismiss}>
      <TouchableOpacity
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)' }}
        onPress={onDismiss} activeOpacity={1}
      />
      <Animated.View style={[s.detailSheet, { paddingBottom: Math.max(safeBottom, 24) }, { transform: [{ translateY: slideAnim }] }]}>
        <View style={s.dragHandle} />
        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          <Text style={s.detailDate}>{getRelativeDate(swc.session.created_at)}</Text>
          {nsName ? (
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={[s.detailNsPill, { backgroundColor: nsColor }]}>
                <Text style={s.detailNsText}>{nsName}</Text>
              </View>
            </View>
          ) : null}
          {checkin?.emotion_tags && checkin.emotion_tags.length > 0 && (
            <View style={s.detailSection}>
              <Text style={s.detailSectionLabel}>EMOTIONS</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {checkin.emotion_tags.map((tag) => (
                  <View key={tag} style={[s.detailChip, { backgroundColor: (EMOTION_TAG_COLOR[tag] ?? '#9B7FBF') + '26' }]}>
                    <Text style={[s.detailChipText, { color: EMOTION_TAG_COLOR[tag] ?? '#9B7FBF' }]}>
                      {tag.charAt(0).toUpperCase() + tag.slice(1)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          {checkin?.body_sensations && checkin.body_sensations.length > 0 && (
            <View style={s.detailSection}>
              <Text style={s.detailSectionLabel}>BODY</Text>
              {checkin.body_sensations.map((bs) => (
                <View key={bs.region} style={s.detailBodyRow}>
                  <View style={[s.detailBodyDot, { backgroundColor: REGION_CHAKRA_COLORS[bs.region] ?? '#9B7FBF' }]} />
                  <Text style={s.detailBodyText}>
                    {bs.region.replace('_', ' / ')}
                    {bs.quality ? <Text style={s.detailBodyQuality}> · {bs.quality}</Text> : null}
                  </Text>
                </View>
              ))}
            </View>
          )}
          {checkin?.elaboration_note ? (
            <View style={s.detailSection}>
              <Text style={s.detailSectionLabel}>NOTE</Text>
              <Text style={s.detailNoteText}>{checkin.elaboration_note}</Text>
            </View>
          ) : null}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// ---- General bottom sheet ----

function BottomSheet({ visible, onDismiss, children }: { visible: boolean; onDismiss: () => void; children: React.ReactNode }) {
  const slideAnim = useRef(new Animated.Value(600)).current;
  const { bottom: safeBottom } = useSafeAreaInsets();
  React.useEffect(() => {
    if (visible) Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 18 }).start();
    else slideAnim.setValue(600);
  }, [visible]);
  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onDismiss}>
      <TouchableOpacity
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)' }}
        onPress={onDismiss} activeOpacity={1}
      />
      <Animated.View style={[s.sheet, { paddingBottom: Math.max(safeBottom, 16) }, { transform: [{ translateY: slideAnim }] }]}>
        <View style={s.dragHandle} />
        {children}
      </Animated.View>
    </Modal>
  );
}

// ---- Day detail sheet ----

function formatSheetDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

function getIntegFirstLine(integ: Integration): string | null {
  const candidates = [
    integ.emotions_q1, integ.body_q1, integ.triggers_q1, integ.patterns_q1,
    integ.meaning_q1, integ.realizations_q1, integ.gratitude_q1,
    integ.memories_q1, integ.actions_q1, integ.free_text,
  ];
  for (const c of candidates) {
    if (c && c.trim()) return c.trim();
  }
  return null;
}

function DaySheet({
  visible, onDismiss, dateIso, sessions: daySessions, integrations: dayIntegrations, mirrors: dayMirrors,
}: {
  visible: boolean; onDismiss: () => void; dateIso: string | null;
  sessions: SessionWithCheckin[]; integrations: Integration[]; mirrors: Mirror[];
}) {
  const router = useRouter();
  const slideAnim = useRef(new Animated.Value(600)).current;
  const { bottom: safeBottom } = useSafeAreaInsets();

  React.useEffect(() => {
    if (visible) Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 18 }).start();
    else slideAnim.setValue(600);
  }, [visible]);

  if (!dateIso) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onDismiss}>
      <TouchableOpacity
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)' }}
        onPress={onDismiss} activeOpacity={1}
      />
      <Animated.View style={[s.sheet, { paddingHorizontal: 20, paddingBottom: Math.max(safeBottom, 24), maxHeight: '70%' }, { transform: [{ translateY: slideAnim }] }]}>
        <View style={s.dragHandle} />
        <Text style={s.detailDate}>{formatSheetDate(dateIso)}</Text>
        <ScrollView showsVerticalScrollIndicator={false}>
          {daySessions.map((swc) => {
            const { icon, color } = getSessionIcon(swc);
            return (
              <TouchableOpacity
                key={swc.session.id}
                style={s.daySheetRow}
                activeOpacity={0.6}
                onPress={() => { onDismiss(); router.push(`/session/${swc.session.id}` as any); }}
              >
                <MaterialCommunityIcons name={icon as any} size={16} color={color} />
                <View style={{ flex: 1 }}>
                  <Text style={s.daySheetRowTitle}>{swc.session.practice_type || 'Session'}</Text>
                  {swc.session.duration_minutes ? (
                    <Text style={s.daySheetRowSubtitle}>{swc.session.duration_minutes} min</Text>
                  ) : null}
                </View>
                <MaterialCommunityIcons name="chevron-right" size={18} color="#CCCCCC" />
              </TouchableOpacity>
            );
          })}
          {dayIntegrations.map((integ) => {
            const firstLine = getIntegFirstLine(integ);
            const catColor = CATEGORY_COLORS[integ.category] ?? '#9B7FBF';
            return (
              <TouchableOpacity
                key={integ.id}
                style={s.daySheetRow}
                activeOpacity={0.6}
                onPress={() => { onDismiss(); router.push('/integration' as any); }}
              >
                <MaterialCommunityIcons name="notebook-outline" size={16} color={catColor} />
                <View style={{ flex: 1 }}>
                  <Text style={s.daySheetRowTitle}>{integ.category.charAt(0).toUpperCase() + integ.category.slice(1).replace('_', ' ')}</Text>
                  {firstLine ? <Text style={s.daySheetRowSubtitle} numberOfLines={1}>{firstLine}</Text> : null}
                </View>
                <MaterialCommunityIcons name="chevron-right" size={18} color="#CCCCCC" />
              </TouchableOpacity>
            );
          })}
          {dayMirrors.map((m) => {
            const typeLabel = m.type === 'monthly' ? 'Monthly' : 'Weekly';
            const rangeLabel = (() => {
              const start = new Date(m.period_start + 'T00:00:00');
              const end = new Date(m.period_end + 'T00:00:00');
              if (m.type === 'monthly') return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
              const sm = start.toLocaleDateString('en-US', { month: 'short' });
              const em = end.toLocaleDateString('en-US', { month: 'short' });
              const yr = end.getFullYear();
              return sm === em
                ? `${sm} ${start.getDate()}–${end.getDate()}, ${yr}`
                : `${sm} ${start.getDate()} – ${em} ${end.getDate()}, ${yr}`;
            })();
            return (
              <TouchableOpacity
                key={m.id}
                style={s.daySheetRow}
                activeOpacity={0.6}
                onPress={() => { onDismiss(); router.push({ pathname: '/mirror/[id]', params: { id: m.id } } as any); }}
              >
                <MaterialCommunityIcons name="eye-outline" size={16} color="#B07FFF" />
                <View style={{ flex: 1 }}>
                  <Text style={s.daySheetRowTitle}>{typeLabel} Mirror</Text>
                  <Text style={s.daySheetRowSubtitle}>{rangeLabel}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={18} color="#CCCCCC" />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// ---- Journey progress helpers ----

function journeyProgressPct(journey: Journey): number {
  if (!journey.start_date || !journey.duration_days) return 0;
  const start = new Date(journey.start_date + 'T00:00:00').getTime();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const elapsed = Math.floor((today.getTime() - start) / 86400000) + 1;
  return Math.min(1, Math.max(0, elapsed / journey.duration_days));
}

function journeyDayLabel(journey: Journey): string {
  if (!journey.start_date || !journey.duration_days) return '';
  const start = new Date(journey.start_date + 'T00:00:00').getTime();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const elapsed = Math.floor((today.getTime() - start) / 86400000) + 1;
  const day = Math.min(elapsed, journey.duration_days);
  return `Day ${day} of ${journey.duration_days}`;
}

function journeyXY(journey: Journey): string | null {
  if (!journey.start_date || !journey.duration_days) return null;
  const start = new Date(journey.start_date + 'T00:00:00').getTime();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const elapsed = Math.floor((today.getTime() - start) / 86400000) + 1;
  const day = Math.min(Math.max(elapsed, 0), journey.duration_days);
  return `${day}/${journey.duration_days}`;
}

// ---- Journey detail sheet ----

const EDU_ITEM_H = 44;

function JourneyDetailSheet({
  visible, onDismiss, journey, sessions, onEnd, onUpdate,
}: {
  visible: boolean; onDismiss: () => void; journey: Journey | null;
  sessions: SessionWithCheckin[]; onEnd: (id: string) => void; onUpdate?: () => void;
}) {
  const slideAnim = useRef(new Animated.Value(700)).current;
  const { bottom: safeBottom } = useSafeAreaInsets();
  const router = useRouter();
  const [confirmEndOpen, setConfirmEndOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editStartDate, setEditStartDate] = useState(new Date());
  const [editDurDays, setEditDurDays] = useState(30);
  const [editSaving, setEditSaving] = useState(false);
  const durScrollRef = useRef<ScrollView>(null);

  React.useEffect(() => {
    if (visible) {
      setConfirmEndOpen(false);
      setEditOpen(false);
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 16 }).start();
    } else {
      slideAnim.setValue(700);
    }
  }, [visible]);

  React.useEffect(() => {
    if (editOpen && durScrollRef.current) {
      const target = Math.max(0, editDurDays - 1) * EDU_ITEM_H;
      setTimeout(() => durScrollRef.current?.scrollTo({ y: target, animated: false }), 80);
    }
  }, [editOpen]);

  function openEdit() {
    if (!journey) return;
    setEditName(journey.name);
    setEditStartDate(journey.start_date ? new Date(journey.start_date + 'T00:00:00') : new Date());
    setEditDurDays(journey.duration_days ?? 30);
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!journey || !editName.trim()) return;
    setEditSaving(true);
    const pad = (n: number) => String(n).padStart(2, '0');
    const iso = `${editStartDate.getFullYear()}-${pad(editStartDate.getMonth() + 1)}-${pad(editStartDate.getDate())}`;
    await updateJourney(journey.id, { name: editName.trim(), start_date: iso, duration_days: editDurDays });
    setEditSaving(false);
    setEditOpen(false);
    onUpdate?.();
  }

  if (!journey) return null;

  const linked = sessions.filter((swc) => swc.session.journey_id === journey.id);
  const pct = journeyProgressPct(journey);
  const startLabel = journey.start_date
    ? new Date(journey.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '';

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onDismiss}>
      <TouchableOpacity
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)' }}
        onPress={onDismiss} activeOpacity={1}
      />
      <Animated.View style={[s.detailSheet, { paddingBottom: Math.max(safeBottom, 24) }, { transform: [{ translateY: slideAnim }] }]}>
        <View style={s.dragHandle} />
        {confirmEndOpen ? (
          <View style={s.journeyConfirmOverlay}>
            <Text style={s.journeyConfirmTitle}>End this Journey?</Text>
            <Text style={s.journeyConfirmBody}>This will close the journey. It will be included in your next Mirror.</Text>
            <TouchableOpacity
              style={s.journeyConfirmPrimary}
              activeOpacity={0.8}
              onPress={() => { onEnd(journey.id); onDismiss(); }}
            >
              <Text style={s.journeyConfirmPrimaryText}>Yes, end journey</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.journeyConfirmSecondary}
              activeOpacity={0.8}
              onPress={() => setConfirmEndOpen(false)}
            >
              <Text style={s.journeyConfirmSecondaryText}>Keep going</Text>
            </TouchableOpacity>
          </View>
        ) : editOpen ? (
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            {/* Edit header */}
            <View style={s.journeyEditHeader}>
              <TouchableOpacity onPress={() => setEditOpen(false)} hitSlop={8}>
                <Text style={s.journeyEditCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={s.journeyEditTitle}>Edit Journey</Text>
              <TouchableOpacity onPress={saveEdit} disabled={!editName.trim() || editSaving} hitSlop={8}>
                <Text style={[s.journeyEditSave, (!editName.trim() || editSaving) && { opacity: 0.4 }]}>Save</Text>
              </TouchableOpacity>
            </View>

            {/* Name */}
            <Text style={s.journeyEditLabel}>JOURNEY NAME</Text>
            <TextInput
              style={s.journeyEditInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Journey name"
              placeholderTextColor="#CCCCCC"
              returnKeyType="done"
            />

            {/* Start date */}
            <Text style={[s.journeyEditLabel, { marginTop: 20 }]}>START DATE</Text>
            <DateTimePicker
              mode="date"
              display="spinner"
              value={editStartDate}
              maximumDate={new Date()}
              onChange={(_, date) => { if (date) setEditStartDate(date); }}
              style={{ height: 140 }}
            />

            {/* Duration */}
            <Text style={[s.journeyEditLabel, { marginTop: 8 }]}>DURATION (DAYS)</Text>
            <View style={s.journeyEditWheelWrap}>
              <View style={s.journeyEditWheelIndicator} pointerEvents="none" />
              <ScrollView
                ref={durScrollRef}
                showsVerticalScrollIndicator={false}
                snapToInterval={EDU_ITEM_H}
                decelerationRate="fast"
                style={{ height: EDU_ITEM_H * 3 }}
                contentContainerStyle={{ paddingVertical: EDU_ITEM_H }}
                onMomentumScrollEnd={(e) => {
                  const idx = Math.round(e.nativeEvent.contentOffset.y / EDU_ITEM_H);
                  setEditDurDays(Math.max(1, Math.min(90, idx + 1)));
                }}
                scrollEnabled
                nestedScrollEnabled
              >
                {Array.from({ length: 90 }, (_, i) => {
                  const val = i + 1;
                  const active = editDurDays === val;
                  return (
                    <View key={i} style={{ height: EDU_ITEM_H, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: active ? 24 : 17, fontWeight: active ? '700' : '400', color: active ? '#1A1A1A' : '#CCCCCC' }}>
                        {val}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
            <Text style={s.journeyEditWheelUnit}>days</Text>
          </ScrollView>
        ) : (
          <>
            {/* Edit button top-right */}
            <View style={{ alignItems: 'flex-end', marginBottom: 2 }}>
              <TouchableOpacity onPress={openEdit} hitSlop={8}>
                <Text style={{ fontSize: 14, fontWeight: '500', color: '#B07FFF' }}>Edit</Text>
              </TouchableOpacity>
            </View>
            <Text style={s.journeySheetName}>{journey.name}</Text>
            <Text style={s.journeySheetMeta}>{startLabel}{journey.duration_days ? ` · ${journey.duration_days} days` : ''}</Text>

            {/* Progress bar */}
            <View style={s.journeySheetBarBg}>
              <View style={[s.journeySheetBarFill, { width: `${Math.round(pct * 100)}%` as any }]} />
            </View>
            <Text style={s.journeySheetPct}>{journeyDayLabel(journey)}</Text>

            {/* Linked sessions */}
            {linked.length > 0 && (
              <>
                <Text style={[s.detailSectionLabel, { marginTop: 16, marginBottom: 8 }]}>SESSIONS</Text>
                <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                  {linked.map((swc) => {
                    const { icon, color } = getSessionIcon(swc);
                    return (
                      <TouchableOpacity
                        key={swc.session.id}
                        style={s.journeySheetSessionRow}
                        activeOpacity={0.6}
                        onPress={() => { onDismiss(); router.push(`/session/${swc.session.id}` as any); }}
                      >
                        <MaterialCommunityIcons name={icon as any} size={18} color={color} />
                        <Text style={s.journeySheetSessionText}>
                          {swc.session.practice_type || 'Session'}
                          {swc.session.duration_minutes ? ` · ${swc.session.duration_minutes} min` : ''}
                        </Text>
                        <Text style={s.journeySheetSessionDate}>
                          {new Date(swc.session.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            )}

            {/* Log a session */}
            <TouchableOpacity
              style={s.journeySheetLogBtn}
              activeOpacity={0.7}
              onPress={() => {
                onDismiss();
                router.push({ pathname: '/new-session', params: { journeyId: journey.id, lockedJourney: 'true' } } as any);
              }}
            >
              <Text style={s.journeySheetLogBtnText}>Log a session</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.journeySheetEndBtn}
              activeOpacity={0.7}
              onPress={() => setConfirmEndOpen(true)}
            >
              <Text style={s.journeySheetEndText}>End journey</Text>
            </TouchableOpacity>
          </>
        )}
      </Animated.View>
    </Modal>
  );
}

// ---- Main screen ----

export default function HomeScreen() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionWithCheckin[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [activeJourneys, setActiveJourneys] = useState<Journey[]>([]);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [mirrors, setMirrors] = useState<Mirror[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [somaView, setSomaView] = useState<SomaView>('arc');
  const [somaFilter, setSomaFilter] = useState<SomaFilter>('all');
  const [showFilterPicker, setShowFilterPicker] = useState(false);
  const [detailSessions, setDetailSessions] = useState<SessionWithCheckin[]>([]);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [dayDetailDate, setDayDetailDate] = useState<string | null>(null);
  const [dayDetailSessions, setDayDetailSessions] = useState<SessionWithCheckin[]>([]);
  const [dayDetailIntegrations, setDayDetailIntegrations] = useState<Integration[]>([]);
  const [dayDetailMirrors, setDayDetailMirrors] = useState<Mirror[]>([]);
  const [dayDetailOpen, setDayDetailOpen] = useState(false);
  const [selectedJourney, setSelectedJourney] = useState<Journey | null>(null);
  const [journeyDetailOpen, setJourneyDetailOpen] = useState(false);
  const [journeyExpanded, setJourneyExpanded] = useState(false);
  const [integrationPromptOpen, setIntegrationPromptOpen] = useState(false);
  const [promptedSessionId, setPromptedSessionId] = useState<string | null>(null);
  const savedToastAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const [sv, j, allJ, p, integ, m] = await Promise.all([getSessions(), getActiveJourneys(), getJourneys(), getProfile(), getIntegrations(), getMirrors()]);
        if (!cancelled) {
          setSessions(sv); setActiveJourneys(j); setJourneys(allJ); setProfile(p); setIntegrations(integ); setMirrors(m);
          const justSaved = consumeSessionSaved();
          if (justSaved) {
            savedToastAnim.setValue(1);
            Animated.timing(savedToastAnim, { toValue: 0, duration: 600, delay: 1200, useNativeDriver: true }).start();
          }

          // Check if we should show integration prompt
          if (sv.length > 0) {
            const latestSession = sv[0];
            const sessionTime = new Date(latestSession.created_at).getTime();
            const hasIntegrationAfter = integ.some((i) => new Date(i.created_at).getTime() > sessionTime);

            if (!hasIntegrationAfter) {
              const dismissedKey = `integration_prompt_dismissed_${latestSession.id}`;
              const alreadyDismissed = await AsyncStorage.getItem(dismissedKey);
              if (!alreadyDismissed) {
                setPromptedSessionId(latestSession.id);
                setIntegrationPromptOpen(true);
              }
            }
          }
        }
      })();
      return () => { cancelled = true; };
    }, [])
  );

  const lastSession = sessions[0] ?? null;
  const populated = sessions.length > 0;
  const framework = profile?.vocabulary_framework ?? 'plain';
  const userName = profile?.preferred_name ?? '';

  const lastNsName = lastSession?.checkin?.nervous_system_state
    ? getStateName(framework, lastSession.checkin.nervous_system_state)
    : '';
  const lastWellnessChip = getWellnessChipColors(lastSession?.checkin?.nervous_system_state);
  const lastTopEmotions = (lastSession?.checkin?.emotion_tags ?? []).slice(0, 2);

  function handleNewSession() { setActionSheetOpen(false); router.push('/new-session'); }
  function handleNewIntegration() { setActionSheetOpen(false); router.push('/new-integration'); }
  function handleNewJourney() { setActionSheetOpen(false); router.push('/new-journey'); }

  async function handlePromptLogIntegration() {
    setIntegrationPromptOpen(false);
    router.push('/new-integration');
  }

  async function handlePromptDismiss() {
    if (promptedSessionId) {
      await AsyncStorage.setItem(`integration_prompt_dismissed_${promptedSessionId}`, 'true');
    }
    setIntegrationPromptOpen(false);
  }

  function openSessionDetail(s: SessionWithCheckin[]) {
    setDetailSessions(s);
    setDetailSheetOpen(true);
  }

  function openDayDetail(iso: string, daySessions: SessionWithCheckin[], dayIntegrations: Integration[]) {
    setDayDetailDate(iso);
    setDayDetailSessions(daySessions);
    setDayDetailIntegrations(dayIntegrations);
    setDayDetailMirrors(mirrors.filter((m) => m.generated_at.slice(0, 10) === iso));
    setDayDetailOpen(true);
  }

  async function handleEndJourney(id: string) {
    await closeJourney(id);
    const [j, allJ] = await Promise.all([getActiveJourneys(), getJourneys()]);
    setActiveJourneys(j);
    setJourneys(allJ);
  }

  async function handleJourneyUpdate() {
    const [j, allJ] = await Promise.all([getActiveJourneys(), getJourneys()]);
    setActiveJourneys(j);
    setJourneys(allJ);
    if (selectedJourney) {
      const updated = allJ.find((x) => x.id === selectedJourney.id);
      if (updated) setSelectedJourney(updated);
    }
  }

  const JOURNEY_MAX = 3;
  const visibleJourneys = journeyExpanded ? activeJourneys : activeJourneys.slice(0, JOURNEY_MAX);
  const hiddenCount = activeJourneys.length - JOURNEY_MAX;

  return (
    <SafeAreaView edges={['top']} style={s.safe}>
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ---- Header ---- */}
        <ExpoLinearGradient
          colors={['rgba(176, 127, 255, 0.12)', 'transparent']}
          start={{ x: 0.34, y: 0 }}
          end={{ x: 0.66, y: 1 }}
          style={s.gradientHeader}
        >
          <View style={s.headerTopRow}>
            <Text style={s.headerDate}>{formatHeaderDate()}</Text>
            <TouchableOpacity onPress={() => router.push('/settings' as any)} hitSlop={8}>
              <MaterialCommunityIcons name="cog-outline" size={24} color="#666666" />
            </TouchableOpacity>
          </View>
          <View style={s.greetingRow}>
            <Text style={s.greeting}>{getGreeting(userName)}</Text>
            {IS_DEV && (
              <View style={s.devBadge}>
                <Text style={s.devBadgeText}>DEV</Text>
              </View>
            )}
          </View>
        </ExpoLinearGradient>

        {populated ? (
          <View style={s.populatedContent}>

            {/* ---- ACTIVE JOURNEYS ---- */}
            {activeJourneys.length > 0 && (
              <View style={s.activeJourneysSection}>
                <Text style={s.sectionLabel}>ACTIVE JOURNEYS</Text>
                <View style={{ gap: 12 }}>
                  {visibleJourneys.map((j, idx) => {
                    const pct = journeyProgressPct(j);
                    const accent = JOURNEY_ACCENT_COLORS[idx % JOURNEY_ACCENT_COLORS.length];
                    const xy = journeyXY(j);
                    return (
                      <TouchableOpacity
                        key={j.id}
                        style={[s.card, CARD_SHADOW, s.journeyCard]}
                        activeOpacity={0.7}
                        onPress={() => { setSelectedJourney(j); setJourneyDetailOpen(true); }}
                      >
                        <View style={s.journeyCardHeader}>
                          <Text style={s.journeyCardName}>{j.name}</Text>
                          {xy ? <Text style={s.journeyCardCount}>{xy}</Text> : null}
                        </View>
                        {j.duration_days ? (
                          <View style={s.journeyCardBarBg}>
                            <View style={[s.journeyCardBarFill, { width: `${Math.round(pct * 100)}%` as any, backgroundColor: accent }]} />
                          </View>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                  {!journeyExpanded && hiddenCount > 0 && (
                    <TouchableOpacity onPress={() => setJourneyExpanded(true)} style={{ alignSelf: 'flex-start' }}>
                      <Text style={s.journeyMoreLink}>+{hiddenCount} more</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* ---- YOUR SOMA CARD ---- */}
            <View style={[s.card, CARD_SHADOW, s.somaCard]}>
              {/* Header row with label */}
              <View style={s.somaCardHeaderRow}>
                <Text style={s.somaCardLabel}>YOUR SOMA</Text>
              </View>

              {/* Combined filter and toggle row */}
              <View style={s.somaControlsRow}>
                {somaView !== 'calendar' && (
                  <TouchableOpacity
                    style={s.somaFilterPill}
                    onPress={() => setShowFilterPicker(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={s.somaFilterPillText}>
                      {SOMA_FILTERS.find((f) => f.key === somaFilter)?.label ?? 'This Week'}
                    </Text>
                    <MaterialCommunityIcons name="chevron-down" size={8} color="#666666" />
                  </TouchableOpacity>
                )}
                <View style={s.somaToggle}>
                  {SOMA_TABS.map(({ key, icon }) => {
                    const active = somaView === key;
                    return (
                      <TouchableOpacity
                        key={key}
                        onPress={() => setSomaView(key)}
                        activeOpacity={0.7}
                        style={[s.somaToggleBtn, active && s.somaToggleBtnActive]}
                      >
                        <MaterialCommunityIcons name={icon as any} size={18} color={active ? '#B07FFF' : '#999999'} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              {(() => {
                const { sessions: fs, integrations: fi } = filterByWindow(sessions, integrations, somaFilter);
                return (
                  <>
                    {somaView === 'arc' && <ArcChart sessions={fs} integrations={fi} framework={framework} />}
                    {somaView === 'calendar' && (
                      <CalendarView
                        sessions={fs} integrations={fi}
                        onDayPress={openDayDetail}
                      />
                    )}
                    {somaView === 'breakdown' && <BreakdownView sessions={fs} framework={framework} />}
                  </>
                );
              })()}
            </View>

            {/* ---- Last session card ---- */}
            {lastSession && (
              <TouchableOpacity
                style={[s.card, CARD_SHADOW, s.lastSessionCard]}
                onPress={() => router.push({ pathname: '/session/[id]', params: { id: lastSession.session.id } } as any)}
                activeOpacity={0.85}
              >
                <View style={s.lastSessionTopRow}>
                  <Text style={s.sectionLabel}>LAST SESSION</Text>
                  <Text style={s.lastSessionDate}>{getRelativeDate(lastSession.session.created_at)}</Text>
                </View>
                <View style={s.lastSessionBody}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.lastSessionTitle}>{lastSession.session.practice_type || 'Session'}</Text>
                    <View style={s.chipsRow}>
                      {lastSession.session.duration_minutes ? (
                        <View style={s.greyChip}>
                          <Text style={s.greyChipText}>{lastSession.session.duration_minutes} min</Text>
                        </View>
                      ) : null}
                      {lastNsName ? (
                        <View style={[s.wellnessChip, { backgroundColor: lastWellnessChip.bg }]}>
                          <Text style={[s.wellnessChipText, { color: lastWellnessChip.text }]}>{lastNsName}</Text>
                        </View>
                      ) : null}
                      {lastTopEmotions.map((tag) => (
                        <View key={tag} style={[s.emotionChip, { backgroundColor: (EMOTION_TAG_COLOR[tag] ?? '#9B7FBF') + '26' }]}>
                          <Text style={[s.emotionChipText, { color: EMOTION_TAG_COLOR[tag] ?? '#9B7FBF' }]}>
                            {tag.charAt(0).toUpperCase() + tag.slice(1)}
                          </Text>
                        </View>
                      ))}
                    </View>
                    {lastSession.checkin?.elaboration_note ? (
                      <Text style={s.lastSessionNote} numberOfLines={1}>{lastSession.checkin.elaboration_note}</Text>
                    ) : null}
                  </View>
                  <BodyFigureEllipses
                    width={70}
                    bodySensations={lastSession.checkin?.body_sensations ?? []}
                  />
                </View>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={s.emptyContainer}>
            <BodyFigureEllipses width={200} bodySensations={[]} />
            <View style={s.emptyTextBlock}>
              <Text style={s.emptyPrimary}>After your next session, log what you noticed.</Text>
              <Text style={s.emptySecondary}>Tap + to record your first session.</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Saved toast */}
      <Animated.View style={[s.savedToast, { opacity: savedToastAnim }]} pointerEvents="none">
        <Text style={s.savedToastText}>Saved.</Text>
      </Animated.View>

      {/* Action sheet */}
      <BottomSheet visible={actionSheetOpen} onDismiss={() => setActionSheetOpen(false)}>
        <View style={s.actionSheet}>
          <TouchableOpacity style={s.actionRow} onPress={handleNewSession} activeOpacity={0.7}>
            <MaterialCommunityIcons name="plus-circle-outline" size={26} color="#7AAE8A" />
            <View style={{ flex: 1 }}>
              <Text style={s.actionLabel}>New session</Text>
              <Text style={s.actionSubtitle}>Record what you noticed</Text>
            </View>
          </TouchableOpacity>
          <View style={s.actionDivider} />
          <TouchableOpacity style={s.actionRow} onPress={handleNewIntegration} activeOpacity={0.7}>
            <MaterialCommunityIcons name="notebook-edit-outline" size={26} color="#6E9BB5" />
            <View style={{ flex: 1 }}>
              <Text style={s.actionLabel}>New integration</Text>
              <Text style={s.actionSubtitle}>{"Log what's still moving"}</Text>
            </View>
          </TouchableOpacity>
          <View style={s.actionDivider} />
          <TouchableOpacity style={s.actionRow} onPress={handleNewJourney} activeOpacity={0.7}>
            <MaterialCommunityIcons name="map-marker-path" size={26} color="#9B7FBF" />
            <View style={{ flex: 1 }}>
              <Text style={s.actionLabel}>New journey</Text>
              <Text style={s.actionSubtitle}>Set an intention or context</Text>
            </View>
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {/* Integration prompt popup */}
      <BottomSheet visible={integrationPromptOpen} onDismiss={handlePromptDismiss}>
        <View style={s.integrationPrompt}>
          <Text style={s.integrationPromptTitle}>How does your body feel?</Text>
          {lastSession && (
            <Text style={s.integrationPromptSubtitle}>
              After your {lastSession.session.practice_type} session on{' '}
              {new Date(lastSession.session.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} —
              have you had a chance to sit with what came up?
            </Text>
          )}
          <View style={s.integrationPromptButtons}>
            <TouchableOpacity style={s.integrationPromptPrimary} onPress={handlePromptLogIntegration} activeOpacity={0.85}>
              <Text style={s.integrationPromptPrimaryText}>Note some integration thoughts</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.integrationPromptSecondary} onPress={handlePromptDismiss} activeOpacity={0.85}>
              <Text style={s.integrationPromptSecondaryText}>Not now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </BottomSheet>

      {/* Session detail sheet */}
      <SessionDetailSheet
        visible={detailSheetOpen}
        onDismiss={() => setDetailSheetOpen(false)}
        sessions={detailSessions}
        framework={framework}
      />

      {/* Day detail sheet */}
      <DaySheet
        visible={dayDetailOpen}
        onDismiss={() => setDayDetailOpen(false)}
        dateIso={dayDetailDate}
        sessions={dayDetailSessions}
        integrations={dayDetailIntegrations}
        mirrors={dayDetailMirrors}
      />

      {/* Filter picker modal */}
      <Modal
        transparent
        visible={showFilterPicker}
        animationType="fade"
        onRequestClose={() => setShowFilterPicker(false)}
      >
        <TouchableOpacity
          style={s.filterPickerBackdrop}
          onPress={() => setShowFilterPicker(false)}
          activeOpacity={1}
        >
          <View style={s.filterPickerSheet}>
            <View style={s.filterPickerDragHandle} />
            <Text style={s.filterPickerTitle}>Time period</Text>
            {SOMA_FILTERS.map(({ key, label }) => (
              <TouchableOpacity
                key={key}
                style={s.filterPickerRow}
                onPress={() => {
                  setSomaFilter(key);
                  setShowFilterPicker(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={[s.filterPickerRowText, somaFilter === key && s.filterPickerRowTextSelected]}>
                  {label}
                </Text>
                {somaFilter === key && (
                  <MaterialCommunityIcons name="check" size={20} color="#B07FFF" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Journey detail sheet */}
      <JourneyDetailSheet
        visible={journeyDetailOpen}
        onDismiss={() => setJourneyDetailOpen(false)}
        journey={selectedJourney}
        sessions={sessions}
        onEnd={handleEndJourney}
        onUpdate={handleJourneyUpdate}
      />

      {/* FAB */}
      <TouchableOpacity style={s.fab} onPress={() => setActionSheetOpen(true)} activeOpacity={0.85}>
        <MaterialCommunityIcons name="plus" size={28} color="#FFFFFF" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ---- Styles ----

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F2F1F6' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 100 },

  // Header
  gradientHeader: {
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24,
  },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  greetingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  greeting: { fontSize: 28, fontFamily: 'DMSerifDisplay_400Regular', color: '#1A1A1A', letterSpacing: -0.5 },
  devBadge: { backgroundColor: '#B07FFF', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  devBadgeText: { fontSize: 9, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.5 },
  headerDate: { fontSize: 13, fontWeight: '400', color: '#999999' },
  headerSubtitle: { fontSize: 15, fontWeight: '400', color: '#999999', marginTop: 4 },
  journeyMoreLink: { fontSize: 12, fontWeight: '500', color: '#B07FFF' },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#B07FFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#B07FFF',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },

  // Journey detail sheet
  journeySheetName: { fontSize: 18, fontWeight: '600', color: '#1A1A1A', marginBottom: 4, textAlign: 'center' },
  journeySheetMeta: { fontSize: 13, fontWeight: '400', color: '#999999', textAlign: 'center', marginBottom: 16 },
  journeySheetBarBg: { height: 4, borderRadius: 2, backgroundColor: 'rgba(176,127,255,0.25)', marginBottom: 6 },
  journeySheetBarFill: { height: 4, borderRadius: 2, backgroundColor: '#B07FFF' },
  journeySheetPct: { fontSize: 12, fontWeight: '500', color: '#B07FFF', textAlign: 'right', marginBottom: 4 },
  journeySheetSessionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EEEEEC',
  },
  journeySheetSessionDot: { width: 10, height: 10, borderRadius: 5 },
  journeySheetSessionText: { flex: 1, fontSize: 14, fontFamily: 'DMSans_400Regular', color: '#1A1A1A' },
  journeySheetSessionDate: { fontSize: 12, fontFamily: 'DMSans_400Regular', color: '#666666' },
  journeySheetEndBtn: { marginTop: 8, paddingVertical: 12, alignItems: 'center' },
  journeySheetEndText: { fontSize: 14, fontWeight: '500', color: '#999999' },
  journeySheetLogBtn: {
    height: 48, borderRadius: 24,
    backgroundColor: '#B07FFF',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 12,
  },
  journeySheetLogBtnText: { fontSize: 15, fontWeight: '500', color: '#FFFFFF' },
  journeyConfirmOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  journeyConfirmTitle: { fontSize: 17, fontWeight: '600', color: '#1A1A1A', textAlign: 'center', marginBottom: 10 },
  journeyConfirmBody: { fontSize: 14, fontWeight: '400', color: '#666666', textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  journeyConfirmPrimary: {
    width: '100%', height: 48, borderRadius: 12,
    backgroundColor: '#B07FFF', alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  journeyConfirmPrimaryText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  journeyConfirmSecondary: { width: '100%', height: 48, alignItems: 'center', justifyContent: 'center' },
  journeyConfirmSecondaryText: { fontSize: 15, fontWeight: '400', color: '#999999' },

  // Empty state
  emptyContainer: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 20, gap: 28 },
  emptyTextBlock: { alignItems: 'center', gap: 6 },
  emptyPrimary: { fontSize: 15, fontWeight: '500', color: '#1A1A1A', textAlign: 'center' },
  emptySecondary: { fontSize: 13, fontWeight: '400', fontStyle: 'italic', color: '#999999', textAlign: 'center' },

  // Populated
  populatedContent: { gap: 12, paddingHorizontal: 20, paddingTop: 12 },

  // Cards
  card: { backgroundColor: '#FFFFFF', borderRadius: 20 },
  lastSessionCard: { padding: 20 },

  // Section labels
  sectionLabel: {
    fontSize: 11, fontWeight: '600', color: '#999999',
    letterSpacing: 1.2, textTransform: 'uppercase',
  },

  // Active journeys
  activeJourneysSection: { gap: 8 },
  journeyCard: { padding: 20 },
  journeyCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  journeyCardName: { fontSize: 18, fontFamily: 'DMSerifDisplay_400Regular', color: '#1A1A1A' },
  journeyCardCount: { fontSize: 13, fontWeight: '400', color: '#999999' },
  journeyCardBarBg: { height: 6, borderRadius: 8, backgroundColor: '#E8E8E8' },
  journeyCardBarFill: { height: 6, borderRadius: 8 },

  // Your Soma card
  somaCard: { padding: 20 },
  somaCardHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4,
  },
  somaCardLabel: {
    fontSize: 10, fontWeight: '600', color: '#BBBBBB',
    letterSpacing: 1, textTransform: 'uppercase',
  },
  somaFilterPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F0F0F0', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  somaFilterPillText: {
    fontSize: 13, fontWeight: '400', color: '#666666',
    fontFamily: 'DMSans_400Regular',
  },
  somaControlsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16,
  },
  somaToggle: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F0F0', borderRadius: 999, padding: 3, gap: 2 },
  somaToggleBtn: { width: 32, height: 32, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  somaToggleBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },

  // Icon legend
  iconLegend: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', alignItems: 'center' },
  legendIconItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  legendIconText: { fontSize: 11, fontWeight: '400', color: '#999999' },
  legendDot: { width: 8, height: 8, borderRadius: 4 },

  // Arc chart
  arcLegendRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
  arcLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  arcLegendDot: { width: 8, height: 8, borderRadius: 4 },
  arcLegendText: { fontSize: 12, fontWeight: '400', color: '#666666' },
  arcCaption: { fontSize: 11, fontWeight: '400', fontStyle: 'italic', color: '#999999', marginTop: 12, lineHeight: 16 },
  arcTooltip: {
    position: 'absolute', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16,
    shadowColor: '#000000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  arcTooltipDate: { fontSize: 13, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
  arcTooltipRow: { fontSize: 13, fontWeight: '400', color: '#666666', textTransform: 'capitalize', lineHeight: 18, marginBottom: 4 },
  arcTooltipEmotion: { fontSize: 14, fontWeight: '600', textTransform: 'capitalize', lineHeight: 18 },

  // Last session card
  lastSessionTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  lastSessionDate: { fontSize: 12, fontWeight: '400', color: '#999999' },
  lastSessionBody: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  lastSessionTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginBottom: 8 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  greyChip: { borderRadius: 24, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#F0F0F0' },
  greyChipText: { fontSize: 13, fontWeight: '500', color: '#666666' },
  wellnessChip: { borderRadius: 24, paddingHorizontal: 12, paddingVertical: 6 },
  wellnessChipText: { fontSize: 13, fontWeight: '500' },
  emotionChip: { borderRadius: 24, paddingHorizontal: 12, paddingVertical: 6 },
  emotionChipText: { fontSize: 13, fontWeight: '500' },
  lastSessionNote: { fontSize: 13, fontWeight: '400', color: '#999999', marginTop: 8 },

  // Bottom sheets (general)
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

  // Integration prompt
  integrationPrompt: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24 },
  integrationPromptTitle: { fontSize: 20, fontFamily: 'DMSerifDisplay_400Regular', color: '#1A1A1A', marginBottom: 8, textAlign: 'center' },
  integrationPromptSubtitle: { fontSize: 14, fontWeight: '400', color: '#999999', lineHeight: 20, textAlign: 'center', marginBottom: 24 },
  integrationPromptButtons: { gap: 12 },
  integrationPromptPrimary: {
    height: 48, borderRadius: 24, backgroundColor: '#B07FFF',
    alignItems: 'center', justifyContent: 'center',
  },
  integrationPromptPrimaryText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  integrationPromptSecondary: { height: 48, borderRadius: 24, backgroundColor: '#E8E8E8', alignItems: 'center', justifyContent: 'center' },
  integrationPromptSecondaryText: { fontSize: 15, fontWeight: '500', color: '#666666' },

  // Calendar month nav (inline soma view)
  calNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  calNavBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  calNavMonth: { fontSize: 13, fontWeight: '600', color: '#1A1A1A', letterSpacing: 0.5 },

  // Breakdown
  bkSection: { marginBottom: 20 },
  bkLabel: {
    fontSize: 11, fontWeight: '600', color: '#999999',
    textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10,
  },
  // NS state cards (3 side-by-side)
  bkNsCards: { flexDirection: 'row', gap: 8 },
  bkNsCard: { flex: 1, borderRadius: 12, padding: 14 },
  bkNsCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  bkNsCardDot: { width: 8, height: 8, borderRadius: 4 },
  bkNsCardName: { fontSize: 13, fontWeight: '500', color: '#1A1A1A' },
  bkNsCardPct: { fontSize: 28, fontFamily: 'DMSerifDisplay_400Regular', lineHeight: 32 },
  // Dominant emotion
  bkDominantCard: { backgroundColor: '#B07FFF14', borderRadius: 12, padding: 16, alignItems: 'center' },
  bkDominantEmotion: { fontSize: 28, fontFamily: 'DMSerifDisplay_400Regular', color: '#B07FFF', textTransform: 'capitalize', textAlign: 'center' },
  // Body regions with bar
  bkRegionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  bkRegionDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  bkRegionName: { width: 110, fontSize: 14, fontWeight: '400', color: '#1A1A1A', textTransform: 'capitalize' },
  bkRegionTrack: { flex: 1, height: 5, borderRadius: 2.5, backgroundColor: '#F0F0F0', overflow: 'hidden' },
  bkRegionBar: { height: 5, borderRadius: 2.5 },
  bkRegionCount: { fontSize: 14, fontWeight: '600', color: '#1A1A1A', minWidth: 20, textAlign: 'right' },

  // Session detail sheet
  detailSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 12, paddingHorizontal: 20, height: '65%',
  },
  detailDate: { fontSize: 12, fontWeight: '500', color: '#999999', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16, textAlign: 'center' },
  detailNsPill: {
    borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8,
  },
  detailNsText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  detailSection: { marginBottom: 16 },
  detailSectionLabel: {
    fontSize: 10, fontWeight: '700', color: '#999999',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8,
  },
  detailChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  detailChipText: { fontSize: 13, fontWeight: '500' },
  detailBodyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  detailBodyDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  detailBodyText: { fontSize: 14, fontWeight: '400', color: '#1A1A1A' },
  detailBodyQuality: { fontSize: 13, fontWeight: '400', color: '#999999' },
  detailNoteText: { fontSize: 14, fontWeight: '400', color: '#666666', lineHeight: 22, fontStyle: 'italic' },

  // Day detail sheet
  daySheetRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EEEEEC',
  },
  daySheetDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  daySheetRowTitle: { fontSize: 15, fontWeight: '500', color: '#1A1A1A', textTransform: 'capitalize' },
  daySheetRowSubtitle: { fontSize: 13, fontWeight: '400', color: '#999999', marginTop: 2 },

  // Saved toast
  savedToast: { position: 'absolute', top: 100, left: 0, right: 0, alignItems: 'center' },
  savedToastText: { fontSize: 13, color: '#999999' },

  // Filter picker modal
  filterPickerBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  filterPickerSheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 12, paddingBottom: 40,
  },
  filterPickerDragHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: '#E0E0E0',
    alignSelf: 'center', marginBottom: 16,
  },
  filterPickerTitle: {
    fontSize: 16, fontWeight: '600', color: '#1A1A1A',
    paddingHorizontal: 24, marginBottom: 12,
  },
  filterPickerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingVertical: 14, minHeight: 48,
  },
  filterPickerRowText: { fontSize: 15, fontWeight: '400', color: '#1A1A1A' },
  filterPickerRowTextSelected: { fontWeight: '600', color: '#B07FFF' },

  // Journey edit mode
  journeyEditHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 20, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EEEEEC',
  },
  journeyEditTitle: { fontSize: 16, fontWeight: '600', color: '#1A1A1A' },
  journeyEditCancel: { fontSize: 15, fontWeight: '400', color: '#999999' },
  journeyEditSave: { fontSize: 15, fontWeight: '600', color: '#B07FFF' },
  journeyEditLabel: {
    fontSize: 10, fontWeight: '700', color: '#999999',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8,
  },
  journeyEditInput: {
    backgroundColor: '#FAFAF8', borderWidth: 1.5, borderColor: '#EEEEEC',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#1A1A1A',
  },
  journeyEditWheelWrap: {
    height: EDU_ITEM_H * 3, overflow: 'hidden', position: 'relative',
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#EEEEEC',
    marginTop: 4,
  },
  journeyEditWheelIndicator: {
    position: 'absolute', top: EDU_ITEM_H, left: 0, right: 0, height: EDU_ITEM_H,
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#B07FFF22',
    pointerEvents: 'none',
  },
  journeyEditWheelUnit: { fontSize: 13, fontWeight: '400', color: '#999999', textAlign: 'center', marginTop: 6, marginBottom: 16 },
});
