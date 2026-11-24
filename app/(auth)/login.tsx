import { AntDesign, Feather } from '@expo/vector-icons'
import { useRef, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { AccountType } from '@/api/endpoints'
import { getGoogleIdToken, googleAvailable } from '@/auth/google'
import { Seal } from '@/components/Seal'
import { Banner, Button, Field, Screen, Segmented } from '@/components/ui'
import { useSession } from '@/store/session'
import { warn } from '@/utils/haptics'
import type { InputInstance } from '@/utils/refs'
import { colors, fonts, radius, space, type } from '@/theme'

export default function Login() {
  const signIn = useSession((s) => s.signIn)
  const signInWithGoogle = useSession((s) => s.signInWithGoogle)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [account, setAccount] = useState<AccountType>('ADVOCATE')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [show, setShow] = useState(false)
  const passwordRef = useRef<InputInstance>(null)

  const submit = async () => {
    if (busy) return
    if (email.trim().length === 0 || password.length === 0) {
      warn()
      setError('Enter your email and password.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await signIn(email, password, account)
    } catch (e) {
      warn()
      setError(e instanceof Error ? e.message : 'Sign in failed. Check your details and try again.')
      setBusy(false)
    }
  }

  const google = async () => {
    if (busy || googleBusy) return
    setError(null)
    setGoogleBusy(true)
    try {
      const idToken = await getGoogleIdToken()
      if (idToken) await signInWithGoogle(idToken, account)
    } catch (e) {
      warn()
      const message = e instanceof Error ? e.message : 'Google sign-in failed. Please try again.'
      setError(message.replace(/ — open the Register tab to create one/, '. Create the account on the InterNyay website first.'))
    } finally {
      setGoogleBusy(false)
    }
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <View style={styles.mark}>
              <Seal size={56} label="InterNyay Scan" />
            </View>
            <Text style={type.display} accessibilityRole="header">
              InterNyay Scan
            </Text>
            <Text style={[type.body, styles.tagline]}>Scan court papers straight into your clients and cases.</Text>
          </View>

          <View style={styles.segment}>
            <Text style={type.label}>Sign in as</Text>
            <Segmented
              value={account}
              onChange={setAccount}
              options={[
                { id: 'ADVOCATE', label: 'Advocate' },
                { id: 'ASSOCIATE', label: 'Associate' },
              ]}
            />
          </View>

          <View style={styles.form}>
            {error ? <Banner tone="bad" message={error} /> : null}
            <Field
              label="Email"
              value={email}
              onChangeText={(v) => {
                setEmail(v)
                if (error) setError(null)
              }}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              textContentType="username"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            <Field
              label="Password"
              inputRef={passwordRef}
              value={password}
              onChangeText={(v) => {
                setPassword(v)
                if (error) setError(null)
              }}
              secureTextEntry={!show}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={() => void submit()}
              right={
                <Pressable
                  onPress={() => setShow((v) => !v)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={show ? 'Hide password' : 'Show password'}
                  style={styles.eye}
                >
                  <Feather name={show ? 'eye-off' : 'eye'} size={20} color={colors.inkSoft} />
                </Pressable>
              }
            />
            <Button label="Sign in" onPress={() => void submit()} loading={busy} disabled={googleBusy} />

            {googleAvailable ? (
              <>
                <View style={styles.or}>
                  <View style={styles.orLine} />
                  <Text style={type.small}>or</Text>
                  <View style={styles.orLine} />
                </View>
                <Pressable
                  onPress={() => void google()}
                  disabled={busy || googleBusy}
                  accessibilityRole="button"
                  accessibilityLabel={`Continue with Google as ${account === 'ADVOCATE' ? 'an advocate' : 'an associate'}`}
                  accessibilityState={{ disabled: busy || googleBusy, busy: googleBusy }}
                  style={({ pressed }) => [styles.google, (busy || googleBusy) && styles.googleOff, pressed && styles.googlePressed]}
                >
                  {googleBusy ? <ActivityIndicator color={colors.ink} /> : <AntDesign name="google" size={18} color={colors.ink} />}
                  <Text style={styles.googleLabel}>Continue with Google</Text>
                </Pressable>
                <Text style={[type.caption, styles.googleHint]}>Use the Google account with the same email as your InterNyay account.</Text>
              </>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: space.xl, gap: space.xl },
  brand: { gap: space.sm },
  mark: { marginBottom: space.md, alignSelf: 'flex-start' },
  tagline: { color: colors.inkSoft },
  segment: { gap: space.sm },
  form: { marginTop: space.xs },
  or: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginVertical: space.lg },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  google: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
  },
  googleOff: { opacity: 0.5 },
  googlePressed: { opacity: 0.8 },
  googleLabel: { fontFamily: fonts.sansSemi, fontSize: 15, color: colors.ink },
  googleHint: { textAlign: 'center', marginTop: space.sm },
  eye: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
})
