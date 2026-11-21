// Cloudflare Pages Function: render a fresh, safe initial preview of *public*
// published active profiles. The normal browser directory still handles filters,
// pagination, authorization and interactions. No private records are queried.
import {authConfig} from '../js/auth-config.js';

const origin='https://sathivo.co';
const escaped=value=>String(value??'').replace(/[&<>"']/g,ch=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
}[ch]));
const clip=(value,max)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
const validUuid=value=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value??''));

export function publicDirectoryPreview(rows){
 if(!Array.isArray(rows))return '';
 const cards=rows.slice(0,8).flatMap(row=>{
  if(!row || !validUuid(row.public_id))return [];
  const name=clip(row.display_name,80);
  if(!name)return [];
  const intro=clip(row.bio,210);
  const city=clip(row.city_name,75);
  const category=Array.isArray(row.categories)
   ?row.categories.filter(x=>typeof x==='string').slice(0,3).map(x=>'<span>'+escaped(clip(x,38))+'</span>').join('')
   :'';
  const mode={'online':'Online','in-person':'In person','both':'Online & in person'}[row.meeting_mode]||'';
  const rate=Number(row.hourly_rate);
  const amount=Number.isSafeInteger(rate)&&rate>0&&rate<=1000000?'₹'+rate.toLocaleString('en-IN')+' / hour':'Rate listed in profile';
  const link='/companion.html?id='+encodeURIComponent(row.public_id);
  const summary=intro||'Read this companion’s published profile for available activities and preferences.';
  return ['<article class="companion-card directory-server-card">',
   '<div class="portrait" aria-hidden="true">'+escaped(name[0].toUpperCase())+'</div>',
   '<div class="card-copy"><div class="card-heading-row"><h2>'+escaped(name)+'</h2></div>',
   city?'<p>'+escaped(city)+'</p>':'',
   '<strong class="rate-chip">'+escaped(amount)+'</strong>',
   mode?'<p>'+escaped(mode)+'</p>':'',
   category?'<div class="tags">'+category+'</div>':'',
   '<p>'+escaped(summary)+'</p>',
   '<div class="card-actions"><a class="text-link companion-profile-link" href="'+link+'">View published profile ↗</a></div>',
   '</div></article>'].join('');
 });
 return cards.join('');
}

export function addPreviewToDirectory(html,rows){
 const anchor='<section id="results" tabindex="-1" class="companion-grid" aria-label="Companions"></section>';
 if(!html.includes(anchor))return html;
 const preview=publicDirectoryPreview(rows);
 if(!preview)return html;
 return html.replace(anchor,'<section id="results" tabindex="-1" class="companion-grid" aria-label="Companions">'+preview+'</section>')
 .replace('>Loading companions…</p>','>Explore currently published profiles below. Filters load automatically.</p>');
}

export async function onRequestGet({request,env}){
 const asset=await env.ASSETS.fetch(request);
 if(!asset.ok || !(asset.headers.get('content-type')||'').includes('text/html'))return asset;
 try{
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),2400);
  let result;
  try{
   result=await fetch(authConfig.supabaseUrl+'/rest/v1/rpc/browse_public_companions_v3',{
    method:'POST',headers:{'apikey':authConfig.publishableKey,'Content-Type':'application/json'},
    body:JSON.stringify({p_offset:0,p_limit:8,p_sort:'newest'}),signal:controller.signal,
    cache:'no-store'
   });
  }finally{clearTimeout(timer)}
  if(!result.ok)return asset;
  const rows=await result.json();
  const html=await asset.text();
  const output=addPreviewToDirectory(html,rows);
  const headers=new Headers(asset.headers);
  headers.delete('content-length');headers.delete('content-encoding');headers.delete('etag');
  headers.set('cache-control','no-store');headers.set('content-type','text/html; charset=utf-8');
  return new Response(output,{status:asset.status,headers});
 }catch{return asset} // Fail open to the normal static directory on network timeout.
}
