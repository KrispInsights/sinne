import React from 'react';
import { View, Image, TouchableOpacity } from 'react-native';
import type { BodySensation } from '@/lib/types';

export const REGION_CHAKRA_COLORS: Record<string, string> = {
  head: '#9B7FBF', eyes: '#7E6B9E', jaw: '#7E6B9E', throat: '#6E9BB5',
  chest: '#7AAE8A', shoulders: '#7AAE8A', arms: '#7AAE8A',
  solar_plexus: '#C9B96A', pelvis: '#C49A6C', legs: '#B5736A',
  spine: '#9B7FBF', full_body: '#9B7FBF',
};

export const REGION_OVERLAYS: Record<string, Array<{ top: string; left: string; width: string; height: string }>> = {
  head:         [{ top: '2%',  left: '38%', width: '24%', height: '12%' }],
  eyes:         [{ top: '7%',  left: '40%', width: '20%', height: '6%'  }],
  jaw:          [{ top: '12%', left: '39%', width: '22%', height: '7%'  }],
  throat:       [{ top: '18%', left: '41%', width: '18%', height: '6%'  }],
  chest:        [{ top: '24%', left: '32%', width: '36%', height: '12%' }],
  shoulders:    [{ top: '21%', left: '18%', width: '64%', height: '7%'  }],
  arms:         [{ top: '27%', left: '8%',  width: '16%', height: '26%' }, { top: '27%', left: '76%', width: '16%', height: '26%' }],
  solar_plexus: [{ top: '36%', left: '33%', width: '34%', height: '10%' }],
  pelvis:       [{ top: '46%', left: '33%', width: '34%', height: '10%' }],
  legs:         [{ top: '57%', left: '30%', width: '17%', height: '36%' }, { top: '57%', left: '53%', width: '17%', height: '36%' }],
  spine:        [{ top: '20%', left: '45%', width: '10%', height: '34%' }],
  full_body:    [{ top: '3%',  left: '15%', width: '70%', height: '90%' }],
};

const OPENING_QUALITIES = new Set(['opening','releasing','release','expansion','expanding','warmth','waves','dissolving','softening','clarity','rooting','grounding','weight lifting','wanting to speak','flutter','energy moving']);
const CONTRACTING_QUALITIES = new Set(['tightness','tightening','constriction','tension','heaviness','pressure','numb','numbness','cramping','tetany','sinking','churning','lump','aching','fog','contraction','burning','dropping','nausea','spinning']);

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function getSensationBg(bs: BodySensation): string {
  if (!bs.quality) return hexToRgba(REGION_CHAKRA_COLORS[bs.region] ?? '#808080', 0.25);
  const q = bs.quality.toLowerCase();
  if (OPENING_QUALITIES.has(q)) return hexToRgba('#7AAE8A', 0.35);
  if (CONTRACTING_QUALITIES.has(q)) return hexToRgba('#B5736A', 0.35);
  return hexToRgba(REGION_CHAKRA_COLORS[bs.region] ?? '#808080', 0.25);
}

export function BodyFigureEllipses({
  width, bodySensations, onPress,
}: {
  width: number; bodySensations: BodySensation[]; onPress?: () => void;
}) {
  const height = Math.round(width * 1.5);
  const inner = (
    <View style={{ width, height }}>
      <Image source={require('../assets/body.png')} style={{ width, height }} resizeMode="contain" />
      {bodySensations.flatMap((bs) => {
        const positions = REGION_OVERLAYS[bs.region];
        if (!positions) return [];
        const bg = getSensationBg(bs);
        return positions.map((pos, idx) => (
          <View
            key={`${bs.region}-${idx}`}
            style={{
              position: 'absolute',
              top: pos.top as any,
              left: pos.left as any,
              width: pos.width as any,
              height: pos.height as any,
              borderRadius: 999,
              backgroundColor: bg,
            }}
          />
        ));
      })}
    </View>
  );
  if (onPress) {
    return <TouchableOpacity onPress={onPress} activeOpacity={0.8}>{inner}</TouchableOpacity>;
  }
  return inner;
}
