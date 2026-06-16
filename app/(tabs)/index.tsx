import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Modal, Animated, StyleSheet, Dimensions, TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import Svg, { Circle, Path, Rect, Defs, LinearGradient as SvgLinearGradient, Stop, Text as SvgText, Line } from 'react-native-svg';
import { Canvas, Circle as SkiaCircle, BlurMask } from '@shopify/react-native-skia';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSessions, getActiveJourneys, getJourneys, getProfile, getIntegrations, closeJourney, updateJourney, getMirrors } from '@/lib/storage';
import { consumeSessionSaved } from '@/lib/events';
import type { SessionWithCheckin, Journey, Profile, Integration, Mirror } from '@/lib/types';
import { BodyFigureEllipses, REGION_CHAKRA_COLORS } from '@/components/BodyFigure';
import { COLORS, OPTION_TEXT, getRegionColor, getEmotionColor } from '@/lib/theme';

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
  grounded: '#7AAE8A',
  activated: '#C9B96A',
  shutdown: '#7E6B9E',
};

// Muted polyvagal "wellness tone" palette — used only for the arc chart bands,
// the breakdown nervous-system bars, and the session list state dots.
const WELLNESS_TONES: Record<string, string> = {
  grounded: '#8FAE9A',   // Ventral — Sage Green
  activated: '#D6C2A1', // Sympathetic — Warm Sand
  shutdown: '#A89ABF',  // Dorsal — Dusty Lavender
};

const ACTIVATED_LABEL = '#B8A080';

function getWellnessChipColors(state?: string | null): { bg: string; text: string } {
  if (state === 'activated') return { bg: WELLNESS_TONES.activated + '26', text: ACTIVATED_LABEL };
  if (state === 'shutdown') return { bg: WELLNESS_TONES.shutdown + '26', text: WELLNESS_TONES.shutdown };
  return { bg: WELLNESS_TONES.grounded + '26', text: WELLNESS_TONES.grounded };
}

function getWellnessDotColor(state?: string | null): string {
  if (state === 'activated') return WELLNESS_TONES.activated;
  if (state === 'shutdown') return WELLNESS_TONES.shutdown;
  if (state === 'grounded') return WELLNESS_TONES.grounded;
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
  plain:     { grounded: 'Grounded',   activated: 'Activated',      shutdown: 'Shutdown' },
  polyvagal: { grounded: 'Ventral',   activated: 'Sympathetic',    shutdown: 'Dorsal' },
  ifs:       { grounded: 'Self',      activated: 'Activated part', shutdown: 'Blended' },
  somatic:   { grounded: 'Grounded',   activated: 'Activated',      shutdown: 'Shutdown' },
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

function formatLastSessionDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const sessionDate = new Date(d); sessionDate.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - sessionDate.getTime()) / 86400000);

  if (diff === 0) {
    return `Today, ${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`;
  }
  if (diff === 1) {
    return 'Yesterday';
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
                <View style={{ flexDirection: 'row', gap: 3, marginTop: 4, height: 10 }}>
                  {daySessions.slice(0, 3).map((swc, si) => {
                    const { icon } = getSessionIcon(swc);
                    return (
                      <MaterialCommunityIcons
                        key={si}
                        name={icon as any}
                        size={10}
                        color={getPracticeTypeColor(swc.session.practice_type)}
                      />
                    );
                  })}
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

      {/* Practice type legend row - dynamic based on sessions */}
      {(() => {
        const seen = new Map<string, { icon: string; color: string; label: string }>();
        sessions.forEach((swc) => {
          const pt = swc.session.practice_type;
          if (!pt) return;
          const label = pt.split(':')[0].trim();
          if (seen.has(label)) return;
          const { icon } = getSessionIcon(swc);
          seen.set(label, { icon, color: getPracticeTypeColor(pt), label });
        });
        const legend = Array.from(seen.values());
        return legend.length > 0 ? (
          <View style={[s.iconLegend, { marginTop: 12 }]}>
            {legend.map(({ icon, color, label }) => (
              <View key={label} style={s.legendIconItem}>
                <MaterialCommunityIcons name={icon as any} size={12} color={color} />
                <Text style={s.legendIconText}>{label}</Text>
              </View>
            ))}
          </View>
        ) : null;
      })()}
    </View>
  );
}

// ---- Arc chart ----

const ARC_BAND_COLORS = ['#8FAE9A', '#B8A080', '#A89ABF'];

function getArcBandLabels(framework: string): Array<{ label: string; color: string }> {
  const vocabMap = VOCAB_NAMES[framework] ?? VOCAB_NAMES.plain;
  return [
    { label: vocabMap.grounded,   color: ARC_BAND_COLORS[0] },
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

function ArcChart({ sessions, integrations, framework, showInfoTooltip, setShowInfoTooltip }: { sessions: SessionWithCheckin[]; integrations: Integration[]; framework: string; showInfoTooltip: boolean; setShowInfoTooltip: (show: boolean) => void }) {
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
    if (state === 'grounded')   return BAND_H * 0.5;
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
      stateBefore: primarySession.checkin?.nervous_system_state_before ?? null,
      stateAfter: primarySession.checkin?.nervous_system_state ?? null,
    };
  });

  const linePath = buildSmoothPath(points);
  const sel = selected !== null ? points[selected] : null;
  const TIP_W = 170;
  let tipLeft = sel ? sel.x - TIP_W / 2 : 0;
  if (tipLeft < 4) tipLeft = 4;
  if (sel && tipLeft + TIP_W > chartW - 4) tipLeft = chartW - 4 - TIP_W;
  const tipAbove = sel ? sel.y > 50 : true;

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
                <View style={[s.arcLegendDot, {
                  backgroundColor: color,
                  shadowColor: color,
                  shadowOpacity: 0.4,
                  shadowRadius: 4,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: 3,
                }]} />
                <Text style={s.arcLegendText}>{label}</Text>
              </View>
            ))}
          </View>

          {/* Scrollable chart */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} onLayout={(e) => setRowW(e.nativeEvent.layout.width)}>
            <View style={{ width: chartW }}>
              <Svg width={chartW} height={CHART_H + DATE_LABEL_H}>
                {/* Chart background */}
                <Rect x={0} y={0} width={chartW} height={CHART_H} fill={COLORS.background} rx={12} ry={12} />

                {/* Polyvagal band backgrounds (Section 2a) */}
                <Rect x={0} y={0} width={chartW} height={CHART_H / 3} fill={WELLNESS_TONES.grounded} fillOpacity={0.07} />
                <Rect x={0} y={CHART_H / 3} width={chartW} height={CHART_H / 3} fill={WELLNESS_TONES.activated} fillOpacity={0.07} />
                <Rect x={0} y={CHART_H * 2 / 3} width={chartW} height={CHART_H / 3} fill={WELLNESS_TONES.shutdown} fillOpacity={0.07} />

                {/* Band labels (framework-aware) */}
                {getArcBandLabels(framework).map(({ label }, i) => (
                  <SvgText
                    key={label}
                    x={6}
                    y={CHART_H / 3 * i + CHART_H / 6 + 3}
                    fontSize={9}
                    fill={WELLNESS_TONES[(['grounded', 'activated', 'shutdown'] as const)[i]]}
                    fillOpacity={0.6}
                  >
                    {label}
                  </SvgText>
                ))}

                {/* Connecting line (Section 2c: reduced opacity) */}
                <Path d={linePath} stroke="#B07FFF" strokeOpacity={0.22} strokeWidth={1} fill="none" strokeLinecap="round" />

                {/* Data points — 5-layer constellation (Section 2b) */}
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
                  const isMultiSession = p.sessionCount > 1;

                  return (
                    <React.Fragment key={i}>
                      {/* Layer 1: Selection halo */}
                      <Circle cx={p.x} cy={p.y} r={18} fill="#B07FFF" fillOpacity={selected === i ? 0.16 : 0} />

                      {/* Layer 2: Outer glow halo (larger for multi-session) */}
                      <Circle cx={p.x} cy={p.y} r={isMultiSession ? 22 : 18} fill={p.dotColor} fillOpacity={0.08} />

                      {/* Layer 3: Multi-session ring (stroke only) */}
                      {isMultiSession && (
                        <Circle cx={p.x} cy={p.y} r={14} stroke={p.dotColor} strokeWidth={1.5} strokeOpacity={0.3} fill="none" />
                      )}

                      {/* Layer 4: Mid glow ring */}
                      <Circle cx={p.x} cy={p.y} r={11} fill={p.dotColor} fillOpacity={0.22} />

                      {/* Layer 5: Solid core */}
                      <Circle cx={p.x} cy={p.y} r={6} fill={p.dotColor} fillOpacity={0.9} />

                      {/* Practice type symbol */}
                      <SvgText
                        x={p.x}
                        y={p.y + 3}
                        textAnchor="middle"
                        fontSize={8}
                        fill="#FFFFFF"
                        fontWeight="600"
                        opacity={0.85}
                      >
                        {symbol}
                      </SvgText>

                      {/* State shift indicator (Section 9) */}
                      {p.stateBefore && p.stateBefore !== p.stateAfter && (() => {
                        const beforeY = nsY(p.stateBefore);
                        const afterY = p.y;
                        const isPositive = beforeY > afterY; // moving up = more grounded = positive
                        const lineColor = isPositive ? WELLNESS_TONES.grounded : WELLNESS_TONES.shutdown;
                        return (
                          <>
                            {/* Shift line connecting before to after */}
                            <Line
                              x1={p.x} y1={beforeY}
                              x2={p.x} y2={afterY}
                              stroke={lineColor}
                              strokeWidth={1.5}
                              strokeOpacity={0.5}
                              strokeDasharray={[2, 2]}
                            />
                            {/* Before dot — smaller, faded */}
                            <Circle
                              cx={p.x} cy={beforeY}
                              r={4}
                              fill={getWellnessDotColor(p.stateBefore)}
                              fillOpacity={0.45}
                            />
                            {/* Shift arrow chevron at midpoint */}
                            <SvgText
                              x={p.x + 8}
                              y={(beforeY + afterY) / 2 + 3}
                              fontSize={8}
                              fill={lineColor}
                              fillOpacity={0.7}
                            >
                              {isPositive ? '↑' : '↓'}
                            </SvgText>
                          </>
                        );
                      })()}

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
                  {/* State shift (before → after) */}
                  {sel.stateBefore && sel.stateBefore !== sel.stateAfter ? (
                    <Text style={s.arcTooltipRow}>
                      {getStateName(framework, sel.stateBefore)} → {sel.stateName}
                    </Text>
                  ) : (sel.practiceType || sel.stateName) ? (
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
        </>
      )}

      {/* Info tooltip */}
    </View>
  );
}

// ---- Breakdown view ----

function computeShiftStats(sessions: SessionWithCheckin[]) {
  // Positive shift: before state is lower (more dysregulated) than after state
  const stateRank: Record<string, number> = { grounded: 2, activated: 1, shutdown: 0 };

  let shiftsTotal = 0;
  let shiftsPositive = 0;
  const practiceShifts: Record<string, { total: number; grounded: number }> = {};

  sessions.forEach((swc) => {
    const before = swc.checkin?.nervous_system_state_before;
    const after = swc.checkin?.nervous_system_state;
    const practice = swc.session.practice_type?.split(':')[0].trim() ?? 'Other';

    if (before && after && before !== after) {
      shiftsTotal++;
      const isPositive = (stateRank[after] ?? 0) > (stateRank[before] ?? 0);
      if (isPositive) shiftsPositive++;
    }

    if (after) {
      if (!practiceShifts[practice]) practiceShifts[practice] = { total: 0, grounded: 0 };
      practiceShifts[practice].total++;
      if (after === 'grounded') practiceShifts[practice].grounded++;
    }
  });

  const positiveShiftRate = shiftsTotal > 0 ? Math.round((shiftsPositive / shiftsTotal) * 100) : null;

  const practiceCorrelation = Object.entries(practiceShifts)
    .filter(([, v]) => v.total >= 2) // only show practices with 2+ sessions
    .map(([practice, v]) => ({
      practice,
      pct: Math.round((v.grounded / v.total) * 100),
      total: v.total,
      color: getPracticeTypeColor(practice),
    }))
    .sort((a, b) => b.pct - a.pct);

  return { positiveShiftRate, practiceCorrelation };
}

function BodyHeatMapSkia({
  topRegions,
  maxCount,
}: {
  topRegions: Array<{ region: string; count: number }>;
  maxCount: number;
}) {
  const FIGURE_W = SCREEN_W - 80;
  const FIGURE_H = 220;

  // These positions are expressed as fractions of FIGURE_W / FIGURE_H
  // and match where BodyFigureEllipses renders each region on the body figure.
  // Adjust these values if the blobs appear misaligned after first render.
  const REGION_POSITIONS: Record<string, { x: number; y: number }> = {
    'Head / mind':            { x: 0.50, y: 0.07 },
    'Eyes':                   { x: 0.50, y: 0.10 },
    'Jaw / face':             { x: 0.50, y: 0.13 },
    'Throat':                 { x: 0.50, y: 0.20 },
    'Chest / heart':          { x: 0.50, y: 0.31 },
    'Shoulders / upper back': { x: 0.50, y: 0.25 },
    'Arms / hands':           { x: 0.50, y: 0.40 },
    'Solar plexus / gut':     { x: 0.50, y: 0.44 },
    'Pelvis / lower belly':   { x: 0.50, y: 0.55 },
    'Legs / feet':            { x: 0.50, y: 0.78 },
    'Spine':                  { x: 0.50, y: 0.42 },
    'Full body':              { x: 0.50, y: 0.45 },
  };

  return (
    <View style={{
      width: FIGURE_W,
      height: FIGURE_H,
      alignSelf: 'center',
      overflow: 'hidden',
      marginBottom: 8,
    }}>
      {/* Existing body figure — renders the correct silhouette */}
      <BodyFigureEllipses
        width={FIGURE_W}
        bodySensations={topRegions.map(({ region }) => ({ region, quality: null }))}
      />
      {/* Skia heat blobs — absolutely positioned on top */}
      <Canvas
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        {topRegions.map(({ region, count }) => {
          const pos = REGION_POSITIONS[region];
          if (!pos) return null;
          const intensity = count / maxCount;
          const cx = pos.x * FIGURE_W;
          const cy = pos.y * FIGURE_H;
          const r = 14 + intensity * 32;  // range: 14px (rare) to 46px (dominant)
          const color = getRegionColor(region);
          return (
            <SkiaCircle
              key={region}
              cx={cx}
              cy={cy}
              r={r}
              color={color}
              opacity={0.15 + intensity * 0.65}  // range: 0.15 (rare) to 0.80 (dominant)
            >
              <BlurMask blur={20} style="normal" />
            </SkiaCircle>
          );
        })}
      </Canvas>
    </View>
  );
}

function computeEmotionFrequency(sessions: SessionWithCheckin[]): Array<{
  tag: string;
  count: number;
  color: string;
  bgColor: string;
}> {
  const counts: Record<string, number> = {};
  sessions.forEach((swc) => {
    (swc.checkin?.emotion_tags ?? []).forEach((tag) => {
      counts[tag] = (counts[tag] ?? 0) + 1;
    });
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tag, count]) => {
      const colors = getEmotionColor(tag); // from @/lib/theme — returns { bg, text }
      return { tag, count, color: colors.text, bgColor: colors.bg };
    });
}

function computeIntegrationRate(
  sessions: SessionWithCheckin[],
  integrations: Integration[],
): { rate: number; withInteg: number; total: number } {
  const total = sessions.length;
  if (total === 0) return { rate: 0, withInteg: 0, total: 0 };
  // Count sessions that have at least one integration note logged after them
  let withInteg = 0;
  sessions.forEach((swc) => {
    const sessionTime = new Date(swc.session.created_at).getTime();
    const hasInteg = integrations.some((integ) => {
      const integTime = new Date(integ.created_at || integ.note_date).getTime();
      return integTime > sessionTime;
    });
    if (hasInteg) withInteg++;
  });
  return { rate: Math.round((withInteg / total) * 100), withInteg, total };
}

function BreakdownView({
  sessions,
  framework,
  integrations,
}: {
  sessions: SessionWithCheckin[];
  framework: string;
  integrations: Integration[];
}) {
  if (sessions.length === 0) return <Text style={{ fontSize: 13, color: '#999999', textAlign: 'center', paddingTop: 20 }}>No sessions yet.</Text>;
  const { nsPercents, topEmotions, topRegions } = computeBreakdown(sessions);
  const { positiveShiftRate, practiceCorrelation } = computeShiftStats(sessions);
  const emotionFrequency = computeEmotionFrequency(sessions);
  const nsOrdered = ['grounded', 'activated', 'shutdown'];
  const vocabMap = VOCAB_NAMES[framework] ?? VOCAB_NAMES.plain;
  const maxCount = topRegions[0]?.count ?? 1;
  const featuredEmotion = topEmotions[0] ?? null;

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Nervous system cards (Section 3a) */}
      <View style={s.bkSection}>
        <View style={s.bkNsCards}>
          {nsOrdered.map((key) => {
            const pct = nsPercents[key] ?? 0;
            const tone = WELLNESS_TONES[key];
            return (
              <View key={key} style={[s.bkNsCard, {
                backgroundColor: tone + '1A',
                borderLeftWidth: 3,
                borderLeftColor: tone,
              }]}>
                <View style={s.bkNsCardHeader}>
                  <Text style={s.bkNsCardName}>{getStateName(framework, key)}</Text>
                </View>
                <Text style={[s.bkNsCardPct, { color: tone }]}>{pct}%</Text>
                {/* Progress bar */}
                <View style={{ width: '100%', height: 3, borderRadius: 2, backgroundColor: tone + '20', marginTop: 8 }}>
                  <View style={{ width: `${pct}%`, height: 3, borderRadius: 2, backgroundColor: tone, opacity: 0.7 }} />
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* Dominant emotion (Section 3b) */}
      {featuredEmotion && (
        <View style={s.bkSection}>
          <Text style={[s.bkLabel, { textAlign: 'center' }]}>DOMINANT EMOTION</Text>
          <ExpoLinearGradient
            colors={['rgba(176,127,255,0.10)', 'rgba(176,127,255,0.02)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={s.bkDominantCard}
          >
            <Text style={s.bkDominantEmotion}>
              {featuredEmotion.tag.charAt(0).toUpperCase() + featuredEmotion.tag.slice(1)}
            </Text>
          </ExpoLinearGradient>
        </View>
      )}

      {/* Body regions (Section 3c) */}
      {topRegions.length > 0 && (
        <View style={s.bkSection}>
          <Text style={s.bkLabel}>BODY REGIONS</Text>
          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <BodyHeatMapSkia topRegions={topRegions} maxCount={maxCount} />
          </View>
        </View>
      )}

      {/* Positive shift rate hero card (Section 10b) */}
      {positiveShiftRate !== null && (
        <View style={s.bkSection}>
          <Text style={s.bkLabel}>SESSION SHIFT</Text>
          <View style={s.bkShiftCard}>
            <ExpoLinearGradient
              colors={['rgba(143,174,154,0.12)', 'rgba(143,174,154,0.03)']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Text style={s.bkShiftPct}>{positiveShiftRate}%</Text>
            <Text style={s.bkShiftLabel}>of sessions ended in a better state than they started</Text>
          </View>
        </View>
      )}

      {/* Practice-to-state correlation (Section 10c) */}
      {practiceCorrelation.length > 0 && (
        <View style={[s.bkSection, { marginTop: 16 }]}>
          <Text style={s.bkLabel}>BY PRACTICE TYPE</Text>
          <View style={s.bkPracticeList}>
            {practiceCorrelation.map(({ practice, pct, total, color }) => (
              <View key={practice} style={s.bkPracticeRow}>
                <View style={s.bkPracticeLeft}>
                  <View style={[s.bkPracticeDot, { backgroundColor: color }]} />
                  <Text style={s.bkPracticeName} numberOfLines={1}>{practice}</Text>
                </View>
                <View style={s.bkPracticeBarWrap}>
                  <View style={s.bkPracticeBarBg}>
                    <View style={[s.bkPracticeBarFill, {
                      width: `${pct}%` as any,
                      backgroundColor: WELLNESS_TONES.grounded,
                    }]} />
                  </View>
                  <Text style={s.bkPracticePct}>{pct}%</Text>
                </View>
              </View>
            ))}
          </View>
          <Text style={s.bkPracticeFootnote}>% of sessions ending grounded · min. 2 sessions</Text>
        </View>
      )}

      {/* Emotion bubble cluster */}
      {emotionFrequency.length > 0 && (
        <View style={s.bkSection}>
          <Text style={s.bkLabel}>What keeps surfacing</Text>
          <Text style={s.bkNarrativeText}>
            {`${emotionFrequency[0].tag.charAt(0).toUpperCase() + emotionFrequency[0].tag.slice(1)} appears most across this period.`}
          </Text>
          <View style={s.emotionBubbleWrap}>
            {emotionFrequency.map(({ tag, count, color, bgColor }, i) => {
              // Largest bubble = index 0. Scale font and padding by rank.
              const maxCount = emotionFrequency[0].count;
              const intensity = count / maxCount;
              const fontSize = 11 + intensity * 7;   // 11–18px
              const paddingH = 10 + intensity * 6;   // 10–16px
              const paddingV = 6 + intensity * 4;    // 6–10px
              return (
                <View
                  key={tag}
                  style={[
                    s.emotionBubble,
                    {
                      backgroundColor: bgColor,
                      paddingHorizontal: paddingH,
                      paddingVertical: paddingV,
                    },
                  ]}
                >
                  <Text style={[s.emotionBubbleText, { fontSize, color }]}>
                    {tag.charAt(0).toUpperCase() + tag.slice(1)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Integration rate */}
      {(() => {
        const { rate, withInteg, total } = computeIntegrationRate(sessions, integrations);
        if (total < 2) return null;
        // Dot row — one dot per session, filled if integration exists after it
        const dots = sessions.slice(0, 10).map((swc, i) => {
          const sessionTime = new Date(swc.session.created_at).getTime();
          const hasInteg = integrations.some((integ) => {
            const integTime = new Date(integ.created_at || integ.note_date).getTime();
            return integTime > sessionTime;
          });
          return hasInteg;
        });
        return (
          <View style={s.bkSection}>
            <Text style={s.bkLabel}>Integration</Text>
            <Text style={s.bkNarrativeText}>
              {`You integrated after ${withInteg} of your last ${total} sessions.`}
            </Text>
            <View style={s.integDotRow}>
              {dots.map((filled, i) => (
                <View
                  key={i}
                  style={[
                    s.integDot,
                    {
                      backgroundColor: filled
                        ? WELLNESS_TONES.grounded
                        : COLORS.track,
                    },
                  ]}
                />
              ))}
            </View>
          </View>
        );
      })()}
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
              <TouchableOpacity onPress={() => { onDismiss(); router.push({ pathname: '/journey/[id]', params: { id: journey.id } } as any); }} hitSlop={8}>
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
  const [showInfoTooltip, setShowInfoTooltip] = useState(false);
  const savedToastAnim = useRef(new Animated.Value(0)).current;
  const dismissedThisSessionRef = useRef(false);

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

            // Rule 1: Check if this session was already prompted and dismissed
            const lastPromptedId = await AsyncStorage.getItem('lastPromptedSessionId');
            const alreadyPrompted = lastPromptedId === latestSession.id;

            // Rule 2: Check if any integration exists AFTER this session
            const sessionTime = new Date(latestSession.created_at).getTime();
            const hasIntegrationAfter = integ.some((i) => {
              const integTime = new Date(i.created_at || i.note_date).getTime();
              return integTime > sessionTime;
            });

            // Show popup only if: session not previously dismissed AND no integration after session AND not dismissed this session
            if (!alreadyPrompted && !hasIntegrationAfter && !dismissedThisSessionRef.current) {
              setPromptedSessionId(latestSession.id);
              setIntegrationPromptOpen(true);
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
    dismissedThisSessionRef.current = true;
    if (promptedSessionId) {
      await AsyncStorage.setItem('lastPromptedSessionId', promptedSessionId);
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
      <ExpoLinearGradient
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
      <View style={{ flex: 1, zIndex: 1 }}>
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

          {/* ---- Header ---- */}
          <View style={s.header}>
            <View style={s.greetingRow}>
              <Text style={s.greeting}>{getGreeting(userName)}</Text>
              {IS_DEV && (
                <View style={s.devBadge}>
                  <Text style={s.devBadgeText}>DEV</Text>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={() => router.push('/settings' as any)} hitSlop={8}>
              <MaterialCommunityIcons name="cog-outline" size={20} color="#CCCCCC" />
            </TouchableOpacity>
          </View>

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
                            <ExpoLinearGradient
                              colors={[accent + 'BB', accent + '33']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 0 }}
                              style={[s.journeyCardBarFill, { width: `${Math.round(pct * 100)}%` as any }]}
                            />
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
                <TouchableOpacity
                  onPress={() => setShowInfoTooltip(!showInfoTooltip)}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="information-outline" size={18} color="#BBBBBB" />
                </TouchableOpacity>
              </View>

              <Modal transparent visible={showInfoTooltip} animationType="fade" onRequestClose={() => setShowInfoTooltip(false)}>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.15)' }}
                  onPress={() => setShowInfoTooltip(false)}
                  activeOpacity={1}
                >
                  <View style={s.arcInfoTooltip}>
                    <Text style={s.arcInfoTooltipText}>
                      Tap any point to see session details. Position on the chart shows nervous system state.
                    </Text>
                  </View>
                </TouchableOpacity>
              </Modal>

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
                    <MaterialCommunityIcons name="clock-time-four-outline" size={14} color="#666666" />
                  </TouchableOpacity>
                )}
                <View style={{ marginLeft: 'auto' }}>
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
                          <MaterialCommunityIcons name={icon as any} size={18} color={active ? '#FFFFFF' : '#999999'} />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>
              {(() => {
                const { sessions: fs, integrations: fi } = filterByWindow(sessions, integrations, somaFilter);
                return (
                  <>
                    {/* Narrative sentence with streak (Section 11) */}
                    {somaView === 'arc' && fs.length > 0 && (() => {
                      // Dominant state label
                      const recent = fs.slice(0, 5);
                      const counts: Record<string, number> = {};
                      recent.forEach(x => {
                        const st = x.checkin?.nervous_system_state;
                        if (st) counts[st] = (counts[st] ?? 0) + 1;
                      });
                      const dominantState = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];

                      // Grounded streak (from most recent)
                      const sorted = [...fs].sort((a, b) =>
                        b.session.created_at.localeCompare(a.session.created_at)
                      );
                      let streak = 0;
                      for (const swc of sorted) {
                        if (swc.checkin?.nervous_system_state === 'grounded') streak++;
                        else break;
                      }

                      const label = dominantState ? getStateName(framework, dominantState) : null;
                      const groundedLabel = getStateName(framework, 'grounded');

                      // Prefer streak sentence when streak >= 2, otherwise dominant state
                      let sentence: string | null = null;
                      if (streak >= 2) {
                        sentence = `Your last ${streak} sessions all ended ${groundedLabel.toLowerCase()}.`;
                      } else if (label) {
                        sentence = `Mostly ${label.toLowerCase()} across your last ${Math.min(fs.length, 5)} sessions.`;
                      }

                      if (!sentence) return null;
                      return <Text style={s.somaNarrativeText}>{sentence}</Text>;
                    })()}

                    {somaView === 'arc' && <ArcChart sessions={fs} integrations={fi} framework={framework} showInfoTooltip={showInfoTooltip} setShowInfoTooltip={setShowInfoTooltip} />}
                    {somaView === 'calendar' && (
                      <CalendarView
                        sessions={fs} integrations={fi}
                        onDayPress={openDayDetail}
                      />
                    )}
                    {somaView === 'breakdown' && <BreakdownView sessions={fs} framework={framework} integrations={fi} />}
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
                <Text style={s.lastSessionHeader}>
                  LAST SESSION  ·  {formatLastSessionDate(lastSession.session.created_at)}
                  {lastSession.session.duration_minutes ? `  ·  ${lastSession.session.duration_minutes} min` : ''}
                </Text>
                <View style={s.lastSessionBody}>
                  <Text style={s.lastSessionTitle}>{lastSession.session.practice_type || 'Session'}</Text>
                  <View style={s.lastSessionColumns}>
                    <View style={s.lastSessionLeft}>
                      {lastNsName ? (
                        <View style={[s.wellnessChip, { backgroundColor: lastWellnessChip.bg, alignSelf: 'flex-start' }]}>
                          <Text style={[s.wellnessChipText, { color: lastWellnessChip.text }]}>{lastNsName.charAt(0).toUpperCase() + lastNsName.slice(1)}</Text>
                        </View>
                      ) : null}
                      {lastTopEmotions.map((tag) => (
                        <View key={tag} style={[s.emotionChip, { backgroundColor: (EMOTION_TAG_COLOR[tag] ?? '#9B7FBF') + '26', alignSelf: 'flex-start', marginTop: 6 }]}>
                          <Text style={[s.emotionChipText, { color: EMOTION_TAG_COLOR[tag] ?? '#9B7FBF' }]}>
                            {tag.charAt(0).toUpperCase() + tag.slice(1)}
                          </Text>
                        </View>
                      ))}
                    </View>
                    <View style={[s.lastSessionRight, {
                      backgroundColor: COLORS.accentTint,
                      borderRadius: 16,
                      padding: 8,
                      alignItems: 'center',
                    }]}>
                      <BodyFigureEllipses width={80} bodySensations={lastSession.checkin?.body_sensations ?? []} />
                      {/* Region dot row below body figure (Section 5) */}
                      {(lastSession.checkin?.body_sensations ?? []).length > 0 && (
                        <View style={{ flexDirection: 'row', gap: 4, marginTop: 6, justifyContent: 'center' }}>
                          {(lastSession.checkin?.body_sensations ?? []).slice(0, 3).map((bs) => (
                            <View
                              key={bs.region}
                              style={{
                                width: 6, height: 6, borderRadius: 3,
                                backgroundColor: getRegionColor(bs.region),
                              }}
                            />
                          ))}
                        </View>
                      )}
                    </View>
                  </View>
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
              {new Date(lastSession.session.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.
              Have you had a chance to sit with what came up?
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
      </View>
    </SafeAreaView>
  );
}

// ---- Styles ----

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 100 },

  // Ambient gradient background
  ambientGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
    width: '100%',
    zIndex: 0,
  },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16,
  },
  greetingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  greeting: { fontSize: 32, fontFamily: 'DMSerifDisplay_400Regular', color: '#1A1A1A', letterSpacing: -0.5 },
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
  journeySheetSessionText: { flex: 1, fontSize: 14, fontFamily: 'Nunito_400Regular', color: '#666666' },
  journeySheetSessionDate: { fontSize: 12, fontFamily: 'Nunito_400Regular', color: '#999999' },
  journeySheetEndBtn: { marginTop: 8, paddingVertical: 12, alignItems: 'center' },
  journeySheetEndText: { fontSize: 14, fontWeight: '500', color: '#999999' },
  journeySheetLogBtn: {
    height: 48, borderRadius: 24,
    backgroundColor: '#B07FFF',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 12,
  },
  journeySheetLogBtnText: { fontFamily: 'Nunito_600SemiBold', fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  journeyConfirmOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  journeyConfirmTitle: { fontSize: 17, fontWeight: '600', color: '#1A1A1A', textAlign: 'center', marginBottom: 10 },
  journeyConfirmBody: { fontSize: 14, fontWeight: '400', color: '#666666', textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  journeyConfirmPrimary: {
    width: '100%', height: 48, borderRadius: 12,
    backgroundColor: '#B07FFF', alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  journeyConfirmPrimaryText: { fontFamily: 'Nunito_600SemiBold', fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  journeyConfirmSecondary: { width: '100%', height: 48, alignItems: 'center', justifyContent: 'center' },
  journeyConfirmSecondaryText: { fontSize: 15, fontWeight: '400', color: '#999999' },

  // Empty state
  emptyContainer: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 20, gap: 28 },
  emptyTextBlock: { alignItems: 'center', gap: 6 },
  emptyPrimary: { fontSize: 15, fontWeight: '500', color: '#1A1A1A', textAlign: 'center' },
  emptySecondary: { fontSize: 13, fontWeight: '400', fontStyle: 'italic', color: '#999999', textAlign: 'center' },

  // Populated
  populatedContent: { gap: 20, paddingHorizontal: 20, paddingTop: 12 },

  // Cards
  card: { backgroundColor: '#FFFFFF', borderRadius: 20 },
  lastSessionCard: { padding: 20 },

  // Section labels
  sectionLabel: {
    fontFamily: 'Nunito_500Medium', fontSize: 11, fontWeight: '500', color: '#999999',
    letterSpacing: 1.2, textTransform: 'uppercase',
  },

  // Active journeys
  activeJourneysSection: { gap: 8 },
  journeyCard: { padding: 20 },
  journeyCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  journeyCardName: { fontSize: 18, fontFamily: 'DMSerifDisplay_400Regular', color: '#1A1A1A' },
  journeyCardCount: { fontFamily: 'Nunito_400Regular', fontSize: 12, fontWeight: '400', color: '#999999' },
  journeyCardBarBg: { height: 5, borderRadius: 99, backgroundColor: COLORS.accentTint },
  journeyCardBarFill: { height: 5, borderRadius: 99 },

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
    backgroundColor: COLORS.accentTint, borderRadius: 12, height: 36,
    paddingHorizontal: 14, paddingVertical: 6,
    alignSelf: 'flex-start',
    borderWidth: 1, borderColor: '#B07FFF4D',
  },
  somaFilterPillText: {
    ...OPTION_TEXT, fontSize: 13,
    fontFamily: 'Nunito_400Regular',
  },
  somaControlsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16,
  },
  somaToggle: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.accentTint, borderRadius: 12, height: 36, padding: 3, gap: 2 },
  somaToggleBtn: { width: 30, height: 30, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  somaToggleBtnActive: {
    backgroundColor: COLORS.accent,
    shadowColor: '#000000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },
  somaNarrativeText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    fontStyle: 'italic',
    color: COLORS.textSecondary,
    marginBottom: 10,
    paddingHorizontal: 2,
  },

  // Icon legend
  iconLegend: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', alignItems: 'center' },
  legendIconItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  legendIconText: { fontSize: 11, fontWeight: '400', color: '#999999' },
  legendDot: { width: 8, height: 8, borderRadius: 4 },

  // Arc chart
  arcLegendRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
  arcLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  arcLegendDot: { width: 10, height: 10, borderRadius: 5 },
  arcLegendText: { fontSize: 12, fontWeight: '400', color: '#666666' },
  arcInfoIcon: { position: 'absolute', bottom: 12, right: 12 },
  arcInfoTooltip: {
    position: 'absolute', top: '35%', alignSelf: 'center',
    width: 260, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    shadowColor: '#000000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  arcInfoTooltipText: { fontSize: 13, fontFamily: 'Nunito_400Regular', color: '#666666', lineHeight: 18 },
  arcTooltip: {
    position: 'absolute', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16,
    shadowColor: '#000000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  arcTooltipDate: { fontSize: 13, fontWeight: '500', color: '#666666', fontFamily: 'Nunito_500Medium', marginBottom: 4 },
  arcTooltipRow: { fontSize: 13, fontWeight: '400', fontFamily: 'Nunito_400Regular', color: '#666666', textTransform: 'capitalize', lineHeight: 18, marginBottom: 4 },
  arcTooltipEmotion: { fontSize: 14, fontWeight: '500', fontFamily: 'Nunito_500Medium', textTransform: 'capitalize', lineHeight: 18 },

  // Last session card
  lastSessionHeader: { fontFamily: 'Nunito_400Regular', fontSize: 12, fontWeight: '400', color: COLORS.textTertiary, marginBottom: 14, textAlign: 'center' },
  lastSessionBody: { flexDirection: 'column', gap: 10 },
  lastSessionTitle: { fontSize: 18, fontFamily: 'DMSerifDisplay_400Regular', color: '#1A1A1A', textAlign: 'center', width: '100%' },
  lastSessionColumns: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  lastSessionLeft: { flex: 1, gap: 6 },
  lastSessionRight: { width: 90, alignItems: 'center', justifyContent: 'center' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 6, marginBottom: 12 },
  greyChip: { borderRadius: 24, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#F0F0F0' },
  greyChipText: { fontSize: 13, fontWeight: '500', color: '#666666' },
  wellnessChip: { borderRadius: 24, paddingHorizontal: 12, paddingVertical: 6 },
  wellnessChipText: { fontFamily: 'Nunito_400Regular', fontSize: 13, fontWeight: '400' },
  emotionChip: { borderRadius: 24, paddingHorizontal: 12, paddingVertical: 6 },
  emotionChipText: { fontFamily: 'Nunito_400Regular', fontSize: 13, fontWeight: '400' },

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
  actionLabel: { fontFamily: 'Nunito_500Medium', fontSize: 15, fontWeight: '500', color: '#1A1A1A' },
  actionSubtitle: { fontFamily: 'Nunito_400Regular', fontSize: 12, fontWeight: '400', color: '#999999', marginTop: 2 },
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
  integrationPromptPrimaryText: { fontFamily: 'Nunito_600SemiBold', fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  integrationPromptSecondary: { height: 48, borderRadius: 24, backgroundColor: '#E8E8E8', alignItems: 'center', justifyContent: 'center' },
  integrationPromptSecondaryText: { fontFamily: 'Nunito_500Medium', fontSize: 15, fontWeight: '500', color: '#666666' },

  // Calendar month nav (inline soma view)
  calNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  calNavBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  calNavMonth: { fontSize: 13, fontWeight: '600', color: '#1A1A1A', letterSpacing: 0.5 },

  // Breakdown
  bkSection: { marginBottom: 20 },
  bkLabel: {
    fontFamily: 'Nunito_500Medium', fontSize: 11, fontWeight: '500', color: '#999999',
    textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10,
  },
  // NS state cards (3 side-by-side)
  bkNsCards: { flexDirection: 'row', gap: 8 },
  bkNsCard: { flex: 1, borderRadius: 16, padding: 14, alignItems: 'center' },
  bkNsCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  bkNsCardName: { fontSize: 13, fontWeight: '400', color: '#999999', fontFamily: 'Nunito_400Regular', textAlign: 'center' },
  bkNsCardPct: { fontSize: 32, fontFamily: 'DMSerifDisplay_400Regular', lineHeight: 36, textAlign: 'center' },
  // Dominant emotion
  bkDominantCard: { backgroundColor: '#B07FFF14', borderRadius: 12, padding: 16, alignItems: 'center' },
  bkDominantEmotion: { fontSize: 32, fontFamily: 'DMSerifDisplay_400Regular', color: '#B07FFF', textTransform: 'capitalize', textAlign: 'center' },
  // Body regions with list
  regionListRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  regionListDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  regionListName: { flex: 1, fontFamily: 'Nunito_400Regular', fontSize: 14, color: '#666666', textTransform: 'capitalize' },
  regionListCount: { fontFamily: 'Nunito_400Regular', fontSize: 14, color: '#999999' },
  // Shift stats (Section 10)
  bkShiftCard: {
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    overflow: 'hidden',
    borderLeftWidth: 3,
    borderLeftColor: WELLNESS_TONES.grounded,
  },
  bkShiftPct: {
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 48,
    color: COLORS.grounded,
    lineHeight: 52,
    marginBottom: 6,
  },
  bkShiftLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  bkPracticeList: { gap: 10 },
  bkPracticeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bkPracticeLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, width: 100 },
  bkPracticeDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  bkPracticeName: { fontSize: 12, color: COLORS.textSecondary, flex: 1 },
  bkPracticeBarWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  bkPracticeBarBg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: COLORS.track },
  bkPracticeBarFill: { height: 4, borderRadius: 2 },
  bkPracticePct: { fontSize: 12, color: COLORS.textTertiary, minWidth: 30, textAlign: 'right' },
  bkPracticeFootnote: { fontSize: 10, color: COLORS.textQuaternary, marginTop: 8, fontStyle: 'italic' },
  emotionBubbleWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  emotionBubble: {
    borderRadius: 99,
  },
  emotionBubbleText: {
    fontFamily: 'Nunito_400Regular',
    fontWeight: '400',
  },
  bkNarrativeText: {
    fontSize: 13,
    fontStyle: 'italic',
    color: COLORS.textSecondary,
    marginBottom: 4,
    lineHeight: 18,
  },
  integDotRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  integDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

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
    fontFamily: 'Nunito_500Medium', fontSize: 11, fontWeight: '500', color: '#999999',
    textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8,
  },
  detailChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  detailChipText: { fontSize: 13, fontWeight: '500' },
  detailBodyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  detailBodyDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  detailBodyText: { fontSize: 14, fontWeight: '400', color: '#1A1A1A' },
  detailBodyQuality: { fontSize: 13, fontWeight: '400', color: '#999999' },
  detailNoteText: { fontFamily: 'Nunito_400Regular', fontSize: 15, fontWeight: '400', color: '#666666', lineHeight: 22, fontStyle: 'italic' },

  // Day detail sheet
  daySheetRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EEEEEC',
  },
  daySheetDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  daySheetRowTitle: { ...OPTION_TEXT, fontSize: 15, fontWeight: '400', textTransform: 'capitalize' },
  daySheetRowSubtitle: { fontFamily: 'Nunito_400Regular', fontSize: 12, fontWeight: '400', color: '#999999', marginTop: 2 },

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
  filterPickerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingVertical: 14, minHeight: 48,
  },
  filterPickerRowText: { fontFamily: 'Nunito_400Regular', fontSize: 15, fontWeight: '400', color: '#1A1A1A' },
  filterPickerRowTextSelected: { fontWeight: '600', color: '#B07FFF' },

  // Journey edit mode
  journeyEditHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 20, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EEEEEC',
  },
  journeyEditTitle: { fontSize: 16, fontWeight: '600', color: '#1A1A1A' },
  journeyEditCancel: { fontFamily: 'Nunito_500Medium', fontSize: 15, fontWeight: '500', color: '#999999' },
  journeyEditSave: { fontFamily: 'Nunito_500Medium', fontSize: 15, fontWeight: '500', color: '#B07FFF' },
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
