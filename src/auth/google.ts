import { GoogleSignin, isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin'

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? ''

export const googleAvailable = webClientId.length > 0

let configured = false

function configure() {
  if (configured) return
  GoogleSignin.configure({ webClientId, scopes: ['email', 'profile'] })
  configured = true
}

// Returns a Google ID token, or null when the person closes the Google sheet.
export async function getGoogleIdToken(): Promise<string | null> {
  if (!googleAvailable) throw new Error('Google sign-in is not set up in this build.')
  configure()
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
    const res = await GoogleSignin.signIn()
    if (res.type !== 'success') return null
    const token = res.data.idToken
    if (!token) throw new Error('Google did not return a sign-in token. Please try again.')
    return token
  } catch (e) {
    if (isErrorWithCode(e)) {
      if (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS) return null
      if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new Error('Google Play services are missing or out of date on this phone.')
      }
    }
    throw e instanceof Error ? e : new Error('Google sign-in failed. Please try again.')
  }
}

export async function googleSignOut(): Promise<void> {
  if (!googleAvailable) return
  try {
    configure()
    await GoogleSignin.signOut()
  } catch {
    // nothing to clear
  }
}
