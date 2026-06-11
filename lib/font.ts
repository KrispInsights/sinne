import React from 'react';
import { Text, TextInput, StyleSheet } from 'react-native';

const WEIGHT_TO_FAMILY: Record<string, string> = {
  '100': 'DMSans_400Regular',
  '200': 'DMSans_400Regular',
  '300': 'DMSans_400Regular',
  '400': 'DMSans_400Regular',
  normal: 'DMSans_400Regular',
  '500': 'DMSans_500Medium',
  '600': 'DMSans_600SemiBold',
  '700': 'DMSans_700Bold',
  '800': 'DMSans_700Bold',
  '900': 'DMSans_700Bold',
  bold: 'DMSans_700Bold',
};

function fontFamilyForStyle(style: unknown): string {
  const flat = (StyleSheet.flatten(style as never) || {}) as { fontWeight?: string | number };
  const weight = String(flat.fontWeight ?? '400');
  return WEIGHT_TO_FAMILY[weight] || 'DMSans_400Regular';
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
