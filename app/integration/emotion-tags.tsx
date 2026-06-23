import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { createIntegration } from '@/lib/storage';
import type { CreateIntegrationInput } from '@/lib/types';
import { EmotionSelector } from '@/components/EmotionSelector';
import { COLORS, CATEGORY_DATA } from '@/lib/theme';

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

export default function EmotionTagsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    category: string;
    noteDate: string;
    journeyId?: string;
    q1?: string;
    q2?: string;
    q3?: string;
    freeText?: string;
    carryForward?: string;
  }>();

  console.log('[EmotionTags] Screen loaded with params:', params);

  const [emotionTags, setEmotionTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const cat = params.category ?? 'Emotions';
  const accentColor = CATEGORY_DATA[cat]?.color ?? '#9B7FBF';

  async function handleSave() {
    setSaving(true);

    const input: CreateIntegrationInput = {
      note_date: params.noteDate,
      category: cat.toLowerCase(),
      journey_id: params.journeyId && params.journeyId.length > 0 ? params.journeyId : null,
      free_text: params.freeText || null,
      carry_forward: params.carryForward || null,
      emotion_tags: emotionTags,
    };

    // Add category-specific questions
    const catKey = cat.toLowerCase();
    (input as any)[`${catKey}_q1`] = params.q1 || null;
    (input as any)[`${catKey}_q2`] = params.q2 || null;
    (input as any)[`${catKey}_q3`] = params.q3 || null;

    await createIntegration(input);

    // Navigate back to integration grid (2 screens back)
    router.back();
    router.back();
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
      </View>
      <ProgressDots current={3} total={3} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.body}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[s.title, { color: accentColor }]}>Name what's here</Text>
        <Text style={s.subtitle}>Optional — select any that feel true</Text>

        <EmotionSelector selected={emotionTags} onChange={setEmotionTags} />
      </ScrollView>

      {/* Bottom action */}
      <View style={s.footer}>
        <TouchableOpacity
          style={[s.saveBtn, { backgroundColor: accentColor }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          <Text style={s.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 28, color: COLORS.accent, lineHeight: 32 },

  body: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 100,
  },

  title: {
    fontSize: 28,
    fontFamily: 'DMSerifDisplay_400Regular',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '400',
    color: '#666666',
    marginBottom: 24,
    lineHeight: 22,
  },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.background,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEC',
  },

  saveBtn: {
    borderRadius: 12,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
