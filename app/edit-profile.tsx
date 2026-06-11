import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Modal, FlatList,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getProfile, updateProfile } from '@/lib/storage';
import type { Profile } from '@/lib/types';

// ---- Options ----

const AGE_RANGES = ['Under 25', '25–34', '35–44', '45–54', '55–64', '65+', 'Prefer not to say'];
const SEX_OPTIONS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];
const EXPERIENCE_OPTIONS = [
  'Just starting out',
  'Want to dive deeper',
  'This is part of my life',
];
const PRACTICE_OPTIONS = [
  'Breathwork', 'Dance / movement therapy', 'IFS / Internal Family Systems',
  'Meditation / Vipassana', 'Qi Gong / Tai Chi', 'Reiki / energy healing',
  'Somatic Experiencing', 'Sound healing', 'Trauma therapy (body-based)',
  'Yoga', 'Not sure yet',
];
const GOAL_OPTIONS = [
  'Deepening presence and awareness', 'Emotional release', 'General wellbeing',
  'Grief processing', 'Improving sleep', 'Managing anxiety',
  'Nervous system regulation', 'Physical performance and recovery', 'Presence',
  'Spiritual exploration', 'Supporting therapy or inner work',
  'Trauma healing and integration', 'Understanding my own patterns',
  "I'm not sure yet",
];
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

// ---- Chip row ----

function ChipRow({
  options,
  selected,
  multi,
  onSelect,
}: {
  options: string[];
  selected: string | string[];
  multi: boolean;
  onSelect: (value: string) => void;
}) {
  const isSelected = (opt: string) =>
    multi ? (selected as string[]).includes(opt) : selected === opt;

  return (
    <View style={s.chipRow}>
      {options.map((opt) => {
        const sel = isSelected(opt);
        return (
          <TouchableOpacity
            key={opt}
            style={[s.chip, sel && s.chipSelected]}
            onPress={() => onSelect(opt)}
            activeOpacity={0.7}
          >
            <Text style={[s.chipText, sel && s.chipTextSel]}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ---- Country selector modal ----

function CountryModal({
  visible, selected, onSelect, onClose,
}: {
  visible: boolean; selected: string; onSelect: (c: string) => void; onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const { bottom: safeBottom } = useSafeAreaInsets();
  const filtered = search.trim()
    ? COUNTRIES.filter((c) => c.toLowerCase().includes(search.toLowerCase()))
    : COUNTRIES;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top']}>
        <View style={s.modalHeader}>
          <Text style={s.modalTitle}>Select country</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <MaterialCommunityIcons name="close" size={22} color="#666666" />
          </TouchableOpacity>
        </View>
        <View style={s.modalSearchWrap}>
          <MaterialCommunityIcons name="magnify" size={18} color="#999999" style={{ marginRight: 8 }} />
          <TextInput
            style={s.modalSearch}
            placeholder="Search countries…"
            placeholderTextColor="#CCCCCC"
            value={search}
            onChangeText={setSearch}
            autoFocus
            returnKeyType="search"
          />
        </View>
        <FlatList
          data={filtered}
          keyExtractor={(item) => item}
          keyboardShouldPersistTaps="always"
          contentContainerStyle={{ paddingBottom: Math.max(safeBottom, 20) }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[s.countryRow, selected === item && s.countryRowSelected]}
              onPress={() => { onSelect(item); onClose(); }}
              activeOpacity={0.7}
            >
              <Text style={[s.countryText, selected === item && s.countryTextSelected]}>{item}</Text>
              {selected === item && (
                <MaterialCommunityIcons name="check" size={18} color="#B07FFF" />
              )}
            </TouchableOpacity>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}

// ---- Main screen ----

export default function EditProfileScreen() {
  const router = useRouter();
  const { bottom: safeBottom } = useSafeAreaInsets();
  const [profile, setProfileState] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [name, setName] = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [sex, setSex] = useState('');
  const [country, setCountry] = useState('');
  const [countryModalOpen, setCountryModalOpen] = useState(false);
  const [experience, setExperience] = useState('');
  const [practices, setPractices] = useState<string[]>([]);
  const [goals, setGoals] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const p = await getProfile();
        if (cancelled) return;
        setProfileState(p);
        setName(p.preferred_name ?? '');
        setAgeRange(p.age_range ?? '');
        setSex(p.sex ?? '');
        setCountry(p.country ?? '');
        setExperience(p.experience_level ?? '');
        setPractices(p.practices ?? []);
        setGoals(p.goals ?? []);
      })();
      return () => { cancelled = true; };
    }, [])
  );

  function togglePractice(opt: string) {
    if (opt === 'Not sure yet') { setPractices(['Not sure yet']); return; }
    setPractices((prev) => {
      const filtered = prev.filter((p) => p !== 'Not sure yet');
      return filtered.includes(opt) ? filtered.filter((p) => p !== opt) : [...filtered, opt];
    });
  }

  function toggleGoal(opt: string) {
    if (opt === "I'm not sure yet") { setGoals(["I'm not sure yet"]); return; }
    setGoals((prev) => {
      const filtered = prev.filter((g) => g !== "I'm not sure yet");
      return filtered.includes(opt) ? filtered.filter((g) => g !== opt) : [...filtered, opt];
    });
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    await updateProfile({
      preferred_name: name.trim(),
      age_range: ageRange,
      sex,
      country,
      experience_level: experience,
      practices,
      goals,
    });
    setSaving(false);
    router.back();
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={s.title}>Edit profile</Text>
        <TouchableOpacity onPress={handleSave} style={s.saveLink} disabled={!name.trim() || saving}>
          <Text style={[s.saveLinkText, !name.trim() && s.saveLinkDisabled]}>
            {saving ? 'Saving…' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        {/* Name */}
        <Text style={s.label}>PREFERRED NAME</Text>
        <TextInput
          style={s.input}
          value={name}
          onChangeText={setName}
          placeholder="Your name or nickname"
          placeholderTextColor="#c4b8a8"
          returnKeyType="done"
        />

        {/* Age range */}
        <Text style={[s.label, { marginTop: 20 }]}>AGE RANGE</Text>
        <ChipRow options={AGE_RANGES} selected={ageRange} multi={false} onSelect={setAgeRange} />

        {/* Sex */}
        <Text style={[s.label, { marginTop: 20 }]}>SEX</Text>
        <ChipRow options={SEX_OPTIONS} selected={sex} multi={false} onSelect={setSex} />

        {/* Country */}
        <Text style={[s.label, { marginTop: 20 }]}>COUNTRY</Text>
        <TouchableOpacity style={s.countryField} onPress={() => setCountryModalOpen(true)} activeOpacity={0.7}>
          <Text style={country ? s.countryFieldText : s.countryFieldPlaceholder}>
            {country || 'Select country'}
          </Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#999999" />
        </TouchableOpacity>

        {/* Experience */}
        <Text style={[s.label, { marginTop: 20 }]}>EXPERIENCE LEVEL</Text>
        {EXPERIENCE_OPTIONS.map((opt) => {
          const sel = experience === opt;
          return (
            <TouchableOpacity
              key={opt}
              style={[s.expCard, sel && s.expCardSelected]}
              onPress={() => setExperience(opt)}
              activeOpacity={0.75}
            >
              <Text style={[s.expCardText, sel && s.expCardTextSelected]}>{opt}</Text>
              <View style={[s.expRadio, sel && s.expRadioSelected]}>
                {sel && <MaterialCommunityIcons name="check" size={14} color="#B07FFF" />}
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Practices */}
        <Text style={[s.label, { marginTop: 20 }]}>PRIMARY PRACTICES</Text>
        <ChipRow options={PRACTICE_OPTIONS} selected={practices} multi onSelect={togglePractice} />

        {/* Goals */}
        <Text style={[s.label, { marginTop: 20 }]}>GOALS</Text>
        <ChipRow options={GOAL_OPTIONS} selected={goals} multi onSelect={toggleGoal} />
      </ScrollView>

      <CountryModal
        visible={countryModalOpen}
        selected={country}
        onSelect={setCountry}
        onClose={() => setCountryModalOpen(false)}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F3EE' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
  },
  backBtn: { minWidth: 36, height: 36, alignItems: 'flex-start', justifyContent: 'center' },
  backText: { fontSize: 28, color: '#6B5E4E', lineHeight: 32 },
  title: { flex: 1, fontSize: 17, fontWeight: '500', color: '#3a2e25', textAlign: 'center' },
  saveLink: { minWidth: 60, height: 36, alignItems: 'flex-end', justifyContent: 'center' },
  saveLinkText: { fontSize: 15, fontWeight: '500', color: '#6B5E4E' },
  saveLinkDisabled: { opacity: 0.4 },
  body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },

  label: {
    fontSize: 11, fontWeight: '500', color: '#c4b8a8',
    textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EAE4DC',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#3a2e25',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EAE4DC',
  },
  chipSelected: { backgroundColor: '#6B5E4E', borderColor: '#6B5E4E' },
  chipText: { fontSize: 13, fontWeight: '500', color: '#3a2e25' },
  chipTextSel: { color: '#FFFFFF' },

  expCard: {
    backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#EAE4DC',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center',
  },
  expCardSelected: { borderColor: '#B07FFF', backgroundColor: '#F6F0FF' },
  expCardText: { flex: 1, fontSize: 15, fontWeight: '500', color: '#3a2e25' },
  expCardTextSelected: { color: '#B07FFF' },
  expRadio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#CCCCCC',
    alignItems: 'center', justifyContent: 'center', marginLeft: 12, flexShrink: 0,
  },
  expRadioSelected: { borderColor: '#B07FFF' },

  countryField: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EAE4DC',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  countryFieldText: { fontSize: 15, color: '#3a2e25', flex: 1 },
  countryFieldPlaceholder: { fontSize: 15, color: '#c4b8a8', flex: 1 },

  // Country modal
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EEEEEC',
  },
  modalTitle: { fontSize: 17, fontWeight: '600', color: '#1A1A1A' },
  modalSearchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginVertical: 12,
    backgroundColor: '#F5F5F5', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
  },
  modalSearch: { flex: 1, fontSize: 15, color: '#1A1A1A', padding: 0 },
  countryRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EEEEEC',
  },
  countryRowSelected: { backgroundColor: '#F6F0FF' },
  countryText: { fontSize: 15, color: '#1A1A1A' },
  countryTextSelected: { color: '#B07FFF', fontWeight: '500' },
});
