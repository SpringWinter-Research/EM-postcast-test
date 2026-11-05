import {migrate as pg} from 'drizzle-orm/postgres-js/migrator'
import {migrate as sqlite} from 'drizzle-orm/bun-sqlite/migrator'
import {client, db, isPg} from './db'
import {Database} from 'bun:sqlite'

if (isPg) await pg(db as unknown as Parameters<typeof pg>[0], {migrationsFolder:'migrations/pg'})
else sqlite(db, {migrationsFolder:'migrations/sqlite'})
if (client instanceof Database) client.close()
else await client.end()
