import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

type CategoryKey = 'Actions' | 'Body' | 'Emotions' | 'Gratitude' | 'Meaning' | 'Memories' | 'Patterns' | 'Realizations' | 'Triggers';

const CATEGORY_DATA: Record<CategoryKey, {
  icon: string; color: string; tint: string; desc: string;
}> = {
  Actions:      { icon: 'lightning-bolt-outline',  color: '#C49A6C', tint: '#F9F5F0', desc: 'What will you do differently?' },
  Body:         { icon: 'human',                   color: '#7AAE8A', tint: '#F2F7F3', desc: 'Physical sensations and signals' },
  Emotions:     { icon: 'heart-outline',           color: '#6E9BB5', tint: '#F1F5F8', desc: "What's still moving?" },
  Gratitude:    { icon: 'hand-heart-outline',      color: '#C9B96A', tint: '#FAF8F0', desc: 'What you want to acknowledge' },
  Meaning:      { icon: 'lightbulb-outline',       color: '#9B7FBF', tint: '#F5F2F9', desc: 'Deeper significance' },
  Memories:     { icon: 'image-outline',           color: '#7A8B8B', tint: '#F0F3F3', desc: 'Surfacing images and moments' },
  Patterns:     { icon: 'repeat-variant',          color: '#8B6347', tint: '#F3EDE8', desc: 'Familiar dynamics noticed' },
  Realizations: { icon: 'star-outline',            color: '#7E6B9E', tint: '#F2F0F5', desc: 'What became clearer' },
  Triggers:     { icon: 'alert-circle-outline',    color: '#B5736A', tint: '#F8F1F0', desc: 'What set something off' },
};

const CATEGORIES = Object.keys(CATEGORY_DATA) as CategoryKey[];

export default function NewIntegrationScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={s.title}>Integration</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <Text style={s.prompt}>What do you want to explore?</Text>

        <View style={s.grid}>
          {CATEGORIES.map((cat) => {
            const data = CATEGORY_DATA[cat];
            return (
              <TouchableOpacity
                key={cat}
                style={[s.card, { backgroundColor: data.tint }]}
                onPress={() => router.push({ pathname: '/integration-entry', params: { category: cat } } as any)}
                activeOpacity={0.75}
              >
                <MaterialCommunityIcons name={data.icon as any} size={28} color={data.color} style={{ marginBottom: 6 }} />
                <Text style={[s.cardName, { color: data.color }]}>{cat}</Text>
                <Text style={s.cardDesc}>{data.desc}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F2F1F6' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 28, color: '#B07FFF', lineHeight: 32 },
  title: { fontSize: 17, fontWeight: '500', color: '#1A1A1A' },
  body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  prompt: { fontSize: 16, fontWeight: '500', color: '#1A1A1A', marginBottom: 20, lineHeight: 22 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 32 },
  card: {
    width: '31%', minHeight: 80,
    borderRadius: 12, paddingVertical: 14, paddingHorizontal: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  cardName: { fontSize: 15, fontWeight: '600', textAlign: 'center', marginBottom: 3 },
  cardDesc: { fontSize: 11, color: '#999999', textAlign: 'center', lineHeight: 14 },
});
