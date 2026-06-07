import bcrypt from 'bcryptjs'

// Laravel memakai bcrypt dengan prefix `$2y$`. bcryptjs menghasilkan/mengenali
// `$2a$`/`$2b$`. Algoritmanya identik — kita normalkan prefix saat verifikasi.
function normalize(hash: string): string {
  return hash.startsWith('$2y$') ? '$2b$' + hash.slice(4) : hash
}

export async function verifyPassword(plain: string, hash: string | null): Promise<boolean> {
  if (!hash) return false
  return bcrypt.compare(plain, normalize(hash))
}

// Cost 12 = default Laravel (config hashing.bcrypt.rounds). Hash bisa diverifikasi
// balik oleh PHP password_verify (menerima $2a/$2b).
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12)
}
