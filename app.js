import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL='https://vtrfgckzpjgtmqsnumur.supabase.co';
const SUPABASE_KEY='sb_publishable_zsgA314WZue1tlu_Kt-SDQ_UopdKMNs';
const db=createClient(SUPABASE_URL,SUPABASE_KEY);
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
let user=null, campaign=null;

function notice(text,bad=false){const n=$('#notice');n.textContent=text;n.className=bad?'notice bad':'notice';}
function show(id){document.querySelectorAll('[data-view]').forEach(x=>x.hidden=true);$(id).hidden=false;}

async function refresh(){
 const {data:{user:u}}=await db.auth.getUser(); user=u;
 $('#who').textContent=u?.email||'Private Alpha'; $('#signout').hidden=!u;
 if(!u){show('#auth');return;}
 await loadCampaigns(); show('#dashboard');
}

async function loadCampaigns(){
 const {data,error}=await db.from('campaigns').select('*').order('created_at',{ascending:false});
 if(error){notice(error.message,true);return;}
 $('#campaigns').innerHTML=(data||[]).map(c=>`<button class="campaign" data-id="${c.id}"><b>${esc(c.name)}</b><span>${esc(c.world_state?.genre||'Uncharted world')}</span></button>`).join('')||'<p>No campaigns yet. Create your first world.</p>';
 document.querySelectorAll('.campaign').forEach(b=>b.onclick=()=>openCampaign(b.dataset.id));
}

async function openCampaign(id){
 const {data:c,error}=await db.from('campaigns').select('*').eq('id',id).single(); if(error)return notice(error.message,true); campaign=c;
 const {data:entities}=await db.from('campaign_entities').select('*').eq('campaign_id',id).order('created_at');
 const {data:turns}=await db.from('game_turns').select('*').eq('campaign_id',id).order('created_at').limit(100);
 const {data:memory}=await db.from('campaign_memory').select('*').eq('campaign_id',id).order('created_at',{ascending:false}).limit(12);
 $('#campaignTitle').textContent=c.name;
 $('#world').textContent=JSON.stringify(c.world_state||{},null,2);
 $('#entities').innerHTML=(entities||[]).map(e=>`<div class="chip"><b>${esc(e.entity_type)}</b> ${esc(e.name)}</div>`).join('')||'<p>No character yet.</p>';
 $('#transcript').innerHTML=(turns||[]).map(t=>`<article class="turn ${t.speaker.toLowerCase()}"><small>${esc(t.speaker)}</small><p>${esc(t.content)}</p></article>`).join('')||'<p>Your story has not begun.</p>';
 $('#memory').innerHTML=(memory||[]).map(m=>`<div class="memory"><b>${esc(m.memory_type)}</b><span>${esc(m.content?.summary||m.content?.text||JSON.stringify(m.content))}</span></div>`).join('')||'<p>No memories yet.</p>';
 show('#play'); $('#action').focus();
}

$('#authForm').onsubmit=async e=>{e.preventDefault();const email=$('#email').value.trim(),password=$('#password').value;const mode=e.submitter.value;let r=mode==='signup'?await db.auth.signUp({email,password}):await db.auth.signInWithPassword({email,password});if(r.error)return notice(r.error.message,true);notice(mode==='signup'&&!r.data.session?'Check your email to confirm the account.':'Signed in.');await refresh();};
$('#signout').onclick=async()=>{await db.auth.signOut();campaign=null;await refresh();};
$('#newCampaign').onsubmit=async e=>{e.preventDefault();const name=$('#newName').value.trim(),genre=$('#genre').value.trim()||'pulp fantasy';const location=$('#location').value.trim()||'the frontier gate';const {data,error}=await db.from('campaigns').insert({owner_id:user.id,name,world_state:{genre,location,clock:'Day 1',threat_level:1}}).select().single();if(error)return notice(error.message,true);$('#newCampaign').reset();await loadCampaigns();await openCampaign(data.id);};
$('#characterForm').onsubmit=async e=>{e.preventDefault();if(!campaign)return;const name=$('#pcName').value.trim(),archetype=$('#archetype').value.trim()||'wanderer';const {error}=await db.from('campaign_entities').insert({campaign_id:campaign.id,entity_type:'PC',name,state:{archetype,status:'active'}});if(error)return notice(error.message,true);notice('Character created.');await openCampaign(campaign.id);};
$('#turnForm').onsubmit=async e=>{e.preventDefault();if(!campaign)return;const action=$('#action').value.trim();if(!action)return;$('#send').disabled=true;notice('GM is resolving the turn…');const {data,error}=await db.functions.invoke('gm-turn',{body:{campaign_id:campaign.id,action}});$('#send').disabled=false;if(error)return notice(error.message,true);$('#action').value='';notice(`Turn ${data.turn} recorded.`);await openCampaign(campaign.id);};
$('#back').onclick=async()=>{campaign=null;await loadCampaigns();show('#dashboard');};

db.auth.onAuthStateChange(()=>setTimeout(refresh,0));
refresh();
