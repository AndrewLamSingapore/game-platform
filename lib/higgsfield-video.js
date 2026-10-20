// REST contract: higgsfield-ai/higgsfield-js README (v2) and Python SDK.
const API='https://api.higgsfield.ai';
export const HIGGSFIELD_MODEL='dop-turbo';
const fail=(code,status=502)=>Object.assign(new Error(code),{code,status});
export function higgsfieldConfigured(env=process.env){return Boolean(env.HF_KEY||env.HF_CREDENTIALS||(env.HF_API_KEY&&env.HF_API_SECRET));}
export async function higgsfieldRequest(path,{method='GET',body,fetchImpl=fetch,env=process.env}={}){
  const credentials=env.HF_KEY||env.HF_CREDENTIALS||(env.HF_API_KEY&&env.HF_API_SECRET?`${env.HF_API_KEY}:${env.HF_API_SECRET}`:'');
  if(!credentials)throw fail('higgsfield_not_configured',503);
  const response=await fetchImpl(`${API}${path}`,{method,redirect:'error',signal:AbortSignal.timeout(18000),headers:{Authorization:`Key ${credentials}`,'Content-Type':'application/json',Accept:'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  if(!response.ok)throw fail('higgsfield_request_failed',response.status);
  const result=await response.json();
  if(!result||typeof result!=='object')throw fail('invalid_provider_response');
  return result;
}
export async function startHiggsfieldVideo({prompt,imageUrl},options={}){
  // Do not retry a billable submission: a transport timeout can mean it was accepted.
  const result=await higgsfieldRequest('/v1/image2video/dop',{...options,method:'POST',body:{model:HIGGSFIELD_MODEL,prompt,input_images:[{type:'image_url',image_url:imageUrl}]}});
  if(!/^[a-zA-Z0-9_-]{1,128}$/.test(result.request_id||''))throw fail('invalid_provider_request_id');
  return {provider:'higgsfield',request_id:result.request_id,model:HIGGSFIELD_MODEL};
}
export async function getHiggsfieldVideo(operation,options={}){
  if(operation?.provider!=='higgsfield'||!/^[a-zA-Z0-9_-]{1,128}$/.test(operation.request_id||''))throw fail('invalid_provider_operation');
  // Never follow a stored or client-supplied status URL with API credentials.
  const result=await higgsfieldRequest(`/requests/${operation.request_id}/status`,options);
  if(['queued','in_progress'].includes(result.status))return{status:'pending'};
  if(['failed','nsfw','canceled','cancelled'].includes(result.status))return{status:'error'};
  if(result.status!=='completed')throw fail('unknown_provider_status');
  let url;try{url=new URL(result.video?.url);}catch{throw fail('missing_provider_video');}
  if(url.protocol!=='https:'||url.username||url.password)throw fail('invalid_provider_video');
  return{status:'completed',url:url.href,mediaType:'video/mp4'};
}
