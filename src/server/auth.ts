import {betterAuth} from 'better-auth'
import {admin} from 'better-auth/plugins'
import {drizzleAdapter} from 'better-auth/adapters/drizzle'
import {Resend} from 'resend'
import {join} from 'node:path'
import {mkdir, writeFile} from 'node:fs/promises'
import {config, production} from './config'
import {db, schema, isPg} from './db'

async function email(to: string, subject: string, url: string) {
  if (!production) {
    await mkdir(config.MAIL_DIR, {recursive:true, mode:0o700})
    await writeFile(join(config.MAIL_DIR,`${crypto.randomUUID()}.json`), JSON.stringify({to,subject,url}), {mode:0o600})
    return
  }
  const {error} = await new Resend(config.RESEND_API_KEY).emails.send({from:config.EMAIL_FROM!, to, subject, text:url})
  if (error) throw new Error('Account email delivery failed')
}
export const auth = betterAuth({
  database: drizzleAdapter(db, {provider: isPg ? 'pg' : 'sqlite', schema}),
  secret: config.BETTER_AUTH_SECRET,
  advanced: {database: {generateId: () => crypto.randomUUID()}},
  baseURL: config.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled:true, requireEmailVerification:true,
    sendResetPassword: ({user,url}) => email(user.email, 'Reset your password', url),
  },
  emailVerification: {
    sendOnSignUp:true,
    sendVerificationEmail: ({user,url}) => email(user.email,'Verify your email address',url),
  },
  plugins:[admin()],
  logger:{disabled:true},
})
