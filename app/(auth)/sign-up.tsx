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
import { saveProfile, createNewProfile, signIn } from '@/lib/storage';

type FieldError = {
  email?: string;
  password?: string;
  confirm?: string;
  form?: string;
};

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export default function SignUpScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<FieldError>({});
  const [loading, setLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);

  const allFilled = email.trim().length > 0 && password.length > 0 && confirm.length > 0;
  const hasErrors = Object.keys(errors).some((k) => errors[k as keyof FieldError]);
  const canSubmit = allFilled && !hasErrors && !loading;

  function clearFieldError(field: keyof FieldError) {
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  async function handleCreateAccount() {
    const next: FieldError = {};
    if (!isValidEmail(email)) next.email = 'Enter a valid email address.';
    if (password.length < 8) next.password = 'Password must be at least 8 characters.';
    if (password !== confirm) next.confirm = "Passwords don't match.";
    if (Object.keys(next).length) { setErrors(next); return; }

    setErrors({});
    setLoading(true);
    try {
      // Phase A: simulate account creation. Phase B: swap for Supabase auth.
      await new Promise((r) => setTimeout(r, 500));
      const profile = createNewProfile();
      await saveProfile(profile);
      await signIn();
      router.replace('/onboarding');
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
                onChangeText={(v) => { setEmail(v); clearFieldError('email'); }}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                editable={!loading}
                returnKeyType="next"
              />
              {errors.email ? (
                <Text style={styles.errorText}>{errors.email}</Text>
              ) : null}
              {/* "email already exists" error with tappable link */}
              {errors.form === 'already_exists' ? (
                <Text style={styles.errorText}>
                  An account with this email already exists.{' '}
                  <Text
                    style={styles.errorLink}
                    onPress={() => router.replace('/(auth)/sign-in')}
                  >
                    Sign in instead?
                  </Text>
                </Text>
              ) : null}
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
                onChangeText={(v) => { setPassword(v); clearFieldError('password'); }}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                editable={!loading}
                returnKeyType="next"
              />
              {errors.password ? (
                <Text style={styles.errorText}>{errors.password}</Text>
              ) : null}
            </View>

            {/* Confirm password */}
            <View style={styles.fieldGroup}>
              <TextInput
                style={[
                  styles.input,
                  confirmFocused && styles.inputFocused,
                  errors.confirm && styles.inputError,
                ]}
                placeholder="Confirm password"
                placeholderTextColor="#c4b8a8"
                value={confirm}
                onChangeText={(v) => { setConfirm(v); clearFieldError('confirm'); }}
                onFocus={() => setConfirmFocused(true)}
                onBlur={() => setConfirmFocused(false)}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                editable={!loading}
                returnKeyType="done"
                onSubmitEditing={canSubmit ? handleCreateAccount : undefined}
              />
              {errors.confirm ? (
                <Text style={styles.errorText}>{errors.confirm}</Text>
              ) : null}
            </View>

            {/* Generic form error */}
            {errors.form && errors.form !== 'already_exists' ? (
              <Text style={styles.errorText}>{errors.form}</Text>
            ) : null}

            {/* Submit */}
            <TouchableOpacity
              style={[styles.button, !canSubmit && styles.buttonDisabled]}
              onPress={handleCreateAccount}
              disabled={!canSubmit}
              activeOpacity={0.85}
            >
              {loading ? (
                <View style={styles.buttonLoading}>
                  <ActivityIndicator color="#ffffff" size="small" />
                  <Text style={styles.buttonText}>Creating account…</Text>
                </View>
              ) : (
                <Text style={[styles.buttonText, !canSubmit && styles.buttonTextDisabled]}>
                  Create account
                </Text>
              )}
            </TouchableOpacity>

            {/* Switch to sign-in */}
            <Link href="/(auth)/sign-in" asChild>
              <TouchableOpacity style={styles.switchLink}>
                <Text style={styles.switchText}>Already have an account? Sign in</Text>
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
  errorLink: {
    textDecorationLine: 'underline',
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
  buttonLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
