import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { createJourney } from '@/lib/storage';

// ---- Date helpers ----

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateToIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDisplayDate(iso: string): string {
  const date = isoToDate(iso);
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  if (targetDate.getTime() === todayDate.getTime()) {
    return `Today, ${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`;
  }

  return date.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ---- Wheel picker ----

const ITEM_H = 50;
const VISIBLE = 5;
const WHEEL_H = ITEM_H * VISIBLE;

function WheelPicker({
  items,
  selectedIndex,
  onIndexChange,
}: {
  items: string[];
  selectedIndex: number;
  onIndexChange: (idx: number) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const [layoutDone, setLayoutDone] = useState(false);

  useEffect(() => {
    if (layoutDone) {
      scrollRef.current?.scrollTo({ y: selectedIndex * ITEM_H, animated: false });
    }
  }, [layoutDone]);

  return (
    <View style={ws.wrapper}>
      <View style={ws.highlight} pointerEvents="none" />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        onLayout={() => setLayoutDone(true)}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
          onIndexChange(Math.max(0, Math.min(idx, items.length - 1)));
        }}
        contentContainerStyle={{ paddingVertical: ITEM_H * 2 }}
        scrollEventThrottle={16}
      >
        {items.map((label, idx) => {
          const isSel = idx === selectedIndex;
          return (
            <View key={idx} style={ws.item}>
              <Text style={[ws.itemText, isSel && ws.itemTextSel]}>{label}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const ws = StyleSheet.create({
  wrapper: {
    height: WHEEL_H,
    width: 160,
    overflow: 'hidden',
    backgroundColor: '#FAFAF8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEEEEC',
  },
  highlight: {
    position: 'absolute',
    top: ITEM_H * 2, left: 0, right: 0, height: ITEM_H,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#B07FFF',
    zIndex: 1,
  },
  item: { height: ITEM_H, alignItems: 'center', justifyContent: 'center' },
  itemText: { fontSize: 14, fontWeight: '400', color: '#999999', textAlign: 'center' },
  itemTextSel: { fontSize: 16, fontWeight: '600', color: '#1A1A1A' },
});

// ---- Main screen ----

const DURATION_DAYS_VALUES = Array.from({ length: 90 }, (_, i) => i + 1); // [1, 2, ..., 90]
const DURATION_ITEMS = DURATION_DAYS_VALUES.map((d) => (d === 1 ? '1 day' : `${d} days`));

const INTENTION_OPTIONS = [
  'Emotional release',
  'Grief processing',
  'Nervous system regulation',
  'Presence',
  'Self-trust',
  'Relationships',
  'Anxiety',
  'Trauma healing',
  'Spiritual growth',
  'Understanding my patterns',
];

export default function NewJourneyScreen() {
  const router = useRouter();
  const { bottom: safeBottom } = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(todayIso());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [durationIndex, setDurationIndex] = useState(9);  // default = 10 days
  const [selectedIntentions, setSelectedIntentions] = useState<string[]>([]);
  const [customIntention, setCustomIntention] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedDays = DURATION_DAYS_VALUES[durationIndex];

  async function handleCreate() {
    if (!name.trim() || saving) return;
    setSaving(true);
    const allIntentions = [...selectedIntentions];
    if (customIntention.trim()) {
      allIntentions.push(customIntention.trim());
    }
    await createJourney({
      name: name.trim(),
      start_date: startDate,
      duration_days: selectedDays,
      intentions: allIntentions.length > 0 ? allIntentions : null,
    });
    router.back();
  }

  function toggleIntention(intention: string) {
    setSelectedIntentions(prev =>
      prev.includes(intention)
        ? prev.filter(i => i !== intention)
        : [...prev, intention]
    );
  }

  const canCreate = name.trim().length > 0;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={s.title}>New journey</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[s.body, { paddingBottom: Math.max(safeBottom + 24, 40) }]} showsVerticalScrollIndicator={false}>

        <View style={s.infoBox}>
          <Text style={s.infoTitle}>What's a Journey?</Text>
          <Text style={s.infoText}>
            A Journey is any period of practice you want to track as a whole, something with a beginning and an arc. It could be a structured program, a personal commitment, or just a container you're holding for yourself.
          </Text>
          <Text style={[s.infoText, { marginTop: 8, fontStyle: 'italic' }]}>
            Setting up a Journey doesn't create a schedule or track whether you showed up. It gives your reflection a sense of where you are in the arc.
          </Text>
        </View>

        <Text style={s.label}>JOURNEY NAME</Text>
        <TextInput
          style={s.input}
          placeholder="10 Days Yoga Challenge"
          placeholderTextColor="#999999"
          value={name}
          onChangeText={setName}
          returnKeyType="done"
        />

        <View style={s.pickersRow}>
          <View style={s.pickerCol}>
            <Text style={s.label}>START DATE</Text>
            <TouchableOpacity
              style={s.dateChip}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.75}
            >
              <MaterialCommunityIcons name="calendar-blank-outline" size={16} color="#B07FFF" />
              <Text style={s.dateChipText}>{formatDisplayDate(startDate)}</Text>
            </TouchableOpacity>
          </View>
          <View style={s.pickerCol}>
            <Text style={s.label}>DURATION</Text>
            <WheelPicker
              items={DURATION_ITEMS}
              selectedIndex={durationIndex}
              onIndexChange={setDurationIndex}
            />
          </View>
        </View>

        <View style={{ marginTop: 32 }}>
          <Text style={s.label}>INTENTION</Text>
          <Text style={s.intentionPrompt}>Why are you doing this journey?</Text>

          <View style={s.intentionGrid}>
            {INTENTION_OPTIONS.map((intention) => {
              const isSelected = selectedIntentions.includes(intention);
              return (
                <TouchableOpacity
                  key={intention}
                  style={[s.intentionCard, isSelected && s.intentionCardSelected]}
                  onPress={() => toggleIntention(intention)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.intentionCardText, isSelected && s.intentionCardTextSelected]}>
                    {intention}
                  </Text>
                  {isSelected && (
                    <View style={s.intentionCheckBadge}>
                      <Text style={s.intentionCheckMark}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <TextInput
            style={s.customIntentionInput}
            placeholder="Add your own intention..."
            placeholderTextColor="#999999"
            value={customIntention}
            onChangeText={setCustomIntention}
            returnKeyType="done"
          />
        </View>

        {/* Create button inside scroll */}
        <TouchableOpacity
          style={[s.createBtn, !canCreate && s.createBtnDisabled, { marginTop: 32 }]}
          onPress={handleCreate}
          disabled={!canCreate || saving}
          activeOpacity={0.85}
        >
          <Text style={s.createBtnText}>{saving ? 'Creating…' : 'Create journey'}</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Date picker modal */}
      <Modal transparent visible={showDatePicker} animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
        <TouchableOpacity
          style={s.modalBackdrop}
          onPress={() => setShowDatePicker(false)}
          activeOpacity={1}
        >
          <View style={[s.datePickerCard, { marginBottom: Math.max(safeBottom + 20, 40) }]}>
            <Text style={s.datePickerTitle}>Choose start date</Text>
            <DateTimePicker
              value={isoToDate(startDate)}
              mode="date"
              display="inline"
              onChange={(event, selectedDate) => {
                if (event.type === 'set' && selectedDate) {
                  setStartDate(dateToIso(selectedDate));
                  setShowDatePicker(false);
                }
              }}
            />
            <TouchableOpacity style={s.datePickerDoneBtn} onPress={() => setShowDatePicker(false)} activeOpacity={0.8}>
              <Text style={s.datePickerDoneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 28, color: '#B07FFF', lineHeight: 32 },
  title: { fontSize: 17, fontWeight: '500', color: '#1A1A1A' },
  body: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24 },

  infoBox: {
    backgroundColor: '#FAFAF8', borderWidth: 1, borderColor: '#EEEEEC',
    borderRadius: 12, padding: 16, marginBottom: 28,
  },
  infoTitle: { fontSize: 14, fontWeight: '600', color: '#1A1A1A', marginBottom: 8 },
  infoText: { fontSize: 14, color: '#666666', lineHeight: 20 },

  label: {
    fontSize: 13, fontWeight: '600', color: '#999999',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10,
  },

  input: {
    backgroundColor: '#FAFAF8', borderWidth: 1, borderColor: '#EEEEEC',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14,
    fontSize: 15, color: '#1A1A1A', marginBottom: 28,
  },

  pickersRow: {
    flexDirection: 'row', gap: 16, alignItems: 'flex-start',
  },
  pickerCol: {
    flex: 1, alignItems: 'center',
  },

  dateChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F6F0FF', borderWidth: 1, borderColor: '#B07FFF',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14,
    minHeight: 48, justifyContent: 'center',
  },
  dateChipText: { fontSize: 14, fontWeight: '600', color: '#B07FFF' },

  createBtn: {
    backgroundColor: '#B07FFF', borderRadius: 12, height: 52,
    alignItems: 'center', justifyContent: 'center',
  },
  createBtnDisabled: { opacity: 0.4 },
  createBtnText: { fontSize: 15, fontWeight: '500', color: '#FFFFFF' },

  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end', paddingHorizontal: 16,
  },
  datePickerCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20,
  },
  datePickerTitle: {
    fontSize: 17, fontWeight: '500', color: '#1A1A1A', marginBottom: 12,
  },
  datePickerDoneBtn: {
    backgroundColor: '#B07FFF', borderRadius: 12, height: 48,
    alignItems: 'center', justifyContent: 'center', marginTop: 12,
  },
  datePickerDoneBtnText: {
    fontSize: 15, fontWeight: '500', color: '#FFFFFF',
  },

  intentionPrompt: {
    fontSize: 15, fontWeight: '400', color: '#666666', marginBottom: 16,
  },
  intentionGrid: {
    gap: 12, marginBottom: 16,
  },
  intentionCard: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EEEEEC',
    borderRadius: 20, padding: 20, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', minHeight: 64,
    shadowColor: '#000000', shadowOpacity: 0.03, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  intentionCardSelected: {
    backgroundColor: '#F2EEF9', borderColor: '#B07FFF', borderWidth: 2,
  },
  intentionCardText: {
    fontSize: 15, fontWeight: '500', color: '#1A1A1A', flex: 1,
  },
  intentionCardTextSelected: {
    fontWeight: '600', color: '#B07FFF',
  },
  intentionCheckBadge: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: '#B07FFF',
    alignItems: 'center', justifyContent: 'center', marginLeft: 12,
  },
  intentionCheckMark: {
    fontSize: 11, color: '#FFFFFF', fontWeight: '700',
  },
  customIntentionInput: {
    backgroundColor: '#FAFAF8', borderWidth: 1, borderColor: '#EEEEEC',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14,
    fontSize: 15, color: '#1A1A1A',
  },
});
