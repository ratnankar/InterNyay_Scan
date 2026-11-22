import { create } from 'zustand'
import { authApi, type AccountType } from '@/api/endpoints'
import { setUnauthorizedHandler } from '@/api/http'
import type { User } from '@/api/types'
import { clearToken, getToken, setToken } from '@/auth/token'
import { kvGet, kvSet, wipeLocalData } from '@/db'
import { clearDownloads } from '@/api/files'

type SessionState = {
  status: 'loading' | 'signedOut' | 'signedIn'
  user: User | null
  restore: () => Promise<void>
  signIn: (email: string, password: string, accountType: AccountType) => Promise<void>
  signOut: () => Promise<void>
}

export const useSession = create<SessionState>((set) => ({
  status: 'loading',
  user: null,
  restore: async () => {
    try {
      const token = await getToken()
      if (!token) {
        set({ status: 'signedOut', user: null })
        return
      }
      const cachedUser = await kvGet('user')
      if (cachedUser) {
        try {
          set({ status: 'signedIn', user: JSON.parse(cachedUser) as User })
          return
        } catch {
          await clearToken()
        }
      }
    } catch {
      // storage unavailable: fall through to signed out
    }
    set({ status: 'signedOut', user: null })
  },
  signIn: async (email, password, accountType) => {
    const result = await authApi.login(email.trim(), password, accountType)
    await setToken(result.token)
    await kvSet('user', JSON.stringify(result.user))
    set({ status: 'signedIn', user: result.user })
  },
  signOut: async () => {
    await clearToken()
    await wipeLocalData()
    clearDownloads()
    set({ status: 'signedOut', user: null })
  },
}))

setUnauthorizedHandler(() => {
  if (useSession.getState().status === 'signedIn') {
    void useSession.getState().signOut()
  }
})
