import {pgTable as table, text, boolean, timestamp} from 'drizzle-orm/pg-core'

export const user = table('user', {
  id: text().primaryKey(), name: text().notNull(), email: text().notNull().unique(),
  emailVerified: boolean('email_verified').notNull(),
  image: text(), createdAt: timestamp('created_at', {withTimezone:true}).notNull(),
  updatedAt: timestamp('updated_at', {withTimezone:true}).notNull(), role: text(),
  banned: boolean(), banReason: text('ban_reason'), banExpires: timestamp('ban_expires', {withTimezone:true}),
})
export const session = table('session', {
  id: text().primaryKey(), token: text().notNull().unique(), expiresAt: timestamp('expires_at', {withTimezone:true}).notNull(),
  createdAt: timestamp('created_at', {withTimezone:true}).notNull(), updatedAt: timestamp('updated_at', {withTimezone:true}).notNull(),
  ipAddress: text('ip_address'), userAgent: text('user_agent'), userId: text('user_id').notNull().references(() => user.id,{onDelete:'cascade'}),
  impersonatedBy: text('impersonated_by'),
})
export const account = table('account', {
  id: text().primaryKey(), accountId: text('account_id').notNull(), providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id,{onDelete:'cascade'}), accessToken: text('access_token'),
  refreshToken: text('refresh_token'), idToken: text('id_token'), scope: text(), password: text(),
  accessTokenExpiresAt: timestamp('access_token_expires_at', {withTimezone:true}), refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {withTimezone:true}),
  createdAt: timestamp('created_at', {withTimezone:true}).notNull(), updatedAt: timestamp('updated_at', {withTimezone:true}).notNull(),
})
export const verification = table('verification', {
  id: text().primaryKey(), identifier: text().notNull(), value: text().notNull(), expiresAt: timestamp('expires_at', {withTimezone:true}).notNull(),
  createdAt: timestamp('created_at', {withTimezone:true}).notNull(), updatedAt: timestamp('updated_at', {withTimezone:true}).notNull(),
})

import { bigint as numberColumn, uniqueIndex, index } from 'drizzle-orm/pg-core'
export const records = table('records', {
  id: text().primaryKey(),
  kind: text().notNull(),
  owner: text().notNull(),
  subject: text(),
  status: text(),
  uniqueKey: text('unique_key'),
  payload: text().notNull(),
  created: numberColumn({mode:'number'}).notNull(),
}, t => [uniqueIndex('records_unique_key').on(t.uniqueKey), index('records_kind_owner').on(t.kind,t.owner)])
