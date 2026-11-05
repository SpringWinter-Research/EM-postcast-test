import {afterAll, expect, test} from 'bun:test'
import {mkdtempSync,rmSync,readdirSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {Database} from 'bun:sqlite'

const folder = mkdtempSync(join(tmpdir(),'podcast-test-'))
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? ''
process.env.MAIL_DIR = join(folder,'mail')
process.env.SQLITE_PATH = join(folder,'db.sqlite')
process.env.BETTER_AUTH_URL = 'http://localhost:5173'
const migration = Bun.spawnSync(['bun','run','migrate'],{env:process.env})
if (migration.exitCode) throw new Error(migration.stderr.toString())
const {app} = await import('../src/server/app')
const {client,db,schema,records} = await import('../src/server/db')
const {eq} = await import('drizzle-orm')
afterAll(async()=>{
  if (client instanceof Database) client.close()
  else await client.end()
  rmSync(folder,{recursive:true,force:true})
})
async function send(path:string,method='GET',body?:unknown,cookie?:string) {
  const response = await app.request(path,{method,headers:{origin:'http://localhost:5173',...(cookie?{cookie}:{}),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined})
  return {status:response.status,headers:response.headers,json:await response.json()}
}
const api = (path:string,cookie:string,method='GET',body?:unknown) => send('/api/v1'+path,method,body,cookie)
async function member(name:string,role?:string) {
  const email = `${name.toLowerCase()}-${crypto.randomUUID()}@example.com`
  const password = 'test-password-1234'
  const signed = await send('/api/auth/sign-up/email','POST',{email,password,name})
  expect(signed.status).toBe(200)
  const id = signed.json.user.id as string
  const user = schema.user as typeof import('../src/server/schema.sqlite').user
  const unverified = await send('/api/auth/sign-in/email','POST',{email,password})
  expect(unverified.status).toBe(403)
  const mailDir = join(folder,'mail')
  const mailbox = await Promise.all(readdirSync(mailDir).map(file => Bun.file(join(mailDir,file)).json()))
  const message = mailbox.find(item => item.to === email)
  expect(message?.subject).toBe('Verify your email address')
  const verified = await app.request(message.url)
  expect(verified.status).toBe(302)
  if (role) await db.update(user).set({role}).where(eq(user.id,id))
  const login = await send('/api/auth/sign-in/email','POST',{email,password})
  expect(login.status).toBe(200)
  return {id,cookie:login.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ')}
}
test('approved profiles, requests, messaging, and interview confirmation',async()=>{
  const host=await member('Host'), guest=await member('Guest'), admin=await member('Admin','admin')
  const listing = {topics:['Business','Careers','Education','Science'],languages:['Hindi','English'],formats:['audio']}
  expect((await api('/me/profiles/host',host.cookie,'PUT',{name:'Host'})).status).toBe(200)
  expect((await api('/me/profiles/host/submit',host.cookie,'POST')).status).toBe(200)
  const show = await api('/me/podcasts',host.cookie,'POST',{...listing,name:'Show',description:'A show',url:'https://example.com/show',open:true})
  expect(show.status).toBe(201)
  const podcastId=show.json.data.id
  expect((await api('/me/podcasts/'+podcastId+'/submit',host.cookie,'POST')).status).toBe(200)
  expect((await api('/me/profiles/guest',guest.cookie,'PUT',{name:'Guest',bio:'A guest',topics:['Business','Careers'],languages:['Hindi'],formats:['audio']})).status).toBe(200)
  expect((await api('/me/profiles/guest/submit',guest.cookie,'POST')).status).toBe(200)
  expect((await api('/directory/podcasts',guest.cookie)).json.data).toHaveLength(0)
  expect((await api('/admin/submissions',guest.cookie)).status).toBe(403)
  const submissions=await api('/admin/submissions',admin.cookie)
  for(const row of submissions.json.data) expect((await api('/admin/submissions/'+row.id+'/approve',admin.cookie,'POST')).status).toBe(200)
  expect((await api('/matches',guest.cookie)).json.data[0].score).toBe(55)
  const request={direction:'application',podcastId,message:'Let us talk',startsAt:new Date(Date.now()+60_000).toISOString(),timezone:'Asia/Kolkata'}
  const duplicate=await Promise.all([api('/requests',guest.cookie,'POST',request),api('/requests',guest.cookie,'POST',request)])
  expect(duplicate.map(r=>r.status).sort()).toEqual([201,409])
  const id=duplicate.find(r=>r.status===201)!.json.data.id
  expect((await api('/threads/'+id+'/messages',guest.cookie)).status).toBe(404)
  expect((await api('/requests/'+id+'/accept',guest.cookie,'POST')).status).toBe(403)
  expect((await api('/requests/'+id+'/accept',host.cookie,'POST')).status).toBe(200)
  expect((await api('/threads/'+id+'/messages',admin.cookie)).status).toBe(404)
  expect((await api('/threads/'+id+'/messages',guest.cookie,'POST',{text:'Hello'})).status).toBe(201)
  expect((await api('/threads',host.cookie)).json.data[0].unread).toBe(1)
  const details={date:'2025-01-01',type:'statements',note:'Both participants confirmed.'}
  const path='/admin/requests/'+id+'/confirmation'
  expect((await api(path,admin.cookie,'PUT',details)).status).toBe(200)
  expect((await api(path,admin.cookie,'PUT',{...details,note:'changed'})).json.data.confirmation.note).toBe(details.note)
  expect((await api('/requests/'+id,host.cookie)).json.data.confirmation).toEqual({date:details.date})
  await api('/blocks/'+guest.id,host.cookie,'PUT')
  expect((await api('/threads/'+id+'/messages',guest.cookie,'POST',{text:'Blocked'})).status).toBe(403)
  expect((await api('/matches',guest.cookie)).json.data).toHaveLength(0)
  const retry=await api('/blocks/'+guest.id,host.cookie,'DELETE')
  expect(retry.status).toBe(200)
  const invitation=await api('/requests',host.cookie,'POST',{...request,direction:'invitation',guestId:guest.id})
  expect(invitation.status).toBe(201)
  expect(invitation.json.data.showName).toBe('Show')
  await db.update(records).set({subject:new Date().toISOString()}).where(eq(records.id,invitation.json.data.id))
  expect((await api('/requests/'+invitation.json.data.id+'/accept',guest.cookie,'POST')).status).toBe(409)
  expect((await api('/requests/'+invitation.json.data.id,guest.cookie)).json.data.status).toBe('expired')
  const ban = await send('/api/auth/admin/ban-user','POST',{userId:guest.id},admin.cookie)
  expect(ban.status).toBe(200)
  expect((await api('/me',guest.cookie)).status).toBe(401)
  expect((await send('/api/auth/admin/unban-user','POST',{userId:guest.id},admin.cookie)).status).toBe(200)
  const missing=await api('/missing',host.cookie)
  expect(missing.status).toBe(404)
  expect(missing.json.error.requestId).toBe(missing.headers.get('X-Request-ID'))
})
