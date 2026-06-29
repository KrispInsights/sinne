import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { getIntegrations, getActiveJourneys } from '@/lib/storage';
import type { Integration, Journey } from '@/lib/types';
import { BottomSheet } from '@/components/BottomSheet';
import { COLORS, OPTION_TEXT, CATEGORY_DATA } from '@/lib/theme';

// ---- Category metadata ----

const CATEGORIES = Object.keys(CATEGORY_DATA) as Array<keyof typeof CATEGORY_DATA>;

// ---- Helpers ----

function formatGroupDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'long', day: 'numeric',
  }).toUpperCase();
}

function getFirstLine(integ: Integration): string {
  const cat = integ.category.toLowerCase();
  const fields = [
    integ[`${cat}_q1` as keyof Integration],
    integ[`${cat}_q2` as keyof Integration],
    integ[`${cat}_q3` as keyof Integration],
    integ.free_text,
  ];
  for (const f of fields) {
    if (f && typeof f === 'string' && f.trim()) return f.trim();
  }
  return '';
}

function groupByDate(integrations: Integration[]): { date: string; items: Integration[] }[] {
  const map = new Map<string, Integration[]>();
  for (const i of integrations) {
    const existing = map.get(i.note_date) ?? [];
    map.set(i.note_date, [...existing, i]);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, items]) => ({ date, items }));
}

function getCatData(category: string) {
  const key = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
  return CATEGORY_DATA[key] ?? { color: '#9B7FBF', tint: '#F5F2F9', icon: 'circle-outline', desc: '' };
}

// ---- Integration row ----

function IntegrationRow({ integ, journeyName, onPress }: { integ: Integration; journeyName: string | null; onPress: () => void }) {
  const firstLine = getFirstLine(integ);
  const displayName = integ.category.charAt(0).toUpperCase() + integ.category.slice(1).toLowerCase();
  const data = getCatData(integ.category);

  return (
    <TouchableOpacity
      style={[s.integRow, { borderLeftColor: data.color }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={s.integRowHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[s.integCategory, { color: data.color }]}>{displayName}</Text>
          {firstLine ? (
            <Text style={s.integPreview} numberOfLines={1}>{firstLine}</Text>
          ) : null}
          {journeyName ? (
            <Text style={s.journeyLabel}>{journeyName}</Text>
          ) : null}
        </View>
        <Text style={[s.chevron, { color: data.color }]}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

// ---- Main screen ----

export default function IntegrationScreen() {
  const router = useRouter();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [activeJourneys, setActiveJourneys] = useState<Journey[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const data = await getIntegrations();
        const journeys = await getActiveJourneys();
        if (!cancelled) {
          setIntegrations(data);
          setActiveJourneys(journeys);
        }
      })();
      return () => { cancelled = true; };
    }, [])
  );

  const groups = groupByDate(integrations);

  function handleNewSession() {
    setActionSheetOpen(false);
    router.push('/new-session');
  }

  function handleNewIntegration() {
    setActionSheetOpen(false);
    router.push('/new-integration');
  }

  function handleNewJourney() {
    setActionSheetOpen(false);
    router.push('/new-journey');
  }

  return (
    <SafeAreaView edges={['top']} style={s.safe}>
      <LinearGradient
        colors={['rgba(176, 127, 255, 0.18)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: 200,
          zIndex: 0,
        }}
        pointerEvents="none"
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.titleRow}>
          <Text style={s.title}>Integration</Text>
          <TouchableOpacity onPress={() => router.push('/settings' as any)} hitSlop={8}>
            <MaterialCommunityIcons name="cog-outline" size={20} color="#CCCCCC" />
          </TouchableOpacity>
        </View>
        <Text style={s.prompt}>What do you want to explore?</Text>

        {/* 3×3 grid */}
        <View style={s.grid}>
          {CATEGORIES.map((cat) => {
            const data = CATEGORY_DATA[cat];
            return (
              <TouchableOpacity
                key={cat}
                style={[s.gridCard, { backgroundColor: data.tint, borderColor: data.color }]}
                onPress={() => router.push({
                  pathname: '/integration-entry',
                  params: { category: cat }
                } as any)}
                activeOpacity={0.75}
              >
                <MaterialCommunityIcons name={data.icon as any} size={28} color={data.color} style={{ marginBottom: 6 }} />
                <Text style={[s.gridCardName, { color: data.color }]}>{cat}</Text>
                <Text style={s.gridCardDesc}>{data.desc}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Log section */}
        {integrations.length === 0 ? (
          <View style={s.emptyRow}>
            <Text style={s.emptyText}>{"What's still moving after your practice? Log it here."}</Text>
          </View>
        ) : (
          <View style={s.logSection}>
            <Text style={s.logSectionLabel}>YOUR INTEGRATIONS</Text>
            {groups.map(({ date, items }) => (
              <View key={date} style={s.dateGroup}>
                <Text style={s.dateHeader}>{formatGroupDate(date)}</Text>
                {items.map((integ, idx) => {
                  const journeyName = integ.journey_id
                    ? activeJourneys.find((j) => j.id === integ.journey_id)?.name ?? null
                    : null;
                  return (
                    <IntegrationRow
                      key={integ.id}
                      integ={integ}
                      journeyName={journeyName}
                      onPress={() => router.push({ pathname: '/integration/[id]', params: { id: integ.id } } as any)}
                    />
                  );
                })}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={s.fab} onPress={() => setActionSheetOpen(true)} activeOpacity={0.85}>
        <MaterialCommunityIcons name="plus" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Action sheet */}
      <BottomSheet visible={actionSheetOpen} onDismiss={() => setActionSheetOpen(false)}>
        <View style={s.actionSheet}>
          <TouchableOpacity style={s.actionRow} onPress={handleNewSession} activeOpacity={0.7}>
            <MaterialCommunityIcons name="plus-circle-outline" size={26} color="#7AAE8A" />
            <View style={{ flex: 1 }}>
              <Text style={s.actionLabel}>Log a session</Text>
              <Text style={s.actionSubtitle}>Record what you noticed</Text>
            </View>
          </TouchableOpacity>
          <View style={s.actionDivider} />
          <TouchableOpacity style={s.actionRow} onPress={handleNewIntegration} activeOpacity={0.7}>
            <MaterialCommunityIcons name="notebook-edit-outline" size={26} color="#6E9BB5" />
            <View style={{ flex: 1 }}>
              <Text style={s.actionLabel}>New integration</Text>
              <Text style={s.actionSubtitle}>{"Log what's still moving"}</Text>
            </View>
          </TouchableOpacity>
          <View style={s.actionDivider} />
          <TouchableOpacity style={s.actionRow} onPress={handleNewJourney} activeOpacity={0.7}>
            <MaterialCommunityIcons name="map-marker-path" size={26} color="#9B7FBF" />
            <View style={{ flex: 1 }}>
              <Text style={s.actionLabel}>New journey</Text>
              <Text style={s.actionSubtitle}>Set an intention or context</Text>
            </View>
          </TouchableOpacity>
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

// ---- Styles ----

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 60 },

  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  title: { fontSize: 32, fontFamily: 'DMSerifDisplay_400Regular', color: '#1A1A1A' },
  prompt: { fontSize: 15, fontWeight: '400', color: '#666666', marginBottom: 20, lineHeight: 22 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 32 },
  gridCard: {
    width: '31%', minHeight: 80,
    borderRadius: 12, paddingVertical: 14, paddingHorizontal: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
  },
  gridCardName: { fontSize: 15, fontWeight: '500', textAlign: 'center', marginBottom: 3 },
  gridCardDesc: { fontSize: 11, color: '#999999', textAlign: 'center', lineHeight: 14 },

  emptyRow: { alignItems: 'center', paddingTop: 8 },
  emptyText: { fontSize: 15, color: '#999999', textAlign: 'center', lineHeight: 22 },

  logSection: {},
  logSectionLabel: {
    fontFamily: 'Nunito_500Medium', fontSize: 11, fontWeight: '500', color: '#999999',
    textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12,
  },

  dateGroup: {
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 12,
    elevation: 2,
  },
  dateHeader: {
    fontFamily: 'Nunito_500Medium', fontSize: 11, fontWeight: '500', color: '#999999',
    letterSpacing: 1.2, textTransform: 'uppercase', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6,
  },

  integRow: {
    paddingHorizontal: 16, paddingVertical: 12,
    borderLeftWidth: 3,
  },
  integRowHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  integCategory: { fontFamily: 'Nunito_500Medium', fontSize: 14, fontWeight: '500' },
  integPreview: { fontFamily: 'Nunito_400Regular', fontSize: 15, fontWeight: '400', color: '#666666', lineHeight: 22 },
  journeyLabel: {
    fontFamily: 'Nunito_500Medium',
    fontSize: 11,
    fontWeight: '500',
    color: '#9B7FBF',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  chevron: { fontSize: 18 },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#EEEEEC', marginHorizontal: 16 },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#B07FFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#B07FFF',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },

  // Action sheet
  actionSheet: { paddingTop: 4 },
  actionRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 24, paddingVertical: 14, gap: 16, minHeight: 64,
  },
  actionLabel: { fontFamily: 'Nunito_500Medium', fontSize: 15, fontWeight: '500', color: '#1A1A1A' },
  actionSubtitle: { fontFamily: 'Nunito_400Regular', fontSize: 12, fontWeight: '400', color: '#999999', marginTop: 2 },
  actionDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#EEEEEC', marginHorizontal: 24 },
});
