import {z} from 'zod'

export const production = process.env.NODE_ENV === 'production'
export const config = z.object({
  DATABASE_URL: production ? z.url({protocol: /^postgres(ql)?$/}) : z.string().optional(),
  MAIL_DIR: z.string().default('data/mail'),
  SQLITE_PATH: z.string().default('data/local.sqlite'),
  BETTER_AUTH_SECRET: production ? z.string().min(32) : z.string().default('development-only-secret-for-local-use'),
  BETTER_AUTH_URL: production ? z.url({protocol: /^https$/}) : z.url().default('http://localhost:5173'),
  RESEND_API_KEY: production ? z.string().min(1) : z.string().optional(),
  EMAIL_FROM: production ? z.string().min(1) : z.string().optional(),
  PORT: z.coerce.number().int().positive().default(3000),
}).parse(process.env)
