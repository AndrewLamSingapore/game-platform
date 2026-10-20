export function createCinematicController({request,update,delay=ms=>new Promise(resolve=>setTimeout(resolve,ms)),pollLimit=60}){
 let scene=null,job=null,version=0,busy=false;
 const show=(phase,message,url)=>update({phase,message,url});
 return{
  load(next){version++;scene=next;job=null;busy=false;if(next)show('idle','Generate a cinematic for this turning point.');},
  async start(){
   if(!scene||busy)return;
   const current=version,active=scene;busy=true;
   show('generating','Preparing your cinematic… You can keep playing.');
   try{
    let next=await request(job?{action:'status',job_id:job.id}:{action:'start',campaign_id:active.campaignId,source_turn:active.sourceTurn});
    for(let count=0;current===version;count++){
     if(!next?.id)throw Error('The cinematic could not be confirmed.');
     job=next;
     if(next.status==='READY'){
      const url=new URL(next.output_url);if(url.protocol!=='https:'||url.username||url.password)throw Error('The cinematic video is unavailable.');
      show('ready','Cinematic ready — press play.',url.href);return;
     }
     if(next.status==='FAILED'){job=null;throw Error('Generation failed. You may retry this scene once.');}
     if(count>=pollLimit){show('waiting','Still generating. Check again shortly.');return;}
     show('generating',next.status==='RESERVED'?'Preparing your cinematic…':'Higgsfield is generating your cinematic…');
     await delay(5000);if(current!==version)return;
     next=await request({action:'status',job_id:next.id});
    }
   }catch(error){if(current===version)show('error',error.message||'The cinematic is unavailable. Your game can continue.');}
   finally{if(current===version)busy=false;}
  }
 };
}
