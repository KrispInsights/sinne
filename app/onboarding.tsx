import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Modal, FlatList, KeyboardAvoidingView, Platform, Switch,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { updateProfile, createJourney, getProfile } from '@/lib/storage';
import type { Profile } from '@/lib/types';

// ---- Data ----

const AGE_RANGES = ['Under 25', '25–34', '35–44', '45–54', '55–64', '65+', 'Prefer not to say'];
const SEXES = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];

const COUNTRIES = [
  'Argentina','Australia','Austria','Belgium','Bolivia','Brazil','Canada','Chile','China',
  'Colombia','Costa Rica','Czech Republic','Denmark','Ecuador','Egypt','Finland','France',
  'Germany','Greece','Hungary','India','Indonesia','Ireland','Israel','Italy','Japan',
  'Jordan','Kenya','Malaysia','Mexico','Morocco','Netherlands','New Zealand','Nigeria',
  'Norway','Pakistan','Peru','Philippines','Poland','Portugal','Romania','Russia',
  'Saudi Arabia','Singapore','South Africa','South Korea','Spain','Sri Lanka','Sweden',
  'Switzerland','Taiwan','Thailand','Turkey','Ukraine','United Arab Emirates',
  'United Kingdom','United States','Uruguay','Venezuela','Vietnam','Prefer not to say',
];

const EXPERIENCE_LEVELS = [
  { id: 'beginner', label: 'Just starting out', sub: 'New to this, exploring' },
  { id: 'building', label: 'Want to dive deeper', sub: 'Some experience, going deeper' },
  { id: 'established', label: 'This is part of my life', sub: 'Inner work is a regular, significant part of my life' },
];

const PRACTICES = [
  'Breathwork','Dance / movement therapy','IFS / Internal Family Systems (Parts work)',
  'Meditation / Vipassana','Qi Gong / Tai Chi','Reiki / energy healing',
  'Somatic Experiencing','Sound healing','Trauma therapy (body-based)','Yoga',
  'Other','Not sure yet',
];

const PRACTICE_SUBTYPES: Record<string, string[]> = {
  'Breathwork': ['4-7-8 breathing','Box breathing','Circular breathing','Conscious connected breathing','Cyclic sighing','Holotropic-style breathing','Pranayama / yogic breathing','Presence Process (Michael Brown)','Rebirthing breathwork','Soma Breath','Somatic breathwork','Wim Hof method','Other'],
  'Dance / movement therapy': ['5Rhythms','Authentic movement','Contact improvisation','Ecstatic dance','Open Floor','Other'],
  'Meditation / Vipassana': ['Body scan','Loving-kindness (Metta)','Mindfulness (MBSR)','Nondual / Dzogchen','Transcendental meditation','Vipassana (S.N. Goenka)','Yoga Nidra / NSDR','Zen / Zazen','Other'],
  'Qi Gong / Tai Chi': ['Medical Qi Gong','Tai Chi Chuan','Zhan Zhuang (standing)','Other'],
  'Trauma therapy (body-based)': ['AEDP','Brainspotting','Compassionate Inquiry','EMDR','Gestalt','Hakomi','Sensorimotor psychotherapy','Somatic Experiencing (SE)','Other'],
  'Yoga': ['Ashtanga','Bikram / hot yoga','Hatha','Iyengar','Kundalini','Nidra','Power yoga','Restorative','Somatic yoga','Vinyasa / flow','Yin','Other'],
};

const GOALS = [
  'Deepening presence and awareness', 'Emotional release', 'General wellbeing',
  'Grief processing', 'Improving sleep', 'Managing anxiety',
  'Nervous system regulation', 'Physical performance and recovery', 'Presence',
  'Spiritual exploration', 'Supporting therapy or inner work',
  'Trauma healing and integration', 'Understanding my own patterns',
  "I'm not sure yet",
];

const VOCAB_OPTIONS = [
  { id: 'plain' as const, label: 'Neutral / plain language', states: ['Settled','Activated','Shutdown'] },
  { id: 'polyvagal' as const, label: 'Polyvagal', states: ['Ventral','Sympathetic','Dorsal'] },
  { id: 'ifs' as const, label: 'IFS / Internal Family Systems', states: ['Self','Activated part','Blended'] },
  { id: 'somatic' as const, label: 'Somatic', states: ['Settled','Activated','Shutdown'] },
];

const NS_COLORS = {
  settled: { bg: '#EAF5EF', text: '#2a6645', border: '#a8d5bc' },
  activated: { bg: '#FEF3EA', text: '#7a4020', border: '#f2c49a' },
  shutdown: { bg: '#EEEAF8', text: '#3d3565', border: '#c0b8e0' },
};

// ---- Sub-components ----

function ProgressDots({ current, total = 4 }: { current: number; total?: number }) {
  return (
    <View style={s.dots}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[s.dot, i + 1 === current && s.dotActive]} />
      ))}
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[s.chip, selected && s.chipSelected]}
    >
      <Text style={[s.chipText, selected && s.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ---- Main component ----

export default function OnboardingScreen() {
  const router = useRouter();
  const { bottom: safeBottom } = useSafeAreaInsets();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1
  const [name, setName] = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [sex, setSex] = useState('');
  const [country, setCountry] = useState('');
  const [countrySearch, setCountrySearch] = useState('');
  const [countryModalOpen, setCountryModalOpen] = useState(false);

  // Step 2
  const [experienceLevel, setExperienceLevel] = useState('');
  const [practices, setPractices] = useState<string[]>([]);
  const [subtypes, setSubtypes] = useState<Record<string, string[]>>({});

  // Step 3
  const [goals, setGoals] = useState<string[]>([]);

  // Step 4
  const [vocab, setVocab] = useState<Profile['vocabulary_framework']>('plain');
  const [chakra, setChakra] = useState(false);

  // Step 5 (journey)
  const [journeyName, setJourneyName] = useState('');
  const [journeyStartDate, setJourneyStartDate] = useState(new Date());
  const [journeyDuration, setJourneyDuration] = useState('');

  // ---- Helpers ----

  function canAdvanceStep1() {
    return name.trim().length > 0 && ageRange.length > 0 && sex.length > 0 && country.length > 0;
  }
  function canAdvanceStep2() {
    return experienceLevel.length > 0 && practices.length > 0;
  }
  function canAdvanceStep3() { return goals.length > 0; }

  function togglePractice(p: string) {
    if (p === 'Not sure yet') {
      setPractices(['Not sure yet']);
      setSubtypes({});
      return;
    }
    setPractices((prev) => {
      const without = prev.filter((x) => x !== 'Not sure yet');
      return without.includes(p) ? without.filter((x) => x !== p) : [...without, p];
    });
    if (!PRACTICE_SUBTYPES[p]) return;
    setSubtypes((prev) => {
      const next = { ...prev };
      if (next[p]) { delete next[p]; } else { next[p] = []; }
      return next;
    });
  }

  function toggleSubtype(practice: string, sub: string) {
    setSubtypes((prev) => {
      const current = prev[practice] ?? [];
      return { ...prev, [practice]: current.includes(sub) ? current.filter((x) => x !== sub) : [...current, sub] };
    });
  }

  function toggleGoal(g: string) {
    if (g === "I'm not sure yet") { setGoals(["I'm not sure yet"]); return; }
    setGoals((prev) => {
      const without = prev.filter((x) => x !== "I'm not sure yet");
      return without.includes(g) ? without.filter((x) => x !== g) : [...without, g];
    });
  }

  const filteredCountries = countrySearch.trim()
    ? COUNTRIES.filter((c) => c.toLowerCase().includes(countrySearch.toLowerCase()))
    : COUNTRIES;

  // ---- Save & complete ----

  async function completeOnboarding(createJourneyIfSet: boolean) {
    setSaving(true);
    const allPractices = [
      ...practices.filter((p) => p !== 'Not sure yet' && p !== 'Other'),
      ...Object.entries(subtypes).flatMap(([, subs]) => subs),
    ];
    await updateProfile({
      preferred_name: name.trim() || 'Friend',
      age_range: ageRange,
      sex,
      country,
      experience_level: experienceLevel,
      practices: allPractices,
      goals: goals,
      vocabulary_framework: vocab,
      chakra_mapping: chakra,
      onboarding_complete: true,
    });
    if (createJourneyIfSet && journeyName.trim()) {
      const startIso = journeyStartDate.toISOString().split('T')[0];
      const dur = parseInt(journeyDuration, 10);
      await createJourney({
        name: journeyName.trim(),
        start_date: startIso,
        duration_days: isNaN(dur) ? null : Math.min(dur, 90),
      });
    }
    router.replace('/(tabs)');
  }

  // ---- Date helpers ----
  function fmtDate(d: Date) {
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }
  function shiftDate(delta: number) {
    const d = new Date(journeyStartDate);
    d.setDate(d.getDate() + delta);
    const today = new Date(); today.setHours(23,59,59,999);
    if (d <= today) setJourneyStartDate(d);
  }

  // ---- Vocab preview ----
  const vocabOption = VOCAB_OPTIONS.find((v) => v.id === vocab)!;

  // ---- Render ----

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

        {/* ── STEP 1 ── */}
        {step === 1 && (
          <>
            <View style={s.header}>
              <ProgressDots current={1} />
              <Text style={s.title}>Tell us about yourself</Text>
              <Text style={s.subtitle}>This helps the Mirror give you more relevant reflections.</Text>
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={s.label}>PREFERRED NAME</Text>
              <TextInput
                style={s.input}
                placeholder="What should we call you?"
                placeholderTextColor="#c4b8a8"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                returnKeyType="done"
              />
              <Text style={[s.label, { marginTop: 20 }]}>AGE RANGE</Text>
              <View style={s.chipRow}>
                {AGE_RANGES.map((a) => <Chip key={a} label={a} selected={ageRange === a} onPress={() => setAgeRange(a)} />)}
              </View>
              <Text style={[s.label, { marginTop: 20 }]}>SEX</Text>
              <View style={s.chipRow}>
                {SEXES.map((x) => <Chip key={x} label={x} selected={sex === x} onPress={() => setSex(x)} />)}
              </View>
              <Text style={[s.label, { marginTop: 20 }]}>COUNTRY</Text>
              <TouchableOpacity style={s.input} onPress={() => setCountryModalOpen(true)} activeOpacity={0.7}>
                <Text style={country ? s.inputText : s.inputPlaceholder}>
                  {country || 'Select country'}
                </Text>
              </TouchableOpacity>
              <View style={{ height: 20 }} />
            </ScrollView>
            <View style={[s.footer, { paddingBottom: Math.max(safeBottom, 16) }]}>
              <TouchableOpacity
                style={[s.btn, !canAdvanceStep1() && s.btnDisabled]}
                disabled={!canAdvanceStep1()}
                onPress={() => setStep(2)}
                activeOpacity={0.85}
              >
                <Text style={[s.btnText, !canAdvanceStep1() && s.btnTextDisabled]}>Continue</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── STEP 2 ── */}
        {step === 2 && (
          <>
            <View style={s.header}>
              <TouchableOpacity style={s.back} onPress={() => setStep(1)}>
                <Text style={s.backArrow}>‹</Text>
              </TouchableOpacity>
              <ProgressDots current={2} />
              <Text style={s.title}>Your practice</Text>
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
              <Text style={s.label}>EXPERIENCE LEVEL</Text>
              {EXPERIENCE_LEVELS.map((e) => {
                const sel = experienceLevel === e.label;
                return (
                  <TouchableOpacity
                    key={e.id}
                    style={[s.card, sel && s.cardSelected]}
                    onPress={() => setExperienceLevel(e.label)}
                    activeOpacity={0.75}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[s.cardTitle, sel && s.cardTitleSelected]}>{e.label}</Text>
                      <Text style={s.cardSub}>{e.sub}</Text>
                    </View>
                    <View style={[s.cardRadio, sel && s.cardRadioSelected]}>
                      {sel && <MaterialCommunityIcons name="check" size={14} color="#B07FFF" />}
                    </View>
                  </TouchableOpacity>
                );
              })}
              <Text style={[s.label, { marginTop: 24 }]}>PRIMARY PRACTICE(S)</Text>
              <View style={s.chipRow}>
                {PRACTICES.map((p) => (
                  <Chip key={p} label={p} selected={practices.includes(p)} onPress={() => togglePractice(p)} />
                ))}
              </View>
              {practices.filter((p) => p !== 'Not sure yet' && p !== 'Other' && PRACTICE_SUBTYPES[p]).map((p) => (
                <View key={p} style={s.subtypeBlock}>
                  <Text style={s.subtypeLabel}>{p.toUpperCase()}, SUB-TYPES (OPTIONAL)</Text>
                  <View style={s.chipRow}>
                    {PRACTICE_SUBTYPES[p].map((sub) => (
                      <Chip key={sub} label={sub} selected={(subtypes[p] ?? []).includes(sub)} onPress={() => toggleSubtype(p, sub)} />
                    ))}
                  </View>
                </View>
              ))}
              <View style={{ height: 20 }} />
            </ScrollView>
            <View style={[s.footer, { paddingBottom: Math.max(safeBottom, 16) }]}>
              <TouchableOpacity
                style={[s.btn, !canAdvanceStep2() && s.btnDisabled]}
                disabled={!canAdvanceStep2()}
                onPress={() => setStep(3)}
                activeOpacity={0.85}
              >
                <Text style={[s.btnText, !canAdvanceStep2() && s.btnTextDisabled]}>Continue</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── STEP 3 ── */}
        {step === 3 && (
          <>
            <View style={s.header}>
              <TouchableOpacity style={s.back} onPress={() => setStep(2)}>
                <Text style={s.backArrow}>‹</Text>
              </TouchableOpacity>
              <ProgressDots current={3} />
              <Text style={s.title}>What are you tracking?</Text>
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
              <View style={s.chipRow}>
                {GOALS.map((g) => <Chip key={g} label={g} selected={goals.includes(g)} onPress={() => toggleGoal(g)} />)}
              </View>
              <View style={{ height: 20 }} />
            </ScrollView>
            <View style={[s.footer, { paddingBottom: Math.max(safeBottom, 16) }]}>
              <TouchableOpacity
                style={[s.btn, !canAdvanceStep3() && s.btnDisabled]}
                disabled={!canAdvanceStep3()}
                onPress={() => setStep(4)}
                activeOpacity={0.85}
              >
                <Text style={[s.btnText, !canAdvanceStep3() && s.btnTextDisabled]}>Continue</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── STEP 4 ── */}
        {step === 4 && (
          <>
            <View style={s.header}>
              <TouchableOpacity style={s.back} onPress={() => setStep(3)}>
                <Text style={s.backArrow}>‹</Text>
              </TouchableOpacity>
              <ProgressDots current={4} />
              <Text style={s.title}>How do you name what you feel?</Text>
              <Text style={s.subtitle}>You can change this at any time in Settings.</Text>
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
              {VOCAB_OPTIONS.map((v) => (
                <TouchableOpacity
                  key={v.id}
                  style={[s.card, vocab === v.id && s.cardSelected]}
                  onPress={() => setVocab(v.id)}
                  activeOpacity={0.75}
                >
                  <Text style={[s.cardTitle, vocab === v.id && s.cardTitleSelected]}>{v.label}</Text>
                  <Text style={s.cardSub}>{v.states.join(' · ')}</Text>
                </TouchableOpacity>
              ))}

              {/* Live preview */}
              <Text style={[s.label, { marginTop: 24 }]}>PREVIEW</Text>
              <View style={s.previewRow}>
                {[
                  { key: 'settled', label: vocabOption.states[0] },
                  { key: 'activated', label: vocabOption.states[1] },
                  { key: 'shutdown', label: vocabOption.states[2] },
                ].map(({ key, label }) => {
                  const c = NS_COLORS[key as keyof typeof NS_COLORS];
                  return (
                    <View key={key} style={[s.previewCard, { backgroundColor: c.bg, borderColor: c.border }]}>
                      <Text style={[s.previewCardText, { color: c.text }]}>{label}</Text>
                    </View>
                  );
                })}
              </View>

              {/* Chakra toggle */}
              <View style={s.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.toggleLabel}>Chakra body mapping</Text>
                  <Text style={s.toggleSub}>Show chakra centers alongside body regions.</Text>
                </View>
                <Switch
                  value={chakra}
                  onValueChange={setChakra}
                  trackColor={{ false: '#EAE4DC', true: '#6B5E4E' }}
                  thumbColor="#FFFFFF"
                />
              </View>
              <View style={{ height: 20 }} />
            </ScrollView>
            <View style={[s.footer, { paddingBottom: Math.max(safeBottom, 16) }]}>
              <TouchableOpacity style={s.btn} onPress={() => setStep(5)} activeOpacity={0.85}>
                <Text style={s.btnText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── STEP 5 (optional journey) ── */}
        {step === 5 && (
          <>
            <View style={s.header}>
              <TouchableOpacity style={s.back} onPress={() => setStep(4)}>
                <Text style={s.backArrow}>‹</Text>
              </TouchableOpacity>
              <View style={s.step5TitleRow}>
                <Text style={s.title}>Set up a Journey</Text>
                <View style={s.optionalBadge}><Text style={s.optionalBadgeText}>Optional</Text></View>
              </View>
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={s.infoBox}>
                <Text style={s.infoBoxTitle}>What's a Journey?</Text>
                <Text style={s.infoBoxBody}>
                  A Journey is any period of practice you want to track as a whole, a structured program, a personal commitment, or just a container you're holding for yourself.{'\n\n'}
                  Setting up a Journey doesn't create a schedule or track whether you showed up. It gives your reflection a sense of where you are in the arc.
                </Text>
              </View>
              <Text style={s.label}>JOURNEY NAME</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. 10-week breathwork program"
                placeholderTextColor="#c4b8a8"
                value={journeyName}
                onChangeText={setJourneyName}
                returnKeyType="done"
              />
              <Text style={[s.label, { marginTop: 20 }]}>START DATE</Text>
              <View style={s.dateRow}>
                <TouchableOpacity style={s.dateArrow} onPress={() => shiftDate(-1)}>
                  <Text style={s.dateArrowText}>‹</Text>
                </TouchableOpacity>
                <Text style={s.dateText}>{fmtDate(journeyStartDate)}</Text>
                <TouchableOpacity style={s.dateArrow} onPress={() => shiftDate(1)}>
                  <Text style={s.dateArrowText}>›</Text>
                </TouchableOpacity>
              </View>
              <Text style={[s.label, { marginTop: 20 }]}>DURATION (WEEKS, MAX 13)</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. 10"
                placeholderTextColor="#c4b8a8"
                value={journeyDuration}
                onChangeText={(v) => setJourneyDuration(v.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                returnKeyType="done"
              />
              <View style={{ height: 20 }} />
            </ScrollView>
            <View style={[s.footer, { paddingBottom: Math.max(safeBottom, 16), gap: 8 }]}>
              {journeyName.trim() ? (
                <TouchableOpacity
                  style={[s.btn, saving && s.btnDisabled]}
                  disabled={saving}
                  onPress={() => completeOnboarding(true)}
                  activeOpacity={0.85}
                >
                  <Text style={[s.btnText, saving && s.btnTextDisabled]}>Set up Journey & continue</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={[s.btn, s.btnSecondary]}
                onPress={() => completeOnboarding(false)}
                activeOpacity={0.85}
              >
                <Text style={s.btnSecondaryText}>Skip for now</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── Country picker modal ── */}
        <Modal visible={countryModalOpen} animationType="slide" presentationStyle="pageSheet">
          <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F3EE' }} edges={['top']}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Select country</Text>
              <TouchableOpacity onPress={() => setCountryModalOpen(false)}>
                <Text style={s.modalClose}>Done</Text>
              </TouchableOpacity>
            </View>
            <View style={s.modalSearch}>
              <TextInput
                style={s.searchInput}
                placeholder="Search…"
                placeholderTextColor="#c4b8a8"
                value={countrySearch}
                onChangeText={setCountrySearch}
                autoCapitalize="none"
              />
            </View>
            <FlatList
              data={filteredCountries}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[s.countryRow, country === item && s.countryRowSelected]}
                  onPress={() => { setCountry(item); setCountryModalOpen(false); setCountrySearch(''); }}
                  activeOpacity={0.7}
                >
                  <Text style={[s.countryText, country === item && s.countryTextSelected]}>{item}</Text>
                </TouchableOpacity>
              )}
              keyboardShouldPersistTaps="handled"
            />
          </SafeAreaView>
        </Modal>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---- Styles ----
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F3EE' },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  back: { marginBottom: 8, padding: 4, alignSelf: 'flex-start' },
  backArrow: { fontSize: 28, color: '#6B5E4E', lineHeight: 32 },
  dots: { flexDirection: 'row', gap: 6, marginBottom: 16, alignSelf: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EAE4DC' },
  dotActive: { backgroundColor: '#6B5E4E' },
  title: { fontSize: 20, fontWeight: '500', color: '#3a2e25', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#a09580', marginBottom: 4 },
  body: { paddingHorizontal: 20, paddingTop: 8 },
  label: { fontFamily: 'Nunito_500Medium', fontSize: 11, fontWeight: '500', color: '#c4b8a8', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 },
  input: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EAE4DC',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14,
    fontSize: 15, color: '#3a2e25', minHeight: 48, justifyContent: 'center',
  },
  inputText: { fontSize: 15, color: '#3a2e25' },
  inputPlaceholder: { fontSize: 15, color: '#c4b8a8' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EAE4DC',
  },
  chipSelected: { backgroundColor: '#B07FFF', borderColor: '#B07FFF' },
  chipText: { fontFamily: 'Nunito_400Regular', fontSize: 13, fontWeight: '400', color: '#3a2e25' },
  chipTextSelected: { color: '#FFFFFF' },
  card: {
    backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#EEEEEC',
    borderRadius: 12, padding: 14, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center',
  },
  cardSelected: { borderColor: '#B07FFF', backgroundColor: '#F6F0FF' },
  cardTitle: { fontFamily: 'Nunito_500Medium', fontSize: 15, fontWeight: '500', color: '#1A1A1A', marginBottom: 2 },
  cardTitleSelected: { color: '#B07FFF' },
  cardSub: { fontSize: 13, color: '#999999' },
  cardRadio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#CCCCCC',
    alignItems: 'center', justifyContent: 'center', marginLeft: 12, flexShrink: 0,
  },
  cardRadioSelected: { borderColor: '#B07FFF' },
  subtypeBlock: { marginTop: 12 },
  subtypeLabel: { fontFamily: 'Nunito_500Medium', fontSize: 11, fontWeight: '500', color: '#c4b8a8', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 },
  previewRow: { flexDirection: 'row', gap: 6 },
  previewCard: {
    flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  previewCardText: { fontSize: 12, fontWeight: '500' },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EAE4DC',
    borderRadius: 12, padding: 14, marginTop: 16,
  },
  toggleLabel: { fontSize: 15, fontWeight: '500', color: '#3a2e25', marginBottom: 2 },
  toggleSub: { fontSize: 13, color: '#a09580' },
  step5TitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  optionalBadge: {
    backgroundColor: '#EAE4DC', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3,
  },
  optionalBadgeText: { fontSize: 11, fontWeight: '500', color: '#a09580' },
  infoBox: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EAE4DC',
    borderRadius: 12, padding: 16, marginBottom: 20,
  },
  infoBoxTitle: { fontSize: 14, fontWeight: '500', color: '#3a2e25', marginBottom: 6 },
  infoBoxBody: { fontSize: 13, color: '#a09580', lineHeight: 19 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  dateArrow: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  dateArrowText: { fontSize: 24, color: '#6B5E4E' },
  dateText: { flex: 1, fontSize: 15, color: '#3a2e25', fontWeight: '400' },
  footer: { paddingHorizontal: 20, paddingTop: 12, backgroundColor: '#F7F3EE' },
  btn: {
    backgroundColor: '#6B5E4E', borderRadius: 12, height: 52,
    alignItems: 'center', justifyContent: 'center',
  },
  btnDisabled: { backgroundColor: '#EAE4DC' },
  btnText: { fontSize: 15, fontWeight: '500', color: '#FFFFFF' },
  btnTextDisabled: { color: '#c4b8a8' },
  btnSecondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#EAE4DC' },
  btnSecondaryText: { fontSize: 15, fontWeight: '500', color: '#a09580' },
  // Country modal
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#EAE4DC',
  },
  modalTitle: { fontSize: 17, fontWeight: '500', color: '#3a2e25' },
  modalClose: { fontSize: 15, color: '#6B5E4E', fontWeight: '500' },
  modalSearch: { paddingHorizontal: 20, paddingVertical: 10 },
  searchInput: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EAE4DC',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#3a2e25',
  },
  countryRow: {
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EAE4DC',
  },
  countryRowSelected: { backgroundColor: '#F7F3EE' },
  countryText: { fontSize: 15, color: '#3a2e25' },
  countryTextSelected: { color: '#6B5E4E', fontWeight: '500' },
});
