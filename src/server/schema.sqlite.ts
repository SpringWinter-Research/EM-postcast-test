import {sqliteTable as table, text, integer} from 'drizzle-orm/sqlite-core'

export const user = table('user', {
  id: text().primaryKey(), name: text().notNull(), email: text().notNull().unique(),
  emailVerified: integer('email_verified', {mode:'boolean'}).notNull(),
  image: text(), createdAt: integer('created_at', {mode:'timestamp_ms'}).notNull(),
  updatedAt: integer('updated_at', {mode:'timestamp_ms'}).notNull(), role: text(),
  banned: integer({mode:'boolean'}), banReason: text('ban_reason'), banExpires: integer('ban_expires', {mode:'timestamp_ms'}),
})
export const session = table('session', {
  id: text().primaryKey(), token: text().notNull().unique(), expiresAt: integer('expires_at', {mode:'timestamp_ms'}).notNull(),
  createdAt: integer('created_at', {mode:'timestamp_ms'}).notNull(), updatedAt: integer('updated_at', {mode:'timestamp_ms'}).notNull(),
  ipAddress: text('ip_address'), userAgent: text('user_agent'), userId: text('user_id').notNull().references(() => user.id,{onDelete:'cascade'}),
  impersonatedBy: text('impersonated_by'),
})
export const account = table('account', {
  id: text().primaryKey(), accountId: text('account_id').notNull(), providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id,{onDelete:'cascade'}), accessToken: text('access_token'),
  refreshToken: text('refresh_token'), idToken: text('id_token'), scope: text(), password: text(),
  accessTokenExpiresAt: integer('access_token_expires_at', {mode:'timestamp_ms'}), refreshTokenExpiresAt: integer('refresh_token_expires_at', {mode:'timestamp_ms'}),
  createdAt: integer('created_at', {mode:'timestamp_ms'}).notNull(), updatedAt: integer('updated_at', {mode:'timestamp_ms'}).notNull(),
})
export const verification = table('verification', {
  id: text().primaryKey(), identifier: text().notNull(), value: text().notNull(), expiresAt: integer('expires_at',{mode:'timestamp_ms'}).notNull(),
  createdAt: integer('created_at',{mode:'timestamp_ms'}).notNull(), updatedAt: integer('updated_at',{mode:'timestamp_ms'}).notNull(),
})

import { integer as numberColumn, uniqueIndex, index } from 'drizzle-orm/sqlite-core'
export const records = table('records', {
  id: text().primaryKey(),
  kind: text().notNull(),
  owner: text().notNull(),
  subject: text(),
  status: text(),
  uniqueKey: text('unique_key'),
  payload: text().notNull(),
  created: numberColumn().notNull(),
}, t => [uniqueIndex('records_unique_key').on(t.uniqueKey), index('records_kind_owner').on(t.kind,t.owner)])
