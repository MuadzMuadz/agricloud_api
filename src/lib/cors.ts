// Helper pencocokan origin CORS — dipisah agar mudah dites & dipakai app.ts.
//
// Latar: `hono/cors` dengan `origin` berupa array string hanya meng-echo
// `Access-Control-Allow-Origin` bila origin PERSIS ada di array. Itu tak bisa
// menangani preview Vercel `https://<acak>.vercel.app` yang subdomainnya
// berubah tiap deploy. Maka kita pakai fungsi: exact match allowlist + regex.

/** True bila origin lolos: ada di allowlist (exact) ATAU cocok salah satu pola. */
export function isOriginAllowed(
  origin: string,
  allow: string[],
  patterns: RegExp[],
): boolean {
  if (allow.includes(origin)) return true
  return patterns.some((re) => re.test(origin))
}

/**
 * Bangun matcher untuk opsi `origin` di `hono/cors`.
 * Mengembalikan origin pemanggil bila lolos (di-echo → kompatibel dengan
 * `credentials: true`), atau `null` bila ditolak (Allow-Origin tak dikirim).
 */
export function buildOriginMatcher(
  allow: string[],
  patterns: RegExp[],
): (origin: string) => string | null {
  return (origin: string) =>
    origin && isOriginAllowed(origin, allow, patterns) ? origin : null
}
