import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { isSignedIn, getProfile } from '@/lib/storage';

type Dest = '/(auth)/sign-in' | '/(tabs)' | '/onboarding' | null;

export default function Index() {
  const [dest, setDest] = useState<Dest>(null);

  useEffect(() => {
    (async () => {
      const signedIn = await isSignedIn();
      if (!signedIn) { setDest('/(auth)/sign-in'); return; }
      const profile = await getProfile();
      setDest(profile.onboarding_complete ? '/(tabs)' : '/onboarding');
    })();
  }, []);

  if (!dest) return <View style={{ flex: 1, backgroundColor: '#F7F3EE' }} />;
  return <Redirect href={dest} />;
}
