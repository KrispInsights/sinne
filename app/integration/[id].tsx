import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { getIntegrations, deleteIntegration } from '@/lib/storage';
import type { Integration } from '@/lib/types';
import { COLORS, FONTS, CARD_SHADOW, CATEGORY_DATA } from '@/lib/theme';

// Category questions (matching integration-entry.tsx)
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

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

export default function IntegrationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [integration, setIntegration] = useState<Integration | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const integrations = await getIntegrations();
        if (cancelled) return;
        const integ = integrations.find((i) => i.id === id) ?? null;
        setIntegration(integ);
      })();
      return () => { cancelled = true; };
    }, [id])
  );

  async function handleDelete() {
    Alert.alert('Delete this integration?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteIntegration(id);
          router.back();
        },
      },
    ]);
  }

  if (!integration) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Text style={s.backBtnText}>‹</Text>
          </TouchableOpacity>
        </View>
        <View style={s.emptyCenter}>
          <Text style={s.emptyText}>Integration not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const cat = integration.category.toLowerCase();
  const displayName = integration.category.charAt(0).toUpperCase() + integration.category.slice(1).toLowerCase();
  const accentColor = CATEGORY_DATA[displayName]?.color ?? COLORS.accent;

  // Get questions for this category
  const questions = CATEGORY_QUESTIONS[displayName] ?? CATEGORY_QUESTIONS.Emotions;

  // Collect all content sections
  const sections: { label: string; content: string }[] = [];

  [1, 2, 3].forEach((n) => {
    const val = (integration as any)[`${cat}_q${n}`];
    if (val && typeof val === 'string' && val.trim()) {
      sections.push({ label: questions[n - 1], content: val.trim() });
    }
  });

  if (integration.free_text && integration.free_text.trim()) {
    sections.push({ label: 'Notes', content: integration.free_text.trim() });
  }

  if (integration.carry_forward && integration.carry_forward.trim()) {
    sections.push({ label: 'Carry forward', content: integration.carry_forward.trim() });
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backBtnText}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        {/* Category chip with accent color */}
        <View style={[s.categoryChip, { backgroundColor: accentColor + '1A' }]}>
          <Text style={[s.categoryChipText, { color: accentColor }]}>{displayName}</Text>
        </View>

        {/* Date */}
        <Text style={s.date}>{formatDate(integration.note_date)}</Text>

        {/* Content sections */}
        {sections.length > 0 ? (
          <View style={[s.card, CARD_SHADOW, { borderLeftWidth: 4, borderLeftColor: accentColor }]}>
            {sections.map((section, idx) => (
              <View key={idx} style={idx > 0 ? s.sectionWithMargin : {}}>
                {sections.length > 1 && (
                  <Text style={s.sectionLabel}>{section.label.toUpperCase()}</Text>
                )}
                <Text style={s.sectionContent}>{section.content}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={s.noContent}>No content available.</Text>
        )}

        {/* Delete button */}
        <TouchableOpacity style={s.deleteBtn} onPress={handleDelete} activeOpacity={0.85}>
          <Text style={s.deleteBtnText}>Delete integration</Text>
        </TouchableOpacity>
      </ScrollView>
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
  backBtnText: { fontSize: 28, color: COLORS.accent, lineHeight: 32 },
  body: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 60 },

  categoryChip: {
    alignSelf: 'flex-start', borderRadius: 24,
    paddingHorizontal: 12, paddingVertical: 6, marginBottom: 12,
  },
  categoryChipText: { fontSize: 14, fontWeight: '600' },

  date: { fontSize: 14, fontWeight: '400', color: COLORS.textTertiary, marginBottom: 20 },

  card: {
    backgroundColor: COLORS.card, borderRadius: 12,
    padding: 20, marginBottom: 24,
  },
  sectionWithMargin: { marginTop: 16 },
  sectionLabel: {
    fontFamily: 'Nunito_500Medium', fontSize: 11, fontWeight: '500', color: COLORS.textTertiary,
    textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8,
  },
  sectionContent: {
    fontSize: 15, fontFamily: FONTS.body, fontWeight: '400',
    color: COLORS.text, lineHeight: 22,
  },

  noContent: { fontSize: 15, color: COLORS.textTertiary, marginTop: 20 },

  deleteBtn: {
    borderWidth: 1, borderColor: '#EEEEEC', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', backgroundColor: '#FAFAF8',
    marginTop: 8,
  },
  deleteBtnText: { fontSize: 15, fontWeight: '500', color: '#FF2A2A' },

  emptyCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 15, color: COLORS.textTertiary },
});
