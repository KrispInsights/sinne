import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { getJourneys, getSessions, closeJourney, reopenJourney, deleteJourney } from '@/lib/storage';
import type { Journey, SessionWithCheckin } from '@/lib/types';
import { COLORS, FONTS, CARD_SHADOW, OPTION_TEXT } from '@/lib/theme';

const STATE_COLORS: Record<string, string> = {
  grounded: '#7AAE8A',
  activated: '#C9B96A',
  shutdown: '#7E6B9E',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function formatSessionDate(iso: string, durationMinutes?: number | null): string {
  const d = new Date(iso);
  const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (durationMinutes != null && durationMinutes > 0) {
    return `${dateStr} · ${durationMinutes} min`;
  }
  return dateStr;
}

export default function JourneyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { bottom: safeBottom } = useSafeAreaInsets();
  const [journey, setJourney] = useState<Journey | null>(null);
  const [journeySessions, setJourneySessions] = useState<SessionWithCheckin[]>([]);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [showClosedMessage, setShowClosedMessage] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const [journeys, allSessions] = await Promise.all([
          getJourneys(), getSessions(),
        ]);
        if (cancelled) return;
        const j = journeys.find((j) => j.id === id) ?? null;
        setJourney(j);
        setJourneySessions(allSessions.filter((s) => s.session.journey_id === id));
      })();
      return () => { cancelled = true; };
    }, [id])
  );

  async function handleClose() {
    await closeJourney(id);
    setShowCloseModal(false);
    const journeys = await getJourneys();
    setJourney(journeys.find((j) => j.id === id) ?? null);
    setShowClosedMessage(true);
  }

  async function handleReopen() {
    await reopenJourney(id);
    setShowReopenModal(false);
    const journeys = await getJourneys();
    setJourney(journeys.find((j) => j.id === id) ?? null);
  }

  async function handleDelete() {
    await deleteJourney(id);
    setShowDeleteModal(false);
    router.back();
  }

  if (!journey) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Text style={s.backBtnText}>‹</Text>
          </TouchableOpacity>
        </View>
        <View style={s.emptyCenter}>
          <Text style={s.emptyText}>Journey not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const dateRange = journey.start_date
    ? formatDate(journey.start_date) + (journey.closed_at ? ', ended ' + formatDate(journey.closed_at) : ', ongoing')
    : null;

  // Calculate days elapsed
  let daysElapsed = 0;
  let totalDays = journey.duration_days;
  if (journey.start_date && totalDays) {
    const start = new Date(journey.start_date + 'T00:00:00').getTime();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const elapsed = Math.floor((today.getTime() - start) / 86400000) + 1;
    daysElapsed = Math.min(Math.max(elapsed, 1), totalDays);
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backBtnText}>‹</Text>
        </TouchableOpacity>
        <View style={[s.statusChip, journey.status === 'active' ? s.statusActive : s.statusClosed]}>
          <Text style={[s.statusText, journey.status === 'active' ? s.statusActiveText : s.statusClosedText]}>
            {journey.status === 'active' ? 'Active' : 'Ended'}
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.push({ pathname: '/new-journey', params: { editId: journey.id } } as any)} style={s.editBtn}>
          <Text style={s.editBtnText}>Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <View style={s.headerCard}>
          <Text style={s.journeyName}>{journey.name}</Text>
          {dateRange && <Text style={s.dateRange}>{dateRange}</Text>}
          {journey.duration_days != null && (
            <Text style={s.duration}>{journey.duration_days} day{journey.duration_days !== 1 ? 's' : ''}</Text>
          )}
          {journey.start_date && totalDays && journey.status === 'active' && (
            <Text style={s.dayCounter}>Day {daysElapsed} of {totalDays}</Text>
          )}
        </View>

        {/* Intentions section */}
        {journey.intentions && journey.intentions.length > 0 && (
          <View style={s.intentionsCard}>
            <Text style={s.intentionLabel}>INTENTIONS</Text>
            <View style={s.intentionChipsRow}>
              {journey.intentions.map((intention, idx) => (
                <View key={idx} style={s.intentionChip}>
                  <Text style={s.intentionChipText}>{intention}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* New Session button — only shown for active journeys */}
        {journey.status === 'active' && (
          <TouchableOpacity
            style={s.newSessionBtn}
            onPress={() => router.push({ pathname: '/new-session', params: { journeyId: journey.id } } as any)}
            activeOpacity={0.85}
          >
            <Text style={s.newSessionBtnText}>New session</Text>
          </TouchableOpacity>
        )}

        {/* Sessions list */}
        {journeySessions.length > 0 ? (
          <>
            <Text style={s.sectionLabel}>SESSIONS</Text>
            <View style={[s.card, CARD_SHADOW]}>
              {journeySessions.map((swc, idx) => (
                <React.Fragment key={swc.session.id}>
                  <TouchableOpacity
                    style={s.sessionRow}
                    onPress={() => router.push({ pathname: '/session/[id]', params: { id: swc.session.id } } as any)}
                    activeOpacity={0.7}
                  >
                    <View style={[s.stateDot, {
                      backgroundColor: STATE_COLORS[swc.checkin?.nervous_system_state ?? ''] ?? '#EEEEEC',
                    }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.sessionDateRow}>{formatSessionDate(swc.session.created_at, swc.session.duration_minutes)}</Text>
                      {swc.session.practice_type && (
                        <Text style={s.sessionPracticeRow}>{swc.session.practice_type}</Text>
                      )}
                    </View>
                    <Text style={s.chevron}>›</Text>
                  </TouchableOpacity>
                  {idx < journeySessions.length - 1 && <View style={s.divider} />}
                </React.Fragment>
              ))}
            </View>
          </>
        ) : (
          <Text style={s.emptySessionsText}>No sessions linked to this journey yet.</Text>
        )}

        {/* Lifecycle actions */}
        <View style={s.actionsSection}>
          {journey.status === 'active' ? (
            <TouchableOpacity style={s.endBtn} onPress={() => setShowCloseModal(true)} activeOpacity={0.85}>
              <Text style={s.endBtnText}>End journey</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={s.endBtn} onPress={() => setShowReopenModal(true)} activeOpacity={0.85}>
              <Text style={s.endBtnText}>Reopen journey</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.deleteBtn} onPress={() => setShowDeleteModal(true)} activeOpacity={0.85}>
            <Text style={s.deleteBtnText}>Delete journey</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* End modal */}
      <Modal transparent visible={showCloseModal} animationType="fade" onRequestClose={() => setShowCloseModal(false)}>
        <TouchableOpacity style={s.backdrop} onPress={() => setShowCloseModal(false)} activeOpacity={1}>
          <View style={[s.modalCard, { marginBottom: Math.max(safeBottom + 20, 40) }]}>
            <Text style={s.modalTitle}>End this journey?</Text>
            <Text style={s.modalBody}>Your sessions will stay associated with this journey. You can reopen it at any time.</Text>
            <TouchableOpacity style={s.modalPrimaryBtn} onPress={handleClose} activeOpacity={0.85}>
              <Text style={s.modalPrimaryText}>End journey</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.modalCancelBtn} onPress={() => setShowCloseModal(false)} activeOpacity={0.7}>
              <Text style={s.modalCancelText}>Keep it open</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Reopen modal */}
      <Modal transparent visible={showReopenModal} animationType="fade" onRequestClose={() => setShowReopenModal(false)}>
        <TouchableOpacity style={s.backdrop} onPress={() => setShowReopenModal(false)} activeOpacity={1}>
          <View style={[s.modalCard, { marginBottom: Math.max(safeBottom + 20, 40) }]}>
            <Text style={s.modalTitle}>Reopen this journey?</Text>
            <Text style={s.modalBody}>This will make "{journey.name}" your active journey.</Text>
            <TouchableOpacity style={s.modalPrimaryBtn} onPress={handleReopen} activeOpacity={0.85}>
              <Text style={s.modalPrimaryText}>Reopen journey</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.modalCancelBtn} onPress={() => setShowReopenModal(false)} activeOpacity={0.7}>
              <Text style={s.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Ended confirmation */}
      <Modal transparent visible={showClosedMessage} animationType="fade" onRequestClose={() => setShowClosedMessage(false)}>
        <TouchableOpacity style={s.backdrop} onPress={() => setShowClosedMessage(false)} activeOpacity={1}>
          <View style={[s.modalCard, { marginBottom: Math.max(safeBottom + 20, 40) }]}>
            <Text style={s.modalTitle}>Your journey is now ended.</Text>
            <Text style={s.modalBody}>It will be included in your next Mirror.</Text>
            <TouchableOpacity style={s.modalPrimaryBtn} onPress={() => setShowClosedMessage(false)} activeOpacity={0.85}>
              <Text style={s.modalPrimaryText}>OK</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal transparent visible={showDeleteModal} animationType="fade" onRequestClose={() => setShowDeleteModal(false)}>
        <TouchableOpacity style={s.backdrop} onPress={() => setShowDeleteModal(false)} activeOpacity={1}>
          <View style={[s.modalCard, { marginBottom: Math.max(safeBottom + 20, 40) }]}>
            <Text style={s.modalTitle}>Delete this journey?</Text>
            <Text style={s.modalBody}>This will permanently delete "{journey.name}". Your linked sessions and integrations will remain safe and intact.</Text>
            <TouchableOpacity style={s.modalDangerBtn} onPress={handleDelete} activeOpacity={0.85}>
              <Text style={s.modalDangerText}>Delete journey</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.modalCancelBtn} onPress={() => setShowDeleteModal(false)} activeOpacity={0.7}>
              <Text style={s.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backBtnText: { fontSize: 28, color: '#B07FFF', lineHeight: 32 },
  editBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  editBtnText: { fontFamily: 'Nunito_500Medium', fontSize: 15, fontWeight: '500', color: '#B07FFF' },
  body: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 60 },

  headerCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
    ...CARD_SHADOW,
  },
  journeyName: { fontSize: 24, fontWeight: '700', color: '#1A1A1A', marginBottom: 6 },
  dateRange: { fontSize: 14, color: '#666666', marginBottom: 2 },
  duration: { fontSize: 13, color: '#999999', marginBottom: 4 },
  dayCounter: { fontSize: 13, fontWeight: '500', color: '#B07FFF', marginBottom: 0 },

  intentionsCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    ...CARD_SHADOW,
  },
  intentionsSection: { marginTop: 16, marginBottom: 4 },
  intentionLabel: {
    fontFamily: 'Nunito_500Medium', fontSize: 11, fontWeight: '500', color: '#999999',
    textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8,
  },
  intentionChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  intentionChip: {
    borderRadius: 24, paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: '#F0F0F0',
  },
  intentionChipText: { fontFamily: 'Nunito_400Regular', fontSize: 13, fontWeight: '400', color: '#666666' },

  emptyCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 15, color: '#999999' },
  emptySessionsText: { fontSize: 15, color: '#999999', marginTop: 16, marginBottom: 8 },

  statusChip: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusActive: { backgroundColor: '#F2F7F3' },
  statusClosed: { backgroundColor: '#F5F2F9' },
  statusText: { fontSize: 12, fontWeight: '500' },
  statusActiveText: { color: '#7AAE8A' },
  statusClosedText: { color: '#9B7FBF' },

  // New Session button
  newSessionBtn: {
    backgroundColor: '#B07FFF', borderRadius: 12, height: 50,
    alignItems: 'center', justifyContent: 'center', marginTop: 20, marginBottom: 28,
  },
  newSessionBtnText: { fontFamily: 'Nunito_600SemiBold', fontSize: 15, fontWeight: '600', color: '#FFFFFF' },

  sectionLabel: {
    fontFamily: 'Nunito_500Medium', fontSize: 11, fontWeight: '500', color: '#999999',
    textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10,
  },

  card: { backgroundColor: '#FFFFFF', borderRadius: 12, marginBottom: 24 },
  sessionRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  stateDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  sessionDate: { ...OPTION_TEXT, fontSize: 14, fontWeight: '500' },
  sessionPractice: { fontSize: 12, color: '#666666', marginTop: 2 },
  sessionDateRow: { fontSize: 14, fontWeight: '400', color: '#999999', fontFamily: 'Nunito_400Regular' },
  sessionPracticeRow: { fontSize: 12, color: '#666666', marginTop: 2, fontFamily: 'Nunito_400Regular', fontWeight: '400' },
  chevron: { fontSize: 18, color: '#999999' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#EEEEEC', marginHorizontal: 16 },

  actionsSection: { marginTop: 16, flexDirection: 'row', gap: 12 },
  endBtn: {
    flex: 1, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.accentTint,
  },
  endBtnText: { fontSize: 14, fontWeight: '500', color: COLORS.accent },
  deleteBtn: {
    flex: 1, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.rootTint,
  },
  deleteBtnText: { fontSize: 14, fontWeight: '500', color: COLORS.root },
  secondaryBtn: {
    borderWidth: 1, borderColor: '#EEEEEC', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', backgroundColor: '#FAFAF8',
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '500', color: '#666666' },

  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end', paddingHorizontal: 16,
  },
  modalCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 17, fontWeight: '500', color: '#1A1A1A', marginBottom: 8 },
  modalBody: { fontSize: 14, color: '#666666', marginBottom: 20, lineHeight: 20 },
  modalPrimaryBtn: {
    backgroundColor: '#B07FFF', borderRadius: 12, height: 50,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  modalPrimaryText: { fontSize: 15, fontWeight: '500', color: '#FFFFFF' },
  modalDangerBtn: {
    backgroundColor: '#FF2A2A', borderRadius: 12, height: 50,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  modalDangerText: { fontSize: 15, fontWeight: '500', color: '#FFFFFF' },
  modalCancelBtn: { height: 44, alignItems: 'center', justifyContent: 'center' },
  modalCancelText: { fontSize: 15, color: '#666666' },
});
