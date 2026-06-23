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

// ---- Categories that include emotion tag selection step ----

const CATEGORIES_WITH_EMOTION_STEP = ['Emotions', 'Triggers', 'Memories', 'Patterns'];

// ---- Progress dots indicator ----

function ProgressDots({ current, total = 3 }: { current: number; total?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 12 }}>
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        if (n < current) return <View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.accent + '66' }} />;
        if (n === current) return <View key={i} style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.accent }} />;
        return <View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.track }} />;
      })}
    </View>
  );
}

// ---- Sub-questions per category ----

const CATEGORY_QUESTIONS: Record<string, [string, string, string]> = {
  Triggers: [
    'What situation or person triggered you?',
    'Where did you feel it land in your body?',
    'What did you want to do, or avoid?',
  ],
  Memories: [
    'What memory brought you here?',
    'Is this a new memory, or one that keeps resurfacing?',
    'What does it feel like to stay with it, rather than understand it?',
  ],
  Emotions: [
    'Describe what is still moving in you right now.',
    'What feels unfinished?',
    'What are you avoiding feeling?',
  ],
  Body: [
    'What is currently happening in or with your body?',
    'Has the sensation changed since your practice, or is it the same?',
    'What happens if you stay with it without trying to change it?',
  ],
  Patterns: [
    'What pattern have you identified?',
    'What familiar story showed up?',
    'What would it cost you to let this pattern go?',
  ],
  Meaning: [
    'What meaning has surfaced?',
    'What assumption no longer feels true?',
    'What are you not ready to name yet?',
  ],
  Realizations: [
    'What is becoming clearer?',
    'What surprised you about yourself?',
    'What do you want to remember about this moment?',
  ],
  Actions: [
    'What is asking to be different?',
    'What needs more of your attention?',
    'What would you do today if you trusted what you are feeling?',
  ],
  Gratitude: [
    'What met you today that you did not expect?',
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
  const { category, journeyId } = useLocalSearchParams<{ category: string; journeyId?: string }>();
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
      // Pre-populate journey selection from grid if passed via params
      if (journeyId && journeyId.length > 0 && journeys.some((j) => j.id === journeyId)) {
        setLinkedJourneyId(journeyId);
      }
    })();
  }, [journeyId]);

  async function handleSave() {
    setSaving(true);

    // For categories with emotion step, navigate to emotion-tags screen instead of saving immediately
    if (CATEGORIES_WITH_EMOTION_STEP.includes(cat)) {
      console.log(`[Integration Entry] ${cat} category detected, navigating to emotion-tags`);
      router.push({
        pathname: '/integration/emotion-tags',
        params: {
          category: cat,
          noteDate: noteDate,
          journeyId: linkedJourneyId ?? '',
          q1: answers[0] || '',
          q2: answers[1] || '',
          q3: answers[2] || '',
          freeText: freeText || '',
          carryForward: carryForward || '',
        },
      } as any);
      setSaving(false);
      return;
    }

    // For all other categories, save immediately as before
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

  const hasEmotionStep = CATEGORIES_WITH_EMOTION_STEP.includes(cat);
  const totalSteps = hasEmotionStep ? 3 : 2;
  const currentStep = 2; // This is always screen 2 (questions)

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={[s.title, { color: accentColor }]}>{cat}</Text>
        <View style={{ width: 36 }} />
      </View>
      <ProgressDots current={currentStep} total={totalSteps} />

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
            <Text style={s.saveBtnText}>
              {saving ? (hasEmotionStep ? 'Navigating…' : 'Saving…') : (hasEmotionStep ? 'Next' : 'Save')}
            </Text>
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
  backText: { fontSize: 28, color: COLORS.accent, lineHeight: 32 },
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
  journeyToggleSelected: { borderColor: COLORS.accent, backgroundColor: COLORS.accentTint },
  journeyToggleName: { fontSize: 15, fontFamily: 'Nunito_500Medium', fontWeight: '500', color: '#1A1A1A' },
  journeyToggleSub: { fontSize: 12, fontFamily: 'Nunito_400Regular', color: '#999999', marginTop: 2 },
  journeyCheckbox: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#EEEEEC',
    alignItems: 'center', justifyContent: 'center',
  },
  journeyCheckboxChecked: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
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
