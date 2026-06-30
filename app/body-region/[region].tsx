import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getSessions, getIntegrations } from '@/lib/storage';
import type { SessionWithCheckin, Integration } from '@/lib/types';
import { COLORS, getRegionColor, getEmotionColor, FONTS } from '@/lib/theme';
import { getStateName } from '@/lib/ns-state';

function formatDisplayText(text: string): string {
  return text
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

interface SessionWithRegion {
  session: SessionWithCheckin;
  quality: string | null;
  integration: Integration | null;
}

export default function BodyRegionDetailScreen() {
  const { region } = useLocalSearchParams<{ region: string }>();
  const router = useRouter();
  const [sessionsWithRegion, setSessionsWithRegion] = useState<SessionWithRegion[]>([]);
  const [loading, setLoading] = useState(true);

  // Decode the region parameter
  const decodedRegion = decodeURIComponent(region || '');

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      (async () => {
        try {
          const [allSessions, allIntegrations] = await Promise.all([
            getSessions(),
            getIntegrations(),
          ]);

          // Filter sessions that have this region in body_sensations
          const filtered: SessionWithRegion[] = [];
          for (const swc of allSessions) {
            if (!swc.checkin) continue;
            const sensation = swc.checkin.body_sensations.find(
              (bs) => bs.region === decodedRegion
            );
            if (sensation) {
              // Find integration note that followed this session (within 24 hours)
              const sessionDate = new Date(swc.session.created_at);
              const followingIntegration = allIntegrations.find((integ) => {
                const integDate = new Date(integ.note_date);
                const timeDiff = integDate.getTime() - sessionDate.getTime();
                return timeDiff >= 0 && timeDiff <= 24 * 60 * 60 * 1000;
              });

              filtered.push({
                session: swc,
                quality: sensation.quality,
                integration: followingIntegration || null,
              });
            }
          }

          if (!cancelled) {
            setSessionsWithRegion(filtered);
            setLoading(false);
          }
        } catch (error) {
          console.error('Error loading body region data:', error);
          if (!cancelled) setLoading(false);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [decodedRegion])
  );

  // Calculate statistics
  const totalActivations = sessionsWithRegion.length;
  const qualitiesMap = new Map<string, number>();
  const emotionsMap = new Map<string, number>();
  const practicesMap = new Map<string, number>();
  const nsStatesMap = new Map<string, number>();

  for (const swr of sessionsWithRegion) {
    if (swr.quality) {
      qualitiesMap.set(swr.quality, (qualitiesMap.get(swr.quality) || 0) + 1);
    }
    if (swr.session.checkin) {
      for (const emotion of swr.session.checkin.emotion_tags) {
        emotionsMap.set(emotion, (emotionsMap.get(emotion) || 0) + 1);
      }
      if (swr.session.checkin.nervous_system_state) {
        nsStatesMap.set(
          swr.session.checkin.nervous_system_state,
          (nsStatesMap.get(swr.session.checkin.nervous_system_state) || 0) + 1
        );
      }
    }
    if (swr.session.session.practice_type) {
      practicesMap.set(
        swr.session.session.practice_type,
        (practicesMap.get(swr.session.session.practice_type) || 0) + 1
      );
    }
  }

  const topQualities = Array.from(qualitiesMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const topEmotions = Array.from(emotionsMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const topPractices = Array.from(practicesMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const dominantNSState = Array.from(nsStatesMap.entries()).sort((a, b) => b[1] - a[1])[0];

  return (
    <SafeAreaView edges={['top']} style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <MaterialCommunityIcons name="chevron-left" size={28} color="#1A1A1A" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <View
            style={[
              s.regionDot,
              { backgroundColor: getRegionColor(decodedRegion), width: 18, height: 18 },
            ]}
          />
          <Text style={s.regionTitle}>{formatDisplayText(decodedRegion)}</Text>
        </View>

        <Text style={s.subtitle}>
          Activated in {totalActivations} session{totalActivations === 1 ? '' : 's'}
        </Text>

        {/* Statistics Section */}
        {topQualities.length > 0 && (
          <>
            <Text style={s.sectionLabel}>MOST COMMON SENSATIONS</Text>
            <View style={s.chipContainer}>
              {topQualities.map(([quality, count]) => (
                <View key={quality} style={s.greyChip}>
                  <Text style={s.greyChipText}>
                    {formatDisplayText(quality)} · {count}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {topEmotions.length > 0 && (
          <>
            <Text style={s.sectionLabel}>ASSOCIATED EMOTIONS</Text>
            <View style={s.chipContainer}>
              {topEmotions.map(([emotion, count]) => {
                const emotionColor = getEmotionColor(emotion);
                return (
                  <View
                    key={emotion}
                    style={[s.emotionChip, { backgroundColor: emotionColor.bg }]}
                  >
                    <Text style={[s.emotionChipText, { color: emotionColor.text }]}>
                      {formatDisplayText(emotion)} · {count}
                    </Text>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {dominantNSState && (
          <>
            <Text style={s.sectionLabel}>NERVOUS SYSTEM CONTEXT</Text>
            <View style={s.nsCard}>
              <Text style={s.nsCardText}>
                This region appeared most frequently when in a{' '}
                <Text style={{ fontWeight: '600' }}>
                  {getStateName('plain', dominantNSState[0])}
                </Text>{' '}
                state ({dominantNSState[1]} of {totalActivations} sessions)
              </Text>
            </View>
          </>
        )}

        {topPractices.length > 0 && (
          <>
            <Text style={s.sectionLabel}>PRACTICES THAT ACTIVATE THIS REGION</Text>
            <View style={s.chipContainer}>
              {topPractices.map(([practice, count]) => (
                <View key={practice} style={s.greyChip}>
                  <Text style={s.greyChipText}>
                    {formatDisplayText(practice)} · {count} session{count === 1 ? '' : 's'}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Sessions List */}
        <Text style={s.sectionLabel}>ALL SESSIONS</Text>
        {sessionsWithRegion.map((swr) => {
          const { session: swc, quality, integration } = swr;
          const sess = swc.session;
          const checkin = swc.checkin;

          return (
            <View key={sess.id} style={s.sessionCard}>
              <View style={s.sessionHeader}>
                <Text style={s.sessionDate}>{formatDate(sess.created_at)}</Text>
                <Text style={s.sessionTime}>{formatTime(sess.created_at)}</Text>
              </View>

              {sess.practice_type && (
                <Text style={s.sessionPractice}>{formatDisplayText(sess.practice_type)}</Text>
              )}

              {quality && (
                <View style={s.qualityRow}>
                  <MaterialCommunityIcons
                    name="hand-back-right-outline"
                    size={14}
                    color="#666666"
                  />
                  <Text style={s.qualityText}>{formatDisplayText(quality)}</Text>
                </View>
              )}

              {checkin?.nervous_system_state && (
                <View style={s.qualityRow}>
                  <MaterialCommunityIcons name="circle-outline" size={14} color="#666666" />
                  <Text style={s.qualityText}>
                    {getStateName('plain', checkin.nervous_system_state)}
                  </Text>
                </View>
              )}

              {checkin?.emotion_tags && checkin.emotion_tags.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {checkin.emotion_tags.map((emotion) => {
                    const emotionColor = getEmotionColor(emotion);
                    return (
                      <View
                        key={emotion}
                        style={[
                          s.sessionEmotionChip,
                          { backgroundColor: emotionColor.bg },
                        ]}
                      >
                        <Text
                          style={[
                            s.sessionEmotionChipText,
                            { color: emotionColor.text },
                          ]}
                        >
                          {formatDisplayText(emotion)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {integration && (
                <View style={s.integrationNote}>
                  <MaterialCommunityIcons
                    name="notebook-outline"
                    size={14}
                    color={COLORS.integrationIcon}
                  />
                  <Text style={s.integrationText}>Integration note followed</Text>
                </View>
              )}
            </View>
          );
        })}

        {sessionsWithRegion.length === 0 && !loading && (
          <Text style={s.noData}>No sessions found with this body region.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 60 },

  regionTitle: {
    fontFamily: FONTS.display,
    fontSize: 26,
    fontWeight: '500',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 32,
  },

  regionDot: { width: 12, height: 12, borderRadius: 999 },

  sectionLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textTertiary,
    letterSpacing: 0.5,
    marginBottom: 12,
    marginTop: 24,
  },

  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  greyChip: {
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  greyChipText: { fontSize: 13, fontWeight: '500', color: '#666666' },

  emotionChip: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  emotionChipText: { fontSize: 13, fontWeight: '500' },

  nsCard: {
    backgroundColor: '#FAFAF8',
    borderWidth: 1,
    borderColor: '#EEEEEC',
    borderRadius: 12,
    padding: 16,
  },
  nsCardText: {
    fontSize: 14,
    lineHeight: 22,
    color: COLORS.text,
  },

  sessionCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0F0F0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sessionDate: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  sessionTime: {
    fontSize: 13,
    color: COLORS.textTertiary,
  },
  sessionPractice: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  qualityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  qualityText: {
    fontSize: 13,
    color: '#666666',
  },

  sessionEmotionChip: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  sessionEmotionChipText: {
    fontSize: 11,
    fontWeight: '500',
  },

  integrationNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  integrationText: {
    fontSize: 12,
    color: COLORS.integrationIcon,
    fontWeight: '500',
  },

  noData: {
    fontSize: 14,
    color: COLORS.textTertiary,
    textAlign: 'center',
    marginTop: 24,
  },
});
