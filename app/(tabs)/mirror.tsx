import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Animated, Easing, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import {
  getMirrors, getSessions, getIntegrations, getProfile,
  shouldShowWeeklyMirror, shouldShowMonthlyMirror, saveMirror, uid,
  getMirrorUnlockStatus,
} from '@/lib/storage';
import type { Mirror, MirrorPromptType, SessionWithCheckin } from '@/lib/types';
import { COLORS, RADII, CARD_SHADOW, FONTS } from '@/lib/theme';

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
    const label = m.type === 'monthly'
      ? `MONTHLY MIRROR — ${formatDateRange(m)}`
      : `WEEKLY MIRROR — ${formatDateRange(m)}`;
    lines.push(label);
    lines.push(m.content);
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

// ---- Generation loading view ----

function GenerationView({ type }: { type: MirrorPromptType }) {
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

  return (
    <View style={s.genContainer}>
      <Animated.View style={{ transform: [{ scale }], opacity }}>
        <MaterialCommunityIcons name="eye-outline" size={56} color={COLORS.accent} />
      </Animated.View>
      <Text style={s.genText}>{type === 'monthly' ? 'Reflecting on your month…' : 'Reflecting on your week…'}</Text>
      <View style={s.genBarTrack}>
        <Animated.View style={[s.genBarFill, { transform: [{ translateX }] }]} />
      </View>
    </View>
  );
}

// ---- Mirror card ----

function MirrorCard({ mirror, onPress, onCopy }: { mirror: Mirror; onPress: () => void; onCopy: () => void }) {
  return (
    <TouchableOpacity style={[s.mirrorCard, CARD_SHADOW]} onPress={onPress} activeOpacity={0.85}>
      <View style={s.cardTopRow}>
        <View style={s.typePill}>
          <Text style={s.typePillText}>{mirror.type === 'weekly' ? 'Weekly' : 'Monthly'}</Text>
        </View>
        <TouchableOpacity onPress={onCopy} hitSlop={8} activeOpacity={0.6}>
          <MaterialCommunityIcons name="content-copy" size={24} color={COLORS.textTertiary} />
        </TouchableOpacity>
      </View>
      <Text style={s.cardDateRange}>{formatDateRange(mirror)}</Text>
      <Text style={s.cardContent}>{mirror.content}</Text>
    </TouchableOpacity>
  );
}

// ---- Main screen ----

export default function MirrorScreen() {
  const router = useRouter();
  const { autogenerate } = useLocalSearchParams<{ autogenerate?: string }>();
  const [mirrors, setMirrors] = useState<Mirror[]>([]);
  const [promptType, setPromptType] = useState<MirrorPromptType>(null);
  const [generating, setGenerating] = useState<MirrorPromptType>(null);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [unlockStatus, setUnlockStatus] = useState({ unlocked: true, daysSinceSignup: 0, totalSessions: 0, sessionsNeeded: 0 });
  const toastAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    const [m, weekly, monthly, status] = await Promise.all([
      getMirrors(), shouldShowWeeklyMirror(), shouldShowMonthlyMirror(), getMirrorUnlockStatus(),
    ]);
    setMirrors(m);
    setPromptType(monthly ? 'monthly' : weekly ? 'weekly' : null);
    setUnlockStatus(status);
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
    return (
      <SafeAreaView edges={['top']} style={s.safe}>
        <GenerationView type={generating} />
      </SafeAreaView>
    );
  }

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
      <View style={s.header}>
        <View>
          <Text style={s.title}>Mirror</Text>
          <Text style={s.subtitle}>Reflections drawn from your practice.</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/settings' as any)} hitSlop={8}>
          <MaterialCommunityIcons name="cog-outline" size={20} color="#CCCCCC" />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {!unlockStatus.unlocked ? (
          <View style={s.lockedState}>
            <MaterialCommunityIcons name="eye-off-outline" size={64} color="#CCCCCC" style={{ marginBottom: 16 }} />
            <Text style={s.lockedTitle}>Your Mirror is resting</Text>
            <Text style={s.lockedMessage}>
              {unlockStatus.sessionsNeeded > 0
                ? `Log ${unlockStatus.sessionsNeeded} more ${unlockStatus.sessionsNeeded === 1 ? 'session' : 'sessions'} to unlock your weekly synthesis.`
                : 'Your Mirror will be available soon.'}
            </Text>
            <View style={s.lockedStats}>
              <View style={s.lockedStatRow}>
                <MaterialCommunityIcons name="check-circle" size={20} color={unlockStatus.totalSessions >= 7 ? COLORS.heart : '#CCCCCC'} />
                <Text style={s.lockedStatText}>{unlockStatus.totalSessions} / 7 sessions logged</Text>
              </View>
              <View style={s.lockedStatRow}>
                <MaterialCommunityIcons name="check-circle" size={20} color={unlockStatus.daysSinceSignup >= 7 ? COLORS.heart : '#CCCCCC'} />
                <Text style={s.lockedStatText}>{unlockStatus.daysSinceSignup} / 7 days since sign-up</Text>
              </View>
            </View>
          </View>
        ) : (
          <>
            {promptType && (
              <ExpoLinearGradient
                colors={['#B07FFF', '#8B5CF6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.banner}
              >
                <MaterialCommunityIcons name="eye-outline" size={28} color="#FFFFFF" style={{ marginBottom: 10 }} />
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
                <MaterialCommunityIcons name="eye-outline" size={48} color="#CCCCCC" />
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

  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 60, gap: 20 },

  banner: {
    borderRadius: RADII.card, padding: 24,
  },
  bannerTitle: { fontSize: 18, fontWeight: '600', color: '#FFFFFF', marginBottom: 4 },
  bannerSubtitle: { fontSize: 13, fontWeight: '400', color: 'rgba(255,255,255,0.85)', marginBottom: 20 },
  bannerBtn: {
    alignSelf: 'flex-start', backgroundColor: '#FFFFFF',
    borderRadius: 24, paddingHorizontal: 28, height: 48,
    alignItems: 'center', justifyContent: 'center',
  },
  bannerBtnText: { fontFamily: 'Nunito_500Medium', fontSize: 15, fontWeight: '500', color: COLORS.accent },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12,
  },
  sectionLabel: {
    fontFamily: 'Nunito_500Medium', fontSize: 11, fontWeight: '500',
    textTransform: 'uppercase', letterSpacing: 1.2, color: '#999999',
  },
  exportLinkText: { fontSize: 13, fontWeight: '500', color: COLORS.accent },

  mirrorCard: {
    backgroundColor: COLORS.card, borderRadius: RADII.card, padding: 20,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  typePill: {
    backgroundColor: '#B07FFF26', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  typePillText: { fontSize: 11, fontWeight: '500', color: COLORS.accent },
  cardDateRange: { fontFamily: 'Nunito_400Regular', fontSize: 12, fontWeight: '400', color: '#999999', marginBottom: 12 },
  cardContent: { fontFamily: 'Nunito_400Regular', fontSize: 15, fontWeight: '400', lineHeight: 22, color: '#666666' },

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
    backgroundColor: '#1A1A1A', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  toastText: { fontSize: 13, fontWeight: '500', color: '#FFFFFF' },

  exportModal: {
    width: '100%', backgroundColor: COLORS.card, borderRadius: RADII.card, padding: 32,
    alignItems: 'center',
    shadowColor: '#000000', shadowOpacity: 0.18, shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 }, elevation: 12,
  },
  exportModalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 10, textAlign: 'center' },
  exportModalBody: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  exportModalBtn: {
    width: '100%', height: 48, backgroundColor: COLORS.accent,
    borderRadius: 24, alignItems: 'center', justifyContent: 'center',
  },
  exportModalBtnText: { fontFamily: 'Nunito_600SemiBold', fontSize: 15, fontWeight: '600', color: '#FFFFFF' },

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
});
