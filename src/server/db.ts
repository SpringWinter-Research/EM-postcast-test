import {Database} from 'bun:sqlite'
import {mkdirSync,readFileSync} from 'node:fs'
import {dirname} from 'node:path'
import {drizzle as sqlite} from 'drizzle-orm/bun-sqlite'
import {drizzle as pg} from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import {config} from './config'
import * as liteSchema from './schema.sqlite'
import * as pgSchema from './schema.pg'

export const isPg = Boolean(config.DATABASE_URL)
function openSqlite() {
  mkdirSync(dirname(config.SQLITE_PATH), {recursive:true})
  const connection = new Database(config.SQLITE_PATH)
  connection.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;')
  return connection
}
const ssl = config.DATABASE_CA_FILE ? {ca:readFileSync(config.DATABASE_CA_FILE,'utf8'),rejectUnauthorized:true} : undefined
export const client = isPg ? postgres(config.DATABASE_URL!, {ssl}) : openSqlite()
export const schema = isPg ? pgSchema : liteSchema
// Both schemas expose the same columns. Keep the dialect cast at this boundary.
export const db = ((client instanceof Database) ? sqlite(client) : pg(client as ReturnType<typeof postgres>)) as ReturnType<typeof sqlite>
export const records = schema.records as typeof liteSchema.records
export async function ready() {
  if (client instanceof Database) client.query('SELECT 1').get()
  else await client`SELECT 1`
}
