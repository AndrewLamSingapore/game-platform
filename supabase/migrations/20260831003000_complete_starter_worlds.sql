-- Complete campaign bibles for the three launch worlds.
-- Living Characters deliberately follows in a later migration.
create table if not exists public.starter_world_blueprints (
  starter_id text primary key,
  version integer not null,
  title text not null,
  content jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.starter_world_blueprints enable row level security;
alter table public.starter_world_blueprints force row level security;
revoke all on public.starter_world_blueprints from public, anon, authenticated;

insert into public.starter_world_blueprints(starter_id,version,title,content) values
('ashen-gate',2,'The Ashen Gate',$json$
{
  "campaign_length":"6-10 hours","genre":"dark fantasy political survival","tone":"urgent, intimate, morally difficult","themes":["truth versus safety","inherited guilt","who deserves sanctuary"],
  "player_role":"Mara Vey, an oathbroken gate warden carrying the last lawful key",
  "central_mystery":"The city was not protected by the Ashen Gate; it was built by sacrificing the refugees the gate was said to save.",
  "acts":[
    {"id":"act-1","title":"The Last Knock","goal":"Choose who enters before the gate seals","turns":"0-5","reversal":"The stranger Sable is Mara's sister, officially recorded dead."},
    {"id":"act-2","title":"A City of Borrowed Names","goal":"Cross the sealed districts and verify the founding ledger","turns":"6-14","reversal":"Captain Rook has been delaying—not causing—the next sacrifice."},
    {"id":"act-3","title":"The Furnace Below","goal":"Enter the gate mechanism and confront the bound witnesses","turns":"15-24","reversal":"Opening the gate releases both refugees and the ash plague."},
    {"id":"act-4","title":"The Trial of Cinders","goal":"Choose allies and make the truth public or controllable","turns":"25-34","reversal":"Mara's mother designed the ritual and left Mara the means to end it."},
    {"id":"act-5","title":"No Gate Forever","goal":"Resolve the siege, plague and legitimacy of the city","turns":"35+","reversal":"There is no ending that preserves the old city unchanged."}
  ],
  "locations":[
    {"id":"outer-killzone","name":"The Red Approach","purpose":"opening siege and refugee dilemma","hazard":"ash hounds"},
    {"id":"gatehouse","name":"The Last Gatehouse","purpose":"keys, command conflict and first betrayal","hazard":"closing mechanisms"},
    {"id":"cinder-market","name":"Cinder Market","purpose":"rumours, supplies and public sentiment","hazard":"informants"},
    {"id":"saints-quarter","name":"Quarter of Hollow Saints","purpose":"ancestral records and hidden survivors","hazard":"memory fever"},
    {"id":"rook-barracks","name":"The Black Barracks","purpose":"military alliance or mutiny","hazard":"martial law"},
    {"id":"archive","name":"The Sealed Civic Archive","purpose":"founding ledger heist","hazard":"oath wards"},
    {"id":"furnace","name":"The Furnace Below","purpose":"supernatural truth and final mechanism","hazard":"ash plague"},
    {"id":"crown-wall","name":"The Crown Wall","purpose":"public climax","hazard":"citywide siege"}
  ],
  "factions":[
    {"name":"The Gate Wardens","objective":"prevent collapse at any moral cost","starting_score":5},
    {"name":"The Unnamed","objective":"restore the erased refugees to history and citizenship","starting_score":0},
    {"name":"Cinder Council","objective":"retain power by controlling the founding truth","starting_score":-5},
    {"name":"Ash Pilgrims","objective":"open every gate and accept purification by plague","starting_score":-15}
  ],
  "npcs":[
    {"key":"rook","name":"Captain Ilyan Rook","role":"commander","personality":"severe, protective, exhausted","objective":"buy enough time to evacuate children before the ritual fails","secret":"has falsified execution lists to save dissidents","disposition":-10},
    {"key":"sable","name":"Sable Vey","role":"returned sister","personality":"fearless, cutting, compassionate toward outsiders","objective":"publish the ledger and open the gate","secret":"carries an early stage of ash plague","disposition":20},
    {"key":"meret","name":"Archivist Meret","role":"keeper of names","personality":"precise, anxious, stubborn","objective":"preserve proof without letting either army seize it","secret":"can read names erased by the ritual","disposition":5},
    {"key":"orr","name":"Councillor Orr","role":"political antagonist","personality":"charming, paternal, ruthless","objective":"stage a controlled revelation that keeps the Council sovereign","secret":"is descended from the first sacrificed family","disposition":-20},
    {"key":"tavin","name":"Tavin Ashhand","role":"smuggler","personality":"comic, mercenary, unexpectedly loyal","objective":"move his people through the old drains","secret":"owns the missing second gate key","disposition":0},
    {"key":"sister-elan","name":"Sister Elan","role":"plague physician","personality":"gentle, empirical, unflinching","objective":"create a treatment before the furnace opens","secret":"the treatment requires Mara's blood","disposition":10},
    {"key":"boy-king","name":"The Boy in the Furnace","role":"bound witness","personality":"ancient, lonely, literal","objective":"make one living citizen speak every erased name","secret":"he is the gate's consciousness","disposition":0},
    {"key":"general-vael","name":"General Vael","role":"besieger","personality":"disciplined, grieving, pragmatic","objective":"recover descendants of the original refugees","secret":"will accept peace if the names are restored","disposition":-15}
  ],
  "quests":[
    {"key":"q1","act":1,"title":"The Last Knock","objective":"Decide who crosses before the Ashen Gate seals forever."},
    {"key":"q2","act":1,"title":"The Second Key","objective":"Find who removed the second key and determine why."},
    {"key":"q3","act":2,"title":"Names Beneath Names","objective":"Steal or lawfully obtain the unedited founding ledger."},
    {"key":"q4","act":2,"title":"Mercy Lists","objective":"Decide whether to expose Rook's falsified execution records."},
    {"key":"q5","act":3,"title":"A Cure Made Personal","objective":"Help Sister Elan test a treatment for the ash plague."},
    {"key":"q6","act":3,"title":"The Bound Witnesses","objective":"Enter the furnace and learn what powers the gate."},
    {"key":"q7","act":4,"title":"Trial of Cinders","objective":"Present the truth before the city chooses violence."},
    {"key":"q8","act":4,"title":"The General's Dead","objective":"Negotiate with General Vael over the erased descendants."},
    {"key":"q9","act":5,"title":"No Gate Forever","objective":"Choose the permanent fate of the gate, plague and city."}
  ],
  "critical_items":["Mara's lawful gate key","Sable's signet","Unedited founding ledger","Second gate key","Elan's ash serum"],
  "world_clocks":[{"name":"Gate collapse","segments":6},{"name":"Ash plague","segments":6},{"name":"Council coup","segments":4},{"name":"Vael's assault","segments":6}],
  "endings":[
    {"id":"open-truth","title":"The Open City","condition":"publish the ledger, negotiate peace, contain the plague"},
    {"id":"sealed-lie","title":"Another Hundred Years","condition":"seal the gate and preserve the founding lie"},
    {"id":"ashes","title":"No Walls Remain","condition":"destroy the furnace without containing the plague"},
    {"id":"new-covenant","title":"The Names Restored","condition":"replace the sacrifice with a voluntary civic covenant"},
    {"id":"warden-queen","title":"The Necessary Tyrant","condition":"Mara takes control of the gate and Council"}
  ]
}
$json$::jsonb),
('neon-midnight',2,'Neon After Midnight',$json$
{
  "campaign_length":"6-10 hours","genre":"noir science-fiction conspiracy mystery","tone":"rain-soaked, paranoid, humane","themes":["memory as evidence","freedom versus prediction","the ownership of a future"],
  "player_role":"Juno Vale, a memory-forensics detective implicated in tomorrow's assassination",
  "central_mystery":"The seven-years-late train is a failed civic prediction experiment returning from a simulated future; its passengers remember different branches, not one fixed destiny.",
  "acts":[
    {"id":"act-1","title":"Seven Years Late","goal":"Escape Platform Nine with a passenger and the data shard","turns":"0-5","reversal":"The assassination footage is authentic but not inevitable."},
    {"id":"act-2","title":"The City That Rehearsed Tomorrow","goal":"Trace the train through Vanta's prediction infrastructure","turns":"6-14","reversal":"Every district has been quietly governed by forecast scores."},
    {"id":"act-3","title":"Passenger Zero","goal":"Identify who sent the train back","turns":"15-24","reversal":"Nia-7 is an ensemble of copied passenger memories."},
    {"id":"act-4","title":"Election Night Forever","goal":"Stop or redirect the coup and assassination","turns":"25-34","reversal":"The mayor commissioned the original experiment."},
    {"id":"act-5","title":"An Unpredicted Dawn","goal":"Decide whether prediction should be destroyed, public or governed","turns":"35+","reversal":"Destroying the system erases the passengers' legal existence."}
  ],
  "locations":[
    {"id":"platform-nine","name":"Platform Nine","purpose":"impossible arrival and security lockdown","hazard":"memory scanners"},
    {"id":"rain-market","name":"The Rain Market","purpose":"informants and black-market identities","hazard":"predictive patrols"},
    {"id":"mnemonic-clinic","name":"Saint Leto Memory Clinic","purpose":"authenticate memories","hazard":"identity bleed"},
    {"id":"ghost-line","name":"The Ghost Line","purpose":"follow the train's impossible route","hazard":"time loops"},
    {"id":"city-archive","name":"Vanta Civic Forecast Archive","purpose":"prove algorithmic government","hazard":"bureaucratic erasure"},
    {"id":"mirror-tower","name":"Mirror Tower","purpose":"media and public disclosure","hazard":"synthetic footage"},
    {"id":"zero-station","name":"Zero Station","purpose":"origin laboratory","hazard":"branch collapse"},
    {"id":"mayoral-forum","name":"Mayoral Forum","purpose":"assassination climax","hazard":"crowd panic"}
  ],
  "factions":[
    {"name":"Vanta Security Bureau","objective":"erase the returned train and preserve public order","starting_score":-10},
    {"name":"Passenger Union","objective":"win personhood and prevent memory deletion","starting_score":10},
    {"name":"Tomorrow Office","objective":"retain exclusive control of civic prediction","starting_score":-15},
    {"name":"Open Signal","objective":"release every forecast and let the city decide","starting_score":0}
  ],
  "npcs":[
    {"key":"kade","name":"Inspector Orin Kade","role":"security pursuer","personality":"controlled, observant, privately sentimental","objective":"contain the train before forecast panic triggers the coup","secret":"his daughter is one of the passengers","disposition":-10},
    {"key":"nia","name":"Nia-7","role":"synthetic passenger advocate","personality":"curious, warm, occasionally plural","objective":"secure legal identity for all returned passengers","secret":"contains memories from seven dead passengers","disposition":20},
    {"key":"mayor","name":"Mayor Cel Veyra","role":"target and architect","personality":"visionary, evasive, guilt-ridden","objective":"survive long enough to dismantle her own prediction regime","secret":"ordered the train experiment","disposition":-5},
    {"key":"roan","name":"Roan Mercer","role":"future assassin","personality":"idealistic, volatile, ashamed","objective":"discover whether he can refuse his remembered crime","secret":"the footage shows Juno stopping him, not assisting him","disposition":5},
    {"key":"moth","name":"Moth","role":"memory broker","personality":"playful, transactional, allergic to certainty","objective":"auction proof of alternate futures","secret":"cannot form new long-term memories","disposition":0},
    {"key":"dr-esh","name":"Dr. Esh Arendt","role":"experiment scientist","personality":"clinical, defensive, fascinated","objective":"stabilize the returning branches regardless of casualties","secret":"one branch contains a cured city","disposition":-10},
    {"key":"signal","name":"Auntie Signal","role":"pirate broadcaster","personality":"theatrical, principled, reckless","objective":"broadcast the truth without triggering mass violence","secret":"is a former Tomorrow Office director","disposition":10},
    {"key":"child","name":"Eli Kade","role":"young passenger","personality":"quiet, literal, brave","objective":"prevent the future in which his father dies","secret":"remembers Juno choosing every major ending","disposition":15}
  ],
  "quests":[
    {"key":"q1","act":1,"title":"Seven Years Late","objective":"Escape Platform Nine and authenticate the assassination footage."},
    {"key":"q2","act":1,"title":"A Passenger Without a Past","objective":"Protect Nia-7 from deletion and learn what she is."},
    {"key":"q3","act":2,"title":"Forecast Citizens","objective":"Expose how prediction scores govern Vanta's daily life."},
    {"key":"q4","act":2,"title":"The Ghost Line","objective":"Ride the vanished route to locate Zero Station."},
    {"key":"q5","act":3,"title":"Passenger Zero","objective":"Identify who chose which future memories returned."},
    {"key":"q6","act":3,"title":"The Man Who Refuses Tomorrow","objective":"Find Roan before the forecast turns him into the assassin."},
    {"key":"q7","act":4,"title":"Election Night Forever","objective":"Prevent the coup without proving the prediction regime correct."},
    {"key":"q8","act":4,"title":"One Honest Broadcast","objective":"Choose what evidence Auntie Signal releases to the city."},
    {"key":"q9","act":5,"title":"An Unpredicted Dawn","objective":"Determine the legal and technological future of prediction."}
  ],
  "critical_items":["Blood-warm data shard","Passenger manifest with changing names","Mnemonic authentication seal","Zero Station master key","Juno's sealed future testimony"],
  "world_clocks":[{"name":"Security purge","segments":4},{"name":"Coup readiness","segments":6},{"name":"Branch collapse","segments":6},{"name":"Public panic","segments":6}],
  "endings":[
    {"id":"open-futures","title":"A Million Tomorrows","condition":"release transparent forecasts and protect passenger personhood"},
    {"id":"blackout","title":"The Unmeasured City","condition":"destroy prediction infrastructure and preserve passenger memories elsewhere"},
    {"id":"perfect-order","title":"Tomorrow's Republic","condition":"place prediction under a new public authority"},
    {"id":"loop","title":"Seven Years Again","condition":"send the train back to preserve the best branch"},
    {"id":"private-future","title":"The Detective's Secret","condition":"suppress the system and keep one forecast for Juno"}
  ]
}
$json$::jsonb),
('last-expedition',2,'The Last Expedition',$json$
{
  "campaign_length":"6-10 hours","genre":"lost-world scientific exploration","tone":"awe-filled, perilous, ethically complex","themes":["discovery versus possession","grief and copies","whether a world can consent"],
  "player_role":"Dr. Ren Sol, rift cartographer and former leader of the missing expedition",
  "central_mystery":"The impossible ocean is a living planetary archive recreating lost explorers from memory; Voss sank the first expedition to stop it copying Earth.",
  "acts":[
    {"id":"act-1","title":"Below the Impossible Sea","goal":"Enter the vertical ocean before demolition","turns":"0-5","reversal":"The transmission is coming from Ren's own voice."},
    {"id":"act-2","title":"The Drowned Observatory","goal":"Recover the expedition record and survivors","turns":"6-14","reversal":"Some survivors are ocean-made reconstructions."},
    {"id":"act-3","title":"A Continent That Dreams","goal":"Map the intelligence beneath the sea","turns":"15-24","reversal":"Mapping injures it and creates new rifts."},
    {"id":"act-4","title":"What Followed Them Home","goal":"Prevent military extraction or planetary spread","turns":"25-34","reversal":"Earth microbes, not the ocean, are the invasive threat."},
    {"id":"act-5","title":"The Last Expedition","goal":"Choose contact, quarantine, union or destruction","turns":"35+","reversal":"Ren must decide which version of the expedition is real enough to return."}
  ],
  "locations":[
    {"id":"rift-cliff","name":"Riftfall Cliff","purpose":"demolition countdown and entry","hazard":"reverse gravity"},
    {"id":"vertical-shore","name":"The Vertical Shore","purpose":"orientation and first contact","hazard":"pressure tides"},
    {"id":"observatory","name":"Drowned Meridian Observatory","purpose":"records, survivors and Ren's duplicate","hazard":"memory echoes"},
    {"id":"glass-reef","name":"The Glass Reef","purpose":"alien ecology and medicine","hazard":"sound predators"},
    {"id":"upside-forest","name":"The Upside Forest","purpose":"expedition camp and moral split","hazard":"falling sky"},
    {"id":"archive-whale","name":"The Archive Leviathan","purpose":"communicate with the ocean","hazard":"borrowed identities"},
    {"id":"deep-engine","name":"The Abyssal Engine","purpose":"rift control","hazard":"continental awakening"},
    {"id":"return-mouth","name":"The Return Mouth","purpose":"final evacuation or first embassy","hazard":"cross-world contamination"}
  ],
  "factions":[
    {"name":"Meridian Expedition","objective":"rescue every viable member and complete the map","starting_score":10},
    {"name":"Voss Containment Command","objective":"quarantine or destroy the rift","starting_score":-10},
    {"name":"Ocean-Born","objective":"be recognized as persons rather than copies","starting_score":0},
    {"name":"The Pelagic Mind","objective":"understand Earth without being colonized by it","starting_score":0}
  ],
  "npcs":[
    {"key":"voss","name":"Commander Voss","role":"containment commander","personality":"decisive, mournful, suspicious of wonder","objective":"seal the rift before either biosphere contaminates the other","secret":"sank the first expedition on Ren's own emergency order","disposition":-10},
    {"key":"tala","name":"Tala Quill","role":"field biologist","personality":"exuberant, empathetic, impatient","objective":"save the expedition and establish peaceful contact","secret":"knows she is an ocean-made reconstruction","disposition":20},
    {"key":"ren-echo","name":"Ren Sol Echo","role":"duplicate cartographer","personality":"calm, intimate, fiercely territorial","objective":"keep the impossible ocean closed to Earth","secret":"possesses memories Ren deliberately erased","disposition":0},
    {"key":"mako","name":"Mako Deren","role":"expedition engineer","personality":"practical, sardonic, loyal","objective":"repair the observatory and bring everyone home","secret":"has been rebuilding the demolition device","disposition":10},
    {"key":"iyu","name":"Iyu Sen","role":"xenolinguist","personality":"patient, mystical in speech, rigorous in method","objective":"complete a grammar for the Pelagic Mind","secret":"has agreed to become its permanent interpreter","disposition":10},
    {"key":"lieutenant","name":"Lieutenant Aras","role":"containment officer","personality":"disciplined, ambitious, frightened","objective":"secure a sample that guarantees promotion","secret":"has already smuggled one toward Earth","disposition":-5},
    {"key":"child-copy","name":"Little Meridian","role":"young ocean-born composite","personality":"curious, candid, rapidly changing","objective":"learn which memories make a person real","secret":"contains the entire expedition's final minutes","disposition":15},
    {"key":"leviathan","name":"The Archive Leviathan","role":"voice of the ocean","personality":"vast, cautious, speaks through remembered voices","objective":"stop painful mapping and negotiate boundaries","secret":"can close the rift only by forgetting Earth","disposition":0}
  ],
  "quests":[
    {"key":"q1","act":1,"title":"Below the Impossible Sea","objective":"Reach the drowned observatory before demolition."},
    {"key":"q2","act":1,"title":"The Voice With Your Name","objective":"Trace the impossible transmission spoken by Ren's voice."},
    {"key":"q3","act":2,"title":"Who Counts as Rescued","objective":"Determine which survivors are original, reconstructed or both."},
    {"key":"q4","act":2,"title":"The Broken Meridian","objective":"Restore the observatory without worsening the rift."},
    {"key":"q5","act":3,"title":"A Grammar for an Ocean","objective":"Help Iyu communicate with the Pelagic Mind."},
    {"key":"q6","act":3,"title":"The Map That Hurts","objective":"Replace extractive mapping with a consensual navigation method."},
    {"key":"q7","act":4,"title":"Contraband Earth","objective":"Recover the sample Lieutenant Aras smuggled toward the rift."},
    {"key":"q8","act":4,"title":"Ren's Last Order","objective":"Reveal why Voss destroyed the original expedition."},
    {"key":"q9","act":5,"title":"The Last Expedition","objective":"Choose the permanent relationship between Earth and the impossible ocean."}
  ],
  "critical_items":["Unpowered speaking receiver","Meridian black box","Consent-map lattice","Voss demolition cipher","Living ocean sample"],
  "world_clocks":[{"name":"Demolition","segments":4},{"name":"Rift expansion","segments":6},{"name":"Cross-contamination","segments":6},{"name":"Pelagic awakening","segments":6}],
  "endings":[
    {"id":"first-embassy","title":"The First Embassy","condition":"establish consent-based contact and reciprocal quarantine"},
    {"id":"clean-seal","title":"A World Remembered","condition":"close the rift after preserving testimony from both sides"},
    {"id":"colonized","title":"The Meridian Concession","condition":"allow Earth institutions to extract the ocean"},
    {"id":"union","title":"Two Oceans","condition":"merge the rift with Earth under negotiated safeguards"},
    {"id":"forgetting","title":"The Kindest Extinction","condition":"let the Pelagic Mind forget Earth and dissolve its human copies"}
  ]
}
$json$::jsonb)
on conflict (starter_id) do update set
  version=excluded.version,title=excluded.title,content=excluded.content,updated_at=now();

create or replace function public.expand_starter_campaign(p_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  starter text;
  blueprint record;
  item jsonb;
  entity_id uuid;
  hero_id uuid;
begin
  select world_state->>'starter_id' into starter from public.campaigns where id=p_campaign_id;
  if starter is null then return; end if;
  select * into blueprint from public.starter_world_blueprints where starter_id=starter;
  if not found then return; end if;

  update public.campaigns
    set world_state = world_state || jsonb_build_object(
      'blueprint_version',blueprint.version,
      'campaign_length',blueprint.content->>'campaign_length',
      'central_mystery',blueprint.content->>'central_mystery',
      'acts',blueprint.content->'acts',
      'locations',blueprint.content->'locations',
      'world_clocks',blueprint.content->'world_clocks',
      'endings',blueprint.content->'endings',
      'themes',blueprint.content->'themes'
    ) where id=p_campaign_id;

  for item in select * from jsonb_array_elements(blueprint.content->'npcs') loop
    if not exists(select 1 from public.campaign_entities where campaign_id=p_campaign_id and state->>'blueprint_key'=item->>'key') then
      insert into public.campaign_entities(campaign_id,kind,name,state)
      values(p_campaign_id,'NPC',item->>'name',jsonb_build_object(
        'status','active','blueprint_key',item->>'key','role',item->>'role',
        'personality',item->>'personality','secret',item->>'secret'
      )) returning id into entity_id;
      insert into public.character_stats(entity_id,campaign_id,hp,max_hp,armor,attack)
      values(entity_id,p_campaign_id,10,10,11,2) on conflict do nothing;
      insert into public.npc_agendas(entity_id,campaign_id,agenda,disposition,state)
      values(entity_id,p_campaign_id,item->>'objective',coalesce((item->>'disposition')::integer,0),jsonb_build_object('blueprint_key',item->>'key'));
    end if;
  end loop;

  for item in select * from jsonb_array_elements(blueprint.content->'quests') loop
    if not exists(select 1 from public.campaign_quests where campaign_id=p_campaign_id and objective->>'blueprint_key'=item->>'key') then
      insert into public.campaign_quests(campaign_id,title,status,objective,source_turn)
      values(p_campaign_id,item->>'title','OPEN',jsonb_build_object(
        'text',item->>'objective','blueprint_key',item->>'key','act',(item->>'act')::integer
      ),0);
    end if;
  end loop;

  for item in select * from jsonb_array_elements(blueprint.content->'factions') loop
    insert into public.faction_relations(campaign_id,faction_name,score,state,updated_at)
    values(p_campaign_id,item->>'name',(item->>'starting_score')::integer,jsonb_build_object('objective',item->>'objective','blueprint',true),now())
    on conflict (campaign_id,faction_name) do nothing;
  end loop;

  select id into hero_id from public.campaign_entities where campaign_id=p_campaign_id and kind='PC' order by updated_at limit 1;
  if hero_id is not null then
    for item in select * from jsonb_array_elements(blueprint.content->'critical_items') loop
      if not exists(select 1 from public.inventory_items where campaign_id=p_campaign_id and name=item#>>'{}') then
        insert into public.inventory_items(campaign_id,owner_entity_id,name,item_type,quantity,state)
        values(p_campaign_id,hero_id,item#>>'{}','STORY',1,jsonb_build_object('critical',true,'starter_id',starter));
      end if;
    end loop;
  end if;
end
$function$;

revoke execute on function public.expand_starter_campaign(uuid) from public, anon, authenticated;

create or replace function public.zz_expand_starter_campaign_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  perform public.expand_starter_campaign(new.id);
  return new;
end
$function$;

revoke execute on function public.zz_expand_starter_campaign_trigger() from public, anon, authenticated;
drop trigger if exists zz_campaigns_expand_starter on public.campaigns;
create trigger zz_campaigns_expand_starter
  after insert on public.campaigns
  for each row execute function public.zz_expand_starter_campaign_trigger();

do $backfill$
declare c record;
begin
  for c in select id from public.campaigns where world_state->>'starter_id' in ('ashen-gate','neon-midnight','last-expedition') loop
    perform public.expand_starter_campaign(c.id);
  end loop;
end
$backfill$;
