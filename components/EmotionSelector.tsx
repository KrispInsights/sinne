import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { INTEGRATION_EMOTION_SELECTOR } from '@/lib/types';
import { OPTION_TEXT, COLORS } from '@/lib/theme';

interface Props {
  selected: string[];
  onChange: (tags: string[]) => void;
}

export function EmotionSelector({ selected, onChange }: Props) {
  function togglePrimary(primary: string) {
    const primaryLower = primary.toLowerCase();
    const isSelected = selected.includes(primaryLower);

    if (isSelected) {
      // Deselect primary and all its subs
      const emotion = INTEGRATION_EMOTION_SELECTOR.find((e) => e.primary === primary);
      const subsLower = emotion?.subs.map((s) => s.toLowerCase()) ?? [];
      const newSelected = selected.filter((tag) => tag !== primaryLower && !subsLower.includes(tag));
      onChange(newSelected);
    } else {
      // Select primary
      onChange([...selected, primaryLower]);
    }
  }

  function toggleSub(primary: string, sub: string) {
    const primaryLower = primary.toLowerCase();
    const subLower = sub.toLowerCase();
    const isSelected = selected.includes(subLower);

    if (isSelected) {
      // Deselect sub
      onChange(selected.filter((tag) => tag !== subLower));
    } else {
      // Select sub and ensure primary is also selected
      const newSelected = [...selected];
      if (!newSelected.includes(primaryLower)) {
        newSelected.push(primaryLower);
      }
      newSelected.push(subLower);
      onChange(newSelected);
    }
  }

  return (
    <View style={s.container}>
      {/* Primary emotions in grid layout */}
      <View style={s.grid}>
        {INTEGRATION_EMOTION_SELECTOR.map((emotion) => {
          const primaryLower = emotion.primary.toLowerCase();
          const isPrimarySelected = selected.includes(primaryLower);

          return (
            <TouchableOpacity
              key={emotion.primary}
              style={[
                s.gridCard,
                isPrimarySelected && s.gridCardSelected,
                { borderColor: isPrimarySelected ? COLORS.accent : COLORS.border }
              ]}
              onPress={() => togglePrimary(emotion.primary)}
              activeOpacity={0.7}
            >
              <Text style={[s.gridCardText, isPrimarySelected && s.gridCardTextSelected]}>
                {emotion.primary}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Sub-emotions (shown below grid for all selected primaries) */}
      {INTEGRATION_EMOTION_SELECTOR.map((emotion) => {
        const primaryLower = emotion.primary.toLowerCase();
        const isPrimarySelected = selected.includes(primaryLower);

        if (!isPrimarySelected) return null;

        return (
          <View key={`subs-${emotion.primary}`} style={s.subSection}>
            <Text style={s.subSectionTitle}>{emotion.primary}</Text>
            <View style={s.subRow}>
              {emotion.subs.map((sub) => {
                const subLower = sub.toLowerCase();
                const isSubSelected = selected.includes(subLower);

                return (
                  <TouchableOpacity
                    key={sub}
                    style={[s.subChip, isSubSelected && s.subChipSelected]}
                    onPress={() => toggleSub(emotion.primary, sub)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.subChipText, isSubSelected && s.subChipTextSelected]}>
                      {sub}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    gap: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridCard: {
    width: '31%',
    minHeight: 64,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFAF8',
    borderWidth: 1.5,
  },
  gridCardSelected: {
    backgroundColor: COLORS.accent,
  },
  gridCardText: {
    ...OPTION_TEXT,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  gridCardTextSelected: {
    color: '#FFFFFF',
  },
  subSection: {
    gap: 8,
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.accent,
    marginBottom: 4,
  },
  subRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  subChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    minHeight: 32,
    justifyContent: 'center',
    backgroundColor: '#FAFAF8',
    borderWidth: 1,
    borderColor: '#EEEEEC',
  },
  subChipSelected: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  subChipText: {
    ...OPTION_TEXT,
    fontSize: 13,
    fontWeight: '400',
  },
  subChipTextSelected: {
    color: '#FFFFFF',
  },
});
