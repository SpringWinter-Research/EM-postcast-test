import {eq} from 'drizzle-orm'
import {db, schema, client} from './db'
import {Database} from 'bun:sqlite'
const email = Bun.argv[2]?.trim().toLowerCase()
if (!email) throw new Error('Usage: bun run admin -- email')
const user = schema.user as typeof import('./schema.sqlite').user
const result = await db.update(user).set({role:'admin'}).where(eq(user.email,email)).returning({id:user.id})
if (!result.length) throw new Error('Account not found')
if (client instanceof Database) client.close()
else await client.end()
