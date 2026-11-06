import {betterAuth} from 'better-auth'
import {admin} from 'better-auth/plugins'
import {drizzleAdapter} from 'better-auth/adapters/drizzle'
import {config} from './config'
import {db, schema, isPg} from './db'

export const auth = betterAuth({
  database: drizzleAdapter(db, {provider: isPg ? 'pg' : 'sqlite', schema}),
  secret: config.BETTER_AUTH_SECRET,
  advanced: {database: {generateId: () => crypto.randomUUID()}},
  baseURL: config.BETTER_AUTH_URL,
  emailAndPassword: {enabled:true},
  plugins:[admin()],
  logger:{disabled:true},
})
