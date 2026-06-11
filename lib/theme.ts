import { ViewStyle, TextStyle } from 'react-native';

// Font families
export const FONTS = {
  display: 'DMSerifDisplay_400Regular',
  body: 'Nunito_400Regular',
  bodyMedium: 'Nunito_500Medium',
  bodySemiBold: 'Nunito_600SemiBold',
  bodyBold: 'Nunito_700Bold',
};

export const COLORS = {
  background: '#F2F1F6',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textSecondary: '#666666',
  textTertiary: '#999999',
  textQuaternary: '#BBBBBB',
  border: '#EEEEEC',
  track: '#E8E8E8',
  inputBg: '#F7F7F7',
  chipBg: '#F0F0F0',
  accent: '#B07FFF',
  accentTint: '#F2EEF9',
  destructive: '#FF2A2A',

  // Wellness tones (nervous system states)
  settled: '#8FAE9A',
  activated: '#D6C2A1',
  activatedLabel: '#B8A080',
  shutdown: '#A89ABF',

  // Muted chakra colours
  root: '#B5736A',
  rootTint: '#F5EDEC',
  sacral: '#C49A6C',
  sacralTint: '#F7F0E7',
  solar: '#C9B96A',
  solarTint: '#F8F5E7',
  heart: '#7AAE8A',
  heartTint: '#EDF5F0',
  throat: '#6E9BB5',
  throatTint: '#ECF3F7',
  thirdEye: '#7E6B9E',
  thirdEyeTint: '#EEEAF5',
  crown: '#9B7FBF',
  crownTint: '#F2EEF9',
};

export const RADII = {
  card: 20,
  chip: 24,
  input: 16,
  pill: 999,
};

export const CARD_SHADOW: ViewStyle = {
  shadowColor: '#000000',
  shadowOpacity: 0.05,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 4 },
  elevation: 3,
};

export const CARD_STYLE: ViewStyle = {
  backgroundColor: COLORS.card,
  borderRadius: RADII.card,
  ...CARD_SHADOW,
};

export const SHEET_STYLE: ViewStyle = {
  borderTopLeftRadius: 28,
  borderTopRightRadius: 28,
};

// Nervous system state -> wellness tone colour
// bg uses the wellness tone at ~10% opacity (hex 1A = 26/255 = ~10%)
export const STATE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  grounded: { bg: '#8FAE9A1A', text: '#8FAE9A', border: '#8FAE9A' },
  settled: { bg: '#8FAE9A1A', text: '#8FAE9A', border: '#8FAE9A' }, // Keep for backward compatibility
  ventral: { bg: '#8FAE9A1A', text: '#8FAE9A', border: '#8FAE9A' },
  self: { bg: '#8FAE9A1A', text: '#8FAE9A', border: '#8FAE9A' },
  activated: { bg: '#D6C2A11A', text: '#B8A080', border: '#D6C2A1' },
  sympathetic: { bg: '#D6C2A11A', text: '#B8A080', border: '#D6C2A1' },
  'activated part': { bg: '#D6C2A11A', text: '#B8A080', border: '#D6C2A1' },
  shutdown: { bg: '#A89ABF1A', text: '#A89ABF', border: '#A89ABF' },
  dorsal: { bg: '#A89ABF1A', text: '#A89ABF', border: '#A89ABF' },
  blended: { bg: '#A89ABF1A', text: '#A89ABF', border: '#A89ABF' },
};

export function getStateColor(state: string | null | undefined) {
  if (!state) return STATE_COLORS.grounded;
  return STATE_COLORS[state.toLowerCase()] || STATE_COLORS.grounded;
}

// Body region -> muted chakra colour
export const REGION_COLORS: Record<string, string> = {
  'Head / mind': COLORS.crown,
  Eyes: COLORS.thirdEye,
  'Jaw / face': COLORS.thirdEye,
  Throat: COLORS.throat,
  'Chest / heart': COLORS.heart,
  'Shoulders / upper back': COLORS.heart,
  'Arms / hands': COLORS.heart,
  'Solar plexus / gut': COLORS.solar,
  'Pelvis / lower belly': COLORS.sacral,
  'Legs / feet': COLORS.root,
  Spine: COLORS.crown,
  'Full body': COLORS.crown,
};

export function getRegionColor(region: string): string {
  return REGION_COLORS[region] || COLORS.crown;
}

// Emotion tag -> muted chakra cluster colour
export const EMOTION_CLUSTERS: Record<string, { bg: string; text: string }> = {
  // Grief family - Throat
  grief: { bg: COLORS.throatTint, text: COLORS.throat },
  sadness: { bg: COLORS.throatTint, text: COLORS.throat },
  longing: { bg: COLORS.throatTint, text: COLORS.throat },
  loss: { bg: COLORS.throatTint, text: COLORS.throat },
  heartbreak: { bg: COLORS.throatTint, text: COLORS.throat },
  // Fear family - Root
  fear: { bg: COLORS.rootTint, text: COLORS.root },
  dread: { bg: COLORS.rootTint, text: COLORS.root },
  anxiety: { bg: COLORS.rootTint, text: COLORS.root },
  terror: { bg: COLORS.rootTint, text: COLORS.root },
  panic: { bg: COLORS.rootTint, text: COLORS.root },
  // Anger family - Sacral
  anger: { bg: COLORS.sacralTint, text: COLORS.sacral },
  rage: { bg: COLORS.sacralTint, text: COLORS.sacral },
  frustration: { bg: COLORS.sacralTint, text: COLORS.sacral },
  irritation: { bg: COLORS.sacralTint, text: COLORS.sacral },
  resentment: { bg: COLORS.sacralTint, text: COLORS.sacral },
  // Shame / contraction - Third Eye
  shame: { bg: COLORS.thirdEyeTint, text: COLORS.thirdEye },
  guilt: { bg: COLORS.thirdEyeTint, text: COLORS.thirdEye },
  unworthiness: { bg: COLORS.thirdEyeTint, text: COLORS.thirdEye },
  smallness: { bg: COLORS.thirdEyeTint, text: COLORS.thirdEye },
  // Positive / opening - Heart
  joy: { bg: COLORS.heartTint, text: COLORS.heart },
  gratitude: { bg: COLORS.heartTint, text: COLORS.heart },
  love: { bg: COLORS.heartTint, text: COLORS.heart },
  warmth: { bg: COLORS.heartTint, text: COLORS.heart },
  bliss: { bg: COLORS.heartTint, text: COLORS.heart },
  awe: { bg: COLORS.heartTint, text: COLORS.heart },
  // Neutral / liminal - Crown
  confusion: { bg: COLORS.crownTint, text: COLORS.crown },
  numbness: { bg: COLORS.crownTint, text: COLORS.crown },
  emptiness: { bg: COLORS.crownTint, text: COLORS.crown },
  dissociation: { bg: COLORS.crownTint, text: COLORS.crown },
  // Release / movement - Sacral
  release: { bg: COLORS.sacralTint, text: COLORS.sacral },
  openness: { bg: COLORS.sacralTint, text: COLORS.sacral },
  relief: { bg: COLORS.sacralTint, text: COLORS.sacral },
  surrender: { bg: COLORS.sacralTint, text: COLORS.sacral },
};

export function getEmotionColor(tag: string): { bg: string; text: string } {
  return EMOTION_CLUSTERS[tag.toLowerCase()] || { bg: COLORS.crownTint, text: COLORS.crown };
}

// Practice type -> calendar/legend colour
export function getPracticeColor(practiceType: string | null | undefined): string {
  if (!practiceType) return '#CCCCCC';
  const p = practiceType.toLowerCase();
  if (p.includes('breathwork') || p.includes('breath')) return COLORS.throat;
  if (p.includes('somatic')) return COLORS.heart;
  if (p.includes('meditation') || p.includes('vipassana')) return COLORS.crown;
  if (p.includes('yoga')) return COLORS.sacral;
  if (p.includes('dance') || p.includes('movement') || p.includes('5rhythms')) return COLORS.solar;
  return '#CCCCCC';
}
