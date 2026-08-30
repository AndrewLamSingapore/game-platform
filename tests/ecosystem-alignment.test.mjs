import assert from 'node:assert/strict';import fs from 'node:fs';
const html=fs.readFileSync('index.html','utf8'),links=fs.readFileSync('ecosystem-link.js','utf8'),tokens=fs.readFileSync('shared-tokens.css','utf8'),migration=fs.readFileSync('supabase/migrations/20260830150000_ecosystem_funnel_events.sql','utf8');
for(const value of ['the-portal-ten.vercel.app','authority-engine-app.vercel.app','game-platform-wine-nine.vercel.app','utm_source','game_return_link'])assert.match(links,new RegExp(value));
assert.match(html,/shared-tokens\.css/);assert.match(html,/ecosystem-link\.js/);assert.match(tokens,/ecosystem-nav/);assert.match(migration,/ecosystem_referral_received/);
console.log('Portal and Game Platform ecosystem alignment: PASS');
