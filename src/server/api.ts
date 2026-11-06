import {Hono} from 'hono'
import {HTTPException} from 'hono/http-exception'
import {and, eq, gt} from 'drizzle-orm'
import {z} from 'zod'
import {auth} from './auth'
import {records} from './db'
import {accounts, add, expire, get, read, remove, rows, update, type Row} from './store'
import * as rules from '../shared/contracts'

type Session = typeof auth.$Infer.Session
export type Env = {Variables:{session:Session; requestId:string; errorCode:string}}
export const api = new Hono<Env>()
const fail = (status: 400|403|404|409|429, message: string): never => {throw new HTTPException(status,{message})}
const found = <T>(value:T|undefined):T => value ?? fail(404,'Record not found')
const saved = <T>(value:T|undefined):T => value ?? fail(409,'The record changed. Refresh and try again.')
const parse = async <T>(schema:z.ZodType<T>, req:{json:()=>Promise<unknown>}) => schema.parse(await req.json().catch(() => null))
const newId = () => crypto.randomUUID()
const uid = (c:{get:(key:'session')=>Session}) => c.get('session').user.id
const pagination = z.object({cursor:z.string().optional(),limit:z.coerce.number().int().min(1).max(100).default(25)})
function page<T extends {id:string}>(items:T[], query:Record<string,string>) {
  const {cursor,limit} = pagination.parse(query)
  const index = cursor ? items.findIndex(item => item.id === cursor) : -1
  if (cursor && index < 0) fail(400,'The list changed. Reload the first page.')
  const start = index + 1
  const data = items.slice(start,start + limit)
  return {data,nextCursor:start + limit < items.length ? data.at(-1)?.id ?? null : null}
}
const recent = (a:Row,b:Row) => b.created-a.created || a.id.localeCompare(b.id)
const suspended = (account:{banned:boolean|null;banExpires:Date|null}) => Boolean(account.banned && (!account.banExpires || account.banExpires > new Date()))
const hasRole = (session:Session, role:string) => session.user.role?.split(',').includes(role)

api.use('*',async (c,next) => {
  const session = await auth.api.getSession({headers:c.req.raw.headers})
  if (!session) throw new HTTPException(401,{message:'Sign in first'})
  if (suspended({banned:session.user.banned ?? null,banExpires:session.user.banExpires ?? null})) fail(403,'Account is unavailable')
  c.set('session',session)
  await next()
})
api.use('/admin/*',async(c,next) => {
  if (!hasRole(c.get('session'),'admin')) fail(403,'Admin access required')
  await next()
})
const audit = (actor:string, action:string, subject:string) => add({id:newId(),kind:'audit',owner:actor,subject,payload:{action}})
const publicAccount = ({id,name}:Awaited<ReturnType<typeof accounts>>[number]) => ({id,name})
const accountRecord = async(id:string) => found((await accounts([id]))[0])
const blocks = async (a:string,b:string) => (await rows('block')).some(row => row.owner === a && row.subject === b || row.owner === b && row.subject === a)
const allowPair = async (a:string,b:string) => {
  if (a === b || await blocks(a,b) || suspended(await accountRecord(a)) || suspended(await accountRecord(b))) fail(403,'This interaction is unavailable')
}
async function rate(owner:string,kind:string,limit:number) {
  if ((await rows(kind,owner)).filter(row => row.created > Date.now()-60_000).length >= limit) fail(429,'Try again in one minute')
}

type Listing = {draft:z.infer<typeof rules.listing>; approved?:z.infer<typeof rules.listing>; submitted?:z.infer<typeof rules.listing>; hidden:boolean; reason?:string}
const listingView = (row:Row) => ({id:row.id,status:row.status,...read<Listing>(row)})
const listingSchema = (kind:string) => kind === 'host' ? rules.profile : kind === 'guest' ? rules.guest : rules.podcast
const own = (row:Row, owner:string) => row.owner === owner ? row : fail(404,'Record not found')
const profileId = (owner:string,kind:string) => `${kind}:${owner}`
const profileRow = (owner:string,kind:string) => get(kind,profileId(owner,kind))
async function createListing(kind:string,owner:string,draft:Listing['draft']) {
  return saved(await add({id:kind === 'podcast' ? newId() : profileId(owner,kind),kind,owner,status:'draft',payload:{draft,hidden:false}},true))
}
async function draft(row:Row, value:Listing['draft']) {
  const current = read<Listing>(row)
  return saved(await update(row,{payload:JSON.stringify({...current,draft:{...current.draft,...value}})}))
}
async function submit(row:Row) {
  const value = read<Listing>(row)
  if (row.status === 'pending') fail(409,'This submission is already in review')
  const submitted = listingSchema(row.kind).parse(value.draft)
  return saved(await update(row,{status:'pending',payload:JSON.stringify({...value,submitted,reason:undefined})},and(eq(records.payload,row.payload),eq(records.status,row.status!))!))
}
async function visibility(row:Row,hidden:boolean) {
  const value = read<Listing>(row)
  return saved(await update(row,{payload:JSON.stringify({...value,hidden})}))
}
api.get('/me',async c => {
  const {id,name,email} = c.get('session').user
  const roles = (await Promise.all(['host','guest'].map(async role => (await profileRow(id,role)) ? role : null))).filter(Boolean)
  return c.json({data:{id,name,email,roles,admin:hasRole(c.get('session'),'admin')}})
})
api.patch('/me/roles',async c => {
  const {role} = await parse(z.object({role:rules.role}),c.req)
  return c.json({data:listingView(await profileRow(uid(c),role) ?? await createListing(role,uid(c),{}))})
})
api.post('/me/deletion-requests',async c => {
  const owner = uid(c)
  const row = await add({id:newId(),kind:'deletion',owner,status:'pending',uniqueKey:`deletion:${owner}`,payload:{}},true)
  if (!row) fail(409,'A deletion request is already open')
  return c.json({data:{id:row!.id}},201)
})
api.get('/me/profiles',async c => {
  const profiles = await Promise.all(['host','guest'].map(role => profileRow(uid(c),role)))
  return c.json({data:profiles.filter((row):row is Row => Boolean(row)).map(listingView),nextCursor:null})
})
api.put('/me/profiles/:role',async c => {
  const kind = rules.role.parse(c.req.param('role'))
  const input = await parse(kind === 'host' ? rules.hostDraft : rules.guestDraft,c.req)
  const row = await profileRow(uid(c),kind)
  return c.json({data:listingView(row ? await draft(row,input) : await createListing(kind,uid(c),input))})
})
api.post('/me/profiles/:role/submit',async c => c.json({data:listingView(await submit(found(await profileRow(uid(c),rules.role.parse(c.req.param('role'))))))}))
api.patch('/me/profiles/:role/visibility',async c => {
  const {hidden} = await parse(z.object({hidden:z.boolean()}),c.req)
  return c.json({data:listingView(await visibility(found(await profileRow(uid(c),rules.role.parse(c.req.param('role')))),hidden))})
})
api.get('/me/podcasts',async c => c.json(page((await rows('podcast',uid(c))).sort(recent).map(listingView),c.req.query())))
api.post('/me/podcasts',async c => {
  found(await profileRow(uid(c),'host'))
  const value = await parse(rules.podcastDraft,c.req)
  return c.json({data:listingView(await createListing('podcast',uid(c),value))},201)
})
api.get('/me/podcasts/:id',async c => c.json({data:listingView(own(found(await get('podcast',c.req.param('id'))),uid(c)))}))
api.patch('/me/podcasts/:id',async c => {
  const value = await parse(rules.podcastDraft,c.req)
  return c.json({data:listingView(await draft(own(found(await get('podcast',c.req.param('id'))),uid(c)),value))})
})
api.post('/me/podcasts/:id/submit',async c => c.json({data:listingView(await submit(own(found(await get('podcast',c.req.param('id'))),uid(c))))}))
api.patch('/me/podcasts/:id/visibility',async c => {
  const {hidden} = await parse(z.object({hidden:z.boolean()}),c.req)
  return c.json({data:listingView(await visibility(own(found(await get('podcast',c.req.param('id'))),uid(c)),hidden))})
})
api.get('/reference-data',c => c.json({data:{topics:rules.topics,languages:rules.languages,formats:rules.formats}}))

const visible = (row:Row) => {
  const value = read<Listing>(row)
  return value.approved && !value.hidden
}
async function directory(kind:'guest'|'podcast',viewer:string) {
  const [entries, hosts, blocked] = await Promise.all([rows(kind), rows('host'), rows('block')])
  const users = await accounts([...new Set(entries.map(row => row.owner))])
  const available = new Set(users.filter(user => !suspended(user)).map(user => user.id))
  const hidden = new Set(blocked.flatMap(row => row.owner === viewer ? [row.subject] : row.subject === viewer ? [row.owner] : []))
  const liveHosts = new Set(hosts.filter(visible).map(row => row.owner))
  return entries.filter(row => available.has(row.owner) && !hidden.has(row.owner) && visible(row) && (kind !== 'podcast' || liveHosts.has(row.owner)))
    .map(row => ({id:row.id,accountId:row.owner,...read<Listing>(row).approved!,name:read<Listing>(row).approved!.name!}))
}
const byName = (a:{name:string;id:string},b:{name:string;id:string}) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
for (const [plural,kind] of [['guests','guest'],['podcasts','podcast']] as const) {
  api.get(`/directory/${plural}`,async c => {
    const q = c.req.query('q')?.trim().toLowerCase() ?? ''
    const entries = (await directory(kind,uid(c))).filter(row => [row.name,row.bio,row.description,...row.topics ?? []].some(value => value?.toLowerCase().includes(q)))
    return c.json(page(entries.sort(byName),c.req.query()))
  })
  api.get(`/directory/${plural}/:id`,async c => c.json({data:found((await directory(kind,uid(c))).find(row => row.id === c.req.param('id')))}))
}
api.get('/matches',async c => {
  const owner = uid(c)
  const selected = c.req.query('podcast_id')
  const [shows,guests] = await Promise.all([directory('podcast',owner),directory('guest',owner)])
  const show = selected ? found(shows.find(row => row.id === selected && row.accountId === owner)) : undefined
  const guest = selected ? undefined : found(guests.find(row => row.accountId === owner))
  const matches = (show ? guests : shows.filter(row => row.open)).flatMap(row => {
    if (row.accountId === owner) return []
    const match = rules.score(rules.podcast.parse(show ?? row),rules.guest.parse(guest ?? row))
    return match ? [{...row,...match,topics:row.topics,languages:row.languages,formats:row.formats,reasons:{topics:match.topics,languages:match.languages,formats:match.formats}}] : []
  })
  return c.json(page(matches.sort((a,b) => b.score-a.score || byName(a,b)),c.req.query()))
})

type Request = z.infer<typeof rules.requestInput> & {guestId:string;hostId:string;recipient:string;showName:string;showUrl:string}
const participants = (row:Row,owner:string) => row.owner === owner || read<Request>(row).recipient === owner
async function requestView(row:Row,admin = false) {
  const confirmed = await get('confirmation',`confirmation:${row.id}`)
  const evidence = confirmed && read<z.infer<typeof rules.confirmation>>(confirmed)
  return {id:row.id,sender:row.owner,status:row.status,...read<Request>(row),...(admin ? {guestName:read<Listing>(found(await profileRow(read<Request>(row).guestId,'guest'))).approved?.name} : {}),confirmation:evidence ? admin ? evidence : {date:evidence.date} : null}
}
api.get('/requests',async c => {
  await expire()
  const {direction,status} = c.req.query()
  const list = (await rows('request')).filter(row => participants(row,uid(c)) && (!status || status === row.status)
    && (!direction || direction === (row.owner === uid(c) ? 'sent' : 'received'))).sort(recent)
  const result = page(list,c.req.query())
  return c.json({...result,data:await Promise.all(result.data.map(row => requestView(row)))})
})
api.post('/requests',async c => {
  const input = await parse(rules.requestInput,c.req)
  const owner = uid(c)
  await expire()
  await rate(owner,'request',10)
  const show = found((await directory('podcast',owner)).find(row => row.id === input.podcastId))
  const invite = input.direction === 'invitation'
  const person = found((await directory('guest',owner)).find(row => row.accountId === (invite ? input.guestId : owner)))
  if (invite ? show.accountId !== owner : !show.open) fail(403,'This request is unavailable')
  await allowPair(show.accountId,person.accountId)
  const startsAt = new Date(input.startsAt).toISOString()
  if (startsAt <= new Date().toISOString()) fail(400,'Choose a future start time')
  const value:Request = {...input,startsAt,guestId:person.accountId,hostId:show.accountId,recipient:invite ? person.accountId : show.accountId,showName:show.name,showUrl:show.url!}
  const row = saved(await add({id:newId(),kind:'request',owner,subject:startsAt,status:'pending',uniqueKey:`request:${show.id}:${person.accountId}`,payload:value},true))
  return c.json({data:await requestView(row)},201)
})
async function memberRequest(id:string,owner:string) {
  const row = found(await get('request',id))
  return participants(row,owner) ? row : fail(404,'Record not found')
}
api.get('/requests/:id',async c => {
  await expire()
  return c.json({data:await requestView(await memberRequest(c.req.param('id'),uid(c)))})
})
for (const [action,status] of [['accept','accepted'],['decline','declined'],['withdraw','withdrawn']] as const) {
  api.post(`/requests/:id/${action}`,async c => {
    await expire()
    const owner = uid(c)
    const row = await memberRequest(c.req.param('id'),owner)
    const value = read<Request>(row)
    if (owner !== (action === 'withdraw' ? row.owner : value.recipient)) fail(403,'You cannot change this request')
    if (action === 'accept') await allowPair(row.owner,value.recipient)
    const result = saved(await update(row,{status,uniqueKey:null},and(eq(records.status,'pending'),gt(records.subject,new Date().toISOString()))!))
    return c.json({data:await requestView(result)})
  })
}

async function thread(id:string,owner:string) {
  const row = await memberRequest(id,owner)
  return row.status === 'accepted' ? row : fail(404,'Thread not found')
}
api.get('/threads',async c => {
  const owner = uid(c)
  const [requests,messages,reads] = await Promise.all([rows('request'),rows('message'),rows('read',owner)])
  const list = requests.filter(row => row.status === 'accepted' && participants(row,owner)).sort(recent)
  return c.json(page(list.map(row => {
    const marker = reads.find(item => item.subject === row.id)
    const readAt = marker ? read<{at:number}>(marker).at : 0
    return {id:row.id,showName:read<Request>(row).showName,unread:messages.filter(item => item.subject === row.id && item.owner !== owner && item.created > readAt).length}
  }),c.req.query()))
})
api.get('/threads/:id/messages',async c => {
  const row = await thread(c.req.param('id'),uid(c))
  const messages = (await rows('message')).filter(item => item.subject === row.id).sort(recent)
  return c.json(page(messages.map(item => ({id:item.id,sender:item.owner,created:item.created,...read<{text:string}>(item)})),c.req.query()))
})
api.post('/threads/:id/messages',async c => {
  const owner = uid(c)
  const row = await thread(c.req.param('id'),owner)
  await allowPair(row.owner,read<Request>(row).recipient)
  await rate(owner,'message',30)
  const value = await parse(z.object({text:rules.note}),c.req)
  const item = saved(await add({id:newId(),kind:'message',owner,subject:row.id,payload:value}))
  return c.json({data:{id:item.id,sender:owner,created:item.created,...value}},201)
})
api.post('/threads/:id/read',async c => {
  const owner = uid(c)
  const row = await thread(c.req.param('id'),owner)
  const id = `read:${row.id}:${owner}`
  const payload = {at:Date.now()}
  const inserted = await add({id,kind:'read',owner,subject:row.id,payload},true)
  if (!inserted) {
    const current = found(await get('read',id))
    if (read<{at:number}>(current).at < payload.at) await update(current,{payload:JSON.stringify(payload)})
  }
  return c.json({data:null})
})
api.get('/blocks',async c => {
  const entries = await rows('block',uid(c))
  return c.json(page((await accounts(entries.map(row => row.subject!))).map(publicAccount).sort(byName),c.req.query()))
})
api.put('/blocks/:accountId',async c => {
  const target = await accountRecord(c.req.param('accountId'))
  if (target.id === uid(c)) fail(400,'You cannot block yourself')
  await add({id:`block:${uid(c)}:${target.id}`,kind:'block',owner:uid(c),subject:target.id,payload:{}},true)
  return c.json({data:null})
})
api.delete('/blocks/:accountId',async c => {
  const row = await get('block',`block:${uid(c)}:${c.req.param('accountId')}`)
  if (row) await remove(row)
  return c.json({data:null})
})
api.post('/reports',async c => {
  const value = await parse(z.object({kind:z.enum(['guest','podcast','message']),id:z.string().min(1),reason:rules.note}),c.req)
  const target = found(await get(value.kind,value.id))
  if (value.kind === 'message') await thread(target.subject!,uid(c))
  else found((await directory(value.kind,uid(c))).find(row => row.id === target.id))
  await rate(uid(c),'report',5)
  const item = await add({id:newId(),kind:'report',owner:uid(c),subject:value.id,status:'pending',payload:{...value,snapshot:value.kind === 'message' ? read(target) : visible(target)}})
  return c.json({data:{id:item!.id}},201)
})

async function submissions() {
  return (await Promise.all(['host','guest','podcast'].map(kind => rows(kind)))).flat().filter(row => row.status === 'pending').sort(recent)
}
const submissionView = (row:Row) => ({id:row.id,kind:row.kind,owner:row.owner,status:row.status,submitted:read<Listing>(row).submitted})
api.get('/admin/submissions',async c => c.json(page((await submissions()).map(submissionView),c.req.query())))
async function submission(id:string) {
  return found((await submissions()).find(row => row.id === id))
}
api.get('/admin/submissions/:id',async c => c.json({data:submissionView(await submission(c.req.param('id')))}))
for (const action of ['approve','return'] as const) {
  api.post(`/admin/submissions/:id/${action}`,async c => {
    const row = await submission(c.req.param('id'))
    const value = read<Listing>(row)
    const reason = action === 'return' ? (await parse(z.object({reason:rules.note}),c.req)).reason : undefined
    const approved = action === 'approve' ? value.submitted : value.approved
    saved(await update(row,{status:action === 'approve' ? 'approved' : 'returned',payload:JSON.stringify({...value,submitted:undefined,approved,reason})},and(eq(records.status,'pending'),eq(records.payload,row.payload))!))
    await audit(uid(c),`submission.${action}`,row.id)
    return c.json({data:null})
  })
}
const adminView = (row:Row) => ({id:row.id,owner:row.owner,subject:row.subject,status:row.status,detail:read(row)})
for (const [path,kind] of [['reports','report'],['deletion-requests','deletion']] as const) {
  api.get(`/admin/${path}`,async c => c.json(page((await rows(kind)).sort(recent).map(adminView),c.req.query())))
  api.post(`/admin/${path}/:id/resolve`,async c => {
    const row = found(await get(kind,c.req.param('id')))
    const {note} = await parse(z.object({note:rules.note}),c.req)
    saved(await update(row,{status:'resolved',uniqueKey:null,payload:JSON.stringify({...read<object>(row),resolution:note})},eq(records.status,'pending')))
    await audit(uid(c),`${kind}.resolve`,row.id)
    return c.json({data:null})
  })
}
api.get('/admin/reports/:id',async c => c.json({data:adminView(found(await get('report',c.req.param('id'))))}))
api.get('/admin/accounts',async c => c.json(page((await accounts()).sort(byName),c.req.query())))
api.get('/admin/accounts/:id',async c => c.json({data:await accountRecord(c.req.param('id'))}))
api.get('/admin/requests',async c => {
  const result = page((await rows('request')).filter(row => row.status === 'accepted').sort(recent),c.req.query())
  return c.json({...result,data:await Promise.all(result.data.map(row => requestView(row,true)))})
})
api.get('/admin/requests/:id',async c => {
  await expire()
  return c.json({data:await requestView(found(await get('request',c.req.param('id'))),true)})
})
api.put('/admin/requests/:id/confirmation',async c => {
  const value = await parse(rules.confirmation,c.req)
  const row = found(await get('request',c.req.param('id')))
  if (row.status !== 'accepted') fail(409,'Only accepted requests can be confirmed')
  const inserted = await add({id:`confirmation:${row.id}`,kind:'confirmation',owner:uid(c),subject:row.id,payload:value},true)
  if (inserted) await audit(uid(c),'interview.confirm',row.id)
  return c.json({data:await requestView(row,true)})
})
