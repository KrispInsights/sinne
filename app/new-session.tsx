import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { BottomSheet } from '@/components/BottomSheet';
import {
  getSessions, getProfile, getActiveJourneys,
  createSession, updateSession,
} from '@/lib/storage';
import { markSessionSaved } from '@/lib/events';
import type { BodySensation, Journey } from '@/lib/types';

function journeyIncludesToday(journey: Journey): boolean {
  if (!journey.start_date || !journey.duration_days) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(journey.start_date); start.setHours(0, 0, 0, 0);
  const end = new Date(journey.start_date);
  end.setDate(end.getDate() + journey.duration_days - 1);
  end.setHours(0, 0, 0, 0);
  return today >= start && today <= end;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ---- Date helpers (date chip + native picker) ----

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateToIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatChipDate(iso: string): string {
  const date = isoToDate(iso);
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const yesterday = new Date(todayDate);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.getTime() === todayDate.getTime()) {
    return `Today, ${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`;
  }
  if (date.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ---- Data constants ----

// Wellness tones for nervous system selection states
const WELLNESS_TONES: Record<string, string> = {
  grounded: '#6B9E7A',
  activated: '#C4993A',
  shutdown: '#7B6BAE',
};

const NS_STATES = [
  { key: 'grounded',  labels: { plain: 'Grounded',  polyvagal: 'Ventral',     ifs: 'Self',           somatic: 'Grounded'  }, color: '#7AAE8A', icon: 'weather-sunny-outline' },
  { key: 'activated', labels: { plain: 'Activated', polyvagal: 'Sympathetic', ifs: 'Activated part', somatic: 'Activated' }, color: '#C9B96A', icon: 'lightning-bolt-outline' },
  { key: 'shutdown',  labels: { plain: 'Shutdown',  polyvagal: 'Dorsal',      ifs: 'Blended',        somatic: 'Shutdown'  }, color: '#7E6B9E', icon: 'weather-night' },
];

const SHIFT_OPTIONS = [
  { label: 'Something released', icon: 'water-outline',        color: '#6E9BB5' },
  { label: 'Something shifted',  icon: 'swap-horizontal',      color: '#9B7FBF' },
  { label: 'Nothing moved',      icon: 'minus-circle-outline', color: '#BBBBBB' },
];

const SHIFT_QUALITIES = [
  { key: 'breaththrough',        label: 'Breaththrough' },
  { key: 'emotional flood',      label: 'Emotional flood' },
  { key: 'heat/cold wave',       label: 'Heat / cold wave' },
  { key: 'physical sensation',   label: 'Physical sensation' },
  { key: 'shaking/trembling',    label: 'Shaking / trembling' },
  { key: 'sound/vocalization',   label: 'Sound / vocalization' },
  { key: 'spontaneous movement', label: 'Spontaneous movement' },
  { key: 'tears',                label: 'Tears' },
];

const EMOTION_CLUSTERS = [
  { name: 'Anger',               text: '#C49A6C', tags: ['anger','frustration','irritation','rage','resentment'] },
  { name: 'Fear',                text: '#B5736A', tags: ['anxiety','dread','fear','panic','terror'] },
  { name: 'Grief',               text: '#6E9BB5', tags: ['grief','heartbreak','longing','loss','sadness'] },
  { name: 'Neutral / liminal',   text: '#9B7FBF', tags: ['confusion','dissociation','emptiness','numbness'] },
  { name: 'Positive / opening',  text: '#7AAE8A', tags: ['awe','bliss','gratitude','joy','love','warmth'] },
  { name: 'Release / movement',  text: '#C49A6C', tags: ['openness','release','relief','surrender'] },
  { name: 'Shame / contraction', text: '#7E6B9E', tags: ['guilt','shame','smallness','unworthiness'] },
];

const CHAKRA_ORDER: Record<string, number> = {
  'Crown — Sahasrara': 0,
  'Third eye — Ajna': 1,
  'Throat — Vishuddha': 2,
  'Heart — Anahata': 3,
  'Solar plexus — Manipura': 4,
  'Sacral — Svadhisthana': 5,
  'Root — Muladhara': 6,
  'All centers — Sushumna': 7,
  'All centers': 8,
};

const BODY_REGIONS = [
  { key: 'head',         icon: 'head-outline',        label: 'Head / mind',            chakra: 'Crown — Sahasrara',       color: '#9B7FBF', qualities: ['Buzzing','Clarity','Expanding','Fog','Pressure','Spinning','Tingling'] },
  { key: 'eyes',         icon: 'eye-outline',         label: 'Eyes',                   chakra: 'Third eye — Ajna',        color: '#7E6B9E', qualities: ['Burning','Heaviness','Softening','Tears'] },
  { key: 'jaw',          icon: 'emoticon-outline',    label: 'Jaw / face',             chakra: 'Third eye — Ajna',        color: '#7E6B9E', qualities: ['Numb','Releasing','Tension','Trembling'] },
  { key: 'throat',       icon: 'microphone-outline',  label: 'Throat',                 chakra: 'Throat — Vishuddha',      color: '#6E9BB5', qualities: ['Constriction','Lump','Opening','Releasing','Wanting to speak','Warmth'] },
  { key: 'chest',        icon: 'heart-outline',       label: 'Chest / heart',          chakra: 'Heart — Anahata',         color: '#7AAE8A', qualities: ['Aching','Expansion','Flutter','Heaviness','Opening','Tightness','Warmth'] },
  { key: 'shoulders',    icon: 'human',               label: 'Shoulders / upper back', chakra: 'Heart — Anahata',         color: '#7AAE8A', qualities: ['Heaviness','Releasing','Tension','Weight lifting'] },
  { key: 'arms',         icon: 'hand-wave',           label: 'Arms / hands',           chakra: 'Heart — Anahata',         color: '#7AAE8A', qualities: ['Cramping','Energy moving','Heaviness','Numbness','Shaking','Tetany','Tingling','Warmth'] },
  { key: 'solar_plexus', icon: 'fire',                label: 'Solar plexus / gut',     chakra: 'Solar plexus — Manipura', color: '#C9B96A', qualities: ['Churning','Dropping','Expansion','Fire','Nausea','Sinking','Tightening'] },
  { key: 'pelvis',       icon: 'circle-outline',      label: 'Pelvis / lower belly',   chakra: 'Sacral — Svadhisthana',   color: '#C49A6C', qualities: ['Contraction','Grounding','Heaviness','Opening','Tingling','Warmth'] },
  { key: 'legs',         icon: 'walk',                label: 'Legs / feet',            chakra: 'Root — Muladhara',        color: '#B5736A', qualities: ['Grounding','Heaviness','Numbness','Rooting','Shaking','Trembling'] },
  { key: 'spine',        icon: 'dots-vertical',       label: 'Spine',                  chakra: 'All centers — Sushumna',  color: '#9B7FBF', qualities: ['Electric','Heat moving up','Releasing','Vibration','Waves'] },
  { key: 'full_body',    icon: 'account-outline',     label: 'Full body',              chakra: 'All centers',             color: '#9B7FBF', qualities: ['Chills','Dissolving','Electricity','Heat','Trembling','Vibration','Waves'] },
];

const BODY_REGIONS_SORTED = [...BODY_REGIONS].sort(
  (a, b) => (CHAKRA_ORDER[a.chakra] ?? 99) - (CHAKRA_ORDER[b.chakra] ?? 99)
);

const CONNECTION_OPTIONS = [
  { key: 'tied_to_something', label: 'A memory, story or situation',         icon: 'book-open-page-variant-outline', color: '#6E9BB5' },
  { key: 'pure_sensation',    label: 'Pure sensation, no story attached',    icon: 'water-outline',                   color: '#7AAE8A' },
  { key: 'unclear',           label: "Unclear / don't know",                 icon: 'help-circle-outline',             color: '#BBBBBB' },
];

// ---- Practices (PRD 4.1) ----

const PRACTICES_WITH_SUBTYPES: Record<string, string[]> = {
  'Breathwork': ['4-7-8 breathing','Box breathing','Circular breathing','Conscious connected breathing','Cyclic sighing','Holotropic-style breathing','Pranayama / yogic breathing','Presence Process (Michael Brown)','Rebirthing breathwork','Soma Breath','Somatic breathwork','Wim Hof method','Other'],
  'Dance / movement therapy': ['5Rhythms','Authentic movement','Contact improvisation','Ecstatic dance','Open Floor','Other'],
  'Meditation / Vipassana': ['Body scan','Loving-kindness (Metta)','Mindfulness (MBSR)','Nondual / Dzogchen','Transcendental meditation','Vipassana (S.N. Goenka)','Yoga Nidra / NSDR','Zen / Zazen','Other'],
  'Qi Gong / Tai Chi': ['Medical Qi Gong','Tai Chi Chuan','Zhan Zhuang (standing)','Other'],
  'Trauma therapy (body-based)': ['AEDP','Brainspotting','Compassionate Inquiry','EMDR','Gestalt','Hakomi','Sensorimotor psychotherapy','Somatic Experiencing (SE)','Other'],
  'Yoga': ['Ashtanga','Bikram / hot yoga','Hatha','Iyengar','Kundalini','Nidra','Power yoga','Restorative','Somatic yoga','Vinyasa / flow','Yin','Other'],
};

const ALL_PRACTICES = [
  'Breathwork',
  'Dance / movement therapy',
  'IFS / Internal Family Systems',
  'Meditation / Vipassana',
  'Qi Gong / Tai Chi',
  'Reiki / energy healing',
  'Somatic Experiencing',
  'Sound healing',
  'Trauma therapy (body-based)',
  'Yoga',
  'Not sure yet',
  'Other',
];

// Most common practices shown by default (reduce cognitive load)
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

const PRACTICE_COLOR = '#9B7FBF';

type VocabFramework = 'plain' | 'polyvagal' | 'ifs' | 'somatic';

// ---- Progress dots indicator ----

function ProgressDots({ current, total = 8 }: { current: number; total?: number }) {
  return (
    <View style={ss.progressDots}>
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        if (n < current) return <View key={i} style={ss.progressDotCompleted} />;
        if (n === current) return <View key={i} style={ss.progressDotCurrent} />;
        return <View key={i} style={ss.progressDotFuture} />;
      })}
    </View>
  );
}

// ---- Duration wheel picker ----

const DURATION_VALUES = Array.from({ length: 18 }, (_, i) => (i + 1) * 10); // [10, 20, ..., 180]
const ITEM_H = 40;
const VISIBLE_ITEMS = 5;

function DurationPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const index = DURATION_VALUES.indexOf(value);
    const idx = index >= 0 ? index : 0;
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: idx * ITEM_H, animated: false });
    }, 50);
    return () => clearTimeout(t);
  }, []);

  function onScrollEnd(e: any) {
    const index = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    const clamped = Math.max(0, Math.min(DURATION_VALUES.length - 1, index));
    onChange(DURATION_VALUES[clamped]);
  }

  return (
    <View style={pw.container}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        scrollEnabled
        nestedScrollEnabled
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        onMomentumScrollEnd={onScrollEnd}
        onScrollEndDrag={onScrollEnd}
        contentContainerStyle={{
          paddingTop: ITEM_H * Math.floor(VISIBLE_ITEMS / 2),
          paddingBottom: ITEM_H * Math.floor(VISIBLE_ITEMS / 2),
        }}
      >
        {DURATION_VALUES.map((min) => (
          <View key={min} style={[pw.item, { height: ITEM_H }]}>
            <Text style={[pw.itemText, value === min && pw.itemTextSelected]}>{min} min</Text>
          </View>
        ))}
      </ScrollView>
      <View style={pw.topFade} pointerEvents="none" />
      <View style={pw.centerHighlight} pointerEvents="none" />
      <View style={pw.bottomFade} pointerEvents="none" />
    </View>
  );
}

const pw = StyleSheet.create({
  container: {
    height: ITEM_H * VISIBLE_ITEMS,
    width: 160,
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: '#FAFAF8',
    borderWidth: 1,
    borderColor: '#EEEEEC',
    position: 'relative',
  },
  item: { alignItems: 'center', justifyContent: 'center' },
  itemText: { fontSize: 14, color: '#CCCCCC', fontWeight: '400' },
  itemTextSelected: { fontSize: 20, color: '#1A1A1A', fontWeight: '700' },
  topFade: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: ITEM_H * Math.floor(VISIBLE_ITEMS / 2),
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  bottomFade: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: ITEM_H * Math.floor(VISIBLE_ITEMS / 2),
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  centerHighlight: {
    position: 'absolute',
    top: ITEM_H * Math.floor(VISIBLE_ITEMS / 2),
    left: 16, right: 16, height: ITEM_H,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#EEEEEC',
  },
});

// ---- Main component ----

export default function NewSessionScreen() {
  const router = useRouter();
  const { journeyId: preselectedJourneyId, lockedJourney } = useLocalSearchParams<{ journeyId?: string; lockedJourney?: string }>();
  const isJourneyLocked = lockedJourney === 'true';
  const { bottom: safeBottom } = useSafeAreaInsets();

  const [step, setStep] = useState(1);
  const [vocab, setVocab] = useState<VocabFramework>('plain');
  const [chakraMapping, setChakraMapping] = useState(false);
  const [showDifferenceStep, setShowDifferenceStep] = useState(false);
  const [activeJourneys, setActiveJourneys] = useState<Journey[]>([]);
  const [linkedJourneyId, setLinkedJourneyId] = useState<string | null>(null);
  const [showJourneyPicker, setShowJourneyPicker] = useState(false);

  // Step 1
  const today = todayIso();
  const [sessionDate, setSessionDate] = useState(today);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [showCustomDuration, setShowCustomDuration] = useState(false);
  const [customDuration, setCustomDuration] = useState('');
  const [mainPractice, setMainPractice] = useState('');
  const [practiceSubtype, setPracticeSubtype] = useState('');
  const [otherPracticeText, setOtherPracticeText] = useState('');

  // Step 2+
  const [nervousState, setNervousState] = useState('');
  const [energeticShift, setEnergeticShift] = useState('');
  const [releaseQualities, setReleaseQualities] = useState<string[]>([]);
  const [emotionTags, setEmotionTags] = useState<string[]>([]);
  const [bodySensations, setBodySensations] = useState<BodySensation[]>([]);
  const [connectionType, setConnectionType] = useState('');
  const [connectionNote, setConnectionNote] = useState('');
  const [elaboration, setElaboration] = useState('');
  const [difference, setDifference] = useState('');

  const sessionIdRef = useRef<string | null>(null);

  const effectivePractice =
    mainPractice === 'Other'
      ? otherPracticeText
      : practiceSubtype
      ? `${mainPractice}: ${practiceSubtype}`
      : mainPractice;

  useEffect(() => {
    (async () => {
      const [profile, sessions, journeys] = await Promise.all([
        getProfile(), getSessions(), getActiveJourneys(),
      ]);
      setVocab(profile.vocabulary_framework);
      setChakraMapping(profile.chakra_mapping);
      setActiveJourneys(journeys);
      if (preselectedJourneyId) {
        setLinkedJourneyId(preselectedJourneyId);
      } else {
        const todays = journeys.filter(journeyIncludesToday);
        if (todays.length === 1) setLinkedJourneyId(todays[0].id);
      }
      if (sessions.length === 0) { setShowDifferenceStep(false); return; }
      if (journeys.length > 0) {
        const ids = new Set(journeys.map((j) => j.id));
        const count = sessions.filter((s) => s.session.journey_id && ids.has(s.session.journey_id)).length;
        setShowDifferenceStep(count > 0);
      } else {
        setShowDifferenceStep(true);
      }
    })();
  }, []);

  const hasSubtypes = !!PRACTICES_WITH_SUBTYPES[mainPractice];

  function nsLabel(key: string) {
    const state = NS_STATES.find((s) => s.key === key);
    if (!state) return key;
    return state.labels[vocab] ?? key;
  }

  const sessionTimestamp = isoToDate(sessionDate).toISOString();

  async function handleNsSelect(key: string) {
    setNervousState(key);
    const { session } = await createSession({
      nervous_system_state: key,
      journey_id: linkedJourneyId,
      practice_type: effectivePractice || null,
      duration_minutes: durationMinutes,
      created_at: sessionTimestamp,
    });
    sessionIdRef.current = session.id;
    setStep(3);
  }

  async function persistCurrent(overrides: Record<string, unknown> = {}) {
    if (!sessionIdRef.current) return;
    await updateSession(sessionIdRef.current, {
      practice_type: effectivePractice || null,
      duration_minutes: durationMinutes,
      journey_id: linkedJourneyId,
      created_at: sessionTimestamp,
      nervous_system_state: nervousState,
      energetic_shift: energeticShift || null,
      release_qualities: releaseQualities,
      emotion_tags: emotionTags,
      body_sensations: bodySensations,
      connection_type: connectionType || null,
      connection_note: connectionNote || null,
      elaboration_note: elaboration || null,
      difference_note: difference || null,
      ...overrides,
    });
  }

  async function next(overrides: Record<string, unknown> = {}) {
    await persistCurrent(overrides);
    setStep((s) => s + 1);
  }

  function back() {
    if (step === 1) { router.back(); return; }
    if (step === 3) { setStep(2); return; }
    setStep((s) => s - 1);
  }

  function toggleBodyRegion(key: string) {
    setBodySensations((prev) =>
      prev.some((b) => b.region === key)
        ? prev.filter((b) => b.region !== key)
        : [...prev, { region: key, quality: null }]
    );
  }

  function setBodyQuality(key: string, quality: string) {
    setBodySensations((prev) =>
      prev.map((b) => b.region === key ? { ...b, quality: b.quality === quality ? null : quality } : b)
    );
  }

  async function handleSave() {
    await persistCurrent();
    markSessionSaved(sessionIdRef.current ?? '');
    router.back();
  }

  // ── Step 1 ──
  if (step === 1) {
    return (
      <SafeAreaView style={ss.safe} edges={['top']}>
        <View style={ss.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={ss.closeBtn}>
            <Text style={ss.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={ss.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* Compact metadata pills */}
            <View style={ss.metadataPillsRow}>
              <TouchableOpacity
                style={ss.metadataPill}
                onPress={() => setShowDatePicker(!showDatePicker)}
                activeOpacity={0.75}
              >
                <MaterialCommunityIcons name="calendar-blank-outline" size={14} color="#666666" />
                <Text style={ss.metadataPillText}>{formatChipDate(sessionDate)}</Text>
              </TouchableOpacity>
              <View style={ss.metadataPill}>
                <MaterialCommunityIcons name="clock-outline" size={14} color="#666666" />
                <Text style={ss.metadataPillText}>{durationMinutes} min</Text>
              </View>
            </View>

            {showDatePicker && (
              <DateTimePicker
                value={isoToDate(sessionDate)}
                mode="date"
                display="inline"
                maximumDate={isoToDate(today)}
                onChange={(event, selectedDate) => {
                  setShowDatePicker(Platform.OS === 'ios' ? showDatePicker : false);
                  if (event.type === 'set' && selectedDate) {
                    setSessionDate(dateToIso(selectedDate));
                    if (Platform.OS !== 'ios') setShowDatePicker(false);
                  }
                }}
              />
            )}
            {showDatePicker && Platform.OS === 'ios' && (
              <TouchableOpacity style={ss.dateDoneBtn} onPress={() => setShowDatePicker(false)} activeOpacity={0.8}>
                <Text style={ss.dateDoneBtnText}>Done</Text>
              </TouchableOpacity>
            )}

            {/* Duration chips */}
            <Text style={ss.prompt}>How long was your practice?</Text>
            <View style={ss.durationGrid}>
              {[[10, 20], [30, 45], [60, 90]].map((row, rowIdx) => (
                <View key={rowIdx} style={ss.durationGridRow}>
                  {row.map((mins) => (
                    <TouchableOpacity
                      key={mins}
                      style={[ss.durationChip, durationMinutes === mins && !showCustomDuration && ss.durationChipSelected]}
                      onPress={() => { setDurationMinutes(mins); setShowCustomDuration(false); }}
                      activeOpacity={0.75}
                    >
                      <Text style={[ss.durationChipText, durationMinutes === mins && !showCustomDuration && ss.durationChipTextSelected]}>
                        {mins} min
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
              <TouchableOpacity
                style={[ss.durationChipCustom, showCustomDuration && ss.durationChipSelected]}
                onPress={() => setShowCustomDuration(!showCustomDuration)}
                activeOpacity={0.75}
              >
                <Text style={[ss.durationChipText, showCustomDuration && ss.durationChipTextSelected]}>
                  Custom
                </Text>
              </TouchableOpacity>
            </View>

            {showCustomDuration && (
              <View style={ss.customDurationRow}>
                <TextInput
                  style={ss.customDurationInput}
                  placeholder="Enter minutes"
                  placeholderTextColor="#999999"
                  keyboardType="number-pad"
                  value={customDuration}
                  onChangeText={(text) => {
                    setCustomDuration(text);
                    const num = parseInt(text, 10);
                    if (!isNaN(num) && num > 0) setDurationMinutes(num);
                  }}
                  returnKeyType="done"
                />
              </View>
            )}

            {/* Journey selector */}
            {!isJourneyLocked && activeJourneys.length > 0 && (
              <View style={ss.journeySelectorRow}>
                <TouchableOpacity
                  style={ss.journeyPill}
                  onPress={() => setShowJourneyPicker(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[ss.journeyPillText, !linkedJourneyId && { opacity: 0.6 }]}>
                    {activeJourneys.find((j) => j.id === linkedJourneyId)?.name ?? 'No journey selected'}
                  </Text>
                  <MaterialCommunityIcons name="chevron-down" size={16} color="#B07FFF" />
                </TouchableOpacity>
              </View>
            )}
            {!isJourneyLocked && activeJourneys.length === 0 && (
              <View style={ss.noJourneyRow}>
                <Text style={ss.noJourneyText}>No active journey</Text>
                <TouchableOpacity onPress={() => router.push('/new-journey')} activeOpacity={0.7}>
                  <Text style={ss.createJourneyLink}>+ Create Journey</Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={ss.prompt}>What type of practice?</Text>
            <View style={ss.practiceList}>
              {ALL_PRACTICES.map((p, idx, arr) => {
                const sel = mainPractice === p;
                const subtypes = PRACTICES_WITH_SUBTYPES[p];
                return (
                  <React.Fragment key={p}>
                    <TouchableOpacity
                      style={ss.practiceRow}
                      onPress={() => {
                        if (mainPractice === p) { setMainPractice(''); setPracticeSubtype(''); }
                        else { setMainPractice(p); setPracticeSubtype(''); }
                      }}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons
                        name={(PRACTICE_ICONS[p] ?? 'circle-outline') as any}
                        size={22}
                        color={PRACTICE_COLOR}
                      />
                      <Text style={[ss.practiceRowLabel, sel && ss.practiceRowLabelSelected]}>{p}</Text>
                      {sel ? (
                        <View style={ss.practiceCheck}>
                          <Text style={ss.practiceCheckMark}>✓</Text>
                        </View>
                      ) : (
                        <MaterialCommunityIcons name="chevron-right" size={18} color="#CCCCCC" />
                      )}
                    </TouchableOpacity>
                    {idx < arr.length - 1 && <View style={ss.practiceDivider} />}

                    {sel && subtypes && (
                      <View style={ss.subtypeSection}>
                        <View style={ss.chipRow}>
                          {subtypes.map((sub) => (
                            <TouchableOpacity
                              key={sub}
                              style={[ss.subtypeChip, practiceSubtype === sub && ss.subtypeChipSelected]}
                              onPress={() => setPracticeSubtype(practiceSubtype === sub ? '' : sub)}
                              activeOpacity={0.7}
                            >
                              <Text style={[ss.subtypeChipText, practiceSubtype === sub && ss.subtypeChipTextSelected]}>{sub}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    )}

                    {sel && p === 'Other' && (
                      <View style={ss.subtypeSection}>
                        <TextInput
                          style={[ss.textArea, { minHeight: 48 }]}
                          placeholder="Describe your practice…"
                          placeholderTextColor="#999999"
                          value={otherPracticeText}
                          onChangeText={setOtherPracticeText}
                          returnKeyType="done"
                        />
                      </View>
                    )}
                  </React.Fragment>
                );
              })}
            </View>
            <View style={{ height: 80 }} />
          </ScrollView>
          <View style={[ss.footerDots, { paddingBottom: Math.max(safeBottom + 16, 32) }]}>
            <ProgressDots current={1} />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <TouchableOpacity style={ss.nextBtn} onPress={() => setStep(2)} activeOpacity={0.85}>
                <Text style={ss.nextBtnText}>Next</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Step 2 — NS state ──
  if (step === 2) {
    return (
      <SafeAreaView style={ss.safe} edges={['top']}>
        <View style={ss.topBar}>
          <TouchableOpacity onPress={back} style={ss.backBtn}><Text style={ss.backBtnText}>‹</Text></TouchableOpacity>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: Math.max(safeBottom + 16, 32) }} showsVerticalScrollIndicator={false}>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Text style={ss.prompt}>How does your nervous system feel after this session?</Text>
            <View style={{ gap: 12 }}>
              {NS_STATES.map((st) => {
                const sel = nervousState === st.key;
                const wellnessTone = WELLNESS_TONES[st.key] ?? st.color;
                return (
                  <TouchableOpacity
                    key={st.key}
                    style={sel ? [ss.nsStackedCard, ss.nsStackedCardSelected, { borderColor: wellnessTone, backgroundColor: st.key === 'grounded' ? '#EDF5F0' : st.key === 'activated' ? '#FBF5E8' : '#EEEAF5' }] : ss.nsStackedCard}
                    onPress={() => handleNsSelect(st.key)}
                    activeOpacity={1}
                  >
                    <View style={ss.nsStackedCardContent}>
                      <View style={[ss.nsStackedDot, { backgroundColor: wellnessTone }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={[ss.nsStackedStateName, { color: sel ? wellnessTone : '#1A1A1A' }]}>{st.labels[vocab]}</Text>
                      </View>
                      {sel && (
                        <View style={[ss.nsCheckBadge, { backgroundColor: wellnessTone, position: 'relative', top: 0, right: 0 }]}>
                          <Text style={ss.nsCheckBadgeMark}>✓</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ScrollView>
        <View style={[ss.footerDots, { paddingBottom: Math.max(safeBottom + 16, 32) }]}>
          <ProgressDots current={2} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Step 3 — Energetic shift ──
  if (step === 3) {
    return (
      <SafeAreaView style={ss.safe} edges={['top']}>
        <View style={ss.topBar}>
          <TouchableOpacity onPress={back} style={ss.backBtn}><Text style={ss.backBtnText}>‹</Text></TouchableOpacity>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: Math.max(safeBottom + 16, 32) }} showsVerticalScrollIndicator={false}>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Text style={ss.prompt}>Did something move or release?</Text>
            <View style={{ gap: 12 }}>
              {SHIFT_OPTIONS.map((opt) => {
                const sel = energeticShift === opt.label;
                return (
                  <TouchableOpacity
                    key={opt.label}
                    style={sel ? [ss.nsStackedCard, ss.nsStackedCardSelected, { borderColor: opt.color, backgroundColor: opt.label === 'Something released' ? '#EBF3F8' : opt.label === 'Something shifted' ? '#F0EBF8' : '#F5F5F5' }] : ss.nsStackedCard}
                    onPress={() => setEnergeticShift(sel ? '' : opt.label)}
                    activeOpacity={1}
                  >
                    <View style={ss.nsStackedCardContent}>
                      <View style={[ss.nsStackedDot, { backgroundColor: opt.color }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={[ss.nsStackedStateName, { color: sel ? opt.color : '#1A1A1A' }]}>{opt.label}</Text>
                      </View>
                      {sel && (
                        <View style={[ss.nsCheckBadge, { backgroundColor: opt.color, position: 'relative', top: 0, right: 0 }]}>
                          <Text style={ss.nsCheckBadgeMark}>✓</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            {(energeticShift === 'Something released' || energeticShift === 'Something shifted') && (
              <View style={ss.qualitySection}>
                <Text style={ss.qualityLabel}>WHAT SENSATION DID YOU EXPERIENCE?</Text>
                <View style={ss.chipRow}>
                  {SHIFT_QUALITIES.map((q) => (
                    <TouchableOpacity
                      key={q.key}
                      style={[ss.chip, releaseQualities.includes(q.key) && ss.chipSelected]}
                      onPress={() => setReleaseQualities((prev) =>
                        prev.includes(q.key) ? prev.filter((x) => x !== q.key) : [...prev, q.key]
                      )}
                      activeOpacity={0.7}
                    >
                      <Text style={[ss.chipText, releaseQualities.includes(q.key) && ss.chipTextSelected]}>{q.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>
          <View style={{ paddingTop: 20 }}>
            <ProgressDots current={3} />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 }}>
              <TouchableOpacity style={ss.nextBtn} onPress={() => next()} activeOpacity={0.85}>
                <Text style={ss.nextBtnText}>Next</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Step 4 — Emotion tags ──
  if (step === 4) {
    return (
      <SafeAreaView style={ss.safe} edges={['top']}>
        <View style={ss.topBar}>
          <TouchableOpacity onPress={back} style={ss.backBtn}><Text style={ss.backBtnText}>‹</Text></TouchableOpacity>
        </View>
        <View style={{ flex: 1 }}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={[ss.body, { paddingBottom: Math.max(safeBottom + 80, 100) }]} showsVerticalScrollIndicator={false}>
            <Text style={ss.prompt}>What was emotionally present?</Text>

            {EMOTION_CLUSTERS.map((cluster) => (
              <View key={cluster.name} style={[ss.clusterBlock, { backgroundColor: hexToRgba(cluster.text, 0.04) }]}>
                <Text style={[ss.clusterName, { color: cluster.text }]}>{cluster.name.toUpperCase()}</Text>
                <View style={ss.chipRow}>
                  {cluster.tags.map((tag) => {
                    const sel = emotionTags.includes(tag);
                    return (
                      <TouchableOpacity
                        key={tag}
                        style={[ss.emotionChip, {
                          backgroundColor: sel ? hexToRgba(cluster.text, 0.12) : '#FFFFFF',
                          borderColor: sel ? cluster.text : '#EEEEEC',
                        }]}
                        onPress={() => setEmotionTags((prev) =>
                          sel ? prev.filter((x) => x !== tag) : [...prev, tag]
                        )}
                        activeOpacity={0.7}
                      >
                        <Text style={[ss.emotionChipText, { color: sel ? cluster.text : '#1A1A1A' }]}>
                          {tag.charAt(0).toUpperCase() + tag.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
            <View style={{ height: 12 }} />
            <ProgressDots current={4} />
            <TouchableOpacity style={ss.nextBtnInline} onPress={() => next()} activeOpacity={0.85}>
              <Text style={ss.nextBtnText}>Next</Text>
            </TouchableOpacity>
          </ScrollView>
          <View style={ss.bottomFadeGradient} pointerEvents="none">
            <LinearGradient colors={['rgba(255,255,255,0)', '#FFFFFF']} style={{ flex: 1 }} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Step 5 — Body sensations ──
  if (step === 5) {
    return (
      <SafeAreaView style={ss.safe} edges={['top']}>
        <View style={ss.topBar}>
          <TouchableOpacity onPress={back} style={ss.backBtn}><Text style={ss.backBtnText}>‹</Text></TouchableOpacity>
        </View>
        <View style={{ flex: 1 }}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={[ss.body, { paddingBottom: Math.max(safeBottom + 80, 100) }]} showsVerticalScrollIndicator={false}>
            <Text style={ss.prompt}>Where in the body did you feel these sensations?</Text>
            <View style={ss.practiceList}>
              {BODY_REGIONS_SORTED.map((r, idx) => {
                const active = bodySensations.some((b) => b.region === r.key);
                const bs = bodySensations.find((b) => b.region === r.key);
                return (
                  <React.Fragment key={r.key}>
                    <TouchableOpacity
                      style={ss.practiceRow}
                      onPress={() => toggleBodyRegion(r.key)}
                      activeOpacity={0.7}
                    >
                      <View style={[ss.bodyRegionDot, { backgroundColor: r.color }]} />
                      <Text style={[ss.practiceRowLabel, active && { color: r.color, fontWeight: '600' }]}>{r.label}</Text>
                      {chakraMapping && <Text style={ss.bodyChakraLabel}>{r.chakra}</Text>}
                      {active ? (
                        <View style={[ss.practiceCheck, { backgroundColor: r.color }]}>
                          <Text style={ss.practiceCheckMark}>✓</Text>
                        </View>
                      ) : (
                        <MaterialCommunityIcons name="chevron-right" size={18} color="#CCCCCC" />
                      )}
                    </TouchableOpacity>
                    {idx < BODY_REGIONS_SORTED.length - 1 && <View style={ss.practiceDivider} />}

                    {active && bs && (
                      <View style={ss.subtypeSection}>
                        <Text style={ss.qualityLabel}>WHAT DID YOU EXPERIENCE?</Text>
                        <View style={ss.chipRow}>
                          {r.qualities.map((q) => {
                            const lq = q.toLowerCase();
                            const qsel = bs.quality === lq;
                            return (
                              <TouchableOpacity
                                key={q}
                                style={[ss.chip, qsel && { backgroundColor: r.color, borderColor: r.color }]}
                                onPress={() => setBodyQuality(r.key, lq)}
                                activeOpacity={0.7}
                              >
                                <Text style={[ss.chipText, qsel && ss.chipTextSelected]}>{q}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    )}
                  </React.Fragment>
                );
              })}
            </View>
            <View style={{ height: 12 }} />
            <ProgressDots current={5} />
            <TouchableOpacity style={ss.nextBtnInline} onPress={() => next()} activeOpacity={0.85}>
              <Text style={ss.nextBtnText}>Next</Text>
            </TouchableOpacity>
          </ScrollView>
          <View style={ss.bottomFadeGradient} pointerEvents="none">
            <LinearGradient colors={['rgba(255,255,255,0)', '#FFFFFF']} style={{ flex: 1 }} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Step 6 — Connected to something? ──
  if (step === 6) {
    return (
      <SafeAreaView style={ss.safe} edges={['top']}>
        <View style={ss.topBar}>
          <TouchableOpacity onPress={back} style={ss.backBtn}><Text style={ss.backBtnText}>‹</Text></TouchableOpacity>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: Math.max(safeBottom + 80, 100) }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Text style={ss.connectionPrompt}>Are these sensations associated with something specific that came up?</Text>
            <View style={ss.optionList}>
              {CONNECTION_OPTIONS.map((opt) => {
                const sel = connectionType === opt.key;
                return (
                  <View key={opt.key}>
                    <TouchableOpacity
                      style={[ss.connectionRow, sel && { borderColor: opt.color, borderWidth: 2, backgroundColor: hexToRgba(opt.color, 0.12) }]}
                      onPress={() => setConnectionType(sel ? '' : opt.key)}
                      activeOpacity={1}
                    >
                      <View style={[ss.nsStackedDot, { backgroundColor: opt.color }]} />
                      <Text style={[ss.connectionRowText, sel && { color: opt.color }]}>{opt.label}</Text>
                      {sel && (
                        <View style={[ss.nsCheckBadge, { backgroundColor: opt.color, position: 'relative', top: 0, right: 0 }]}>
                          <Text style={ss.nsCheckBadgeMark}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                    {sel && opt.key === 'tied_to_something' && (
                      <TextInput
                        style={[ss.textArea, { marginTop: 8 }]}
                        placeholder="Optional — just for you"
                        placeholderTextColor="#999999"
                        value={connectionNote}
                        onChangeText={setConnectionNote}
                        multiline
                        textAlignVertical="top"
                      />
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>
        <View style={[ss.footerDots, { paddingBottom: Math.max(safeBottom + 16, 32) }]}>
          <ProgressDots current={6} />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
            <TouchableOpacity style={ss.nextBtn} onPress={() => next()} activeOpacity={0.85}>
              <Text style={ss.nextBtnText}>Next</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Step 7 — Any final notes? (merged elaboration + difference) ──
  if (step === 7) {
    return (
      <SafeAreaView style={ss.safe} edges={['top']}>
        <View style={ss.topBar}>
          <TouchableOpacity onPress={back} style={ss.backBtn}><Text style={ss.backBtnText}>‹</Text></TouchableOpacity>
        </View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={ss.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={ss.prompt}>Any final notes?</Text>
            <View style={ss.noteCard}>
              <Text style={ss.noteCardLabel}>IN THIS MOMENT</Text>
              <TextInput
                style={[ss.textArea, { minHeight: 120, borderWidth: 0, backgroundColor: 'transparent', padding: 0 }]}
                placeholder="Write or dictate freely…"
                placeholderTextColor="#999999"
                value={elaboration}
                onChangeText={setElaboration}
                multiline
                textAlignVertical="top"
              />
            </View>
            {showDifferenceStep && (
              <View style={ss.noteCard}>
                <Text style={ss.noteCardLabel}>SINCE LAST TIME</Text>
                <TextInput
                  style={[ss.textArea, { minHeight: 120, borderWidth: 0, backgroundColor: 'transparent', padding: 0 }]}
                  placeholder="What feels different from last time? (optional)"
                  placeholderTextColor="#999999"
                  value={difference}
                  onChangeText={setDifference}
                  multiline
                  textAlignVertical="top"
                />
              </View>
            )}
          </ScrollView>
          <View style={[ss.footerDots, { paddingBottom: Math.max(safeBottom + 16, 32) }]}>
            <ProgressDots current={7} />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <TouchableOpacity style={ss.nextBtn} onPress={() => next()} activeOpacity={0.85}>
                <Text style={ss.nextBtnText}>Next</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Review ──
  const nsState = NS_STATES.find((s) => s.key === nervousState);
  const linkedJourney = activeJourneys.find((j) => j.id === linkedJourneyId) ?? null;

  return (
    <SafeAreaView style={ss.safe} edges={['top']}>
      <View style={ss.topBar}>
        <TouchableOpacity onPress={back} style={ss.backBtn}><Text style={ss.backBtnText}>‹</Text></TouchableOpacity>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={ss.body} showsVerticalScrollIndicator={false}>
        <Text style={ss.detailsLabel}>Details</Text>

        {/* Practice */}
        <View style={ss.summaryCard}>
          <Text style={ss.summaryCardLabel}>PRACTICE</Text>
          <Text style={ss.summaryCardValue}>{formatChipDate(sessionDate)} · {durationMinutes} min</Text>
          {effectivePractice ? <Text style={ss.summaryCardSub}>{effectivePractice}</Text> : null}
          {nsState && (
            <View style={[ss.statePill, { backgroundColor: hexToRgba(nsState.color, 0.14) }]}>
              <Text style={[ss.statePillText, { color: nsState.color }]}>{nsLabel(nervousState)}</Text>
            </View>
          )}
        </View>

        {/* What moved */}
        <View style={ss.summaryCard}>
          <Text style={ss.summaryCardLabel}>WHAT MOVED</Text>
          <Text style={ss.summaryCardValue}>{energeticShift || '—'}</Text>
          {releaseQualities.length > 0 && (
            <Text style={ss.summaryCardSub}>{releaseQualities.join(', ')}</Text>
          )}
        </View>

        {/* Emotions */}
        <View style={ss.summaryCard}>
          <Text style={ss.summaryCardLabel}>EMOTIONS</Text>
          {emotionTags.length > 0 ? (
            <View style={ss.chipRow}>
              {emotionTags.map((t) => {
                const cluster = EMOTION_CLUSTERS.find((c) => c.tags.includes(t.toLowerCase()));
                const chipBg = cluster ? cluster.text + '1A' : '#F0F0F0';
                const chipText = cluster ? cluster.text : '#666666';
                return (
                  <View key={t} style={[ss.emotionChip, { backgroundColor: chipBg, borderColor: chipText, borderWidth: 1 }]}>
                    <Text style={[ss.emotionChipText, { color: chipText }]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={[ss.summaryCardValue, { fontStyle: 'italic', color: '#999999' }]}>—</Text>
          )}
        </View>

        {/* Body */}
        <View style={ss.summaryCard}>
          <Text style={ss.summaryCardLabel}>BODY</Text>
          {bodySensations.length > 0 ? (
            <View style={{ gap: 8, marginTop: 4 }}>
              {bodySensations.map((b, idx) => {
                const r = BODY_REGIONS.find((x) => x.key === b.region);
                return (
                  <View key={idx} style={ss.bodyRegionRow}>
                    <View style={[ss.bodyRegionDotReview, { backgroundColor: r?.color || '#CCCCCC' }]} />
                    <Text style={ss.summaryCardValue}>
                      {r?.label}{b.quality ? ` (${b.quality})` : ''}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={ss.summaryCardValue}>—</Text>
          )}
        </View>

        {/* Notes */}
        <View style={ss.summaryCard}>
          <Text style={ss.summaryCardLabel}>NOTES</Text>
          {connectionType ? (
            <Text style={ss.summaryCardSub}>
              {CONNECTION_OPTIONS.find((o) => o.key === connectionType)?.label}
              {connectionNote ? ` — ${connectionNote}` : ''}
            </Text>
          ) : null}
          <Text style={ss.summaryCardValue}>{elaboration.trim() || '—'}</Text>
          {showDifferenceStep && difference.trim() ? (
            <Text style={ss.summaryCardSub}>{difference}</Text>
          ) : null}
        </View>

        {/* Journey */}
        <View style={ss.summaryCard}>
          <Text style={ss.summaryCardLabel}>JOURNEY</Text>
          <Text style={ss.summaryCardValue}>{linkedJourney ? linkedJourney.name : 'Not linked'}</Text>
        </View>
      </ScrollView>
      <View style={[ss.footer, { paddingBottom: Math.max(safeBottom + 16, 32), alignItems: 'center' }]}>
        <TouchableOpacity style={ss.saveBtn} onPress={handleSave} activeOpacity={0.85}>
          <Text style={ss.saveBtnText}>Save session</Text>
        </TouchableOpacity>
      </View>

      {/* Journey picker */}
      <BottomSheet visible={showJourneyPicker} onDismiss={() => setShowJourneyPicker(false)}>
        <View style={ss.journeyPickerSheet}>
          <TouchableOpacity
            style={ss.journeyPickerOption}
            onPress={() => { setLinkedJourneyId(null); setShowJourneyPicker(false); }}
            activeOpacity={0.7}
          >
            <Text style={ss.journeyPickerOptionText}>No journey</Text>
            {linkedJourneyId === null && <MaterialCommunityIcons name="check" size={20} color="#B07FFF" />}
          </TouchableOpacity>
          {activeJourneys.map((journey) => (
            <TouchableOpacity
              key={journey.id}
              style={ss.journeyPickerOption}
              onPress={() => { setLinkedJourneyId(journey.id); setShowJourneyPicker(false); }}
              activeOpacity={0.7}
            >
              <Text style={ss.journeyPickerOptionText}>{journey.name}</Text>
              {linkedJourneyId === journey.id && <MaterialCommunityIcons name="check" size={20} color="#B07FFF" />}
            </TouchableOpacity>
          ))}
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

// ---- Styles ----
const ss = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
  },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 18, color: '#666666' },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backBtnText: { fontSize: 28, color: '#B07FFF', lineHeight: 32 },
  stepLabel: { fontSize: 12, color: '#999999', fontWeight: '500' },

  prompt: {
    fontSize: 18, fontFamily: 'DMSerifDisplay_400Regular', color: '#1A1A1A',
    marginBottom: 20, lineHeight: 26,
  },

  detailsLabel: {
    fontSize: 11, fontWeight: '600', color: '#999999',
    letterSpacing: 0.9, textTransform: 'uppercase', marginBottom: 12,
  },

  body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 },

  // Compact metadata pills
  metadataPillsRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  metadataPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FAFAF8', borderWidth: 1, borderColor: '#EEEEEC',
    borderRadius: 20, paddingHorizontal: 12, height: 36,
  },
  metadataPillText: { fontSize: 13, fontWeight: '500', color: '#666666' },

  // Duration chips
  durationGrid: { gap: 10, marginBottom: 20 },
  durationGridRow: { flexDirection: 'row', gap: 10 },
  durationChip: {
    flex: 1, height: 52, borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEEEEC',
    alignItems: 'center', justifyContent: 'center',
  },
  durationChipCustom: {
    height: 52, borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEEEEC',
    alignItems: 'center', justifyContent: 'center',
  },
  durationChipSelected: {
    backgroundColor: '#F2EEF9',
    borderColor: '#B07FFF',
    borderWidth: 1.5,
  },
  durationChipText: { fontSize: 15, fontWeight: '600', color: '#1A1A1A', fontFamily: 'Nunito_600SemiBold' },
  durationChipTextSelected: { color: '#B07FFF' },

  // Custom duration input
  customDurationRow: { marginBottom: 20 },
  customDurationInput: {
    height: 44, paddingHorizontal: 16, borderRadius: 12,
    backgroundColor: '#FAFAF8', borderWidth: 1, borderColor: '#EEEEEC',
    fontSize: 15, fontWeight: '400', color: '#1A1A1A',
  },

  // Date picker dismiss button
  dateDoneBtn: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 20, marginBottom: 12 },
  dateDoneBtnText: { fontSize: 15, fontWeight: '600', color: PRACTICE_COLOR },

  // Vertical practice list (Step 1 + Step 5 share this row pattern)
  practiceList: { gap: 0 },
  practiceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    minHeight: 48, paddingVertical: 8,
  },
  practiceRowLabel: { flex: 1, fontSize: 15, fontWeight: '400', color: '#1A1A1A' },
  practiceRowLabelSelected: { fontWeight: '600', color: PRACTICE_COLOR },
  practiceDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#EEEEEC' },
  practiceCheck: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: PRACTICE_COLOR,
    alignItems: 'center', justifyContent: 'center',
  },
  practiceCheckMark: { fontSize: 12, color: '#FFFFFF', fontWeight: '700' },

  bodyRegionDot: { width: 12, height: 12, borderRadius: 6, flexShrink: 0 },
  bodyChakraLabel: { fontSize: 11, color: '#999999' },

  bodyRegionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bodyRegionDotReview: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },

  subtypeSection: {
    marginTop: 4, marginBottom: 12, paddingTop: 10, paddingLeft: 36,
  },
  subtypeChip: {
    paddingHorizontal: 11, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EEEEEC',
  },
  subtypeChipSelected: {
    backgroundColor: '#F2EEF9',
    borderColor: PRACTICE_COLOR,
    borderWidth: 1.5,
  },
  subtypeChipText: { fontSize: 12, fontWeight: '500', color: '#1A1A1A' },
  subtypeChipTextSelected: { color: PRACTICE_COLOR },

  // Date chip / journey link
  journeyToggleRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FAFAF8', borderWidth: 1, borderColor: '#EEEEEC',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 16, gap: 12,
  },
  journeyToggleSelected: { borderColor: PRACTICE_COLOR, backgroundColor: '#F6F0FF' },
  journeyToggleName: { fontSize: 15, fontWeight: '500', color: '#1A1A1A' },
  journeyToggleSub: { fontSize: 12, color: '#999999', marginTop: 2 },
  journeyCheckbox: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#EEEEEC',
    alignItems: 'center', justifyContent: 'center',
  },
  journeyCheckboxChecked: { backgroundColor: PRACTICE_COLOR, borderColor: PRACTICE_COLOR },
  journeyCheckmark: { fontSize: 13, color: '#FFFFFF', fontWeight: '700' },

  // Step 2 stacked cards
  nsStackedCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1.5, borderColor: '#EEEEEC',
    paddingHorizontal: 20, paddingVertical: 18,
    shadowColor: '#1A1A1A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },
  nsStackedCardSelected: {
    borderWidth: 2,
    shadowOpacity: 0.10,
  },
  nsStackedCardContent: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  nsStackedDot: {
    width: 12, height: 12, borderRadius: 6,
  },
  nsStackedStateName: {
    fontSize: 16, fontWeight: '600',
  },

  // Step 2/3 cards (legacy - keeping for Step 3)
  nsIconRow: { flexDirection: 'row', gap: 12 },
  nsIconCard: {
    flex: 1, minHeight: 110, borderRadius: 16, borderWidth: 2, borderColor: 'transparent',
    backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center', padding: 16, gap: 10,
    position: 'relative',
    shadowColor: '#1A1A1A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },
  nsIconCardFull: { flex: 0, width: '50%' },
  nsCheckBadge: {
    position: 'absolute', top: 10, right: 10,
    width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  nsCheckBadgeMark: { fontSize: 11, color: '#FFFFFF', fontWeight: '700' },
  nsIconCardText: { fontSize: 14, fontWeight: '600', textAlign: 'center' },

  shiftRow: { flexDirection: 'row', gap: 12 },

  body_unused: {},

  optionList: { gap: 12 },

  // Connection step (step 6)
  connectionPrompt: {
    fontSize: 20, fontFamily: 'DMSerifDisplay_400Regular', color: '#1A1A1A',
    marginBottom: 24, lineHeight: 28, textAlign: 'center',
  },
  connectionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EEEEEC',
    borderRadius: 16, paddingVertical: 18, paddingHorizontal: 20,
    shadowColor: '#1A1A1A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },
  connectionRowText: {
    flex: 1, fontSize: 16, fontFamily: 'DMSans_500Medium', fontWeight: '500', color: '#1A1A1A',
  },

  qualitySection: { marginTop: 16 },
  qualityLabel: {
    fontSize: 10, fontWeight: '500', color: '#999999',
    letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 8,
  },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, minHeight: 44, justifyContent: 'center',
    backgroundColor: '#FAFAF8', borderWidth: 1, borderColor: '#EEEEEC',
  },
  chipSelected: { backgroundColor: '#B07FFF', borderColor: '#B07FFF' },
  chipText: { fontSize: 13, fontWeight: '500', color: '#1A1A1A' },
  chipTextSelected: { color: '#FFFFFF' },

  clusterBlock: { marginBottom: 14, borderRadius: 12, padding: 12 },
  clusterName: {
    fontSize: 11, fontWeight: '700',
    letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 8,
  },
  emotionChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, minHeight: 44, justifyContent: 'center' },
  emotionChipText: { fontSize: 13, fontWeight: '500' },

  textArea: {
    backgroundColor: '#FAFAF8', borderWidth: 1, borderColor: '#EEEEEC',
    borderRadius: 10, padding: 14, fontSize: 15, color: '#1A1A1A',
    lineHeight: 22, minHeight: 100,
  },

  noteCard: {
    backgroundColor: '#FAFAF8', borderWidth: 1, borderColor: '#EEEEEC',
    borderRadius: 12, padding: 14, marginBottom: 12,
  },
  noteCardLabel: {
    fontSize: 10, fontWeight: '500', color: '#999999',
    letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 8,
  },

  // Review screen — stacked summary cards
  summaryCard: {
    backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#EEEEEC',
    padding: 16, marginBottom: 10,
    shadowColor: '#1A1A1A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1,
  },
  summaryCardLabel: {
    fontSize: 11, fontWeight: '600', color: '#999999',
    letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 6,
  },
  summaryCardValue: { fontSize: 15, color: '#1A1A1A', lineHeight: 21 },
  summaryCardSub: { fontSize: 13, color: '#666666', marginTop: 4, lineHeight: 19 },
  statePill: {
    alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginTop: 10,
  },
  statePillText: { fontSize: 13, fontWeight: '600' },
  summaryTag: {
    backgroundColor: '#F5F2F9', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  summaryTagText: { fontSize: 12, fontWeight: '500', color: '#9B7FBF' },

  footer: {
    paddingHorizontal: 24, paddingTop: 12, backgroundColor: '#FFFFFF',
    flexDirection: 'row', justifyContent: 'flex-end',
  },
  footerDots: {
    paddingHorizontal: 24, paddingTop: 8, backgroundColor: '#FFFFFF',
  },
  nextBtn: {
    backgroundColor: '#B07FFF', borderRadius: 24, height: 48, minWidth: 120, paddingHorizontal: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  nextBtnInline: {
    alignSelf: 'flex-end',
    backgroundColor: '#B07FFF', borderRadius: 24, height: 48, minWidth: 120, paddingHorizontal: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  nextBtnText: { fontSize: 15, fontWeight: '500', color: '#FFFFFF' },

  // Progress dots
  progressDots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 12 },
  progressDotCurrent: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#B07FFF' },
  progressDotCompleted: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(176,127,255,0.4)' },
  progressDotFuture: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E0E0E0' },

  // Fade gradient overlay for inline-button steps
  bottomFadeGradient: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 40,
  },
  saveBtn: {
    backgroundColor: '#B07FFF', borderRadius: 28, height: 56, width: 200,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },

  // Journey selector
  journeySelectorRow: { marginBottom: 16 },
  journeyPill: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', height: 52,
    backgroundColor: 'rgba(176, 127, 255, 0.12)', borderRadius: 16,
    borderWidth: 1.5, borderColor: '#B07FFF',
    paddingHorizontal: 16,
  },
  journeyPillText: { fontSize: 15, fontWeight: '500', color: '#B07FFF', fontFamily: 'Nunito_500Medium', flex: 1 },
  noJourneyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16,
  },
  noJourneyText: { fontSize: 13, color: '#999999', fontFamily: 'Nunito_400Regular' },
  createJourneyLink: { fontSize: 13, color: '#B07FFF', fontWeight: '500', fontFamily: 'Nunito_500Medium' },
  journeyPickerSheet: { paddingTop: 4 },
  journeyPickerOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingVertical: 16, minHeight: 56,
  },
  journeyPickerOptionText: { fontSize: 16, fontWeight: '500', color: '#1A1A1A' },
});
