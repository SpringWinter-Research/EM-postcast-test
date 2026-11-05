import {useState,type FormEvent,type ReactNode} from 'react'
import {createRoot} from 'react-dom/client'
import {createRouter,createRootRoute,createRoute,RouterProvider,Link,Outlet} from '@tanstack/react-router'
import {QueryClient,QueryClientProvider,useInfiniteQuery,useQuery,useMutation} from '@tanstack/react-query'
import {createAuthClient} from 'better-auth/react'
import {adminClient} from 'better-auth/client/plugins'
import {call} from './util'
import {Card} from './card'
import {Badge} from './badge'
import {Input} from './input'
import {Textarea} from './textarea'
import {Brand,Initials,PageHeading} from './presentation'
import {Button} from './button'
import {topics,languages,formats} from '../shared/reference'
import './styles.css'

const auth = createAuthClient({plugins:[adminClient()]})
const queryClient = new QueryClient({defaultOptions:{queries:{retry:false}}})
type Fields = {name?:string;bio?:string;description?:string;url?:string;open?:boolean;topics?:string[];languages?:string[];formats?:string[]}
type Listing = {id:string;status:string;draft:Fields;approved?:Fields;hidden:boolean;reason?:string}
type Entry = Fields & {id:string;accountId:string;name:string;score?:number;reasons?:{topics:string[];languages:string[];formats:string[]}}
type Request = {id:string;direction:string;sender:string;status:string;showName:string;showUrl:string;message:string;startsAt:string;timezone:string;confirmation?:{date:string}}
type Me = {id:string;roles:string[];admin:boolean}
const form = (event:FormEvent<HTMLFormElement>) => {event.preventDefault();return new FormData(event.currentTarget)}
const value = (data:FormData,key:string) => String(data.get(key) ?? '')
const errorText = (error:unknown) => error instanceof Error ? error.message : 'The action failed'
function ErrorText({error}:{error:unknown}) {return error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{errorText(error)}</p> : null}
function useAction() {
  return useMutation({mutationFn:(action:()=>Promise<unknown>)=>action(),onSuccess:()=>queryClient.invalidateQueries()})
}
function List<T>({path,children,columns=false}:{path:string;children:(item:T)=>ReactNode;columns?:boolean}) {
  const result = useInfiniteQuery({
    queryKey:[path],initialPageParam:'',
    queryFn:({pageParam})=>call<T[]>(path+(pageParam ? (path.includes('?')?'&':'?')+'cursor='+encodeURIComponent(pageParam) : '')),
    getNextPageParam:last=>last.nextCursor ?? undefined,
  })
  const entries = result.data?.pages.flatMap(page=>page.data) ?? []
  return <div className={columns ? "grid items-start gap-4 md:grid-cols-2" : "grid gap-4"}>
    {result.isPending && <p>Loading…</p>}
    <ErrorText error={result.error}/>
    {result.isSuccess && !entries.length && <p className="col-span-full rounded-xl border border-dashed border-border px-5 py-7 text-center text-sm text-muted-foreground">No records to show.</p>}
    {entries.map(children)}
    {result.hasNextPage && <Button onClick={()=>result.fetchNextPage()} disabled={result.isFetchingNextPage}>Load more</Button>}
  </div>
}
function Account() {
  const params = new URLSearchParams(location.search)
  const [mode,setMode] = useState(params.has('token') ? 'reset' : 'login')
  const [notice,setNotice] = useState('')
  const action = useAction()
  async function submit(event:FormEvent<HTMLFormElement>) {
    const fields = form(event)
    const email = value(fields,'email')
    const password = value(fields,'password')
    const callbackURL = location.origin
    action.mutate(async()=>{
      const result = mode === 'login' ? await auth.signIn.email({email,password}) :
        mode === 'register' ? await auth.signUp.email({email,password,name:value(fields,'name'),callbackURL}) :
        mode === 'verify' ? await auth.sendVerificationEmail({email,callbackURL}) :
        mode === 'reset' ? await auth.resetPassword({token:params.get('token')!,newPassword:password}) :
        await auth.requestPasswordReset({email,redirectTo:callbackURL})
      if (result.error) throw new Error(result.error.message ?? 'Account action failed')
      if (mode === 'reset') {history.replaceState(null,'','/');setMode('login');setNotice('Password updated. Sign in.')}
      else if (mode !== 'login') setNotice('Check your email to continue.')
    })
  }
  return <div className="mx-auto grid w-full max-w-md gap-6">
    <Brand/>
    <PageHeading title="Podcast Matcher" description="Find a podcast or guest for your next interview."/>
    <Card><h2>{({login:'Sign in',register:'Register',reset:'Set a new password',verify:'Verify email',forgot:'Reset password'})[mode]}</h2>
      <form className="grid gap-3" onSubmit={submit}>
        {mode === 'register' && <label>Display name<Input name="name" required/></label>}
        {mode !== 'reset' && <label>Email<Input name="email" type="email" required/></label>}
        {['login','register','reset'].includes(mode) && <label>Password<Input name="password" type="password" minLength={8} required/></label>}
        <Button disabled={action.isPending}>Continue</Button>
      </form>
      <ErrorText error={action.error}/>{notice && <p role="status">{notice}</p>}
      <div className="flex flex-wrap gap-2">{[['login','Sign in'],['register','Register'],['forgot','Forgot password'],['verify','Resend verification']].filter(([key])=>key!==mode).map(([key,label])=><Button variant="ghost" key={key} onClick={()=>{setMode(key);action.reset();setNotice('')}}>{label}</Button>)}</div>
    </Card>
  </div>
}
function Layout() {
  const session = auth.useSession()
  const me = useQuery({queryKey:['/me'],queryFn:()=>call<Me>('/me'),enabled:Boolean(session.data)})
  if (!session.data) return <main className="grid min-h-dvh place-items-center px-4 py-10"><Account/></main>
  return <>
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-5 gap-y-3 px-4 py-3 sm:px-6">
        <Brand/>
        <nav className="order-last flex w-full flex-wrap gap-1 text-sm lg:order-none lg:w-auto" aria-label="Main navigation">
          <Link className="nav-link" to="/" activeOptions={{exact:true}}>Profiles</Link>
          <Link className="nav-link" to="/discover">Discover</Link>
          <Link className="nav-link" to="/requests">Requests</Link>
          <Link className="nav-link" to="/inbox">Inbox</Link>
          {me.data?.data.admin && <Link className="nav-link" to="/admin">Admin</Link>}
        </nav>
        <div className="flex items-center gap-2"><Initials name={session.data.user.name}/><Button variant="ghost" onClick={async()=>{await auth.signOut();queryClient.clear()}}>Sign out</Button></div>
      </div>
    </header>
    <main className="mx-auto grid max-w-6xl gap-6 px-4 py-7 sm:px-6 sm:py-10">
      <ErrorText error={me.error}/><Outlet/>
    </main>
  </>
}
function Choices({title,field,options,selected=[]}:{title:string;field:string;options:string[];selected?:string[]}) {
  return <fieldset><legend>{title}</legend>{options.map(option=><label className="choice-label" key={option}><Input name={field} value={option} type="checkbox" defaultChecked={selected.includes(option)}/>{option}</label>)}</fieldset>
}
function Editor({kind,item}:{kind:'host'|'guest'|'podcast';item?:Listing}) {
  const action = useAction()
  const fields = item?.draft ?? {}
  const path = kind === 'podcast' ? '/me/podcasts'+(item ? '/'+item.id : '') : '/me/profiles/'+kind
  function save(event:FormEvent<HTMLFormElement>) {
    const target = event.currentTarget
    const data = form(event)
    const payload:Fields = {name:value(data,'name')}
    if (kind !== 'host') Object.assign(payload,{topics:data.getAll('topics'),languages:data.getAll('languages'),formats:data.getAll('formats')})
    if (kind === 'guest') payload.bio=value(data,'bio')
    if (kind === 'podcast') Object.assign(payload,{description:value(data,'description'),url:value(data,'url'),open:data.has('open')})
    action.mutate(()=>call(path,kind === 'podcast' ? item ? 'PATCH' : 'POST' : 'PUT',payload),{onSuccess:()=>{if (!item && kind === 'podcast') target.reset()}})
  }
  return <Card>
    <h2>{item?.draft.name || (kind === 'podcast' ? 'New podcast' : kind === 'host' ? 'Host profile' : 'Guest profile')}</h2>
    {item && <div className="flex flex-wrap gap-2"><Badge variant="secondary">{item.status}</Badge>{item.hidden ? <Badge variant="outline">Hidden</Badge> : item.approved && <Badge>Published</Badge>}</div>}
    {item?.reason && <p role="status">{item.reason}</p>}
    <form className="grid gap-3" onSubmit={save}>
      <label>{kind === 'podcast'?'Show name':'Display name'}<Input name="name" defaultValue={fields.name}/></label>
      {kind === 'guest' && <label>Short bio<Textarea name="bio" defaultValue={fields.bio}/></label>}
      {kind === 'podcast' && <><label>Short description<Textarea name="description" defaultValue={fields.description}/></label><label>Public show link<Input name="url" type="url" defaultValue={fields.url}/></label><label className="inline-flex flex-row"><input type="checkbox" name="open" defaultChecked={fields.open ?? true}/>Accept guest applications</label></>}
      {kind !== 'host' && <><Choices title="Topics" field="topics" options={topics} selected={fields.topics}/><Choices title="Interview languages" field="languages" options={languages} selected={fields.languages}/><Choices title="Formats" field="formats" options={formats} selected={fields.formats}/></>}
      <div><Button disabled={action.isPending}>Save draft</Button></div>
    </form>
    {item && <div className="flex flex-wrap gap-2">
      <Button disabled={item.status==='pending'||action.isPending} onClick={()=>action.mutate(()=>call(path+'/submit','POST'))}>Submit saved draft</Button>
      <Button variant="outline" disabled={action.isPending} onClick={()=>action.mutate(()=>call(path+'/visibility','PATCH',{hidden:!item.hidden}))}>{item.hidden?'Show':'Hide'}</Button>
    </div>}
    <ErrorText error={action.error}/>
  </Card>
}
function Profiles() {
  const profiles = useQuery({queryKey:['/me/profiles'],queryFn:()=>call<Listing[]>('/me/profiles')})
  const action = useAction()
  const [newShow,setNewShow]=useState(false)
  const data = profiles.data?.data
  const host = data?.find(item=>item.id.startsWith('host:'))
  const guest = data?.find(item=>item.id.startsWith('guest:'))
  return <><PageHeading title="Profiles" description="Create a host or guest profile and submit it for review."/><ErrorText error={profiles.error}/>{data && <>
    <div className="grid items-start gap-4 md:grid-cols-2">
    <Editor key={host?.id ?? 'new-host'} kind="host" item={host}/>
    <Editor key={guest?.id ?? 'new-guest'} kind="guest" item={guest}/>
    </div>
    {host && <><h2>Podcasts</h2><List<Listing> path="/me/podcasts" columns>{item=><Editor key={item.id} kind="podcast" item={item}/>}</List>
      <div><Button onClick={()=>setNewShow(!newShow)}>{newShow?'Close form':'Add a podcast'}</Button></div>{newShow&&<Editor kind="podcast"/>}</>}
    <div><Button variant="outline" disabled={action.isPending||action.isSuccess} onClick={()=>action.mutate(()=>call('/me/deletion-requests','POST'))}>Request account deletion</Button></div>
    {action.isSuccess && <p role="status">Deletion request sent.</p>}<ErrorText error={action.error}/>
    <List<{id:string;name:string}> path="/blocks">{item=><Card key={item.id}><span>{item.name}</span><Button onClick={()=>action.mutate(()=>call('/blocks/'+item.id,'DELETE'))}>Unblock</Button></Card>}</List>
  </>}</>
}
function Report({kind,id}:{kind:string;id:string}) {
  const action = useAction()
  return <details><summary className="cursor-pointer text-sm underline">Report</summary>
    <form className="mt-2 flex flex-wrap gap-2" onSubmit={event=>{const data=form(event);action.mutate(()=>call('/reports','POST',{kind,id,reason:value(data,'reason')}))}}>
      <label>Reason<Input name="reason" required/></label><Button disabled={action.isPending||action.isSuccess}>Send report</Button>
    </form>{action.isSuccess&&<p role="status">Report sent.</p>}<ErrorText error={action.error}/></details>
}
function Discover() {
  const [view,setView]=useState('podcasts')
  const [keyword,setKeyword]=useState('')
  const [matching,setMatching]=useState(false)
  const [podcast,setPodcast]=useState('')
  const shows = useQuery({queryKey:['/me/podcasts?limit=100'],queryFn:()=>call<Listing[]>('/me/podcasts?limit=100')})
  const path = matching ? '/matches'+(view==='guests'?'?podcast_id='+encodeURIComponent(podcast):'') : '/directory/'+view+'?q='+encodeURIComponent(keyword)
  return <><PageHeading title="Discover" description="Search approved profiles or see recommendations for your next interview."/><Card><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <label>Directory<select value={view} onChange={event=>setView(event.target.value)}><option value="podcasts">Podcasts</option><option value="guests">Guests</option></select></label>
    <label>View<select value={String(matching)} onChange={event=>setMatching(event.target.value==='true')}><option value="false">Keyword search</option><option value="true">Recommendations</option></select></label>
    {!matching && <label>Keyword<Input value={keyword} onChange={event=>setKeyword(event.target.value)}/></label>}
    {view==='guests' && <label>Your podcast<select value={podcast} onChange={event=>setPodcast(event.target.value)}><option value="">Select a podcast</option>{shows.data?.data.filter(item=>item.approved&&!item.hidden).map(item=><option key={item.id} value={item.id}>{item.approved!.name}</option>)}</select></label>}
    </div></Card>{(!matching||view!=='guests'||podcast) && <List<Entry> key={path} path={path} columns>{entry=><DiscoveryCard key={entry.id} entry={entry} guest={view==='guests'} podcast={podcast}/>}</List>}</>
}
function DiscoveryCard({entry,guest,podcast}:{entry:Entry;guest:boolean;podcast:string}) {
  const action=useAction()
  const block=useAction()
  const me=queryClient.getQueryData<{data:Me}>(['/me'])?.data
  return <Card>
    <div className="flex items-start gap-3"><Initials name={entry.name}/><div className="min-w-0"><p className="text-xs font-medium text-muted-foreground">{guest ? 'Guest' : 'Podcast'}</p><h2 className="break-words">{entry.name}</h2></div></div><p className="text-sm leading-relaxed">{entry.bio??entry.description}</p>
    {entry.url&&<a href={entry.url} target="_blank" rel="noreferrer">Open public show page</a>}
    <div className="flex flex-wrap gap-1.5">{entry.topics?.map(topic=><Badge variant="secondary" key={topic}>{topic}</Badge>)}</div><p className="text-sm text-muted-foreground">{entry.languages?.join(', ')} · {entry.formats?.join(', ')}</p>
    {entry.reasons&&<div className="grid gap-1 rounded-lg bg-accent p-3 text-sm text-accent-foreground"><strong>Match {entry.score}/100</strong><p>Shared topics {entry.reasons.topics.join(', ')} · Shared languages {entry.reasons.languages.join(', ')} · {entry.reasons.formats.join(', ')||'Format differs'}</p></div>}
    {entry.accountId!==me?.id&&<>
      {(guest?Boolean(podcast):entry.open)&&<details><summary className="cursor-pointer underline">{guest?'Invite guest':'Apply to podcast'}</summary>
        <form className="mt-3 grid gap-3" onSubmit={event=>{const data=form(event);action.mutate(()=>call('/requests','POST',{direction:guest?'invitation':'application',podcastId:guest?podcast:entry.id,guestId:guest?entry.accountId:undefined,message:value(data,'message'),startsAt:new Date(value(data,'time')).toISOString(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone}))}}>
          <label>Message<Textarea name="message" required maxLength={2000}/></label><label>Proposed start ({Intl.DateTimeFormat().resolvedOptions().timeZone})<Input type="datetime-local" name="time" required/></label>
          <div><Button disabled={action.isPending||action.isSuccess}>Send request</Button></div>
        </form>{action.isSuccess&&<p role="status">Request sent.</p>}<ErrorText error={action.error}/>
      </details>}
      <Report kind={guest?'guest':'podcast'} id={entry.id}/>
      <div><Button variant="ghost" onClick={()=>block.mutate(()=>call('/blocks/'+entry.accountId,'PUT'))}>Block account</Button></div><ErrorText error={block.error}/>
    </>}
  </Card>
}
function Requests() {
  const [direction,setDirection]=useState('received')
  return <><PageHeading title="Requests" description="Review invitations and applications you sent or received."/><label className="max-w-xs">Direction<select value={direction} onChange={event=>setDirection(event.target.value)}><option value="received">Received</option><option value="sent">Sent</option></select></label>
    <List<Request> path={'/requests?direction='+direction}>{item=><RequestCard key={item.id} item={item} sent={direction==='sent'}/>}</List></>
}
function RequestCard({item,sent}:{item:Request;sent:boolean}) {
  const action=useAction()
  return <Card><h2>{item.showName}</h2><a href={item.showUrl} target="_blank" rel="noreferrer">Open public show page</a><div className="flex flex-wrap gap-2"><Badge variant="outline">{item.direction}</Badge><Badge variant={item.status==='accepted'?'default':'secondary'}>{item.status}</Badge></div><p className="whitespace-pre-wrap">{item.message}</p><p>Proposed start {new Date(item.startsAt).toLocaleString(undefined,{timeZone:item.timezone})} ({item.timezone})</p>
    {item.confirmation&&<p>Interview confirmed for {item.confirmation.date}</p>}
    {item.status==='pending'&&<div className="flex gap-2">{(sent?['withdraw']:['accept','decline']).map(verb=><Button key={verb} className="capitalize" disabled={action.isPending} onClick={()=>action.mutate(()=>call('/requests/'+item.id+'/'+verb,'POST'))}>{verb}</Button>)}</div>}
    {item.status==='accepted'&&<Link to="/inbox/$thread" params={{thread:item.id}}>Open messages</Link>}<ErrorText error={action.error}/></Card>
}
function Inbox() {
  return <><PageHeading title="Inbox" description="Coordinate your interview in an accepted request."/><List<{id:string;showName:string;unread:number}> path="/threads">{item=><Card key={item.id}><div className="flex items-center gap-3"><Initials name={item.showName}/><Link className="min-w-0 flex-1 break-words font-medium" to="/inbox/$thread" params={{thread:item.id}}>{item.showName}</Link><Badge variant="secondary">{item.unread} unread</Badge></div></Card>}</List></>
}
function Thread() {
  const {thread}=threadRoute.useParams()
  const action=useAction()
  const path='/threads/'+thread
  return <><Link to="/inbox">Back to inbox</Link><h1>Messages</h1>
    <form className="grid gap-3" onSubmit={event=>{const target=event.currentTarget;const fields=form(event);action.mutate(()=>call(path+'/messages','POST',{text:value(fields,'text')}),{onSuccess:()=>target.reset()})}}>
      <label>Message<Textarea name="text" required maxLength={2000}/></label><div className="flex gap-2"><Button disabled={action.isPending}>Send</Button><Button type="button" onClick={()=>action.mutate(()=>call(path+'/read','POST'))}>Mark read</Button></div>
    </form><ErrorText error={action.error}/>
    <List<{id:string;text:string;sender:string;created:number}> path={path+'/messages'}>{item=><Card key={item.id}><p className="whitespace-pre-wrap">{item.text}</p><p className="text-sm text-muted-foreground">{item.sender===queryClient.getQueryData<{data:Me}>(['/me'])?.data.id?'You':'Participant'} · {new Date(item.created).toLocaleString()}</p><Report kind="message" id={item.id}/></Card>}</List>
  </>
}
function Admin() {
  const [section,setSection]=useState('submissions')
  return <><PageHeading title="Admin" description="Review profiles, handle reports, and confirm interviews."/><label className="max-w-xs">View<select value={section} onChange={event=>setSection(event.target.value)}>{['submissions','reports','requests','accounts','deletion-requests'].map(name=><option key={name}>{name}</option>)}</select></label>
    <List<AdminRecord> key={section} path={'/admin/'+section}>{item=><AdminCard key={item.id} section={section} item={item}/>}</List></>
}
type AdminRecord={id:string;status?:string;kind?:string;submitted?:Fields;detail?:object;name?:string;email?:string;banned?:boolean;showName?:string;guestId?:string;guestName?:string;startsAt?:string;confirmation?:{date:string}}
function AdminCard({section,item}:{section:string;item:AdminRecord}) {
  const action=useAction()
  const path='/admin/'+section+'/'+item.id
  const [evidence,setEvidence]=useState('statements')
  return <Card><h2>{item.showName??item.submitted?.name??item.name??item.id}</h2>
    {item.status&&<p>{item.kind} {item.status}</p>}
    {item.submitted&&<><p>{item.submitted.bio??item.submitted.description}</p><p>{item.submitted.topics?.join(', ')} {item.submitted.languages?.join(', ')} {item.submitted.formats?.join(', ')}</p>{item.submitted.url&&<a href={item.submitted.url} target="_blank" rel="noreferrer">Check public show link</a>}</>}
    {section==='submissions'&&<><div><Button disabled={action.isPending} onClick={()=>action.mutate(()=>call(path+'/approve','POST'))}>Approve</Button></div><form className="flex flex-wrap gap-2" onSubmit={event=>{const data=form(event);action.mutate(()=>call(path+'/return','POST',{reason:value(data,'reason')}))}}><label>Reason<Input name="reason" required/></label><Button disabled={action.isPending}>Return for edits</Button></form></>}
    {item.detail&&<pre className="whitespace-pre-wrap break-all rounded bg-muted p-2 text-xs">{JSON.stringify(item.detail,null,2)}</pre>}
    {['reports','deletion-requests'].includes(section)&&item.status==='pending'&&<form className="flex flex-wrap gap-2" onSubmit={event=>{const data=form(event);action.mutate(()=>call(path+'/resolve','POST',{note:value(data,'note')}))}}><label>Resolution<Input name="note" required/></label><Button disabled={action.isPending}>Resolve</Button></form>}
    {section==='accounts'&&<><p>{item.email} · {item.banned?'Suspended':'Active'}</p><div><Button disabled={action.isPending} onClick={()=>action.mutate(async()=>{const result=item.banned?await auth.admin.unbanUser({userId:item.id}):await auth.admin.banUser({userId:item.id});if(result.error)throw new Error(result.error.message??'Account action failed')})}>{item.banned?'Reactivate':'Suspend'}</Button></div></>}
    {section==='requests'&&<><p>Guest {item.guestName??item.guestId} · Proposed {item.startsAt && new Date(item.startsAt).toLocaleString()}</p>{item.confirmation?<p>Confirmed for {item.confirmation.date}</p>:<form className="grid gap-2" onSubmit={event=>{const data=form(event);action.mutate(()=>call(path+'/confirmation','PUT',{date:value(data,'date'),type:evidence,note:value(data,'note'),url:value(data,'url')||undefined}))}}>
      <label>Actual interview date<Input name="date" type="date" required/></label><label>Evidence type<select value={evidence} onChange={event=>setEvidence(event.target.value)}><option value="statements">Written statements from both participants</option><option value="episode">Public episode link</option></select></label>
      {evidence==='episode'&&<label>Public episode link<Input name="url" type="url" required/></label>}
      <label>Evidence note<Textarea name="note" required/></label><div><Button disabled={action.isPending}>Confirm interview</Button></div></form>}</>}
    <ErrorText error={action.error}/>
  </Card>
}
const root=createRootRoute({component:Layout})
const profilesRoute=createRoute({getParentRoute:()=>root,path:'/',component:Profiles})
const discoverRoute=createRoute({getParentRoute:()=>root,path:'/discover',component:Discover})
const requestsRoute=createRoute({getParentRoute:()=>root,path:'/requests',component:Requests})
const inboxRoute=createRoute({getParentRoute:()=>root,path:'/inbox',component:Inbox})
const threadRoute=createRoute({getParentRoute:()=>root,path:'/inbox/$thread',component:Thread})
const adminRoute=createRoute({getParentRoute:()=>root,path:'/admin',component:Admin})
const router=createRouter({routeTree:root.addChildren([profilesRoute,discoverRoute,requestsRoute,inboxRoute,threadRoute,adminRoute])})
declare module '@tanstack/react-router' {interface Register {router:typeof router}}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={queryClient}><RouterProvider router={router}/></QueryClientProvider>)
