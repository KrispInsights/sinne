import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import {
  getSession, updateSession, deleteSession, getJourneys,
} from '@/lib/storage';
import type { SessionWithCheckin, Journey, BodySensation } from '@/lib/types';

// ---- Constants ----

const NS_STATES = [
  { key: 'settled',   labels: { plain: 'Settled',   polyvagal: 'Ventral',     ifs: 'Self',           somatic: 'Settled'   }, bg: '#F2F7F3', text: '#7AAE8A', border: '#7AAE8A' },
  { key: 'activated', labels: { plain: 'Activated', polyvagal: 'Sympathetic', ifs: 'Activated part', somatic: 'Activated' }, bg: '#FAF8F0', text: '#C9B96A', border: '#C9B96A' },
  { key: 'shutdown',  labels: { plain: 'Shutdown',  polyvagal: 'Dorsal',      ifs: 'Blended',        somatic: 'Shutdown'  }, bg: '#F2F0F5', text: '#7E6B9E', border: '#7E6B9E' },
];

const SHIFT_OPTIONS = ['Release', 'Shift', 'No shift'];
const SHIFT_QUALITIES = ['Tears','Shaking/trembling','Heat/cold wave','Sound/vocalization','Physical sensation','Spontaneous movement','Emotional flood','Breaththrough'];

const EMOTION_CLUSTERS = [
  { name: 'Grief family',        bg: '#F1F5F8', text: '#6E9BB5', tags: ['grief','sadness','longing','loss','heartbreak'] },
  { name: 'Fear family',         bg: '#F8F1F0', text: '#B5736A', tags: ['fear','dread','anxiety','terror','panic'] },
  { name: 'Anger family',        bg: '#F9F5F0', text: '#C49A6C', tags: ['anger','rage','frustration','irritation','resentment'] },
  { name: 'Shame / contraction', bg: '#F2F0F5', text: '#7E6B9E', tags: ['shame','guilt','unworthiness','smallness'] },
  { name: 'Positive / opening',  bg: '#F2F7F3', text: '#7AAE8A', tags: ['joy','gratitude','love','warmth','bliss','awe'] },
  { name: 'Neutral / liminal',   bg: '#F5F2F9', text: '#9B7FBF', tags: ['confusion','numbness','emptiness','dissociation'] },
  { name: 'Release / movement',  bg: '#F9F5F0', text: '#C49A6C', tags: ['release','openness','relief','surrender'] },
];

function getTagColors(tag: string) {
  for (const c of EMOTION_CLUSTERS) {
    if (c.tags.includes(tag)) return { bg: c.bg, text: c.text };
  }
  return { bg: '#F5F2F9', text: '#9B7FBF' };
}

const BODY_REGIONS = [
  { key: 'head',         label: 'Head / mind',        qualities: ['Pressure','Buzzing','Clarity','Fog','Tingling','Spinning','Expanding'] },
  { key: 'eyes',         label: 'Eyes',               qualities: ['Tears','Burning','Softening','Heaviness'] },
  { key: 'jaw',          label: 'Jaw / face',         qualities: ['Tension','Releasing','Trembling','Numb'] },
  { key: 'throat',       label: 'Throat',             qualities: ['Constriction','Releasing','Wanting to speak','Lump','Warmth','Opening'] },
  { key: 'chest',        label: 'Chest / heart',      qualities: ['Heaviness','Opening','Warmth','Tightness','Aching','Expansion','Flutter'] },
  { key: 'shoulders',    label: 'Shoulders / upper back', qualities: ['Tension','Releasing','Heaviness','Weight lifting'] },
  { key: 'arms',         label: 'Arms / hands',       qualities: ['Tingling','Shaking','Heaviness','Energy moving','Numbness','Warmth','Cramping','Tetany'] },
  { key: 'solar_plexus', label: 'Solar plexus / gut', qualities: ['Churning','Dropping','Expansion','Nausea','Tightening','Fire','Sinking'] },
  { key: 'pelvis',       label: 'Pelvis / lower belly', qualities: ['Heaviness','Tingling','Grounding','Contraction','Warmth','Opening'] },
  { key: 'legs',         label: 'Legs / feet',        qualities: ['Shaking','Heaviness','Grounding','Numbness','Rooting','Trembling'] },
  { key: 'spine',        label: 'Spine',              qualities: ['Vibration','Heat moving up','Waves','Electric','Releasing'] },
  { key: 'full_body',    label: 'Full body',          qualities: ['Vibration','Waves','Trembling','Heat','Chills','Electricity','Dissolving'] },
];

const REGION_COLORS: Record<string, string> = {
  head: '#9B7FBF', eyes: '#7E6B9E', jaw: '#7E6B9E', throat: '#6E9BB5',
  chest: '#7AAE8A', shoulders: '#7AAE8A', arms: '#7AAE8A', solar_plexus: '#C9B96A',
  pelvis: '#C49A6C', legs: '#B5736A', spine: '#9B7FBF', full_body: '#9B7FBF',
};

const CONNECTION_OPTIONS = [
  { key: 'tied_to_something', label: 'A memory, story or situation' },
  { key: 'pure_sensation',    label: 'Pure sensation, no story' },
  { key: 'unclear',           label: 'Unclear / don\'t know' },
];

function getStateColor(state: string | null | undefined) {
  const colors: Record<string, string> = { settled: '#7AAE8A', activated: '#C9B96A', shutdown: '#7E6B9E' };
  return colors[state ?? ''] ?? '#EEEEEC';
}

function getNsState(key: string | null | undefined) {
  return NS_STATES.find((s) => s.key === key) ?? null;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' }) +
    ' at ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  );
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

type VocabKey = 'plain' | 'polyvagal' | 'ifs' | 'somatic';

const CARD_SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 12,
  elevation: 3,
} as const;

// ---- Main component ----

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { bottom: safeBottom } = useSafeAreaInsets();

  const [swc, setSwc] = useState<SessionWithCheckin | null>(null);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showJourneyPicker, setShowJourneyPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit state
  const [nervousState, setNervousState] = useState('');
  const [energeticShift, setEnergeticShift] = useState('');
  const [releaseQualities, setReleaseQualities] = useState<string[]>([]);
  const [emotionTags, setEmotionTags] = useState<string[]>([]);
  const [bodySensations, setBodySensations] = useState<BodySensation[]>([]);
  const [connectionType, setConnectionType] = useState('');
  const [connectionNote, setConnectionNote] = useState('');
  const [elaboration, setElaboration] = useState('');
  const [differenceNote, setDifferenceNote] = useState('');
  const [practiceType, setPracticeType] = useState('');
  const [durationText, setDurationText] = useState('');
  const [journeyId, setJourneyId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const [loaded, js] = await Promise.all([getSession(id), getJourneys()]);
        if (cancelled) return;
        setSwc(loaded);
        setJourneys(js);
        if (loaded) {
          const { session, checkin } = loaded;
          setNervousState(checkin?.nervous_system_state ?? '');
          setEnergeticShift(checkin?.energetic_shift ?? '');
          setReleaseQualities(checkin?.release_qualities ?? []);
          setEmotionTags(checkin?.emotion_tags ?? []);
          setBodySensations(checkin?.body_sensations ?? []);
          setConnectionType(checkin?.connection_type ?? '');
          setConnectionNote(checkin?.connection_note ?? '');
          setElaboration(checkin?.elaboration_note ?? '');
          setDifferenceNote(checkin?.difference_note ?? '');
          setPracticeType(session.practice_type ?? '');
          setDurationText(session.duration_minutes !== null ? String(session.duration_minutes) : '');
          setJourneyId(session.journey_id);
        }
      })();
      return () => { cancelled = true; };
    }, [id])
  );

  async function handleSave() {
    if (!swc) return;
    setSaving(true);
    const duration = parseInt(durationText, 10);
    await updateSession(swc.session.id, {
      nervous_system_state: nervousState || undefined,
      energetic_shift: energeticShift || null,
      release_qualities: releaseQualities,
      emotion_tags: emotionTags,
      body_sensations: bodySensations,
      connection_type: connectionType || null,
      connection_note: connectionNote || null,
      elaboration_note: elaboration || null,
      difference_note: differenceNote || null,
      practice_type: practiceType || null,
      duration_minutes: isNaN(duration) ? null : duration,
      journey_id: journeyId,
    });
    const refreshed = await getSession(swc.session.id);
    setSwc(refreshed);
    setSaving(false);
    setEditMode(false);
  }

  function handleCancelEdit() {
    if (!swc) return;
    const { session, checkin } = swc;
    setNervousState(checkin?.nervous_system_state ?? '');
    setEnergeticShift(checkin?.energetic_shift ?? '');
    setReleaseQualities(checkin?.release_qualities ?? []);
    setEmotionTags(checkin?.emotion_tags ?? []);
    setBodySensations(checkin?.body_sensations ?? []);
    setConnectionType(checkin?.connection_type ?? '');
    setConnectionNote(checkin?.connection_note ?? '');
    setElaboration(checkin?.elaboration_note ?? '');
    setDifferenceNote(checkin?.difference_note ?? '');
    setPracticeType(session.practice_type ?? '');
    setDurationText(session.duration_minutes !== null ? String(session.duration_minutes) : '');
    setJourneyId(session.journey_id);
    setEditMode(false);
  }

  async function handleDelete() {
    if (!swc) return;
    await deleteSession(swc.session.id);
    setShowDelete(false);
    router.back();
  }

  function toggleRegion(key: string) {
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

  if (!swc) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
            <Text style={s.backText}>‹</Text>
          </TouchableOpacity>
        </View>
        <View style={s.emptyCenter}>
          <Text style={s.emptyTxt}>Session not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { session, checkin } = swc;
  const nsState = getNsState(checkin?.nervous_system_state);
  const journeyName = journeys.find((j) => j.id === session.journey_id)?.name ?? null;

  // ---- Read-only view ----
  if (!editMode) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
            <Text style={s.backText}>‹</Text>
          </TouchableOpacity>
          <Text style={s.topBarTitle} numberOfLines={1}>{formatDateTime(session.created_at)}</Text>
          <TouchableOpacity onPress={() => setEditMode(true)} style={s.editBtn}>
            <Text style={s.editBtnText}>Edit</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.bodyReadOnly} showsVerticalScrollIndicator={false}>

          {/* NS state pill (muted chakra colour) */}
          {nsState && (
            <View style={[s.statePill, { backgroundColor: getStateColor(checkin?.nervous_system_state) + '24' }]}>
              <Text style={[s.statePillText, { color: getStateColor(checkin?.nervous_system_state) }]}>
                {nsState.labels['plain' as VocabKey]}
              </Text>
            </View>
          )}

          {/* Meta card (practice, duration, journey) */}
          {(session.practice_type || session.duration_minutes !== null || journeyName) && (
            <View style={[s.sectionCard, CARD_SHADOW]}>
              {(session.practice_type || session.duration_minutes !== null) && (
                <View style={s.metaRow}>
                  {session.practice_type && <Text style={s.metaChip}>{session.practice_type}</Text>}
                  {session.duration_minutes !== null && <Text style={s.metaChip}>{session.duration_minutes} min</Text>}
                </View>
              )}
              {journeyName && (
                <View style={[s.journeyPill, { marginTop: (session.practice_type || session.duration_minutes !== null) ? 10 : 0 }]}>
                  <Text style={s.journeyPillText}>Journey: {journeyName}</Text>
                </View>
              )}
            </View>
          )}

          {/* Shift card */}
          {checkin?.energetic_shift && (
            <View style={[s.sectionCard, CARD_SHADOW]}>
              <Text style={s.cardSectionLabel}>SHIFT OR RELEASE</Text>
              <Text style={s.cardBodyText}>
                {checkin.energetic_shift}
                {checkin.release_qualities.length > 0 ? ', ' + checkin.release_qualities.map(capitalize).join(', ') : ''}
              </Text>
            </View>
          )}

          {/* Emotions card */}
          {(checkin?.emotion_tags?.length ?? 0) > 0 && (
            <View style={[s.sectionCard, CARD_SHADOW]}>
              <Text style={s.cardSectionLabel}>EMOTIONS</Text>
              <View style={s.chipRow}>
                {checkin!.emotion_tags.map((tag) => {
                  const col = getTagColors(tag);
                  return (
                    <View key={tag} style={[s.chip, { backgroundColor: col.bg }]}>
                      <Text style={[s.chipText, { color: col.text }]}>{capitalize(tag)}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Body card */}
          {(checkin?.body_sensations?.length ?? 0) > 0 && (
            <View style={[s.sectionCard, CARD_SHADOW]}>
              <Text style={s.cardSectionLabel}>BODY</Text>
              <View style={s.bodyList}>
                {checkin!.body_sensations.map((bs) => {
                  const region = BODY_REGIONS.find((r) => r.key === bs.region);
                  const dotColor = REGION_COLORS[bs.region] ?? '#999999';
                  return (
                    <View key={bs.region} style={s.bodyRow}>
                      <View style={[s.bodyDot, { backgroundColor: dotColor }]} />
                      <Text style={s.bodyRegionName}>{region?.label ?? bs.region}</Text>
                      {bs.quality && <Text style={s.bodyQuality}>, {capitalize(bs.quality)}</Text>}
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Connection card */}
          {checkin?.connection_type && (
            <View style={[s.sectionCard, CARD_SHADOW]}>
              <Text style={s.cardSectionLabel}>CONNECTION</Text>
              <Text style={s.cardBodyText}>
                {CONNECTION_OPTIONS.find((o) => o.key === checkin.connection_type)?.label ?? checkin.connection_type}
              </Text>
              {checkin.connection_note ? <Text style={s.connectionNote}>{checkin.connection_note}</Text> : null}
            </View>
          )}

          {/* Note card */}
          {checkin?.elaboration_note ? (
            <View style={[s.sectionCard, CARD_SHADOW]}>
              <Text style={s.cardSectionLabel}>NOTE</Text>
              <Text style={s.cardBodyText}>{checkin.elaboration_note}</Text>
            </View>
          ) : null}

          {/* What felt different card */}
          {checkin?.difference_note ? (
            <View style={[s.sectionCard, CARD_SHADOW]}>
              <Text style={s.cardSectionLabel}>WHAT FELT DIFFERENT</Text>
              <Text style={s.cardBodyText}>{checkin.difference_note}</Text>
            </View>
          ) : null}

          <TouchableOpacity style={s.deleteBtn} onPress={() => setShowDelete(true)} activeOpacity={0.7}>
            <Text style={s.deleteBtnText}>Delete session</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Delete confirmation modal */}
        <Modal transparent visible={showDelete} animationType="fade" onRequestClose={() => setShowDelete(false)}>
          <TouchableOpacity style={s.modalBackdrop} onPress={() => setShowDelete(false)} activeOpacity={1}>
            <View style={[s.modalCard, { marginBottom: Math.max(safeBottom + 20, 40) }]}>
              <Text style={s.modalTitle}>Delete this session?</Text>
              <Text style={s.modalBody}>This cannot be undone.</Text>
              <TouchableOpacity style={s.modalDestructiveBtn} onPress={handleDelete} activeOpacity={0.85}>
                <Text style={s.modalDestructiveText}>Delete</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalCancelBtn} onPress={() => setShowDelete(false)} activeOpacity={0.7}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </SafeAreaView>
    );
  }

  // ---- Edit view ----
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={handleCancelEdit} style={s.iconBtn}>
          <Text style={s.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={s.topBarTitle}>Edit session</Text>
        <TouchableOpacity onPress={handleSave} style={s.iconBtn} disabled={saving}>
          <Text style={s.saveLinkText}>{saving ? 'Saving…' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* NS state */}
          <Text style={s.sectionLabel}>NERVOUS SYSTEM STATE</Text>
          <View style={s.optionList}>
            {NS_STATES.map((st) => (
              <TouchableOpacity
                key={st.key}
                style={[s.nsCard, { backgroundColor: st.bg, borderColor: nervousState === st.key ? st.border : '#EEEEEC' }, nervousState === st.key && { borderWidth: 2 }]}
                onPress={() => setNervousState(nervousState === st.key ? '' : st.key)}
                activeOpacity={0.75}
              >
                <Text style={[s.nsCardText, { color: st.text }]}>{st.labels.plain}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Energetic shift */}
          <Text style={[s.sectionLabel, { marginTop: 20 }]}>SHIFT OR RELEASE</Text>
          <View style={s.optionList}>
            {SHIFT_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[s.optionCard, energeticShift === opt && s.optionCardSelected]}
                onPress={() => setEnergeticShift(energeticShift === opt ? '' : opt)}
                activeOpacity={0.75}
              >
                <Text style={[s.optionCardText, energeticShift === opt && s.optionCardTextSel]}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Shift qualities */}
          {(energeticShift === 'Release' || energeticShift === 'Shift') && (
            <View style={{ marginTop: 12 }}>
              <Text style={s.qualityLabel}>QUALITY (OPTIONAL)</Text>
              <View style={s.chipRow}>
                {SHIFT_QUALITIES.map((q) => (
                  <TouchableOpacity
                    key={q}
                    style={[s.chip, s.chipOutline, releaseQualities.includes(q.toLowerCase()) && s.chipSelected]}
                    onPress={() => {
                      const lq = q.toLowerCase();
                      setReleaseQualities((prev) => prev.includes(lq) ? prev.filter((x) => x !== lq) : [...prev, lq]);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.chipText, releaseQualities.includes(q.toLowerCase()) && s.chipTextSel]}>{q}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Emotions */}
          <Text style={[s.sectionLabel, { marginTop: 20 }]}>EMOTIONS</Text>
          {EMOTION_CLUSTERS.map((cluster) => (
            <View key={cluster.name} style={{ marginBottom: 12 }}>
              <Text style={s.qualityLabel}>{cluster.name.toUpperCase()}</Text>
              <View style={s.chipRow}>
                {cluster.tags.map((tag) => {
                  const sel = emotionTags.includes(tag);
                  return (
                    <TouchableOpacity
                      key={tag}
                      style={[s.chip, { backgroundColor: sel ? cluster.bg : '#FAFAF8', borderColor: sel ? cluster.bg : '#EEEEEC', borderWidth: 1 }]}
                      onPress={() => setEmotionTags((prev) => sel ? prev.filter((x) => x !== tag) : [...prev, tag])}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.chipText, { color: sel ? cluster.text : '#1A1A1A' }]}>{capitalize(tag)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}

          {/* Body sensations */}
          <Text style={[s.sectionLabel, { marginTop: 8 }]}>BODY SENSATIONS</Text>
          <View style={s.chipRow}>
            {BODY_REGIONS.map((r) => {
              const active = bodySensations.some((b) => b.region === r.key);
              return (
                <TouchableOpacity
                  key={r.key}
                  style={[s.chip, s.chipOutline, active && s.chipSelected]}
                  onPress={() => toggleRegion(r.key)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.chipText, active && s.chipTextSel]}>{r.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {bodySensations.map((bs) => {
            const region = BODY_REGIONS.find((r) => r.key === bs.region);
            if (!region) return null;
            return (
              <View key={bs.region} style={{ marginTop: 12 }}>
                <Text style={s.qualityLabel}>{region.label.toUpperCase()}, QUALITY</Text>
                <View style={s.chipRow}>
                  {region.qualities.map((q) => {
                    const lq = q.toLowerCase();
                    return (
                      <TouchableOpacity
                        key={q}
                        style={[s.chip, s.chipOutline, bs.quality === lq && s.chipSelected]}
                        onPress={() => setBodyQuality(bs.region, lq)}
                        activeOpacity={0.7}
                      >
                        <Text style={[s.chipText, bs.quality === lq && s.chipTextSel]}>{q}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })}

          {/* Connection type */}
          <Text style={[s.sectionLabel, { marginTop: 20 }]}>CONNECTION</Text>
          <View style={s.optionList}>
            {CONNECTION_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[s.optionCard, connectionType === opt.key && s.optionCardSelected]}
                onPress={() => setConnectionType(connectionType === opt.key ? '' : opt.key)}
                activeOpacity={0.75}
              >
                <Text style={[s.optionCardText, connectionType === opt.key && s.optionCardTextSel]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {connectionType === 'tied_to_something' && (
            <TextInput
              style={[s.textarea, { marginTop: 8 }]}
              value={connectionNote}
              onChangeText={setConnectionNote}
              placeholder="Which memory or situation? (optional)"
              placeholderTextColor="#999999"
              multiline
              textAlignVertical="top"
            />
          )}

          {/* Elaboration */}
          <Text style={[s.sectionLabel, { marginTop: 20 }]}>NOTE</Text>
          <TextInput
            style={[s.textarea, { minHeight: 120 }]}
            value={elaboration}
            onChangeText={setElaboration}
            placeholder="Anything that wants to be named…"
            placeholderTextColor="#999999"
            multiline
            textAlignVertical="top"
          />

          {/* What felt different */}
          <Text style={[s.sectionLabel, { marginTop: 20 }]}>WHAT FELT DIFFERENT</Text>
          <TextInput
            style={[s.textarea, { minHeight: 80 }]}
            value={differenceNote}
            onChangeText={setDifferenceNote}
            placeholder="What felt different from last time? (optional)"
            placeholderTextColor="#999999"
            multiline
            textAlignVertical="top"
          />

          {/* Practice + duration */}
          <Text style={[s.sectionLabel, { marginTop: 20 }]}>PRACTICE TYPE</Text>
          <TextInput
            style={s.input}
            value={practiceType}
            onChangeText={setPracticeType}
            placeholder="e.g. Breathwork (optional)"
            placeholderTextColor="#999999"
          />
          <Text style={[s.sectionLabel, { marginTop: 16 }]}>DURATION (MINUTES)</Text>
          <TextInput
            style={s.input}
            value={durationText}
            onChangeText={(v) => setDurationText(v.replace(/[^0-9]/g, ''))}
            placeholder="Optional"
            placeholderTextColor="#999999"
            keyboardType="number-pad"
          />

          {/* Journey assignment */}
          <Text style={[s.sectionLabel, { marginTop: 20 }]}>JOURNEY</Text>
          <TouchableOpacity
            style={s.journeyPickerRow}
            onPress={() => setShowJourneyPicker(true)}
            activeOpacity={0.7}
          >
            <Text style={s.journeyPickerText}>
              {journeys.find((j) => j.id === journeyId)?.name ?? 'None'}
            </Text>
            <Text style={s.chevronSmall}>›</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Journey picker modal */}
      <Modal transparent visible={showJourneyPicker} animationType="slide" onRequestClose={() => setShowJourneyPicker(false)}>
        <TouchableOpacity style={s.modalBackdrop} onPress={() => setShowJourneyPicker(false)} activeOpacity={1}>
          <View style={[s.pickerSheet, { paddingBottom: Math.max(safeBottom, 16) }]}>
            <Text style={s.pickerTitle}>Assign to journey</Text>
            <TouchableOpacity
              style={[s.pickerRow, journeyId === null && s.pickerRowSelected]}
              onPress={() => { setJourneyId(null); setShowJourneyPicker(false); }}
              activeOpacity={0.7}
            >
              <Text style={s.pickerRowText}>None</Text>
              {journeyId === null && <Text style={s.checkmark}>✓</Text>}
            </TouchableOpacity>
            {journeys.map((j) => (
              <TouchableOpacity
                key={j.id}
                style={[s.pickerRow, journeyId === j.id && s.pickerRowSelected]}
                onPress={() => { setJourneyId(j.id); setShowJourneyPicker(false); }}
                activeOpacity={0.7}
              >
                <Text style={s.pickerRowText}>{j.name}</Text>
                {journeyId === j.id && <Text style={s.checkmark}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ---- Styles ----

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10, gap: 8,
  },
  iconBtn: { minWidth: 60, height: 36, justifyContent: 'center' },
  backText: { fontSize: 28, color: '#B07FFF', lineHeight: 32 },
  cancelText: { fontSize: 15, color: '#666666' },
  saveLinkText: { fontSize: 15, color: '#B07FFF', fontWeight: '500', textAlign: 'right' },
  editBtn: { minWidth: 60, height: 36, justifyContent: 'center', alignItems: 'flex-end' },
  editBtnText: { fontSize: 15, color: '#B07FFF', fontWeight: '500' },
  topBarTitle: { flex: 1, fontSize: 13, color: '#666666', textAlign: 'center' },
  body: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },
  bodyReadOnly: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40, gap: 12 },

  emptyCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTxt: { fontSize: 15, color: '#999999' },

  // Read-only section cards
  sectionCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16 },
  statePill: {
    alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
  },
  statePillText: { fontSize: 14, fontWeight: '600' },
  journeyPill: {
    alignSelf: 'flex-start', backgroundColor: '#F5F2F9',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
  },
  journeyPillText: { fontSize: 12, fontWeight: '500', color: '#9B7FBF' },
  cardSectionLabel: {
    fontSize: 11, fontWeight: '500', color: '#999999',
    textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10,
  },
  cardBodyText: { fontSize: 15, color: '#1A1A1A', lineHeight: 22 },
  connectionNote: { fontSize: 13, color: '#666666', marginTop: 6, fontStyle: 'italic' },

  metaRow: { flexDirection: 'row', gap: 8 },
  metaChip: {
    fontSize: 12, color: '#666666', backgroundColor: '#FAFAF8',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },

  // Edit mode section label
  sectionLabel: {
    fontSize: 11, fontWeight: '500', color: '#999999',
    textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8,
  },

  // Legacy (kept for edit mode, nsCard used in edit view)
  nsCard: {
    borderWidth: 1.5, borderRadius: 12, paddingVertical: 16, paddingHorizontal: 16,
    marginBottom: 12, alignItems: 'center',
  },
  nsCardText: { fontSize: 16, fontWeight: '500' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  chip: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20,
  },
  chipOutline: {
    backgroundColor: '#FAFAF8', borderWidth: 1, borderColor: '#EEEEEC',
  },
  chipSelected: { backgroundColor: '#B07FFF', borderColor: '#B07FFF' },
  chipText: { fontSize: 13, fontWeight: '500', color: '#1A1A1A' },
  chipTextSel: { color: '#FFFFFF' },

  bodyList: { gap: 8 },
  bodyRow: { flexDirection: 'row', alignItems: 'center' },
  bodyDot: { width: 7, height: 7, borderRadius: 3.5, marginRight: 8, flexShrink: 0 },
  bodyRegionName: { fontSize: 14, fontWeight: '500', color: '#1A1A1A' },
  bodyQuality: { fontSize: 13, color: '#666666', fontStyle: 'italic' },

  // Delete button — tiny grey text, no button styling
  deleteBtn: {
    marginTop: 40, alignSelf: 'center',
    paddingVertical: 8, paddingHorizontal: 16,
  },
  deleteBtnText: { fontSize: 13, fontWeight: '400', color: '#CCCCCC' },

  // Edit mode
  optionList: { gap: 8, marginBottom: 4 },
  optionCard: {
    backgroundColor: '#FAFAF8', borderWidth: 1, borderColor: '#EEEEEC',
    borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16,
  },
  optionCardSelected: { borderColor: '#B07FFF' },
  optionCardText: { fontSize: 15, fontWeight: '500', color: '#1A1A1A' },
  optionCardTextSel: { color: '#B07FFF' },
  qualityLabel: {
    fontSize: 10, fontWeight: '500', color: '#999999',
    textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 6,
  },
  textarea: {
    backgroundColor: '#FAFAF8', borderWidth: 1, borderColor: '#EEEEEC',
    borderRadius: 10, padding: 14, fontSize: 15, color: '#1A1A1A',
    lineHeight: 22, minHeight: 80,
  },
  input: {
    backgroundColor: '#FAFAF8', borderWidth: 1, borderColor: '#EEEEEC',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#1A1A1A',
  },
  journeyPickerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FAFAF8', borderWidth: 1, borderColor: '#EEEEEC',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14,
  },
  journeyPickerText: { fontSize: 15, color: '#1A1A1A' },
  chevronSmall: { fontSize: 16, color: '#999999' },

  // Modals
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end', paddingHorizontal: 16,
  },
  modalCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20,
  },
  modalTitle: { fontSize: 17, fontWeight: '500', color: '#1A1A1A', marginBottom: 8 },
  modalBody: { fontSize: 14, color: '#666666', marginBottom: 20, lineHeight: 20 },
  modalDestructiveBtn: {
    backgroundColor: '#FF2A2A', borderRadius: 12, height: 50,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  modalDestructiveText: { fontSize: 15, fontWeight: '500', color: '#FFFFFF' },
  modalCancelBtn: {
    height: 44, alignItems: 'center', justifyContent: 'center',
  },
  modalCancelText: { fontSize: 15, color: '#666666' },

  // Journey picker sheet
  pickerSheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 16, borderTopRightRadius: 16,
    paddingTop: 16, paddingHorizontal: 0,
  },
  pickerTitle: {
    fontSize: 13, fontWeight: '500', color: '#999999',
    textTransform: 'uppercase', letterSpacing: 0.7,
    paddingHorizontal: 20, marginBottom: 8,
  },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EEEEEC',
  },
  pickerRowSelected: { backgroundColor: '#F6F0FF' },
  pickerRowText: { fontSize: 15, color: '#1A1A1A' },
  checkmark: { fontSize: 16, color: '#B07FFF', fontWeight: '600' },
});
