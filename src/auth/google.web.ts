export const googleAvailable = false

export async function getGoogleIdToken(): Promise<string | null> {
  throw new Error('Google sign-in is only available in the phone app.')
}

export async function googleSignOut(): Promise<void> {}
