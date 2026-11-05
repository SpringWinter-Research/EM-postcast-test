import {Hono} from 'hono'
import {HTTPException} from 'hono/http-exception'
import {serveStatic} from 'hono/bun'
import {ZodError} from 'zod'
import {api,type Env} from './api'
import {auth} from './auth'
import {config,production} from './config'
import {ready} from './db'
import {add} from './store'
import {log} from '../shared/log'

export const app = new Hono<Env>()
app.use('/api/*',async(c,next) => {
  const start = performance.now()
  const id = crypto.randomUUID()
  c.set('requestId',id)
  await next()
  c.header('X-Request-ID',id)
  c.header('Cache-Control','no-store')
  log({requestId:id,route:c.req.routePath,status:c.res.status,duration:Math.round(performance.now()-start),errorCode:c.get('errorCode') ?? (c.res.ok ? undefined : `HTTP_${c.res.status}`)})
})
app.use('/api/v1/*',async(c,next) => {
  const origin = c.req.header('origin')
  if (c.req.path.startsWith('/api/v1/') && !['GET','HEAD','OPTIONS'].includes(c.req.method) && origin && origin !== new URL(config.BETTER_AUTH_URL).origin) {
    throw new HTTPException(403,{message:'Origin is not allowed'})
  }
  await next()
})
app.onError((error,c) => {
  const status = error instanceof HTTPException ? error.status : error instanceof ZodError ? 400 : 500
  const code = error instanceof ZodError ? 'INVALID_INPUT' : `HTTP_${status}`
  c.set('errorCode',code)
  const message = error instanceof ZodError ? error.issues.map(issue => issue.path.join('.') || 'input').join(', ') + ': check required fields and values' : status === 500 ? 'An unexpected error occurred' : error.message
  return c.json({error:{code,message,requestId:c.get('requestId')}},status)
})
app.on(['GET','POST'],'/api/auth/*',async c => {
  const path = c.req.path
  const action = path === '/api/auth/admin/ban-user' ? 'account.suspend' : path === '/api/auth/admin/unban-user' ? 'account.reactivate' : null
  if (!action && path.startsWith('/api/auth/admin/')) throw new HTTPException(404)
  if (!action) return auth.handler(c.req.raw)
  const session = await auth.api.getSession({headers:c.req.raw.headers})
  if (!session?.user.emailVerified || !session.user.role?.split(',').includes('admin')) throw new HTTPException(403)
  const value = await c.req.raw.clone().json() as {userId:string}
  if (value.userId === session.user.id) throw new HTTPException(400,{message:'You cannot suspend your own account'})
  const response = await auth.handler(c.req.raw)
  if (response.ok) await add({id:crypto.randomUUID(),kind:'audit',owner:session.user.id,subject:value.userId,payload:{action}})
  return response
})
app.route('/api/v1',api)
app.all('/api/*',() => {throw new HTTPException(404,{message:'API route not found'})})
app.get('/health/ready',async c => {
  try { await ready(); return c.json({status:'ready'}) }
  catch { return c.json({status:'unavailable'},503) }
})
if (production) {
  app.get('/assets/*',serveStatic({root:'dist'}))
  app.get('*',serveStatic({path:'dist/index.html'}))
}
