import {Avatar, AvatarFallback} from './avatar'

export function Brand() {
  return <div className="flex items-center gap-3">
    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className="size-5">
        <rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11v1a7 7 0 0 0 14 0v-1M12 19v3m-3 0h6"/>
      </svg>
    </span>
    <span className="grid leading-tight"><strong>Emerging Talks</strong><span className="text-xs text-muted-foreground">Podcast Matcher</span></span>
  </div>
}

export function Initials({name}: {name:string}) {
  const initials = name.trim().split(/\s+/).slice(0,2).map(word => Array.from(word)[0]).join('').toUpperCase()
  return <Avatar aria-hidden="true" className="size-11"><AvatarFallback className="bg-accent font-semibold text-accent-foreground">{initials || 'ET'}</AvatarFallback></Avatar>
}

export function PageHeading({title,description}: {title:string;description:string}) {
  return <div className="grid gap-2">
    <h1>{title}</h1>
    <p className="max-w-prose text-sm text-muted-foreground sm:text-base">{description}</p>
  </div>
}
