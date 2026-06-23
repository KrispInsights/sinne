// Phase 3 — Aggregated body map test component
// This is a temporary test component to validate BodyFigureAggregated against different session counts
// To use: import and render in any screen, then test on both iOS and Android

import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { BodyFigureAggregated } from './BodyFigure';
import type { BodySensation } from '@/lib/types';

// Generate mock body sensations with realistic distribution
function generateMockSensations(count: number): BodySensation[] {
  const regions = [
    'head', 'eyes', 'jaw', 'throat', 'chest', 'shoulders', 'arms',
    'solar_plexus', 'pelvis', 'legs', 'spine', 'full_body'
  ];
  const qualities = ['opening', 'tightness', 'warmth', 'pressure', 'releasing', null];

  const sensations: BodySensation[] = [];

  // Create a realistic distribution: chest and throat more common than eyes/jaw
  const weights = {
    chest: 3,
    throat: 3,
    solar_plexus: 2,
    shoulders: 2,
    head: 2,
    pelvis: 2,
    legs: 1,
    arms: 1,
    spine: 1,
    jaw: 1,
    eyes: 1,
    full_body: 1,
  };

  const weightedRegions: string[] = [];
  for (const [region, weight] of Object.entries(weights)) {
    for (let i = 0; i < weight; i++) {
      weightedRegions.push(region);
    }
  }

  for (let i = 0; i < count; i++) {
    const region = weightedRegions[Math.floor(Math.random() * weightedRegions.length)];
    const quality = qualities[Math.floor(Math.random() * qualities.length)];
    sensations.push({ region, quality });
  }

  return sensations;
}

export function BodyFigureTest() {
  // Test scenarios: 10, 50, 200 sessions
  const scenarios = [
    { label: '10 sessions', sensations: generateMockSensations(10) },
    { label: '50 sessions', sensations: generateMockSensations(50) },
    { label: '200 sessions', sensations: generateMockSensations(200) },
  ];

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.header}>Aggregated Body Map Test</Text>
      <Text style={s.subtitle}>
        Testing readability across different session counts.{'\n'}
        Verify on both iOS and Android.
      </Text>

      {scenarios.map((scenario, idx) => (
        <View key={idx} style={s.scenario}>
          <Text style={s.scenarioLabel}>{scenario.label}</Text>
          <View style={s.figureContainer}>
            <BodyFigureAggregated width={180} bodySensations={scenario.sensations} />
          </View>
          <Text style={s.regionCount}>
            {Array.from(new Set(scenario.sensations.map(s => s.region))).length} unique regions
          </Text>
        </View>
      ))}

      <View style={s.notes}>
        <Text style={s.notesTitle}>Expected behavior:</Text>
        <Text style={s.note}>• 200-session figure should be as readable as 10-session</Text>
        <Text style={s.note}>• No muddy/washed-out overlays on Android</Text>
        <Text style={s.note}>• Clear intensity tiers (quiet/present/frequent)</Text>
        <Text style={s.note}>• Chakra colors preserved at all opacity levels</Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F1F6' },
  content: { padding: 20, alignItems: 'center' },
  header: { fontSize: 24, fontWeight: '700', color: '#1A1A1A', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#666666', textAlign: 'center', lineHeight: 20, marginBottom: 32 },
  scenario: { marginBottom: 40, alignItems: 'center', width: '100%' },
  scenarioLabel: { fontSize: 16, fontWeight: '600', color: '#1A1A1A', marginBottom: 16 },
  figureContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000000',
    shadowOpacity: 0.02,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  regionCount: { fontSize: 12, color: '#999999', marginTop: 12 },
  notes: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    marginTop: 20,
  },
  notesTitle: { fontSize: 14, fontWeight: '600', color: '#1A1A1A', marginBottom: 12 },
  note: { fontSize: 13, color: '#666666', marginBottom: 6, lineHeight: 18 },
});
