import React from 'react';
import { Text, TextInput, StyleSheet } from 'react-native';

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
