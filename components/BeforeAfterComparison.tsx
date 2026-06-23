// Phase 4 — Before/after comparison component
// Shows side-by-side body maps and NS state proportions for first half vs second half of an arc
// Consumed by both Home Breakdown (4a) and Journey detail (4b)

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BodyFigureAggregated } from './BodyFigure';
import type { SessionWithCheckin } from '@/lib/types';
import { COLORS } from '@/lib/theme';

interface BeforeAfterComparisonProps {
  sessions: SessionWithCheckin[];
  framework: string;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function computeNSStateProportions(sessions: SessionWithCheckin[]): {
  grounded: number;
  activated: number;
  shutdown: number;
} {
  const counts = { grounded: 0, activated: 0, shutdown: 0 };
  let total = 0;

  for (const s of sessions) {
    const state = s.checkin?.nervous_system_state;
    if (!state) continue;
    total++;
    // Map all framework aliases to base states
    if (state === 'grounded' || state === 'ventral' || state === 'self') {
      counts.grounded++;
    } else if (state === 'activated' || state === 'sympathetic' || state === 'activated part') {
      counts.activated++;
    } else if (state === 'shutdown' || state === 'dorsal' || state === 'blended') {
      counts.shutdown++;
    }
  }

  if (total === 0) return { grounded: 0, activated: 0, shutdown: 0 };

  return {
    grounded: Math.round((counts.grounded / total) * 100),
    activated: Math.round((counts.activated / total) * 100),
    shutdown: Math.round((counts.shutdown / total) * 100),
  };
}

export function BeforeAfterComparison({ sessions, framework }: BeforeAfterComparisonProps) {
  // Require minimum 6 sessions (3 per half)
  if (sessions.length < 6) {
    return null;
  }

  // Sort by created_at
  const sorted = [...sessions].sort((a, b) =>
    a.session.created_at.localeCompare(b.session.created_at)
  );

  // Split at midpoint
  const midpoint = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, midpoint);
  const secondHalf = sorted.slice(midpoint);

  // Get date ranges
  const firstStart = firstHalf[0]?.session.created_at.split('T')[0] ?? '';
  const firstEnd = firstHalf[firstHalf.length - 1]?.session.created_at.split('T')[0] ?? '';
  const secondStart = secondHalf[0]?.session.created_at.split('T')[0] ?? '';
  const secondEnd = secondHalf[secondHalf.length - 1]?.session.created_at.split('T')[0] ?? '';

  const firstLabel = `${formatDateLabel(firstStart)}–${formatDateLabel(firstEnd)}`;
  const secondLabel = `${formatDateLabel(secondStart)}–${formatDateLabel(secondEnd)}`;

  // Aggregate body sensations
  const firstSensations = firstHalf.flatMap(s => s.checkin?.body_sensations ?? []);
  const secondSensations = secondHalf.flatMap(s => s.checkin?.body_sensations ?? []);

  // Compute NS state proportions
  const firstProportions = computeNSStateProportions(firstHalf);
  const secondProportions = computeNSStateProportions(secondHalf);

  return (
    <View style={s.container}>
      <View style={s.halves}>
        {/* First half */}
        <View style={s.half}>
          <Text style={s.dateLabel}>{firstLabel}</Text>
          <View style={s.figureWrapper}>
            <BodyFigureAggregated width={140} bodySensations={firstSensations} />
          </View>
          <View style={s.stateRows}>
            <StateRow label="Grounded" percentage={firstProportions.grounded} color="#8FAE9A" />
            <StateRow label="Activated" percentage={firstProportions.activated} color="#D6C2A1" />
            <StateRow label="Shutdown" percentage={firstProportions.shutdown} color="#A89ABF" />
          </View>
        </View>

        {/* Second half */}
        <View style={s.half}>
          <Text style={s.dateLabel}>{secondLabel}</Text>
          <View style={s.figureWrapper}>
            <BodyFigureAggregated width={140} bodySensations={secondSensations} />
          </View>
          <View style={s.stateRows}>
            <StateRow label="Grounded" percentage={secondProportions.grounded} color="#8FAE9A" />
            <StateRow label="Activated" percentage={secondProportions.activated} color="#D6C2A1" />
            <StateRow label="Shutdown" percentage={secondProportions.shutdown} color="#A89ABF" />
          </View>
        </View>
      </View>
    </View>
  );
}

function StateRow({ label, percentage, color }: { label: string; percentage: number; color: string }) {
  return (
    <View style={s.stateRow}>
      <View style={[s.stateDot, { backgroundColor: color }]} />
      <Text style={s.stateLabel}>{label}</Text>
      <Text style={s.statePercentage}>{percentage}%</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000000',
    shadowOpacity: 0.02,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  halves: {
    flexDirection: 'row',
    gap: 20,
  },
  half: {
    flex: 1,
    alignItems: 'center',
  },
  dateLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginBottom: 16,
    textAlign: 'center',
  },
  figureWrapper: {
    marginBottom: 20,
  },
  stateRows: {
    width: '100%',
    gap: 8,
  },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stateDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stateLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '400',
    color: COLORS.textSecondary,
  },
  statePercentage: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
});
