export function log(fields:{route:string; status:number; duration:number; requestId?:string; errorCode?:string}) {
  const event = {event:'api.request',...fields}
  if (fields.status >= 400) console.error(JSON.stringify(event))
  else console.info(JSON.stringify(event))
}
