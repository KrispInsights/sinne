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
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Svg, Path } from 'react-native-svg';

function ChevronLeft() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 18l-6-6 6-6"
        stroke="#3a2e25"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const canSubmit = email.trim().length > 0 && !loading;

  async function handleSend() {
    if (!isValidEmail(email)) {
      setEmailError('Enter a valid email address.');
      return;
    }
    setEmailError('');
    setLoading(true);
    // Phase A: simulate the request. Phase B: call Supabase password reset.
    await new Promise((r) => setTimeout(r, 500));
    setLoading(false);
    setSent(true);
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
          {/* Back button */}
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <ChevronLeft />
          </TouchableOpacity>

          {!sent ? (
            <>
              <View style={styles.titleBlock}>
                <Text style={styles.title}>Reset password</Text>
                <Text style={styles.subtitle}>
                  We'll send a link to reset your password.
                </Text>
              </View>

              <View style={styles.form}>
                <View style={styles.fieldGroup}>
                  <TextInput
                    style={[
                      styles.input,
                      emailFocused && styles.inputFocused,
                      emailError && styles.inputError,
                    ]}
                    placeholder="Email"
                    placeholderTextColor="#c4b8a8"
                    value={email}
                    onChangeText={(v) => { setEmail(v); setEmailError(''); }}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    editable={!loading}
                    returnKeyType="done"
                    onSubmitEditing={canSubmit ? handleSend : undefined}
                  />
                  {emailError ? (
                    <Text style={styles.errorText}>{emailError}</Text>
                  ) : null}
                </View>

                <TouchableOpacity
                  style={[styles.button, !canSubmit && styles.buttonDisabled]}
                  onPress={handleSend}
                  disabled={!canSubmit}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={[styles.buttonText, !canSubmit && styles.buttonTextDisabled]}>
                      Send reset link
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.confirmation}>
              <Text style={styles.title}>Check your email</Text>
              <Text style={styles.subtitle}>
                We've sent a reset link to {email.trim().toLowerCase()}.
              </Text>
              <TouchableOpacity
                style={styles.switchLink}
                onPress={() => router.back()}
              >
                <Text style={styles.switchText}>Back to sign in</Text>
              </TouchableOpacity>
            </View>
          )}
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
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    marginTop: 8,
    marginLeft: -4,
  },
  titleBlock: {
    marginTop: 24,
    marginBottom: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: '500',
    color: '#3a2e25',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '400',
    color: '#a09580',
    lineHeight: 22,
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
  confirmation: {
    marginTop: 24,
    flex: 1,
  },
  switchLink: {
    marginTop: 32,
  },
  switchText: {
    fontSize: 14,
    color: '#6B5E4E',
  },
});
