const clamp=(n,min,max)=>Math.max(min,Math.min(max,Number(n)||0));
export const DEFAULT_RATING=Object.freeze({rating:1500,games:0,provisional:true});

export function expectedScore(a,b){return 1/(1+10**((b-a)/400));}
export function updateElo(player,opponent,score,options={}){
  const p={...DEFAULT_RATING,...player},o={...DEFAULT_RATING,...opponent};
  const k=options.kFactor??(p.games<10?40:p.rating>=2400?10:20);
  const next=Math.round(p.rating+k*(clamp(score,0,1)-expectedScore(p.rating,o.rating)));
  return Object.freeze({rating:next,games:p.games+1,provisional:p.games+1<10,delta:next-p.rating,algorithm:'elo-v1'});
}

export function difficultyFromRating(rating){
  const r=clamp(rating,0,4000);
  if(r<1200)return Object.freeze({tier:'GUIDED',aggression:0.35,reactionTicks:8,retreatAt:40});
  if(r<1800)return Object.freeze({tier:'STANDARD',aggression:0.55,reactionTicks:5,retreatAt:30});
  if(r<2400)return Object.freeze({tier:'VETERAN',aggression:0.72,reactionTicks:3,retreatAt:22});
  return Object.freeze({tier:'ELITE',aggression:0.86,reactionTicks:2,retreatAt:16});
}

export function rankCandidates(player,candidates,{maxRatingGap=400,maxLatencyMs=180}={}){
  return candidates.filter(c=>c.id!==player.id&&c.region===player.region&&c.latencyMs<=maxLatencyMs)
    .map(c=>({...c,ratingGap:Math.abs(c.rating-player.rating),score:Math.abs(c.rating-player.rating)+(c.latencyMs*0.75)+(c.waitSeconds>30?-Math.min(c.waitSeconds,120):0)}))
    .filter(c=>c.ratingGap<=maxRatingGap+Math.min(c.waitSeconds??0,120)*2).sort((a,b)=>a.score-b.score||String(a.id).localeCompare(String(b.id)));
}
