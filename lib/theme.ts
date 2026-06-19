import React from 'react';
import { ViewStyle, TextStyle, Text, TextInput, StyleSheet } from 'react-native';

// Font families
export const FONTS = {
  display: 'DMSerifDisplay_400Regular',
  body: 'Nunito_400Regular',
  bodyMedium: 'Nunito_500Medium',
  bodySemiBold: 'Nunito_600SemiBold',
  bodyBold: 'Nunito_700Bold',
};

export const TYPOGRAPHY = {
  // Display — DMSerifDisplay for headings ≥20px
  display: {
    fontFamily: 'DMSerifDisplay_400Regular',
    fontWeight: '400' as const,
  },
  // Body hierarchy — all Nunito via the global patcher
  bodyLarge: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 17,
    fontWeight: '400' as const,
  },
  body: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    fontWeight: '400' as const,
  },
  bodyMedium: {
    fontFamily: 'Nunito_500Medium',
    fontSize: 15,
    fontWeight: '500' as const,
  },
  bodySemiBold: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 15,
    fontWeight: '600' as const,
  },
  // Labels — uppercase tracking, always Nunito 500
  label: {
    fontFamily: 'Nunito_500Medium',
    fontSize: 11,
    fontWeight: '500' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.2,
    color: '#999999',
  },
  // Chip / option text — Nunito 400
  chip: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    fontWeight: '400' as const,
  },
  // Button text — Nunito 600
  button: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 15,
    fontWeight: '600' as const,
  },
  buttonSmall: {
    fontFamily: 'Nunito_500Medium',
    fontSize: 13,
    fontWeight: '500' as const,
  },
  // Caption / meta — Nunito 400
  caption: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    fontWeight: '400' as const,
  },
  // Input text — Nunito 400
  input: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    fontWeight: '400' as const,
  },
};

export const OPTION_TEXT = {
  fontSize: 13,
  fontFamily: 'Nunito_400Regular',
  fontWeight: '400' as const,
  color: '#666666',
} as const;

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
  grounded: '#8FAE9A',
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
  shadowOpacity: 0.02,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
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
  grounded: { bg: '#8FAE9A1A', text: '#8FAE9A', border: '#8FAE9A' }, // Keep for backward compatibility
  ventral: { bg: '#8FAE9A1A', text: '#8FAE9A', border: '#8FAE9A' },
  self: { bg: '#8FAE9A1A', text: '#8FAE9A', border: '#8FAE9A' },
  activated: { bg: '#D6C2A11A', text: '#B8A080', border: '#D6C2A1' },
  sympathetic: { bg: '#D6C2A11A', text: '#B8A080', border: '#D6C2A1' },
  'activated part': { bg: '#D6C2A11A', text: '#B8A080', border: '#D6C2A1' },
  shutdown: { bg: '#A89ABF1A', text: '#A89ABF', border: '#A89ABF' },
  dorsal: { bg: '#A89ABF1A', text: '#A89ABF', border: '#A89ABF' },
  blended: { bg: '#A89ABF1A', text: '#A89ABF', border: '#A89ABF' },
};


// integration category colors
export const CATEGORY_DATA: Record<string, {
  icon: string; color: string; tint: string; desc: string;
}> = {
  Actions:      { icon: 'lightning-bolt-outline',  color: '#B07FFF', tint: '#F2EEFF', desc: 'What will you do differently?' },
  Body:         { icon: 'human',                   color: '#B07FFF', tint: '#F2EEFF', desc: 'Physical sensations and signals' },
  Emotions:     { icon: 'heart-outline',           color: '#B07FFF', tint: '#F2EEFF', desc: "What's still moving?" },
  Gratitude:    { icon: 'hand-heart-outline',      color: '#B07FFF', tint: '#F2EEFF', desc: 'What you want to acknowledge' },
  Meaning:      { icon: 'lightbulb-outline',       color: '#B07FFF', tint: '#F2EEFF', desc: 'Deeper significance' },
  Memories:     { icon: 'image-outline',           color: '#B07FFF', tint: '#F2EEFF', desc: 'Surfacing images and moments' },
  Patterns:     { icon: 'repeat-variant',          color: '#B07FFF', tint: '#F2EEFF', desc: 'Familiar dynamics noticed' },
  Realizations: { icon: 'star-outline',            color: '#B07FFF', tint: '#F2EEFF', desc: 'What became clearer' },
  Triggers:     { icon: 'alert-circle-outline',    color: '#B07FFF', tint: '#F2EEFF', desc: 'What set something off' },
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
  const base = practiceType.split(':')[0].trim();
  const map: Record<string, string> = {
    'Breathwork': COLORS.throat,
    'Dance / movement therapy': COLORS.solar,
    'IFS / Internal Family Systems': COLORS.crown,
    'Meditation / Vipassana': COLORS.thirdEye,
    'Qi Gong / Tai Chi': COLORS.heart,
    'Reiki / energy healing': COLORS.crown,
    'Somatic Experiencing': COLORS.heart,
    'Sound healing': COLORS.throat,
    'Trauma therapy (body-based)': COLORS.root,
    'Yoga': COLORS.sacral,
    'Other': '#A0896B',
  };
  for (const [key, color] of Object.entries(map)) {
    if (base === key || base.startsWith(key) || key.startsWith(base)) return color;
  }
  return '#CCCCCC';
}

// ---- Global font patcher ----

const WEIGHT_TO_FAMILY: Record<string, string> = {
  '100': 'Nunito_400Regular',
  '200': 'Nunito_400Regular',
  '300': 'Nunito_400Regular',
  '400': 'Nunito_400Regular',
  normal: 'Nunito_400Regular',
  '500': 'Nunito_500Medium',
  '600': 'Nunito_600SemiBold',
  '700': 'Nunito_700Bold',
  '800': 'Nunito_700Bold',
  '900': 'Nunito_700Bold',
  bold: 'Nunito_700Bold',
};

function fontFamilyForStyle(style: unknown): string {
  const flat = (StyleSheet.flatten(style as never) || {}) as { fontWeight?: string | number };
  const weight = String(flat.fontWeight ?? '400');
  return WEIGHT_TO_FAMILY[weight] || 'Nunito_400Regular';
}

let applied = false;

export function applyGlobalFont() {
  if (applied) return;
  applied = true;

  const TextRender = (Text as any).render;
  (Text as any).render = function render(...args: any[]) {
    const origin = TextRender.apply(this, args);
    return React.cloneElement(origin, {
      style: [{ fontFamily: fontFamilyForStyle(origin.props.style) }, origin.props.style],
    });
  };

  const TextInputRender = (TextInput as any).render;
  (TextInput as any).render = function render(...args: any[]) {
    const origin = TextInputRender.apply(this, args);
    return React.cloneElement(origin, {
      style: [{ fontFamily: fontFamilyForStyle(origin.props.style) }, origin.props.style],
    });
  };
}
