import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useState } from 'react';
import { useRouter, Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getProfile, signIn } from '@/lib/storage';

const IS_DEV = process.env.EXPO_PUBLIC_DEV_MODE === 'true';

type FieldError = { email?: string; password?: string; form?: string };

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldError>({});
  const [loading, setLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const canSubmit = IS_DEV ? !loading : (email.trim().length > 0 && password.length > 0 && !loading);

  async function handleSignIn() {
    if (IS_DEV) {
      setLoading(true);
      await signIn();
      router.replace('/(tabs)');
      setLoading(false);
      return;
    }

    const next: FieldError = {};
    if (!isValidEmail(email)) next.email = 'Enter a valid email address.';
    if (password.length === 0) next.password = 'Enter your password.';
    if (Object.keys(next).length) { setErrors(next); return; }

    setErrors({});
    setLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 400));
      const profile = await getProfile();
      await signIn();
      router.replace(profile.onboarding_complete ? '/(tabs)' : '/onboarding');
    } catch {
      setErrors({ form: 'Something went wrong. Check your connection and try again.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Wordmark */}
          <View style={styles.header}>
            <Text style={styles.wordmark}>Sinne</Text>
            <Text style={styles.descriptor}>Track what your practice is doing to you.</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Apple Sign-In */}
            <TouchableOpacity
              style={styles.appleButton}
              onPress={() => {}}
              activeOpacity={0.85}
            >
              <Text style={styles.appleButtonText}>Continue with Apple</Text>
            </TouchableOpacity>

            {/* Google Sign-In */}
            <TouchableOpacity
              style={styles.googleButton}
              onPress={() => {}}
              activeOpacity={0.85}
            >
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Email */}
            <View style={styles.fieldGroup}>
              <TextInput
                style={[
                  styles.input,
                  emailFocused && styles.inputFocused,
                  errors.email && styles.inputError,
                ]}
                placeholder="Email"
                placeholderTextColor="#c4b8a8"
                value={email}
                onChangeText={(v) => { setEmail(v); setErrors((e) => ({ ...e, email: undefined })); }}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                autoComplete="email"
                editable={!loading}
                returnKeyType="next"
              />
              {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
            </View>

            {/* Password */}
            <View style={styles.fieldGroup}>
              <TextInput
                style={[
                  styles.input,
                  passwordFocused && styles.inputFocused,
                  errors.password && styles.inputError,
                ]}
                placeholder="Password"
                placeholderTextColor="#c4b8a8"
                value={password}
                onChangeText={(v) => { setPassword(v); setErrors((e) => ({ ...e, password: undefined })); }}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password"
                editable={!loading}
                returnKeyType="done"
                onSubmitEditing={canSubmit ? handleSignIn : undefined}
              />
              {errors.password ? (
                <Text style={styles.errorText}>{errors.password}</Text>
              ) : null}
              <Link href="/(auth)/forgot-password" asChild>
                <TouchableOpacity style={styles.forgotLink}>
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </TouchableOpacity>
              </Link>
            </View>

            {/* Form-level error */}
            {errors.form ? <Text style={styles.errorText}>{errors.form}</Text> : null}

            {/* Submit */}
            <TouchableOpacity
              style={[styles.button, !canSubmit && styles.buttonDisabled]}
              onPress={handleSignIn}
              disabled={!canSubmit}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={[styles.buttonText, !canSubmit && styles.buttonTextDisabled]}>
                  Sign in
                </Text>
              )}
            </TouchableOpacity>

            {/* Switch to sign-up */}
            <Link href="/(auth)/sign-up" asChild>
              <TouchableOpacity style={styles.switchLink}>
                <Text style={styles.switchText}>New here? Create an account</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F7F3EE',
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 32,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 16,
  },
  wordmark: {
    fontSize: 22,
    fontWeight: '500',
    color: '#3a2e25',
    letterSpacing: -0.5,
  },
  descriptor: {
    fontSize: 14,
    fontWeight: '400',
    color: '#a09580',
    marginTop: 6,
    textAlign: 'center',
  },
  form: {
    gap: 12,
  },
  fieldGroup: {
    gap: 6,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAE4DC',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: '#3a2e25',
    minHeight: 48,
  },
  inputFocused: {
    borderColor: '#6B5E4E',
  },
  inputError: {
    borderColor: '#FF2A2A',
  },
  errorText: {
    fontSize: 13,
    color: '#FF2A2A',
    paddingHorizontal: 2,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    paddingVertical: 4,
  },
  forgotText: {
    fontSize: 13,
    color: '#a09580',
  },
  button: {
    backgroundColor: '#6B5E4E',
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#EAE4DC',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  buttonTextDisabled: {
    color: '#c4b8a8',
  },
  switchLink: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  switchText: {
    fontSize: 14,
    color: '#6B5E4E',
  },
  appleButton: {
    backgroundColor: '#000000',
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appleButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAE4DC',
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#3a2e25',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#EAE4DC',
  },
  dividerText: {
    fontSize: 13,
    color: '#a09580',
    paddingHorizontal: 12,
  },
});
