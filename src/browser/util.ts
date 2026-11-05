import {clsx,type ClassValue} from 'clsx'
import {twMerge} from 'tailwind-merge'
import {log} from '../shared/log'
export const cn = (...inputs:ClassValue[]) => twMerge(clsx(inputs))
export async function call<T>(path:string,method='GET',body?:unknown):Promise<{data:T;nextCursor?:string|null}> {
  const start = performance.now()
  const response = await fetch('/api/v1'+path,{method,headers:body === undefined ? undefined : {'Content-Type':'application/json'},body:body === undefined ? undefined : JSON.stringify(body)})
  const result = await response.json()
  if (!response.ok) {
    log({route:path.split('?')[0]!,status:response.status,duration:Math.round(performance.now()-start),requestId:response.headers.get('X-Request-ID') ?? undefined,errorCode:result.error?.code})
    throw new Error(result.error?.message ?? 'Request failed')
  }
  return result
}
