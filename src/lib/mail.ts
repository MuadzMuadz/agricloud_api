import nodemailer from 'nodemailer'
import { config } from '../config.ts'

let transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter
  transporter = nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.port === 465, // SSL untuk 465; STARTTLS untuk 587
    auth: config.mail.username
      ? { user: config.mail.username, pass: config.mail.password }
      : undefined,
  })
  return transporter
}

const from = `"${config.mail.fromName}" <${config.mail.fromAddress}>`

// Kirim email reset password berisi link ke FE.
export async function sendResetPasswordEmail(to: string, resetUrl: string): Promise<void> {
  await getTransporter().sendMail({
    from,
    to,
    subject: 'Reset Kata Sandi AgriCloud',
    text: `Anda menerima email ini karena ada permintaan reset kata sandi untuk akun Anda.\n\nKlik tautan berikut untuk mengatur ulang kata sandi (berlaku 60 menit):\n${resetUrl}\n\nJika Anda tidak meminta ini, abaikan email ini.`,
    html: `<p>Anda menerima email ini karena ada permintaan reset kata sandi untuk akun Anda.</p>
<p><a href="${resetUrl}">Atur ulang kata sandi</a> (berlaku 60 menit).</p>
<p>Jika Anda tidak meminta ini, abaikan email ini.</p>`,
  })
}
