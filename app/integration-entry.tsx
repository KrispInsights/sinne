import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { createIntegration, getActiveJourneys } from '@/lib/storage';
import type { CreateIntegrationInput, Journey } from '@/lib/types';
import { COLORS, CATEGORY_DATA } from '@/lib/theme';

// ---- Sub-questions per category ----

const CATEGORY_QUESTIONS: Record<string, [string, string, string]> = {
  Triggers: [
    'What set something off?',
    'What emotion came with it?',
    'What did you want to do, or avoid?',
  ],
  Memories: [
    'What memory or image keeps surfacing?',
    'How old does it feel?',
    'What does it seem to want from you?',
  ],
  Emotions: [
    'What emotions are still present?',
    'What feels unfinished?',
    'What are you avoiding feeling?',
  ],
  Body: [
    'Where do you feel this in your body?',
    'What does that sensation want you to know?',
    'What does your body seem to need?',
  ],
  Patterns: [
    'Where did you recognise yourself?',
    'What familiar story showed up?',
    'Where does this pattern appear in your daily life?',
  ],
  Meaning: [
    'What might this be pointing to?',
    'What assumption no longer feels true?',
    'What new perspective is forming?',
  ],
  Realizations: [
    'What is becoming clearer?',
    'What surprised you about yourself?',
    'What are you still sitting with?',
  ],
  Actions: [
    'What is one small thing you could do differently?',
    'What needs more of your attention?',
    'What would it look like to live this insight?',
  ],
  Gratitude: [
    'What are you grateful for right now?',
    'What part of yourself showed up that you want to acknowledge?',
    'What feels like a gift, even if it was hard?',
  ],
};

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatChipDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
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

function getCategoryKey(category: string): string {
  return category.toLowerCase();
}

export default function IntegrationEntryScreen() {
  const { category } = useLocalSearchParams<{ category: string }>();
  const router = useRouter();
  const { bottom: safeBottom } = useSafeAreaInsets();

  const cat = category ?? 'Emotions';
  const questions = CATEGORY_QUESTIONS[cat] ?? CATEGORY_QUESTIONS.Emotions;
  const accentColor = CATEGORY_DATA[cat]?.color ?? '#9B7FBF';
  const accentTint = accentColor + '18';

  const today = todayString();
  const [noteDate, setNoteDate] = useState(today);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [answers, setAnswers] = useState<[string, string, string]>(['', '', '']);
  const [freeText, setFreeText] = useState('');
  const [showFreeText, setShowFreeText] = useState(false);
  const [carryForward, setCarryForward] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeJourneys, setActiveJourneys] = useState<Journey[]>([]);
  const [linkedJourneyId, setLinkedJourneyId] = useState<string | null>(null);

  function setAnswer(index: number, value: string) {
    setAnswers((prev) => {
      const next: [string, string, string] = [...prev] as [string, string, string];
      next[index] = value;
      return next;
    });
  }

  React.useEffect(() => {
    (async () => {
      const journeys = await getActiveJourneys();
      setActiveJourneys(journeys);
    })();
  }, []);

  async function handleSave() {
    setSaving(true);
    const input: CreateIntegrationInput = {
      note_date: noteDate,
      category: getCategoryKey(cat),
      journey_id: linkedJourneyId,
      free_text: freeText || null,
      carry_forward: carryForward || null,
    };
    const catKey = getCategoryKey(cat);
    (input as any)[`${catKey}_q1`] = answers[0] || null;
    (input as any)[`${catKey}_q2`] = answers[1] || null;
    (input as any)[`${catKey}_q3`] = answers[2] || null;
    await createIntegration(input);
    router.back();
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={[s.title, { color: accentColor }]}>{cat}</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={s.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Date chip */}
          <View style={s.dateChipRow}>
            <TouchableOpacity
              style={[s.dateChip, { backgroundColor: accentTint, borderColor: accentColor }]}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.75}
            >
              <Text style={[s.dateChipText, { color: accentColor }]}>{formatChipDate(noteDate)}</Text>
            </TouchableOpacity>
          </View>
          {showDatePicker && (
            <DateTimePicker
              value={isoToDate(noteDate)}
              mode="date"
              display="inline"
              maximumDate={isoToDate(today)}
              onChange={(event, selectedDate) => {
                setShowDatePicker(Platform.OS === 'ios' ? showDatePicker : false);
                if (event.type === 'set' && selectedDate) {
                  setNoteDate(dateToIso(selectedDate));
                  if (Platform.OS !== 'ios') setShowDatePicker(false);
                }
              }}
            />
          )}
          {showDatePicker && Platform.OS === 'ios' && (
            <TouchableOpacity style={s.dateDoneBtn} onPress={() => setShowDatePicker(false)} activeOpacity={0.8}>
              <Text style={[s.dateDoneBtnText, { color: accentColor }]}>Done</Text>
            </TouchableOpacity>
          )}

          {/* Question cards */}
          {questions.map((q, idx) => (
            <View key={idx} style={s.questionCard}>
              <Text style={[s.questionLabel, { color: accentColor }]}>{q}</Text>
              <TextInput
                style={s.questionInput}
                value={answers[idx]}
                onChangeText={(v) => setAnswer(idx, v)}
                multiline
                textAlignVertical="top"
                placeholderTextColor="#CCCCCC"
                placeholder="Optional…"
              />
            </View>
          ))}

          {/* Carry forward */}
          <View style={s.questionCard}>
            <Text style={[s.questionLabel, { color: accentColor }]}>CARRY FORWARD</Text>
            <Text style={[s.carryForwardPrompt, { color: accentColor }]}>What feels important to carry forward?</Text>
            <TextInput
              style={s.questionInput}
              value={carryForward}
              onChangeText={setCarryForward}
              placeholder="Optional…"
              placeholderTextColor="#CCCCCC"
              returnKeyType="done"
            />
          </View>

          {/* Add a note row / free text */}
          {showFreeText ? (
            <View style={s.questionCard}>
              <Text style={[s.questionLabel, { color: accentColor }]}>Anything else</Text>
              <TextInput
                style={[s.questionInput, { minHeight: 80 }]}
                value={freeText}
                onChangeText={setFreeText}
                multiline
                textAlignVertical="top"
                placeholderTextColor="#CCCCCC"
                placeholder="No character limit…"
                autoFocus
              />
            </View>
          ) : (
            <TouchableOpacity style={s.addNoteRow} onPress={() => setShowFreeText(true)} activeOpacity={0.7}>
              <Text style={s.addNoteText}>+ Add a note</Text>
            </TouchableOpacity>
          )}

          {/* Journey selector */}
          {activeJourneys.length > 0 && (
            <View style={s.journeySection}>
              <Text style={s.journeySectionLabel}>LINK TO JOURNEY</Text>
              <Text style={s.journeySectionPrompt}>Connect this integration to an active journey</Text>
              <View style={{ gap: 8, marginTop: 12 }}>
                {activeJourneys.map((journey) => {
                  const sel = linkedJourneyId === journey.id;
                  return (
                    <TouchableOpacity
                      key={journey.id}
                      style={[s.journeyToggleRow, sel && s.journeyToggleSelected]}
                      onPress={() => setLinkedJourneyId(sel ? null : journey.id)}
                      activeOpacity={0.75}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={s.journeyToggleName}>{journey.name}</Text>
                        <Text style={s.journeyToggleSub}>Active journey</Text>
                      </View>
                      <View style={[s.journeyCheckbox, sel && s.journeyCheckboxChecked]}>
                        {sel && <Text style={s.journeyCheckmark}>✓</Text>}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[s.saveBtn, { backgroundColor: accentColor, marginTop: 24, marginBottom: 32 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Text style={s.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 28, color: '#B07FFF', lineHeight: 32 },
  title: { fontSize: 20, fontWeight: '500', color: '#1A1A1A' },
  body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },

  dateChipRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  dateChip: {
    borderWidth: 1, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8, minHeight: 44, justifyContent: 'center',
  },
  dateChipText: { fontSize: 14, fontWeight: '600' },
  dateDoneBtn: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 20, marginBottom: 16 },
  dateDoneBtnText: { fontSize: 15, fontWeight: '600' },

  questionCard: {
    backgroundColor: '#FAFAF8', borderWidth: 1, borderColor: '#EEEEEC',
    borderRadius: 12, padding: 14, marginBottom: 12,
  },
  questionLabel: {
    fontSize: 15, fontFamily: 'DMSerifDisplay_400Regular', marginBottom: 8, lineHeight: 22,
  },
  questionInput: {
    fontFamily: 'Nunito_400Regular', fontSize: 15, fontWeight: '400', color: '#1A1A1A', lineHeight: 22, minHeight: 56,
    padding: 0,
  },

  addNoteRow: {
    paddingVertical: 12, alignItems: 'center',
  },
  addNoteText: { fontSize: 14, color: '#999999', fontWeight: '500' },

  journeySection: {
    marginTop: 12, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#E0E0E0',
  },
  journeySectionLabel: {
    fontFamily: 'Nunito_500Medium', fontSize: 11, fontWeight: '500',
    color: '#999999', letterSpacing: 1.2,
    textTransform: 'uppercase', marginBottom: 8,
  },
  journeySectionPrompt: {
    fontSize: 14, fontFamily: 'Nunito_400Regular', fontWeight: '400',
    color: '#1A1A1A', lineHeight: 22,
  },
  journeyToggleRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FAFAF8', borderWidth: 1, borderColor: '#EEEEEC',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 16, gap: 12,
  },
  journeyToggleSelected: { borderColor: '#B07FFF', backgroundColor: '#F6F0FF' },
  journeyToggleName: { fontSize: 15, fontFamily: 'Nunito_500Medium', fontWeight: '500', color: '#1A1A1A' },
  journeyToggleSub: { fontSize: 12, fontFamily: 'Nunito_400Regular', color: '#999999', marginTop: 2 },
  journeyCheckbox: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#EEEEEC',
    alignItems: 'center', justifyContent: 'center',
  },
  journeyCheckboxChecked: { backgroundColor: '#B07FFF', borderColor: '#B07FFF' },
  journeyCheckmark: { fontSize: 13, color: '#FFFFFF', fontWeight: '700' },

  carryForwardPrompt: {
    fontSize: 14, fontFamily: 'Nunito_400Regular', fontWeight: '400',
    marginBottom: 10, lineHeight: 22, opacity: 0.7,
  },

  saveBtn: {
    borderRadius: 12, height: 56,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnText: { fontFamily: 'Nunito_600SemiBold', fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
});
