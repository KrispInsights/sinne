import '../global.css';
import React, { useEffect, useRef, useState } from 'react';
import { AppState, Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
} from '@expo-google-fonts/nunito';
import {
  DMSerifDisplay_400Regular,
} from '@expo-google-fonts/dm-serif-display';
import { getMirrorPromptType } from '@/lib/storage';
import type { MirrorPromptType } from '@/lib/types';
import { applyGlobalFont, COLORS } from '@/lib/theme';

SplashScreen.preventAutoHideAsync();
applyGlobalFont();

function MirrorPromptModal() {
  const router = useRouter();
  const appState = useRef(AppState.currentState);
  const [promptType, setPromptType] = useState<MirrorPromptType>(null);

  async function checkPrompt() {
    const type = await getMirrorPromptType();
    setPromptType(type);
  }

  useEffect(() => {
    checkPrompt();
    const sub = AppState.addEventListener('change', (next) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        checkPrompt();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, []);

  function handleViewNow() {
    const type = promptType;
    setPromptType(null);
    router.push({ pathname: '/(tabs)/mirror', params: { autogenerate: type } } as any);
  }

  function handleLater() {
    setPromptType(null);
  }

  if (!promptType) return null;

  const isMonthly = promptType === 'monthly';

  return (
    <Modal transparent visible animationType="fade" onRequestClose={handleLater}>
      <View style={s.overlay}>
        <View style={s.card}>
          <MaterialCommunityIcons name="eye-outline" size={40} color={COLORS.accent} style={{ marginBottom: 16 }} />
          <Text style={s.title}>{isMonthly ? 'Your Monthly Mirror is ready' : 'Your Weekly Mirror is ready'}</Text>
          <Text style={s.body}>
            {isMonthly
              ? 'Take a moment to see how this month moved through you.'
              : 'Take a moment to see how this week moved through you.'}
          </Text>
          <TouchableOpacity style={s.primaryBtn} onPress={handleViewNow} activeOpacity={0.85}>
            <Text style={s.primaryBtnText}>View now</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.laterBtn} onPress={handleLater} activeOpacity={0.7}>
            <Text style={s.laterBtnText}>Later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
    DMSerifDisplay_400Regular,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F2F1F6' } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="new-session" />
        <Stack.Screen name="new-integration" />
        <Stack.Screen name="new-journey" />
        <Stack.Screen name="session/[id]" />
        <Stack.Screen name="journey/[id]" />
        <Stack.Screen name="mirror/[id]" />
        <Stack.Screen name="integration/[id]" />
        <Stack.Screen name="integration/edit/[id]" />
        <Stack.Screen name="integration-entry" />
        <Stack.Screen name="edit-profile" />
      </Stack>
      <MirrorPromptModal />
    </>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32,
  },
  card: {
    width: '100%', backgroundColor: '#FFFFFF', borderRadius: 24,
    padding: 32, alignItems: 'center',
  },
  title: { fontSize: 18, fontWeight: '600', color: '#1A1A1A', textAlign: 'center', marginBottom: 8 },
  body: { fontSize: 14, fontWeight: '400', color: '#666666', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  primaryBtn: {
    width: '100%', height: 48, borderRadius: 12, backgroundColor: COLORS.accent,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  primaryBtnText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  laterBtn: { height: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  laterBtnText: { fontSize: 14, fontWeight: '500', color: '#999999' },
});
