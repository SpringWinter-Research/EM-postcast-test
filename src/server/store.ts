import {and, eq, inArray, lte} from 'drizzle-orm'
import {db, records} from './db'

export type Row = typeof records.$inferSelect
export type Write = Omit<typeof records.$inferInsert, 'payload' | 'created'> & {payload: object}
export const read = <T>(row: Row): T => JSON.parse(row.payload)
export async function rows(kind: string, owner?: string) {
  return await db.select().from(records).where(and(eq(records.kind,kind), owner === undefined ? undefined : eq(records.owner,owner)))
}
export async function get(kind: string, id: string) {
  return (await db.select().from(records).where(and(eq(records.kind,kind),eq(records.id,id))).limit(1))[0]
}
export async function add(row: Write, ignoreDuplicate = false) {
  const query = db.insert(records).values({...row,payload:JSON.stringify(row.payload),created:Date.now()})
  return (await (ignoreDuplicate ? query.onConflictDoNothing() : query).returning())[0]
}
export async function update(row: Row, fields: Partial<Pick<Row,'payload'|'status'|'uniqueKey'>>, condition = eq(records.payload,row.payload)) {
  return (await db.update(records).set(fields).where(and(eq(records.id,row.id),condition)).returning())[0]
}
export async function remove(row: Row) {
  await db.delete(records).where(eq(records.id,row.id))
}
export async function expire() {
  // Pending requests store their ISO UTC cutoff as the subject for an atomic comparison.
  await db.update(records).set({status:'expired',uniqueKey:null}).where(and(eq(records.kind,'request'),eq(records.status,'pending'),lte(records.subject,new Date().toISOString())))
}
export async function accounts(ids?: string[]) {
  const {schema} = await import('./db')
  const user = schema.user as typeof import('./schema.sqlite').user
  if (ids && !ids.length) return []
  return await db.select({id:user.id,name:user.name,email:user.email,banned:user.banned,banExpires:user.banExpires,role:user.role})
    .from(user).where(ids ? inArray(user.id,ids) : undefined)
}
