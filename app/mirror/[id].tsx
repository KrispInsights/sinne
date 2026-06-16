import React, { useState, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { getMirrors } from '@/lib/storage';
import type { Mirror } from '@/lib/types';
import { COLORS } from '@/lib/theme';

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatDateRange(mirror: Mirror): string {
  const start = new Date(mirror.period_start + 'T00:00:00');
  const end = new Date(mirror.period_end + 'T00:00:00');
  if (mirror.type === 'journey') {
    const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startStr} – ${endStr}`;
  }
  if (mirror.type === 'monthly') {
    return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
  const year = end.getFullYear();
  if (startMonth === endMonth) {
    return `${startMonth} ${start.getDate()}–${end.getDate()}, ${year}`;
  }
  return `${startMonth} ${start.getDate()} – ${endMonth} ${end.getDate()}, ${year}`;
}

export default function MirrorDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [mirror, setMirror] = useState<Mirror | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    (async () => {
      const mirrors = await getMirrors();
      const found = mirrors.find((m) => m.id === id) ?? null;
      if (!cancelled) setMirror(found);
    })();
    return () => { cancelled = true; };
  }, [id]));

  async function handleCopy() {
    if (!mirror) return;
    await Clipboard.setStringAsync(mirror.content);
    toastAnim.setValue(1);
    Animated.timing(toastAnim, { toValue: 0, duration: 600, delay: 1500, useNativeDriver: true }).start();
  }

  if (!mirror) {
    return (
      <SafeAreaView edges={['top']} style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <MaterialCommunityIcons name="chevron-left" size={28} color="#1A1A1A" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <MaterialCommunityIcons name="chevron-left" size={28} color="#1A1A1A" />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleCopy} hitSlop={8}>
          <MaterialCommunityIcons name="content-copy" size={22} color="#666666" />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={[s.typePill, mirror.type === 'journey' && { backgroundColor: '#F7F0E7' }]}>
          <Text style={[s.typePillText, mirror.type === 'journey' && { color: '#C49A6C' }]}>
            {mirror.type === 'journey'
              ? `Journey · ${mirror.journey_name ?? 'Journey'}`
              : mirror.type === 'weekly' ? 'Weekly Mirror' : 'Monthly Mirror'}
          </Text>
        </View>
        <Text style={s.dateRange}>{formatDateRange(mirror)}</Text>

        <View style={s.statsRow}>
          <View style={s.statItem}>
            <MaterialCommunityIcons name="clock-outline" size={16} color="#999999" />
            <Text style={s.statText}>{mirror.session_count} session{mirror.session_count !== 1 ? 's' : ''}</Text>
          </View>
          <View style={s.statItem}>
            <MaterialCommunityIcons name="notebook-outline" size={16} color="#999999" />
            <Text style={s.statText}>{mirror.integration_count} integration{mirror.integration_count !== 1 ? 's' : ''}</Text>
          </View>
        </View>

        <View style={s.textCard}>
          <Text style={s.bodyText}>{mirror.content}</Text>
        </View>

        <Text style={s.disclaimer}>Reflection only. The Mirror never gives advice.</Text>
      </ScrollView>

      <Animated.View style={[s.toast, { opacity: toastAnim }]} pointerEvents="none">
        <Text style={s.toastText}>Copied</Text>
      </Animated.View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8,
  },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 60 },

  typePill: {
    alignSelf: 'flex-start', backgroundColor: '#F6F0FF', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5, marginBottom: 8,
  },
  typePillText: { fontSize: 11, fontWeight: '500', color: '#B07FFF' },
  dateRange: { fontSize: 20, fontWeight: '500', color: '#1A1A1A', marginBottom: 16 },

  statsRow: { flexDirection: 'row', gap: 20, marginBottom: 24 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statText: { fontSize: 13, color: '#666666' },

  textCard: {
    backgroundColor: '#FAFAF8', borderWidth: 1, borderColor: '#EEEEEC',
    borderRadius: 12, padding: 20, marginBottom: 16,
  },
  bodyText: { fontSize: 15, fontWeight: '400', lineHeight: 25.5, color: '#1A1A1A' },

  disclaimer: { fontSize: 11, fontWeight: '400', color: '#999999', textAlign: 'center' },

  toast: {
    position: 'absolute', bottom: 40, alignSelf: 'center',
    backgroundColor: '#1A1A1A', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  toastText: { fontSize: 13, fontWeight: '500', color: '#FFFFFF' },
});
