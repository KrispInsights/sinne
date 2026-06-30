import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Switch, Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  getProfile, updateProfile, signOut, resetToMockData,
} from '@/lib/storage';
import type { Profile } from '@/lib/types';
import { COLORS } from '@/lib/theme';

const CARD_SHADOW = {
  shadowColor: '#7E6B9E',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 16,
  elevation: 3,
} as const;

const VOCAB_OPTIONS = [
  { key: 'plain',     label: 'Plain language',               example: 'grounded / Activated / Shutdown' },
  { key: 'polyvagal', label: 'Polyvagal',                    example: 'Ventral / Sympathetic / Dorsal' },
  { key: 'ifs',       label: 'IFS, Internal Family Systems', example: 'Self / Activated part / Blended' },
  { key: 'somatic',   label: 'Somatic',                       example: 'grounded / Activated / Shutdown' },
] as const;

type VocabKey = typeof VOCAB_OPTIONS[number]['key'];

function Row({ label, value, onPress, destructive, chevron = true }: {
  label: string; value?: string; onPress: () => void; destructive?: boolean; chevron?: boolean;
}) {
  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.7}>
      <Text style={[s.rowLabel, destructive && s.rowLabelDestructive]}>{label}</Text>
      <View style={s.rowRight}>
        {value ? <Text style={s.rowValue}>{value}</Text> : null}
        {chevron && <Text style={[s.rowChevron, destructive && { color: '#FF2A2A' }]}>›</Text>}
      </View>
    </TouchableOpacity>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={s.sectionHeader}>{title}</Text>;
}

function Divider() {
  return <View style={s.divider} />;
}

function ConfirmModal({ visible, title, body, confirmLabel, destructive, onConfirm, onCancel }: {
  visible: boolean; title: string; body: string; confirmLabel: string;
  destructive?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  const { bottom: safeBottom } = useSafeAreaInsets();
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <TouchableOpacity style={s.backdrop} onPress={onCancel} activeOpacity={1}>
        <View style={[s.modalCard, { marginBottom: Math.max(safeBottom + 20, 40) }]}>
          <Text style={s.modalTitle}>{title}</Text>
          <Text style={s.modalBody}>{body}</Text>
          <TouchableOpacity
            style={[s.modalPrimaryBtn, destructive && s.modalDestructiveBtn]}
            onPress={onConfirm} activeOpacity={0.85}
          >
            <Text style={s.modalPrimaryText}>{confirmLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.modalCancelBtn} onPress={onCancel} activeOpacity={0.7}>
            <Text style={s.modalCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [integReminder, setIntegReminder] = useState(true);
  const [journeyNudge, setJourneyNudge] = useState(true);
  const [showDeleteData, setShowDeleteData] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [showSignOut, setShowSignOut] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const p = await getProfile();
        if (!cancelled) setProfile(p);
      })();
      return () => { cancelled = true; };
    }, [])
  );

  async function handleVocabChange(key: VocabKey) {
    if (!profile) return;
    const updated = await updateProfile({ vocabulary_framework: key });
    setProfile(updated);
  }

  async function handleChakraToggle(val: boolean) {
    if (!profile) return;
    const updated = await updateProfile({ chakra_mapping: val });
    setProfile(updated);
  }

  async function handleWeeklyMirrorToggle(val: boolean) {
    if (!profile) return;
    const updated = await updateProfile({ weekly_mirror_reminder: val });
    setProfile(updated);
  }

  async function handleMonthlyMirrorToggle(val: boolean) {
    if (!profile) return;
    const updated = await updateProfile({ monthly_mirror_reminder: val });
    setProfile(updated);
  }

  async function handleDeleteAllData() {
    await resetToMockData();
    const p = await getProfile();
    setProfile(p);
    setShowDeleteData(false);
  }

  async function handleDeleteAccount() {
    await resetToMockData();
    await signOut();
    setShowDeleteAccount(false);
    router.replace('/(auth)/sign-in' as any);
  }

  async function handleSignOut() {
    await signOut();
    setShowSignOut(false);
    router.replace('/(auth)/sign-in' as any);
  }

  const vocab = profile?.vocabulary_framework ?? 'plain';
  const chakra = profile?.chakra_mapping ?? true;

  return (
    <SafeAreaView edges={['top']} style={s.safe}>
      <View style={s.headerRow}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <MaterialCommunityIcons name="chevron-left" size={28} color="#1A1A1A" />
        </TouchableOpacity>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.title}>Settings</Text>

        {/* Vocabulary */}
        <SectionHeader title="VOCABULARY" />
        <View style={[s.card, CARD_SHADOW]}>
          {VOCAB_OPTIONS.map((opt, idx) => (
            <React.Fragment key={opt.key}>
              <TouchableOpacity style={s.vocabRow} onPress={() => handleVocabChange(opt.key)} activeOpacity={0.7}>
                <View style={s.vocabRowLeft}>
                  <Text style={s.vocabLabel}>{opt.label}</Text>
                  <Text style={s.vocabExample}>{opt.example}</Text>
                </View>
                {vocab === opt.key && <Text style={s.checkmark}>✓</Text>}
              </TouchableOpacity>
              {idx < VOCAB_OPTIONS.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </View>

        {/* Chakra mapping */}
        <View style={[s.card, CARD_SHADOW]}>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.rowLabel}>Chakra body mapping</Text>
              <Text style={s.rowSubLabel}>Show chakra centres alongside body regions</Text>
            </View>
            <Switch
              value={chakra}
              onValueChange={handleChakraToggle}
              trackColor={{ false: '#EEEEEC', true: COLORS.accent }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Notifications */}
        <SectionHeader title="NOTIFICATIONS" />
        <View style={[s.card, CARD_SHADOW]}>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.rowLabel}>Integration reminder</Text>
              <Text style={s.rowSubLabel}>A quiet nudge a few hours after your session to log what's still moving.</Text>
            </View>
            <Switch
              value={integReminder}
              onValueChange={setIntegReminder}
              trackColor={{ false: '#EEEEEC', true: COLORS.accent }}
              thumbColor="#FFFFFF"
            />
          </View>
          <Divider />
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.rowLabel}>Journey nudge</Text>
              <Text style={s.rowSubLabel}>One gentle reminder if you have an active journey and haven't logged in two days.</Text>
            </View>
            <Switch
              value={journeyNudge}
              onValueChange={setJourneyNudge}
              trackColor={{ false: '#EEEEEC', true: COLORS.accent }}
              thumbColor="#FFFFFF"
            />
          </View>
          <Divider />
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.rowLabel}>Weekly Mirror reminder</Text>
              <Text style={s.rowSubLabel}>A gentle nudge once a week when your Mirror is ready to view.</Text>
            </View>
            <Switch
              value={profile?.weekly_mirror_reminder ?? true}
              onValueChange={handleWeeklyMirrorToggle}
              trackColor={{ false: '#EEEEEC', true: COLORS.accent }}
              thumbColor="#FFFFFF"
            />
          </View>
          <Divider />
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.rowLabel}>Monthly Mirror reminder</Text>
              <Text style={s.rowSubLabel}>A reminder at the end of each month when your longer reflection is ready.</Text>
            </View>
            <Switch
              value={profile?.monthly_mirror_reminder ?? true}
              onValueChange={handleMonthlyMirrorToggle}
              trackColor={{ false: '#EEEEEC', true: COLORS.accent }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Profile */}
        <SectionHeader title="PROFILE" />
        <View style={[s.card, CARD_SHADOW]}>
          <Row
            label="Edit profile"
            value={profile?.preferred_name || undefined}
            onPress={() => router.push('/edit-profile' as any)}
          />
        </View>

        {/* Account */}
        <SectionHeader title="ACCOUNT" />
        <View style={[s.card, CARD_SHADOW]}>
          <Row label="Change email" onPress={() => {}} />
          <Divider />
          <Row label="Change password" onPress={() => {}} />
          <Divider />
          <Row label="Manage subscription" value="Mirror Monthly" onPress={() => {}} />
          <Divider />
          <Row label="Sign out" chevron={false} onPress={() => setShowSignOut(true)} />
        </View>

        <View style={[s.card, CARD_SHADOW]}>
          <Row label="Delete all data" destructive onPress={() => setShowDeleteData(true)} />
          <Divider />
          <Row label="Delete account" destructive onPress={() => setShowDeleteAccount(true)} />
        </View>

        <Text style={s.version}>Sinne · Phase A</Text>
      </ScrollView>

      <ConfirmModal
        visible={showDeleteData}
        title="Delete all data?"
        body="This removes all sessions, integrations, and journeys. Your account is kept. This cannot be undone."
        confirmLabel="Delete all data"
        destructive
        onConfirm={handleDeleteAllData}
        onCancel={() => setShowDeleteData(false)}
      />

      <ConfirmModal
        visible={showDeleteAccount}
        title="Delete your account?"
        body="This permanently removes your account and all data. There is no way to recover it."
        confirmLabel="Delete account"
        destructive
        onConfirm={handleDeleteAccount}
        onCancel={() => setShowDeleteAccount(false)}
      />

      <ConfirmModal
        visible={showSignOut}
        title="Sign out?"
        body="You can sign back in at any time."
        confirmLabel="Sign out"
        onConfirm={handleSignOut}
        onCancel={() => setShowSignOut(false)}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 60 },

  headerRow: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  title: { fontSize: 20, fontWeight: '500', color: '#1A1A1A', marginBottom: 24 },

  sectionHeader: {
    fontSize: 11, fontWeight: '500', color: '#999999',
    textTransform: 'uppercase', letterSpacing: 1.2,
    marginTop: 24, marginBottom: 8,
  },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 12, overflow: 'hidden', marginBottom: 8,
  },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 16, minHeight: 52,
  },
  rowLabel: { flex: 1, fontSize: 15, color: '#1A1A1A', fontWeight: '400' },
  rowLabelDestructive: { color: '#FF2A2A' },
  rowSubLabel: { fontSize: 13, color: '#999999', marginTop: 4, lineHeight: 18 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowValue: { fontSize: 14, color: '#666666' },
  rowChevron: { fontSize: 18, color: '#999999' },

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#EEEEEC', marginHorizontal: 16 },

  vocabRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 16, minHeight: 52,
  },
  vocabRowLeft: { flex: 1 },
  vocabLabel: { fontSize: 15, color: '#1A1A1A' },
  vocabExample: { fontSize: 13, color: '#999999', marginTop: 4 },
  checkmark: { fontSize: 16, color: COLORS.accent, fontWeight: '500', marginLeft: 8 },

  version: { fontSize: 13, color: '#999999', textAlign: 'center', marginTop: 24 },

  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end', paddingHorizontal: 16,
  },
  modalCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 24 },
  modalTitle: { fontSize: 17, fontWeight: '500', color: '#1A1A1A', marginBottom: 8 },
  modalBody: { fontSize: 14, color: '#666666', marginBottom: 24, lineHeight: 22 },
  modalPrimaryBtn: {
    backgroundColor: COLORS.accent, borderRadius: 12, height: 56,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  modalDestructiveBtn: { backgroundColor: '#FF2A2A' },
  modalPrimaryText: { fontSize: 15, fontWeight: '500', color: '#FFFFFF' },
  modalCancelBtn: { height: 44, alignItems: 'center', justifyContent: 'center' },
  modalCancelText: { fontSize: 15, color: '#666666' },
});
