import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Modal, Animated, StyleSheet, Dimensions, TextInput, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import Svg, { Circle, Path, Rect, Defs, LinearGradient as SvgLinearGradient, Stop, Text as SvgText, Line } from 'react-native-svg';
import { Canvas, Circle as SkiaCircle, BlurMask } from '@shopify/react-native-skia';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSessions, getActiveJourneys, getJourneys, getProfile, getIntegrations, closeJourney, updateJourney, getMirrors, updateProfile } from '@/lib/storage';
import { consumeSessionSaved } from '@/lib/events';
import type { SessionWithCheckin, Journey, Profile, Integration, Mirror } from '@/lib/types';
import { BodyFigureEllipses, REGION_CHAKRA_COLORS } from '@/components/BodyFigure';
import { COLORS, FONTS, TYPOGRAPHY, OPTION_TEXT, getRegionColor, getEmotionColor, CARD_SHADOW, JOURNEY_COLORS, ARC_BAND_COLORS, PRACTICE_LEGEND_COLORS, INTEGRATION_CATEGORY_COLORS } from '@/lib/theme';

const IS_DEV = process.env.EXPO_PUBLIC_DEV_MODE === 'true';
const { width: SCREEN_W } = Dimensions.get('window');

// ---- Constants ----

const STATE_COLORS: Record<string, string> = {
  grounded: COLORS.heart,
  activated: COLORS.actionsCategory,
  shutdown: COLORS.patternsCategory,
};

// Muted polyvagal "wellness tone" palette — used only for the arc chart bands,
// the breakdown nervous-system bars, and the session list state dots.
const WELLNESS_TONES: Record<string, string> = {
  grounded: COLORS.arcGrounded,
  activated: '#D6C2A1', // Sympathetic — Warm Sand (custom blend)
  shutdown: COLORS.arcShutdown,
};

// Saturated variants for the Arc chart only — WELLNESS_TONES stays muted
// for chips/cards elsewhere; the chart needs more contrast since the
// line and dots ARE the content, not an accent.
const ARC_CHART_TONES: Record<string, string> = {
  grounded: '#5A9470', // Saturated green (custom)
  activated: '#C9A53F', // Saturated ochre (custom)
  shutdown: '#8166B8', // Saturated purple (custom)
};

const ACTIVATED_LABEL = COLORS.arcActivated;

function getWellnessChipColors(state?: string | null): { bg: string; text: string } {
  if (state === 'activated') return { bg: WELLNESS_TONES.activated + '26', text: ACTIVATED_LABEL };
  if (state === 'shutdown') return { bg: WELLNESS_TONES.shutdown + '26', text: WELLNESS_TONES.shutdown };
  return { bg: WELLNESS_TONES.grounded + '26', text: WELLNESS_TONES.grounded };
}

function getWellnessDotColor(state?: string | null): string {
  if (state === 'activated') return WELLNESS_TONES.activated;
  if (state === 'shutdown') return WELLNESS_TONES.shutdown;
  if (state === 'grounded') return WELLNESS_TONES.grounded;
  return COLORS.gray300;
}

// Saturated variant for Arc chart dots
function getArcDotColor(state?: string | null): string {
  if (state === 'activated') return ARC_CHART_TONES.activated;
  if (state === 'shutdown') return ARC_CHART_TONES.shutdown;
  if (state === 'grounded') return ARC_CHART_TONES.grounded;
  return COLORS.gray300;
}

type SomaView = 'arc' | 'calendar';

const SOMA_TABS: Array<{ key: SomaView; icon: string }> = [
  { key: 'arc', icon: 'chart-bell-curve-cumulative' },
  { key: 'calendar', icon: 'calendar-month-outline' },
];

type SomaFilter = 'week' | '7d' | 'month' | '30d' | '3mo' | '6mo' | 'ytd' | '1yr' | 'all';

const SOMA_FILTERS: Array<{ key: SomaFilter; label: string }> = [
  { key: 'week', label: 'This Week' },
  { key: '7d', label: 'Past 7 days' },
  { key: 'month', label: 'This Month' },
  { key: '30d', label: 'Past 30 days' },
  { key: '3mo', label: 'Past 3 Months' },
  { key: '6mo', label: 'Past 6 Months' },
  { key: 'ytd', label: 'Year to Date' },
  { key: '1yr', label: 'Past Year' },
  { key: 'all', label: 'All Time' },
];

const VOCAB_NAMES: Record<string, Record<string, string>> = {
  plain:     { grounded: 'Grounded',   activated: 'Activated',      shutdown: 'Shutdown' },
  polyvagal: { grounded: 'Ventral',   activated: 'Sympathetic',    shutdown: 'Dorsal' },
  ifs:       { grounded: 'Self',      activated: 'Activated part', shutdown: 'Blended' },
  somatic:   { grounded: 'Grounded',   activated: 'Activated',      shutdown: 'Shutdown' },
};

// Note: EMOTION_TAG_COLOR uses theme's getEmotionColor() - mapping kept here for quick lookup
const EMOTION_TAG_COLOR: Record<string, string> = {
  grief: COLORS.throat, sadness: COLORS.throat, longing: COLORS.throat, loss: COLORS.throat, heartbreak: COLORS.throat,
  fear: COLORS.root, dread: COLORS.root, anxiety: COLORS.root, terror: COLORS.root, panic: COLORS.root,
  anger: COLORS.sacral, rage: COLORS.sacral, frustration: COLORS.sacral, irritation: COLORS.sacral, resentment: COLORS.sacral,
  shame: COLORS.thirdEye, guilt: COLORS.thirdEye, unworthiness: COLORS.thirdEye, smallness: COLORS.thirdEye,
  joy: COLORS.heart, gratitude: COLORS.heart, love: COLORS.heart, warmth: COLORS.heart, bliss: COLORS.heart, awe: COLORS.heart,
  confusion: COLORS.crown, numbness: COLORS.crown, emptiness: COLORS.crown, dissociation: COLORS.crown,
  release: COLORS.sacral, openness: COLORS.sacral, relief: COLORS.sacral, surrender: COLORS.sacral,
};

// Use theme's INTEGRATION_CATEGORY_COLORS
const CATEGORY_COLORS = INTEGRATION_CATEGORY_COLORS;

// ---- Helpers ----

function getDominantEmotionColor(swc: SessionWithCheckin): string {
  const tags = swc.checkin?.emotion_tags ?? [];
  for (const tag of tags) {
    const color = EMOTION_TAG_COLOR[tag];
    if (color) return color;
  }
  const state = swc.checkin?.nervous_system_state;
  if (state && STATE_COLORS[state]) return STATE_COLORS[state];
  return COLORS.border;
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
  if (!practiceType) return COLORS.practiceOther;
  const base = practiceType.split(':')[0].trim().toLowerCase();
  if (base.startsWith('breathwork') || base.includes('breath')) return COLORS.practiceBreathwork;
  if (base.startsWith('somatic')) return COLORS.practiceSomatic;
  if (base.startsWith('meditation')) return COLORS.practiceMeditation;
  if (base.startsWith('yoga')) return COLORS.practiceYoga;
  if (base.startsWith('dance') || base.includes('movement')) return COLORS.practiceMovement;
  return COLORS.practiceOther;
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
  } else if (filter === '7d') {
    cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
  } else if (filter === 'month') {
    cutoff = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (filter === '30d') {
    cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
  } else if (filter === '3mo') {
    cutoff = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
  } else if (filter === '6mo') {
    cutoff = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
  } else if (filter === 'ytd') {
    cutoff = new Date(now.getFullYear(), 0, 1);
  } else {
    // '1yr'
    cutoff = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
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
  const tagCounts: Record<string, number> = {};
  const regionCounts: Record<string, number> = {};
  for (const swc of sessions) {
    for (const tag of swc.checkin?.emotion_tags ?? []) {
      tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
    }
    for (const bs of swc.checkin?.body_sensations ?? []) {
      regionCounts[bs.region] = (regionCounts[bs.region] ?? 0) + 1;
    }
  }
  const topEmotions = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([tag, count]) => ({ tag, count }));
  const topRegions = Object.entries(regionCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([region, count]) => ({ region, count }));
  return { topEmotions, topRegions };
}

// Compute trend for a tag/region by comparing first half vs second half frequency
function computeTrend(
  sessions: SessionWithCheckin[],
  itemKey: string,
  type: 'emotion' | 'region'
): { trend: 'Rising' | 'Easing' | 'Steady'; sparkline: number[] } | null {
  if (sessions.length < 3) return null;

  const midpoint = Math.floor(sessions.length / 2);
  const firstHalf = sessions.slice(0, midpoint);
  const secondHalf = sessions.slice(midpoint);

  let firstCount = 0;
  let secondCount = 0;

  if (type === 'emotion') {
    firstCount = firstHalf.filter((s) => s.checkin?.emotion_tags?.includes(itemKey)).length;
    secondCount = secondHalf.filter((s) => s.checkin?.emotion_tags?.includes(itemKey)).length;
  } else {
    firstCount = firstHalf.filter((s) =>
      s.checkin?.body_sensations?.some((bs) => bs.region === itemKey)
    ).length;
    secondCount = secondHalf.filter((s) =>
      s.checkin?.body_sensations?.some((bs) => bs.region === itemKey)
    ).length;
  }

  const firstRate = firstHalf.length > 0 ? firstCount / firstHalf.length : 0;
  const secondRate = secondHalf.length > 0 ? secondCount / secondHalf.length : 0;

  const diff = secondRate - firstRate;
  let trend: 'Rising' | 'Easing' | 'Steady';
  if (Math.abs(diff) < 0.1) {
    trend = 'Steady';
  } else if (diff > 0) {
    trend = 'Rising';
  } else {
    trend = 'Easing';
  }

  // Create a simple 5-point sparkline across the session arc
  const sparkline: number[] = [];
  const chunkSize = Math.ceil(sessions.length / 5);
  for (let i = 0; i < 5; i++) {
    const chunk = sessions.slice(i * chunkSize, (i + 1) * chunkSize);
    let count = 0;
    if (type === 'emotion') {
      count = chunk.filter((s) => s.checkin?.emotion_tags?.includes(itemKey)).length;
    } else {
      count = chunk.filter((s) =>
        s.checkin?.body_sensations?.some((bs) => bs.region === itemKey)
      ).length;
    }
    sparkline.push(chunk.length > 0 ? count / chunk.length : 0);
  }

  return { trend, sparkline };
}

// Create adaptive time buckets for visualizations
function createTimeBuckets(sessions: SessionWithCheckin[], maxBuckets: number = 16): Array<{
  sessions: SessionWithCheckin[];
  startDate: string;
  endDate: string;
}> {
  if (sessions.length === 0) return [];

  const sorted = [...sessions].sort((a, b) =>
    a.session.created_at.localeCompare(b.session.created_at)
  );

  const firstDate = new Date(sorted[0].session.created_at);
  const lastDate = new Date(sorted[sorted.length - 1].session.created_at);
  const spanDays = Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  // Determine bucket size: aim for 12-16 buckets
  const targetBuckets = Math.min(maxBuckets, Math.max(sessions.length, 12));
  const bucketDays = Math.max(1, Math.ceil(spanDays / targetBuckets));

  const buckets: Array<{
    sessions: SessionWithCheckin[];
    startDate: string;
    endDate: string;
  }> = [];

  let currentBucketStart = new Date(firstDate);

  while (currentBucketStart <= lastDate) {
    const bucketEnd = new Date(currentBucketStart);
    bucketEnd.setDate(bucketEnd.getDate() + bucketDays - 1);

    const bucketSessions = sorted.filter((s) => {
      const d = new Date(s.session.created_at);
      return d >= currentBucketStart && d <= bucketEnd;
    });

    buckets.push({
      sessions: bucketSessions,
      startDate: currentBucketStart.toISOString().slice(0, 10),
      endDate: bucketEnd.toISOString().slice(0, 10),
    });

    currentBucketStart = new Date(bucketEnd);
    currentBucketStart.setDate(currentBucketStart.getDate() + 1);
  }

  return buckets.filter((b) => b.sessions.length > 0);
}

// ---- Calendar grid ----

const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const CAL_CELL_H = 64;
const CAL_CELL_SIZE = 32;

const JOURNEY_BAR_H = 4;
const JOURNEY_BAR_GAP = 3;

// Get dominant nervous system state for a day (most recent session wins)
function getDominantStateForDay(daySessions: SessionWithCheckin[]): string | null {
  if (daySessions.length === 0) return null;

  // Sort by created_at descending (most recent first)
  const sorted = [...daySessions].sort((a, b) =>
    b.session.created_at.localeCompare(a.session.created_at)
  );

  // Return the state from the most recent session
  return sorted[0].checkin?.nervous_system_state ?? null;
}

function CalendarGrid({
  year, month, cellSize, sessions, integrations, onDayPress, onEmptyDayPress,
}: {
  year: number; month: number; cellSize: number;
  sessions: SessionWithCheckin[]; integrations: Integration[];
  onDayPress?: (iso: string, sessions: SessionWithCheckin[], integrations: Integration[]) => void;
  onEmptyDayPress?: (iso: string) => void;
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
              borderRightColor: COLORS.gray100,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '500', color: COLORS.gray400 }}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Week rows */}
      {weeks.map((week, wi) => {
        return (
        <View key={wi} style={{ flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.gray100, position: 'relative' }}>
          {week.map((date, di) => {
            const isLast = di === 6;
            if (!date) {
              return (
                <View
                  key={di}
                  style={{
                    width: cellSize, height: CAL_CELL_H,
                    borderRightWidth: isLast ? 0 : StyleSheet.hairlineWidth,
                    borderRightColor: COLORS.gray100,
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

            // Get dominant NS state for background color (View 6 - Arc View Phase 2)
            const dominantState = hasSession ? getDominantStateForDay(daySessions) : null;
            let cellBgColor: string | undefined;
            if (dominantState && !isToday) {
              // Use wellness tones at very low opacity for background
              const stateColor = WELLNESS_TONES[dominantState];
              cellBgColor = stateColor ? `${stateColor}15` : undefined; // ~8% opacity
            }

            const numColor = isToday ? COLORS.white
              : hasSession ? COLORS.gray600
              : isPast ? COLORS.gray300
              : COLORS.gray400;

            return (
              <TouchableOpacity
                key={di}
                style={{
                  width: cellSize, height: CAL_CELL_H,
                  borderRightWidth: isLast ? 0 : StyleSheet.hairlineWidth,
                  borderRightColor: COLORS.gray100,
                  alignItems: 'center', paddingTop: 6,
                  backgroundColor: cellBgColor,
                }}
                onPress={() => {
                  if (hasSession || hasInteg) {
                    const dayIntegrations = integDateMap.get(iso) ?? [];
                    onDayPress?.(iso, daySessions, dayIntegrations);
                  } else {
                    onEmptyDayPress?.(iso);
                  }
                }}
                activeOpacity={0.6}
              >
                {isToday ? (
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.goldTint, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.goldLabel }}>{dateNum}</Text>
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
                    <MaterialCommunityIcons name="notebook-outline" size={12} color={COLORS.meaningCategory} />
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
  { color: COLORS.practiceBreathwork, label: 'Breathwork' },
  { color: COLORS.practiceSomatic, label: 'Somatic' },
  { color: COLORS.practiceMeditation, label: 'Meditation' },
  { color: COLORS.practiceYoga, label: 'Yoga' },
  { color: COLORS.practiceMovement, label: 'Movement' },
  { color: COLORS.practiceOther, label: 'Other' },
] as const;

function CalendarView({
  sessions, integrations, onDayPress, onEmptyDayPress,
}: {
  sessions: SessionWithCheckin[]; integrations: Integration[];
  onDayPress?: (iso: string, sessions: SessionWithCheckin[], integrations: Integration[]) => void;
  onEmptyDayPress?: (iso: string) => void;
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
            <MaterialCommunityIcons name="chevron-left" size={18} color={COLORS.purple} />
          </TouchableOpacity>
          <TouchableOpacity onPress={nextMonth} style={s.calNavBtn} activeOpacity={0.6}>
            <MaterialCommunityIcons name="chevron-right" size={18} color={COLORS.purple} />
          </TouchableOpacity>
        </View>
      </View>

      <View onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
        <CalendarGrid
          year={year} month={month} cellSize={cellSize}
          sessions={sessions} integrations={integrations}
          onDayPress={onDayPress}
          onEmptyDayPress={onEmptyDayPress}
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
        const legend = Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label));
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

// ARC_BAND_COLORS is imported from theme

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

function ArcChart({ sessions, integrations, framework }: { sessions: SessionWithCheckin[]; integrations: Integration[]; framework: string }) {
  const [rowW, setRowW] = useState(SCREEN_W - 80);
  const [selected, setSelected] = useState<number | null>(null);
  const scrollRef = useRef<ScrollView>(null);

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
      dotColor: getArcDotColor(primarySession.checkin?.nervous_system_state),
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
          <Text style={{ fontSize: 13, color: COLORS.gray400 }}>No sessions yet.</Text>
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
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            onLayout={(e) => setRowW(e.nativeEvent.layout.width)}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          >
            <View style={{ width: chartW }}>
              <Svg width={chartW} height={CHART_H + DATE_LABEL_H}>
                <Defs>
                  {/* Chakra gradient background - smooth transitions with equal spacing */}
                  <SvgLinearGradient id="chakraGradient" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%" stopColor={COLORS.crown} stopOpacity="0.5" />
                    <Stop offset="16.67%" stopColor={COLORS.thirdEye} stopOpacity="0.5" />
                    <Stop offset="33.33%" stopColor={COLORS.throat} stopOpacity="0.5" />
                    <Stop offset="50%" stopColor={COLORS.heart} stopOpacity="0.5" />
                    <Stop offset="66.67%" stopColor={COLORS.solar} stopOpacity="0.5" />
                    <Stop offset="83.33%" stopColor={COLORS.sacral} stopOpacity="0.5" />
                    <Stop offset="100%" stopColor={COLORS.root} stopOpacity="0.5" />
                  </SvgLinearGradient>
                </Defs>

                {/* Chart background with chakra gradient */}
                <Rect x={0} y={0} width={chartW} height={CHART_H} fill="url(#chakraGradient)" rx={12} ry={12} />

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

                {/* Connecting line */}
                <Path d={linePath} stroke={COLORS.purple} strokeOpacity={0.5} strokeWidth={2} fill="none" strokeLinecap="round" />

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
                      <Circle cx={p.x} cy={p.y} r={18} fill={COLORS.purple} fillOpacity={selected === i ? 0.16 : 0} />

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
                        fill={COLORS.white}
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
                        cx={p.x} cy={p.y} r={20} fill={COLORS.black} fillOpacity={0}
                        onPress={() => setSelected((cur) => (cur === i ? null : i))}
                      />
                    </React.Fragment>
                  );
                })}

                {/* X-axis date labels */}
                {points.map((p, i) => (
                  (points.length <= 8 || i % 3 === 0) ? (
                    <SvgText key={i} x={p.x} y={CHART_H + 14} textAnchor="middle" fontSize={10} fill={COLORS.gray300}>
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
                    <MaterialCommunityIcons name="notebook-outline" size={12} color={COLORS.meaningCategory} />
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

  sessions.forEach((swc) => {
    const before = swc.checkin?.nervous_system_state_before;
    const after = swc.checkin?.nervous_system_state;

    if (before && after && before !== after) {
      shiftsTotal++;
      const isPositive = (stateRank[after] ?? 0) > (stateRank[before] ?? 0);
      if (isPositive) shiftsPositive++;
    }
  });

  const positiveShiftRate = shiftsTotal > 0 ? Math.round((shiftsPositive / shiftsTotal) * 100) : null;

  return { positiveShiftRate };
}

// Phase 2c — Then → Now comparator data function
function computeThenNow(sessions: SessionWithCheckin[]): {
  then: Record<string, number>; // percent 0-100 per state, first half
  now: Record<string, number>;  // percent 0-100 per state, second half
  shiftRate: number | null;     // existing positiveShiftRate logic, folded in here
} | null {
  const withState = sessions.filter((s) => s.checkin?.nervous_system_state);
  if (withState.length < 4) return null; // not enough to split meaningfully

  const sorted = [...withState].sort((a, b) =>
    a.session.created_at.localeCompare(b.session.created_at)
  );
  const mid = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, mid);
  const secondHalf = sorted.slice(mid);

  function pctByState(group: SessionWithCheckin[]): Record<string, number> {
    const counts: Record<string, number> = { grounded: 0, activated: 0, shutdown: 0 };
    group.forEach((s) => {
      const st = s.checkin?.nervous_system_state;
      if (st) counts[st] = (counts[st] ?? 0) + 1;
    });
    const total = group.length || 1;
    return {
      grounded: Math.round((counts.grounded / total) * 100),
      activated: Math.round((counts.activated / total) * 100),
      shutdown: Math.round((counts.shutdown / total) * 100),
    };
  }

  // Reuse existing shift-rate logic from computeShiftStats
  const { positiveShiftRate } = computeShiftStats(sessions);

  return {
    then: pctByState(firstHalf),
    now: pctByState(secondHalf),
    shiftRate: positiveShiftRate,
  };
}

// Trend Row component with sparkline
// Phase 2c — Then → Now comparator component

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
  const nsColor = checkin?.nervous_system_state ? STATE_COLORS[checkin.nervous_system_state] : COLORS.gray400;
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
                  <View key={tag} style={[s.detailChip, { backgroundColor: (EMOTION_TAG_COLOR[tag] ?? COLORS.meaningCategory) + '26' }]}>
                    <Text style={[s.detailChipText, { color: EMOTION_TAG_COLOR[tag] ?? COLORS.meaningCategory }]}>
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
                  <View style={[s.detailBodyDot, { backgroundColor: REGION_CHAKRA_COLORS[bs.region] ?? COLORS.meaningCategory }]} />
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
                <MaterialCommunityIcons name="chevron-right" size={18} color={COLORS.gray300} />
              </TouchableOpacity>
            );
          })}
          {dayIntegrations.map((integ) => {
            const firstLine = getIntegFirstLine(integ);
            const catColor = CATEGORY_COLORS[integ.category] ?? COLORS.meaningCategory;
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
                <MaterialCommunityIcons name="chevron-right" size={18} color={COLORS.gray300} />
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
                <MaterialCommunityIcons name="eye-outline" size={16} color={COLORS.purple} />
                <View style={{ flex: 1 }}>
                  <Text style={s.daySheetRowTitle}>{typeLabel} Mirror</Text>
                  <Text style={s.daySheetRowSubtitle}>{rangeLabel}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={18} color={COLORS.gray300} />
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
              placeholderTextColor={COLORS.gray300}
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
                      <Text style={{ fontSize: active ? 24 : 17, fontWeight: active ? '700' : '400', color: active ? COLORS.gray600 : COLORS.gray300 }}>
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
                <Text style={{ fontSize: 14, fontWeight: '500', color: COLORS.purple }}>Edit</Text>
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
  const [somaFilter, setSomaFilter] = useState<SomaFilter>('month');
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
  const [emptyDateSheetOpen, setEmptyDateSheetOpen] = useState(false);
  const [selectedEmptyDate, setSelectedEmptyDate] = useState<string | null>(null);
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

  function handleEmptyDateNewSession() { setEmptyDateSheetOpen(false); router.push('/new-session'); }
  function handleEmptyDateNewIntegration() { setEmptyDateSheetOpen(false); router.push('/new-integration'); }
  function handleEmptyDateNewJourney() {
    setEmptyDateSheetOpen(false);
    router.push({ pathname: '/new-journey', params: { startDate: selectedEmptyDate } } as any);
  }

  function openEmptyDateSheet(iso: string) {
    setSelectedEmptyDate(iso);
    setEmptyDateSheetOpen(true);
  }

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

  // Extract filtered sessions/integrations for use in Soma card
  const { sessions: filteredSessions, integrations: filteredIntegrations } =
    filterByWindow(sessions, integrations, somaFilter);

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
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

          {/* ---- Header ---- */}
          <View style={s.header}>
            <View style={s.greetingRow}>
              <Text style={s.greeting}>{getGreeting(userName)}</Text>
              {IS_DEV && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={s.devBadge}>
                    <Text style={s.devBadgeText}>DEV</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert(
                        'Reset Onboarding',
                        'This will reset your onboarding and restart the flow. Your sessions and data will not be deleted. Continue?',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Continue',
                            style: 'destructive',
                            onPress: async () => {
                              const profile = await getProfile();
                              if (profile) {
                                await updateProfile({
                                  ...profile,
                                  onboarding_complete: false,
                                  vocabulary_preference: null,
                                  practices: [],
                                  goals: [],
                                });
                              }
                              router.push('/onboarding' as any);
                            },
                          },
                        ]
                      );
                    }}
                    hitSlop={8}
                  >
                    <Text style={{ fontSize: 10, fontWeight: '500', color: COLORS.errorRed, textDecorationLine: 'underline' }}>
                      Reset onboarding
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={() => router.push('/settings' as any)} hitSlop={8}>
              <MaterialCommunityIcons name="cog-outline" size={20} color={COLORS.gray300} />
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
                    const accent = JOURNEY_COLORS[idx % JOURNEY_COLORS.length];
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
                        <View key={tag} style={[s.emotionChip, { backgroundColor: (EMOTION_TAG_COLOR[tag] ?? COLORS.meaningCategory) + '26', alignSelf: 'flex-start', marginTop: 6 }]}>
                          <Text style={[s.emotionChipText, { color: EMOTION_TAG_COLOR[tag] ?? COLORS.meaningCategory }]}>
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
                    <MaterialCommunityIcons name="clock-time-four-outline" size={14} color={COLORS.gray500} />
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
                          <MaterialCommunityIcons name={icon as any} size={18} color={active ? COLORS.white : COLORS.gray400} />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>
              {(() => {
                const fs = filteredSessions;
                const fi = filteredIntegrations;
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

                    {somaView === 'arc' && <ArcChart sessions={fs} integrations={fi} framework={framework} />}
                    {somaView === 'calendar' && (
                      <CalendarView
                        sessions={fs} integrations={fi}
                        onDayPress={openDayDetail}
                        onEmptyDayPress={openEmptyDateSheet}
                      />
                    )}
                  </>
                );
              })()}

              {/* Explore more insights button */}
              <TouchableOpacity
                style={s.exploreInsightsBtn}
                onPress={() => router.push('/mirror?tab=explore' as any)}
                activeOpacity={0.7}
              >
                <Text style={s.exploreInsightsBtnText}>Explore more insights</Text>
                <MaterialCommunityIcons name="arrow-right" size={18} color={COLORS.accent} />
              </TouchableOpacity>
            </View>
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
            <MaterialCommunityIcons name="plus-circle-outline" size={26} color={COLORS.bodyCategory} />
            <View style={{ flex: 1 }}>
              <Text style={s.actionLabel}>New session</Text>
              <Text style={s.actionSubtitle}>Record what you noticed</Text>
            </View>
          </TouchableOpacity>
          <View style={s.actionDivider} />
          <TouchableOpacity style={s.actionRow} onPress={handleNewIntegration} activeOpacity={0.7}>
            <MaterialCommunityIcons name="notebook-edit-outline" size={26} color={COLORS.emotionCategory} />
            <View style={{ flex: 1 }}>
              <Text style={s.actionLabel}>New integration</Text>
              <Text style={s.actionSubtitle}>{"Log what's still moving"}</Text>
            </View>
          </TouchableOpacity>
          <View style={s.actionDivider} />
          <TouchableOpacity style={s.actionRow} onPress={handleNewJourney} activeOpacity={0.7}>
            <MaterialCommunityIcons name="map-marker-path" size={26} color={COLORS.meaningCategory} />
            <View style={{ flex: 1 }}>
              <Text style={s.actionLabel}>New journey</Text>
              <Text style={s.actionSubtitle}>Set an intention or context</Text>
            </View>
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {/* Empty date action sheet */}
      <BottomSheet visible={emptyDateSheetOpen} onDismiss={() => setEmptyDateSheetOpen(false)}>
        <View style={s.actionSheet}>
          <TouchableOpacity style={s.actionRow} onPress={handleEmptyDateNewSession} activeOpacity={0.7}>
            <MaterialCommunityIcons name="plus-circle-outline" size={26} color={COLORS.bodyCategory} />
            <View style={{ flex: 1 }}>
              <Text style={s.actionLabel}>New session</Text>
              <Text style={s.actionSubtitle}>Record what you noticed</Text>
            </View>
          </TouchableOpacity>
          <View style={s.actionDivider} />
          <TouchableOpacity style={s.actionRow} onPress={handleEmptyDateNewIntegration} activeOpacity={0.7}>
            <MaterialCommunityIcons name="notebook-edit-outline" size={26} color={COLORS.emotionCategory} />
            <View style={{ flex: 1 }}>
              <Text style={s.actionLabel}>New integration</Text>
              <Text style={s.actionSubtitle}>{"Log what's still moving"}</Text>
            </View>
          </TouchableOpacity>
          <View style={s.actionDivider} />
          <TouchableOpacity style={s.actionRow} onPress={handleEmptyDateNewJourney} activeOpacity={0.7}>
            <MaterialCommunityIcons name="map-marker-path" size={26} color={COLORS.meaningCategory} />
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
                  <MaterialCommunityIcons name="check" size={20} color={COLORS.purple} />
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
        <MaterialCommunityIcons name="plus" size={28} color={COLORS.white} />
      </TouchableOpacity>
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
  greeting: { fontSize: 32, fontFamily: FONTS.display, color: COLORS.gray600, letterSpacing: -0.5 },
  devBadge: { backgroundColor: COLORS.purple, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  devBadgeText: { fontSize: 9, fontWeight: '700', color: COLORS.white, letterSpacing: 0.5 },
  headerDate: { fontSize: 13, fontWeight: '400', color: COLORS.gray400 },
  headerSubtitle: { fontSize: 15, fontWeight: '400', color: COLORS.gray400, marginTop: 4 },
  journeyMoreLink: { fontSize: 12, fontWeight: '500', color: COLORS.purple },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.purple,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.purple,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },

  // Journey detail sheet
  journeySheetName: { fontSize: 18, fontWeight: '600', color: COLORS.gray600, marginBottom: 4, textAlign: 'center' },
  journeySheetMeta: { fontSize: 13, fontWeight: '400', color: COLORS.gray400, textAlign: 'center', marginBottom: 16 },
  journeySheetBarBg: { height: 4, borderRadius: 2, backgroundColor: 'rgba(176,127,255,0.25)', marginBottom: 6 },
  journeySheetBarFill: { height: 4, borderRadius: 2, backgroundColor: COLORS.purple },
  journeySheetPct: { fontSize: 12, fontWeight: '500', color: COLORS.purple, textAlign: 'right', marginBottom: 4 },
  journeySheetSessionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
  },
  journeySheetSessionDot: { width: 10, height: 10, borderRadius: 5 },
  journeySheetSessionText: { flex: 1, fontSize: 14, fontFamily: FONTS.body, color: COLORS.gray500 },
  journeySheetSessionDate: { fontSize: 12, fontFamily: FONTS.body, color: COLORS.gray400 },
  journeySheetEndBtn: { marginTop: 8, paddingVertical: 12, alignItems: 'center' },
  journeySheetEndText: { fontSize: 14, fontWeight: '500', color: COLORS.gray400 },
  journeySheetLogBtn: {
    height: 48, borderRadius: 24,
    backgroundColor: COLORS.purple,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 12,
  },
  journeySheetLogBtnText: { fontFamily: FONTS.bodySemiBold, fontSize: 15, fontWeight: '600', color: COLORS.white },
  journeyConfirmOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  journeyConfirmTitle: { fontSize: 17, fontWeight: '600', color: COLORS.gray600, textAlign: 'center', marginBottom: 10 },
  journeyConfirmBody: { fontSize: 14, fontWeight: '400', color: COLORS.gray500, textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  journeyConfirmPrimary: {
    width: '100%', height: 48, borderRadius: 12,
    backgroundColor: COLORS.purple, alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  journeyConfirmPrimaryText: { fontFamily: FONTS.bodySemiBold, fontSize: 15, fontWeight: '600', color: COLORS.white },
  journeyConfirmSecondary: { width: '100%', height: 48, alignItems: 'center', justifyContent: 'center' },
  journeyConfirmSecondaryText: { fontSize: 15, fontWeight: '400', color: COLORS.gray400 },

  // Empty state
  emptyContainer: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 20, gap: 28 },
  emptyTextBlock: { alignItems: 'center', gap: 6 },
  emptyPrimary: { fontSize: 15, fontWeight: '500', color: COLORS.gray600, textAlign: 'center' },
  emptySecondary: { fontSize: 13, fontWeight: '400', fontStyle: 'italic', color: COLORS.gray400, textAlign: 'center' },

  // Populated
  populatedContent: { gap: 20, paddingHorizontal: 20, paddingTop: 12 },

  // Cards
  card: { backgroundColor: COLORS.white, borderRadius: 20 },
  lastSessionCard: { padding: 20 },

  // Section labels
  sectionLabel: TYPOGRAPHY.label,

  // Active journeys
  activeJourneysSection: { gap: 8 },
  journeyCard: { padding: 20 },
  journeyCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  journeyCardName: { fontSize: 22, lineHeight: 28, fontFamily: FONTS.display, color: COLORS.gray600 },
  journeyCardCount: { fontFamily: FONTS.body, fontSize: 12, fontWeight: '400', color: COLORS.gray400 },
  journeyCardBarBg: { height: 5, borderRadius: 99, backgroundColor: COLORS.accentTint },
  journeyCardBarFill: { height: 5, borderRadius: 99 },

  // Your Soma card
  somaCard: { padding: 20 },
  somaCardHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4,
  },
  somaCardLabel: {
    fontSize: 10, fontWeight: '600', color: COLORS.textQuaternary,
    letterSpacing: 1, textTransform: 'uppercase',
  },
  somaFilterPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.accentTint, borderRadius: 12, height: 36,
    paddingHorizontal: 14, paddingVertical: 6,
    alignSelf: 'flex-start',
    borderWidth: 1, borderColor: COLORS.purple + '4D',
  },
  somaFilterPillText: {
    ...OPTION_TEXT, fontSize: 13,
    fontFamily: FONTS.body,
  },
  somaControlsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16,
  },
  somaToggle: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.accentTint, borderRadius: 12, height: 36, padding: 3, gap: 2 },
  somaToggleBtn: { width: 30, height: 30, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  somaToggleBtnActive: {
    backgroundColor: COLORS.accent,
    shadowColor: COLORS.black, shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },
  somaNarrativeText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    fontStyle: 'italic',
    color: COLORS.textSecondary,
    marginBottom: 10,
    paddingHorizontal: 2,
  },

  exploreInsightsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: COLORS.accentTint,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  exploreInsightsBtnText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.accent,
  },

  // Icon legend
  iconLegend: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', alignItems: 'center' },
  legendIconItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  legendIconText: { fontSize: 11, fontWeight: '400', color: COLORS.gray400 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },

  // Arc chart
  arcLegendRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
  arcLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  arcLegendDot: { width: 10, height: 10, borderRadius: 5 },
  arcLegendText: { fontSize: 12, fontWeight: '400', color: COLORS.gray500 },
  arcTooltip: {
    position: 'absolute', backgroundColor: COLORS.white, borderRadius: 12, padding: 16,
    shadowColor: COLORS.black, shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  arcTooltipDate: { fontSize: 13, fontWeight: '500', color: COLORS.gray500, fontFamily: FONTS.bodyMedium, marginBottom: 4 },
  arcTooltipRow: { fontSize: 13, fontWeight: '400', fontFamily: FONTS.body, color: COLORS.gray500, textTransform: 'capitalize', lineHeight: 18, marginBottom: 4 },
  arcTooltipEmotion: { fontSize: 14, fontWeight: '500', fontFamily: FONTS.bodyMedium, textTransform: 'capitalize', lineHeight: 18 },

  // Last session card
  lastSessionHeader: { fontFamily: FONTS.body, fontSize: 12, fontWeight: '400', color: COLORS.textTertiary, marginBottom: 14, textAlign: 'center' },
  lastSessionBody: { flexDirection: 'column', gap: 10 },
  lastSessionTitle: { fontSize: 22, lineHeight: 28, fontFamily: FONTS.display, color: COLORS.gray600, textAlign: 'center', width: '100%' },
  lastSessionColumns: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  lastSessionLeft: { flex: 1, gap: 6 },
  lastSessionRight: { width: 90, alignItems: 'center', justifyContent: 'center' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 6, marginBottom: 12 },
  greyChip: { borderRadius: 24, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: COLORS.gray100 },
  greyChipText: { fontSize: 13, fontWeight: '500', color: COLORS.gray500 },
  wellnessChip: { borderRadius: 24, paddingHorizontal: 12, paddingVertical: 6 },
  wellnessChipText: { fontFamily: FONTS.body, fontSize: 13, fontWeight: '400' },
  emotionChip: { borderRadius: 24, paddingHorizontal: 12, paddingVertical: 6 },
  emotionChipText: { fontFamily: FONTS.body, fontSize: 13, fontWeight: '400' },

  // Bottom sheets (general)
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12,
  },
  dragHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.gray200,
    alignSelf: 'center', marginBottom: 12,
  },
  actionSheet: { paddingTop: 4 },
  actionRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 24, paddingVertical: 14, gap: 16, minHeight: 64,
  },
  actionLabel: { fontFamily: FONTS.bodyMedium, fontSize: 15, fontWeight: '500', color: COLORS.gray600 },
  actionSubtitle: { fontFamily: FONTS.body, fontSize: 12, fontWeight: '400', color: COLORS.gray400, marginTop: 2 },
  actionDivider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border, marginHorizontal: 24 },

  // Integration prompt
  integrationPrompt: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24 },
  integrationPromptTitle: { fontSize: 22, lineHeight: 28, fontFamily: FONTS.display, color: COLORS.gray600, marginBottom: 8, textAlign: 'center' },
  integrationPromptSubtitle: { fontSize: 14, fontWeight: '400', color: COLORS.gray400, lineHeight: 20, textAlign: 'center', marginBottom: 24 },
  integrationPromptButtons: { gap: 12 },
  integrationPromptPrimary: {
    height: 48, borderRadius: 24, backgroundColor: COLORS.purple,
    alignItems: 'center', justifyContent: 'center',
  },
  integrationPromptPrimaryText: { fontFamily: FONTS.bodySemiBold, fontSize: 15, fontWeight: '600', color: COLORS.white },
  integrationPromptSecondary: { height: 48, borderRadius: 24, backgroundColor: COLORS.gray200, alignItems: 'center', justifyContent: 'center' },
  integrationPromptSecondaryText: { fontFamily: FONTS.bodyMedium, fontSize: 15, fontWeight: '500', color: COLORS.gray500 },

  // Calendar month nav (inline soma view)
  calNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  calNavBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  calNavMonth: { fontSize: 13, fontWeight: '600', color: COLORS.gray600, letterSpacing: 0.5 },

  // Session detail sheet
  detailSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.white, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 12, paddingHorizontal: 20, height: '65%',
  },
  detailDate: { fontSize: 12, fontWeight: '500', color: COLORS.gray400, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16, textAlign: 'center' },
  detailNsPill: {
    borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8,
  },
  detailNsText: { fontSize: 15, fontWeight: '600', color: COLORS.white },
  detailSection: { marginBottom: 16 },
  detailSectionLabel: { ...TYPOGRAPHY.label, marginBottom: 8 },
  detailChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  detailChipText: { fontSize: 13, fontWeight: '500' },
  detailBodyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  detailBodyDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  detailBodyText: { fontSize: 14, fontWeight: '400', color: COLORS.gray600 },
  detailBodyQuality: { fontSize: 13, fontWeight: '400', color: COLORS.gray400 },
  detailNoteText: { fontFamily: FONTS.body, fontSize: 15, fontWeight: '400', color: COLORS.gray500, lineHeight: 22, fontStyle: 'italic' },

  // Day detail sheet
  daySheetRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
  },
  daySheetDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  daySheetRowTitle: { ...OPTION_TEXT, fontSize: 15, fontWeight: '400', textTransform: 'capitalize' },
  daySheetRowSubtitle: { fontFamily: FONTS.body, fontSize: 12, fontWeight: '400', color: COLORS.gray400, marginTop: 2 },

  // Saved toast
  savedToast: { position: 'absolute', top: 100, left: 0, right: 0, alignItems: 'center' },
  savedToastText: { fontSize: 13, color: COLORS.gray400 },

  // Filter picker modal
  filterPickerBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  filterPickerSheet: {
    backgroundColor: COLORS.white, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 12, paddingBottom: 40,
  },
  filterPickerDragHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.gray200,
    alignSelf: 'center', marginBottom: 16,
  },
  filterPickerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingVertical: 14, minHeight: 48,
  },
  filterPickerRowText: { fontFamily: FONTS.body, fontSize: 15, fontWeight: '400', color: COLORS.gray600 },
  filterPickerRowTextSelected: { fontWeight: '600', color: COLORS.purple },

  // Journey edit mode
  journeyEditHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 20, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
  },
  journeyEditTitle: { fontSize: 16, fontWeight: '600', color: COLORS.gray600 },
  journeyEditCancel: { fontFamily: FONTS.bodyMedium, fontSize: 15, fontWeight: '500', color: COLORS.gray400 },
  journeyEditSave: { fontFamily: FONTS.bodyMedium, fontSize: 15, fontWeight: '500', color: COLORS.purple },
  journeyEditLabel: {
    fontSize: 10, fontWeight: '700', color: COLORS.gray400,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8,
  },
  journeyEditInput: {
    backgroundColor: COLORS.inputBg, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: COLORS.gray600,
  },
  journeyEditWheelWrap: {
    height: EDU_ITEM_H * 3, overflow: 'hidden', position: 'relative',
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border,
    marginTop: 4,
  },
  journeyEditWheelIndicator: {
    position: 'absolute', top: EDU_ITEM_H, left: 0, right: 0, height: EDU_ITEM_H,
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: COLORS.purple + '22',
    pointerEvents: 'none',
  },
  journeyEditWheelUnit: { fontSize: 13, fontWeight: '400', color: COLORS.gray400, textAlign: 'center', marginTop: 6, marginBottom: 16 },
});
