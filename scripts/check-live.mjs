// Read-only public production smoke test. Never signs up users or sends messages.
import {readdir,readFile} from 'node:fs/promises';
import {authConfig} from '../js/auth-config.js';
const base='https://sathivo.co/';
async function request(url,options={}){
 const response=await fetch(url,{...options,signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error(`${new URL(url).pathname}: HTTP ${response.status}`);
 return response;
}
const pages=(await readdir('.')).filter(p=>p.endsWith('.html'));
for(const page of pages){
 const r=await request(new URL(page,base));
 const html=await r.text();
 if(!html.includes('<html')||!/<title>[^<]+<\/title>/i.test(html))throw Error(page+': invalid HTML');
 console.log('HTTP OK',page);
}
for(const path of ['robots.txt','sitemap.xml','ads.txt']){
 const r=await request(new URL(path,base));const text=await r.text();
 if(path==='robots.txt'&&!text.includes('Sitemap: https://sathivo.co/sitemap.xml'))throw Error('Sitemap reference missing');
 if(path==='sitemap.xml'&&!text.includes('<urlset'))throw Error('Invalid sitemap');
 if(path==='ads.txt'&&!text.includes('google.com, pub-'))throw Error('Invalid ads.txt');
 console.log('HTTP OK',path);
}
const headers={apikey:authConfig.publishableKey,'Content-Type':'application/json'};
const ids=new Set();let total=0;
for(let offset=0;offset<240;offset+=24){
 const r=await request(authConfig.supabaseUrl+'/rest/v1/rpc/browse_public_companions_v3',{method:'POST',headers,body:JSON.stringify({p_limit:24,p_offset:offset})});
 const rows=await r.json();if(!Array.isArray(rows))throw Error('Invalid public discovery response');
 for(const row of rows){if(ids.has(row.public_id))throw Error('Repeated profile across pages');ids.add(row.public_id)}
 total+=rows.length;if(rows.length<24)break;
}
console.log('Public discovery pagination OK; inspected',total,'profiles (maximum 240).');
// These unauthenticated calls must stop before any privileged handler action.
for(const slug of ['admin-maintenance','admin-users-list','delete-my-account','open-view-once-photo','mark-chat-read']){
 const r=await fetch(authConfig.supabaseUrl+'/functions/v1/'+slug,{method:'POST',headers,body:'{}',signal:AbortSignal.timeout(20000)});
 if(![401,403].includes(r.status))throw Error(slug+': expected unauthenticated rejection, got '+r.status);
 console.log('Unauthenticated access rejected',slug,r.status);
}
