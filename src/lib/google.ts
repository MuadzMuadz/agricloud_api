import { OAuth2Client } from 'google-auth-library'
import { config } from '../config.ts'

const client = new OAuth2Client(config.google.clientId)

export interface GoogleProfile {
  id: string
  email: string | null
  name: string | null
  avatar: string | null
}

// Verifikasi Google ID token (padanan Socialite::driver('google')->userFromToken).
// verifyIdToken sekaligus memeriksa signature, expiry, dan audience = client_id.
// Melempar bila token invalid → handler menerjemahkan ke 401.
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile> {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: config.google.clientId,
  })
  const p = ticket.getPayload()
  if (!p) throw new Error('Empty Google payload')
  return {
    id: p.sub,
    email: p.email ?? null,
    name: p.name ?? null,
    avatar: p.picture ?? null,
  }
}
