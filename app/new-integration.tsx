import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, OPTION_TEXT, CATEGORY_DATA } from '@/lib/theme';

const CATEGORIES = Object.keys(CATEGORY_DATA) as Array<keyof typeof CATEGORY_DATA>;

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
                style={[s.card, { backgroundColor: data.tint, borderColor: data.color }]}
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
  backText: { fontSize: 28, color: COLORS.accent, lineHeight: 32 },
  title: { fontSize: 17, fontWeight: '500', color: '#1A1A1A' },
  body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  prompt: { ...OPTION_TEXT, fontSize: 16, fontWeight: '500', marginBottom: 20, lineHeight: 22 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 32 },
  card: {
    width: '31%', minHeight: 80,
    borderRadius: 12, paddingVertical: 14, paddingHorizontal: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
  },
  cardName: { fontSize: 15, fontWeight: '600', textAlign: 'center', marginBottom: 3 },
  cardDesc: { fontSize: 11, color: '#999999', textAlign: 'center', lineHeight: 14 },
});
