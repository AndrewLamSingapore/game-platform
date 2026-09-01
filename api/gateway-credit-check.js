export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'method_not_allowed'});
  const token=process.env.AI_GATEWAY_API_KEY||process.env.VERCEL_OIDC_TOKEN;
  const authSource=process.env.AI_GATEWAY_API_KEY?'AI_GATEWAY_API_KEY':process.env.VERCEL_OIDC_TOKEN?'VERCEL_OIDC_TOKEN':'NONE';
  if(!token)return res.status(503).json({ok:false,auth_source:authSource,error:'gateway_auth_unavailable'});
  try{
    const r=await fetch('https://ai-gateway.vercel.sh/v1/credits',{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(10000)});
    const text=await r.text();let data;try{data=JSON.parse(text)}catch{data={raw:text.slice(0,200)}}
    return res.status(r.ok?200:502).json({ok:r.ok,auth_source:authSource,gateway_status:r.status,balance:data?.balance??null,total_used:data?.total_used??null,error:r.ok?null:(data?.error?.message||data?.error||'credit_check_failed')});
  }catch(e){return res.status(502).json({ok:false,auth_source:authSource,error:String(e?.message||e)})}
}
