import React from 'react';
import { ViewStyle, Text, TextInput, StyleSheet } from 'react-native';

// ─────────────────────────────────────────────
// SINNE DESIGN SYSTEM — theme.ts
// Palette rationale:
//   Base: warm off-white (#F0EDE6) — Pantone Cloud Dancer family,
//         "journal page / sacred ledger" quality, not clinical white
//   Card: pure white for gentle lift against warm base
//   Accent: smoky teal (#3E6B6A) — WGSN/Coloro Transformative Teal 2026,
//           semantically tied to "change and redirection"
//   Gold: warm gold (#C8A86A) — milestone/insight accent, used sparingly
//         for breakthroughs, "today" markers, and special moments only.
//         NOT a second brand color — a single-use emotional register.
//   NS states: warm-to-cool temperature scale within muted family —
//              no alarm reds, trauma-informed safe palette
//   Text: soft warm ink (#221E1A), never pure #000000
//   Chakra colors: muted, kept for data layer only (body heatmap,
//                  emotion clusters, practice types) — never as screen bg
// ─────────────────────────────────────────────

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
    lineHeight: 26,
    fontWeight: '400' as const,
  },
  body: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400' as const,
  },
  bodyMedium: {
    fontFamily: 'Nunito_500Medium',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500' as const,
  },
  bodySemiBold: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600' as const,
  },
  // Labels — uppercase tracking, always Nunito 500
  label: {
    fontFamily: 'Nunito_500Medium',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '500' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.2,
    color: '#9A9186',
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
    lineHeight: 18,
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
  color: '#7A7168',
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const COLORS = {
  // ── Surfaces ──────────────────────────────
  // Warm off-white — Pantone Cloud Dancer family
  // Reads as journal page, not clinical white
  background: '#F0EDE6',
  card: '#FFFFFF',
  inputBg: '#F7F5F1',
  chipBg: '#EDE9E2',

  // ── Text ──────────────────────────────────
  // Soft warm ink — never pure black
  text: '#221E1A',
  textSecondary: '#7A7168',
  textTertiary: '#9A9186',
  textQuaternary: '#C2BBB2',

  // ── Structure ─────────────────────────────
  border: '#E4DED6',
  track: '#DDD8CF',

  // ── Accent — Smoky Teal ───────────────────
  // WGSN/Coloro Transformative Teal 2026
  // "A fluid fusion between dependable dark blue and aquatic green,
  //  the colour for a period of change and redirection"
  // Semantically tied to Sinne's "tracks your transformation" promise
  accent: '#3E6B6A',
  accentMid: '#5A8F8E',   // for icons, borders on tint bg
  accentTint: '#EAF2F1',  // chip selected bg, tag bg

  // ── Gold — Milestone / Insight accent ─────
  // Warm gold — used sparingly for breakthroughs, "today" markers,
  // and special moments only. A second emotional register, not a
  // second brand color. Never for navigation, labels, or routine UI.
  gold: '#C8A86A',
  goldLabel: '#8A6E3A',
  goldTint: '#F7F1E4',

  // ── Utility ───────────────────────────────
  // Muted clay red — warm, not alarm
  destructive: '#C0392B',

  // ── UI grays ──────────────────────────────
  // For dividers, disabled states, placeholders
  gray100: '#F0F0F0',
  gray200: '#E0E0E0',
  gray300: '#CCCCCC',
  gray400: '#999999',
  gray500: '#666666',
  gray600: '#1A1A1A',
  white: '#FFFFFF',
  black: '#000000',

  // ── Accent purple (legacy — crown/insight data viz only) ──────
  // Reserved exclusively for crown chakra visualization and
  // insight-related data overlays. Do not use for navigation,
  // buttons, or any routine UI elements.
  purple: '#B07FFF',
  purpleTint: '#B07FFF26',

  // ── Integration category colors ───────────
  // Used in data visualization
  emotionCategory: '#6E9BB5',
  bodyCategory: '#7AAE8A',
  triggersCategory: '#B5736A',
  patternsCategory: '#7E6B9E',
  meaningCategory: '#9B7FBF',
  realizationsCategory: '#9B7FBF',
  gratitudeCategory: '#7AAE8A',
  memoriesCategory: '#6E9BB5',
  actionsCategory: '#C9B96A',
  freeTextCategory: '#999999',

  // ── Journey accent colors ─────────────────
  journey1: '#6E9BB5',
  journey2: '#7AAE8A',
  journey3: '#C49A6C',
  journey4: '#7E6B9E',
  journey5: '#B5736A',
  journey6: '#C9B96A',

  // ── Calendar & visualization ──────────────
  calendarToday: '#3E6B6A',    // teal — was purple; now consistent with accent
  calendarPast: '#CCCCCC',
  calendarFuture: '#999999',
  integrationIcon: '#3E6B6A',  // teal — was purple; now consistent with accent
  errorRed: '#FF6B6B',

  // ── Chakra visualization (brighter) ───────
  // Used for chakra view dots - brighter than muted palette
  chakraRoot: '#E8A080',
  chakraSacral: '#E88040',
  chakraSolar: '#E8C080',
  chakraHeart: '#80C880',
  chakraThroat: '#80C8E8',
  chakraThirdEye: '#8080E8',
  chakraCrown: '#C880C8',

  // ── Practice type legend colors ───────────
  practiceBreathwork: '#6E9BB5',
  practiceSomatic: '#7AAE8A',
  practiceMeditation: '#9B7FBF',
  practiceYoga: '#C49A6C',
  practiceMovement: '#C9B96A',
  practiceOther: '#CCCCCC',

  // ── Arc band colors (muted NS states) ─────
  arcGrounded: '#8FAE9A',
  arcActivated: '#B8A080',
  arcShutdown: '#A89ABF',

  // ── NS state narrative accent ─────────────
  narrativeAccent: '#3E6B6A',

  // ── NS state colours ──────────────────────
  // Warm-to-cool temperature scale within muted family
  // No alarm reds — trauma-informed safe palette
  // Grounded: sage — growth, safety, regulation (ventral vagal)
  grounded: '#6A9E7F',
  groundedLabel: '#4A7A5C',
  groundedTint: '#EAF4EE',
  // Activated: warm ochre — energy, mobilisation (sympathetic)
  activated: '#C08A3E',
  activatedLabel: '#8A6020',
  activatedTint: '#F7EFE0',
  // Shutdown: muted slate-blue — withdrawal, collapse (dorsal)
  shutdown: '#5C7A94',
  shutdownLabel: '#3A5870',
  shutdownTint: '#E8EFF5',

  // ── Chakra colours — DATA LAYER ONLY ─────
  // Used exclusively for: body heatmap blobs, emotion cluster chips,
  // practice type dots, calendar legend. Never as screen backgrounds.
  // Muted/desaturated so they harmonise with the warm base.
  root: '#A8665E',
  rootTint: '#F3EDEB',
  sacral: '#B8885A',
  sacralTint: '#F5EDE2',
  solar: '#B8A84A',
  solarTint: '#F5F2E0',
  heart: '#6A9E7F',       // intentionally shared with grounded NS state
  heartTint: '#EAF4EE',
  throat: '#5A8F9E',
  throatTint: '#E5EFF3',
  thirdEye: '#7A6898',
  thirdEyeTint: '#EEEAF5',
  crown: '#9070A8',
  crownTint: '#F0EAF5',
};

// ─────────────────────────────────────────────
// Helper arrays for rotation/selection
// ─────────────────────────────────────────────
export const JOURNEY_COLORS = [
  COLORS.journey1,
  COLORS.journey2,
  COLORS.journey3,
  COLORS.journey4,
  COLORS.journey5,
  COLORS.journey6,
];

export const ARC_BAND_COLORS = [
  COLORS.arcGrounded,
  COLORS.arcActivated,
  COLORS.arcShutdown,
];

export const PRACTICE_LEGEND_COLORS = [
  { color: COLORS.practiceBreathwork, label: 'Breathwork' },
  { color: COLORS.practiceSomatic, label: 'Somatic' },
  { color: COLORS.practiceMeditation, label: 'Meditation' },
  { color: COLORS.practiceYoga, label: 'Yoga' },
  { color: COLORS.practiceMovement, label: 'Movement' },
  { color: COLORS.practiceOther, label: 'Other' },
];

// Integration category color map
export const INTEGRATION_CATEGORY_COLORS: Record<string, string> = {
  emotions: COLORS.emotionCategory,
  body: COLORS.bodyCategory,
  triggers: COLORS.triggersCategory,
  patterns: COLORS.patternsCategory,
  meaning: COLORS.meaningCategory,
  realizations: COLORS.realizationsCategory,
  gratitude: COLORS.gratitudeCategory,
  memories: COLORS.memoriesCategory,
  actions: COLORS.actionsCategory,
  free_text: COLORS.freeTextCategory,
};

// Chakra visualization color array (for overview dots)
export const CHAKRA_COLORS = [
  COLORS.chakraRoot,
  COLORS.chakraSacral,
  COLORS.chakraSolar,
  COLORS.chakraHeart,
  COLORS.chakraThroat,
  COLORS.chakraThirdEye,
  COLORS.chakraCrown,
];

export const RADII = {
  card: 20,
  chip: 24,
  input: 16,
  pill: 999,
};

export const CARD_SHADOW: ViewStyle = {
  shadowColor: '#221E1A',
  shadowOpacity: 0.06,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
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

// ─────────────────────────────────────────────
// NS state colour map
// Keys: grounded / ventral / self (ventral/IFS aliases)
//       activated / sympathetic / activated part
//       shutdown / dorsal / blended
// bg uses hex tint values (not rgba — avoids Android rgba bug)
// ─────────────────────────────────────────────
export const STATE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  grounded:         { bg: COLORS.groundedTint,  text: COLORS.groundedLabel,  border: COLORS.grounded },
  ventral:          { bg: COLORS.groundedTint,  text: COLORS.groundedLabel,  border: COLORS.grounded },
  self:             { bg: COLORS.groundedTint,  text: COLORS.groundedLabel,  border: COLORS.grounded },
  activated:        { bg: COLORS.activatedTint, text: COLORS.activatedLabel, border: COLORS.activated },
  sympathetic:      { bg: COLORS.activatedTint, text: COLORS.activatedLabel, border: COLORS.activated },
  'activated part': { bg: COLORS.activatedTint, text: COLORS.activatedLabel, border: COLORS.activated },
  shutdown:         { bg: COLORS.shutdownTint,  text: COLORS.shutdownLabel,  border: COLORS.shutdown },
  dorsal:           { bg: COLORS.shutdownTint,  text: COLORS.shutdownLabel,  border: COLORS.shutdown },
  blended:          { bg: COLORS.shutdownTint,  text: COLORS.shutdownLabel,  border: COLORS.shutdown },
};

export function getStateColor(state: string | null | undefined) {
  if (!state) return STATE_COLORS.grounded;
  return STATE_COLORS[state.toLowerCase()] || STATE_COLORS.grounded;
}

// ─────────────────────────────────────────────
// Integration category data
// All use accent teal — consistent, single-brand
// ─────────────────────────────────────────────
export const CATEGORY_DATA: Record<string, {
  icon: string; color: string; tint: string; desc: string;
}> = {
  Actions:      { icon: 'lightning-bolt-outline', color: COLORS.accent, tint: COLORS.accentTint, desc: 'What will you do differently?' },
  Body:         { icon: 'human',                  color: COLORS.accent, tint: COLORS.accentTint, desc: 'Physical sensations and signals' },
  Emotions:     { icon: 'heart-outline',          color: COLORS.accent, tint: COLORS.accentTint, desc: "What's still moving?" },
  Gratitude:    { icon: 'hand-heart-outline',     color: COLORS.accent, tint: COLORS.accentTint, desc: 'What you want to acknowledge' },
  Meaning:      { icon: 'lightbulb-outline',      color: COLORS.accent, tint: COLORS.accentTint, desc: 'Deeper significance' },
  Memories:     { icon: 'image-outline',          color: COLORS.accent, tint: COLORS.accentTint, desc: 'Surfacing images and moments' },
  Patterns:     { icon: 'repeat-variant',         color: COLORS.accent, tint: COLORS.accentTint, desc: 'Familiar dynamics noticed' },
  Realizations: { icon: 'star-outline',           color: COLORS.accent, tint: COLORS.accentTint, desc: 'What became clearer' },
  Triggers:     { icon: 'alert-circle-outline',   color: COLORS.accent, tint: COLORS.accentTint, desc: 'What set something off' },
};

// ─────────────────────────────────────────────
// Body region → muted chakra colour (data layer)
// ─────────────────────────────────────────────
export const REGION_COLORS: Record<string, string> = {
  'Head / mind':          COLORS.crown,
  Eyes:                   COLORS.thirdEye,
  'Jaw / face':           COLORS.thirdEye,
  Throat:                 COLORS.throat,
  'Chest / heart':        COLORS.heart,
  'Shoulders / upper back': COLORS.heart,
  'Arms / hands':         COLORS.heart,
  'Solar plexus / gut':   COLORS.solar,
  'Pelvis / lower belly': COLORS.sacral,
  'Legs / feet':          COLORS.root,
  Spine:                  COLORS.crown,
  'Full body':            COLORS.crown,
};

export function getRegionColor(region: string): string {
  return REGION_COLORS[region] || COLORS.crown;
}

// ─────────────────────────────────────────────
// Emotion tag → chakra cluster colour (data layer)
// ─────────────────────────────────────────────
export const EMOTION_CLUSTERS: Record<string, { bg: string; text: string }> = {
  // Grief — Throat
  grief:       { bg: COLORS.throatTint, text: COLORS.throat },
  sadness:     { bg: COLORS.throatTint, text: COLORS.throat },
  longing:     { bg: COLORS.throatTint, text: COLORS.throat },
  loss:        { bg: COLORS.throatTint, text: COLORS.throat },
  heartbreak:  { bg: COLORS.throatTint, text: COLORS.throat },
  // Fear — Root
  fear:        { bg: COLORS.rootTint, text: COLORS.root },
  dread:       { bg: COLORS.rootTint, text: COLORS.root },
  anxiety:     { bg: COLORS.rootTint, text: COLORS.root },
  terror:      { bg: COLORS.rootTint, text: COLORS.root },
  panic:       { bg: COLORS.rootTint, text: COLORS.root },
  // Anger — Sacral
  anger:       { bg: COLORS.sacralTint, text: COLORS.sacral },
  rage:        { bg: COLORS.sacralTint, text: COLORS.sacral },
  frustration: { bg: COLORS.sacralTint, text: COLORS.sacral },
  irritation:  { bg: COLORS.sacralTint, text: COLORS.sacral },
  resentment:  { bg: COLORS.sacralTint, text: COLORS.sacral },
  // Shame — Third Eye
  shame:        { bg: COLORS.thirdEyeTint, text: COLORS.thirdEye },
  guilt:        { bg: COLORS.thirdEyeTint, text: COLORS.thirdEye },
  unworthiness: { bg: COLORS.thirdEyeTint, text: COLORS.thirdEye },
  smallness:    { bg: COLORS.thirdEyeTint, text: COLORS.thirdEye },
  // Positive — Heart
  joy:       { bg: COLORS.heartTint, text: COLORS.heart },
  gratitude: { bg: COLORS.heartTint, text: COLORS.heart },
  love:      { bg: COLORS.heartTint, text: COLORS.heart },
  warmth:    { bg: COLORS.heartTint, text: COLORS.heart },
  bliss:     { bg: COLORS.heartTint, text: COLORS.heart },
  awe:       { bg: COLORS.heartTint, text: COLORS.heart },
  // Liminal — Crown
  confusion:    { bg: COLORS.crownTint, text: COLORS.crown },
  numbness:     { bg: COLORS.crownTint, text: COLORS.crown },
  emptiness:    { bg: COLORS.crownTint, text: COLORS.crown },
  dissociation: { bg: COLORS.crownTint, text: COLORS.crown },
  // Release — Sacral
  release:  { bg: COLORS.sacralTint, text: COLORS.sacral },
  openness: { bg: COLORS.sacralTint, text: COLORS.sacral },
  relief:   { bg: COLORS.sacralTint, text: COLORS.sacral },
  surrender:{ bg: COLORS.sacralTint, text: COLORS.sacral },
};

export function getEmotionColor(tag: string): { bg: string; text: string } {
  return EMOTION_CLUSTERS[tag.toLowerCase()] || { bg: COLORS.crownTint, text: COLORS.crown };
}

// ─────────────────────────────────────────────
// Practice type → calendar / legend colour (data layer)
// ─────────────────────────────────────────────
export function getPracticeColor(practiceType: string | null | undefined): string {
  if (!practiceType) return COLORS.textQuaternary;
  const base = practiceType.split(':')[0].trim();
  const map: Record<string, string> = {
    'Breathwork':                   COLORS.throat,
    'Dance / movement therapy':     COLORS.solar,
    'IFS / Internal Family Systems':COLORS.crown,
    'Meditation / Vipassana':       COLORS.thirdEye,
    'Qi Gong / Tai Chi':            COLORS.heart,
    'Reiki / energy healing':       COLORS.crown,
    'Somatic Experiencing':         COLORS.heart,
    'Sound healing':                COLORS.throat,
    'Trauma therapy (body-based)':  COLORS.root,
    'Yoga':                         COLORS.sacral,
    'Other':                        COLORS.textTertiary,
  };
  for (const [key, color] of Object.entries(map)) {
    if (base === key || base.startsWith(key) || key.startsWith(base)) return color;
  }
  return COLORS.textQuaternary;
}

// ─────────────────────────────────────────────
// Global font patcher
// Patches Text and TextInput to use Nunito
// weighted by fontWeight. Called once in _layout.tsx.
// Note: this approach is fragile against major Expo SDK
// upgrades — consider migrating to NativeWind @apply
// or a global <AppText> wrapper in Phase B.
// ─────────────────────────────────────────────
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
  bold:  'Nunito_700Bold',
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