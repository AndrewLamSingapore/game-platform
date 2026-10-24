const clips=[...document.querySelectorAll('video')];
for(const clip of clips){const error=clip.parentElement.querySelector('.error');const failed=()=>{error.hidden=false};clip.addEventListener('error',failed);clip.querySelector('source').addEventListener('error',failed);clip.addEventListener('play',()=>{error.hidden=true;for(const other of clips)if(other!==clip)other.pause()})}
document.addEventListener('visibilitychange',()=>{if(document.hidden)clips.forEach(clip=>clip.pause())});
addEventListener('pagehide',()=>clips.forEach(clip=>clip.pause()));
