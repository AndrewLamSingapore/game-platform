import { consumeEvents } from '../supabase/functions/_shared/turn-stream.js';
export async function requestTurn({url,key,token,body,onNarrative,fetchImpl=fetch}) {
  const response=await fetchImpl(`${url}/functions/v1/gm-turn`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${token}`,'Content-Type':'application/json',Accept:'text/event-stream'},body:JSON.stringify(body),signal:AbortSignal.timeout(90000)});
  if(!response.ok){const data=await response.json().catch(()=>({}));return {error:{context:{status:response.status,json:async()=>data},message:data.error||'turn_failed'}};}
  if(!response.headers.get('content-type')?.includes('text/event-stream'))return {data:await response.json()};
  let result,error;
  await consumeEvents(response.body,(event,data)=>{if(event==='narrative')onNarrative?.(data.text);if(event==='result')result=data;if(event==='error')error={context:{status:data.status,json:async()=>data},message:data.error};});
  if(error)return {error};
  if(!result)throw Error('The connection ended before the turn was confirmed. Reopen the scene before trying again.');
  return {data:result};
}
