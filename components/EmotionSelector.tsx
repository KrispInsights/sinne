import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { INTEGRATION_EMOTION_SELECTOR } from '@/lib/types';
import { OPTION_TEXT } from '@/lib/theme';

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
      {INTEGRATION_EMOTION_SELECTOR.map((emotion) => {
        const primaryLower = emotion.primary.toLowerCase();
        const isPrimarySelected = selected.includes(primaryLower);

        return (
          <View key={emotion.primary} style={s.emotionBlock}>
            {/* Primary emotion chip */}
            <TouchableOpacity
              style={[s.chip, isPrimarySelected && s.chipSelected]}
              onPress={() => togglePrimary(emotion.primary)}
              activeOpacity={0.7}
            >
              <Text style={[s.chipText, isPrimarySelected && s.chipTextSelected]}>
                {emotion.primary}
              </Text>
            </TouchableOpacity>

            {/* Sub-emotion chips (only shown when primary is selected) */}
            {isPrimarySelected && (
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
            )}
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    gap: 12,
  },
  emotionBlock: {
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FAFAF8',
    borderWidth: 1,
    borderColor: '#EEEEEC',
  },
  chipSelected: {
    backgroundColor: '#B07FFF',
    borderColor: '#B07FFF',
  },
  chipText: {
    ...OPTION_TEXT,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  subRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingLeft: 8,
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
    backgroundColor: '#B07FFF',
    borderColor: '#B07FFF',
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
