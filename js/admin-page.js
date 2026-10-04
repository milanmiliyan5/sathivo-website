import {authConfig} from './auth-config.js?v=20260926-1';
const $=id=>document.getElementById(id);
let client,user,profiles=[],metricsTimer,presenceChannel;
const nf=new Intl.NumberFormat('en-IN');
const el=(t,x,c)=>{const n=document.createElement(t);if(x!==undefined)n.textContent=x;if(c)n.className=c;return n};
const fmt=d=>d?new Intl.DateTimeFormat('en-IN',{dateStyle:'medium'}).format(new Date(d)):'—';

function metric(id,value){const n=$(id);if(n)n.textContent=nf.format(Number(value||0))}
async function loadStats(){
  const {data,error}=await client.functions.invoke('admin-dashboard-stats');
  if(error){$('metrics-updated').textContent='Dashboard refresh failed';return}
  const row=Array.isArray(data)?data[0]:data;
  if(!row)return;
  metric('metric-accounts',row.total_accounts);
  metric('metric-today-bookings',row.bookings_today);
  metric('metric-total-bookings',row.total_bookings);
  metric('metric-male',row.male_users);
  metric('metric-female',row.female_users);
  $('gender-note').textContent=nf.format(Number(row.gender_other_or_unset||0))+' account'+(Number(row.gender_other_or_unset||0)===1?'':'s')+' have Other / Prefer not to say / no gender selected yet.';
  $('metrics-updated').textContent='Updated '+new Intl.DateTimeFormat('en-IN',{hour:'numeric',minute:'2-digit',second:'2-digit'}).format(new Date())+' · every 10 sec';
}
function updateOnline(){
  if(!presenceChannel)return;
  const state=presenceChannel.presenceState();
  metric('metric-online',Object.keys(state||{}).length);
}
function startPresence(){
  presenceChannel=client.channel('site-presence-v1')
    .on('presence',{event:'sync'},updateOnline)
    .on('presence',{event:'join'},updateOnline)
    .on('presence',{event:'leave'},updateOnline)
    .subscribe(status=>{if(status==='SUBSCRIBED')updateOnline()});
}
async function setSupport(id,status){
  const {error}=await client.from('support_requests').update({status}).eq('id',id);
  $('status').textContent=error?error.message:'Support request updated.';
  if(!error)await load();
}
function supportCard(r){
  const n=el('article',undefined,'booking-card');
  const top=el('div',undefined,'booking-top');
  top.append(el('h3',r.subject),el('span',r.status,'status-pill'));
  n.append(top,el('p',r.category+' · '+r.email+' · '+fmt(r.created_at),'booking-note'),el('p',r.message,'booking-note'));
  const a=el('div',undefined,'admin-actions');
  for(const s of ['reviewed','resolved','closed']){const b=el('button',s,'button button-outline');b.onclick=()=>void setSupport(r.id,s);a.append(b)}
  n.append(a);return n;
}
async function setReport(id,status){
  const {error}=await client.from('user_reports').update({status}).eq('id',id);
  $('status').textContent=error?error.message:'Report updated.';
  if(!error)await load();
}
async function setListing(userId,status){
  const note=status==='suspended'?(prompt('Moderation note (optional)')||''):null;
  const {error}=await client.from('companion_listings').update({moderation_status:status,moderation_note:note}).eq('user_id',userId);
  $('status').textContent=error?error.message:'Listing updated.';
  if(!error)await load();
}
function reportCard(r){
  const n=el('article',undefined,'booking-card');
  n.append(el('h3',r.reason),el('p',r.details||'No extra details.','booking-note'),el('span',r.status,'status-pill'));
  const a=el('div',undefined,'admin-actions');
  for(const s of ['reviewed','actioned','dismissed']){
    const b=el('button',s,'button button-outline');b.onclick=()=>void setReport(r.id,s);a.append(b)
  }
  n.append(a);return n;
}
function listingCard(r){
  const n=el('article',undefined,'booking-card');
  n.append(el('h3',r.display_name),el('p',r.bio,'booking-note'),el('span',r.moderation_status,'status-pill'));
  const a=el('div',undefined,'admin-actions'),s=el('button',r.moderation_status==='active'?'Suspend':'Restore','button button-outline');
  s.onclick=()=>void setListing(r.user_id,r.moderation_status==='active'?'suspended':'active');a.append(s);n.append(a);return n;
}
function userCard(p){
  const n=el('article',undefined,'booking-card admin-user-card'),top=el('div',undefined,'booking-top');
  top.append(el('h3',p.display_name||'Unnamed member'),el('code',p.safety_id||'No Safety ID','safety-code'));
  n.append(top,el('p','Internal ID: '+p.user_id,'booking-note'));
  const meta=el('div',undefined,'booking-meta');
  const gender=p.gender==='male'?'Male':p.gender==='female'?'Female':p.gender==='other'?'Other':p.gender==='prefer_not_to_say'?'Prefer not to say':'Gender not set';
  meta.append(el('span',p.profile_kind||'member'),el('span',gender),el('span',p.email_verified_at?'Email verified':'Email not verified'),el('span','Joined '+fmt(p.joined_at)));
  n.append(meta);return n;
}
function renderUsers(){
  const q=$('user-search').value.trim().toLowerCase();
  const rows=!q?profiles:profiles.filter(p=>[p.display_name,p.safety_id,p.user_id,p.gender].some(v=>String(v||'').toLowerCase().includes(q)));
  $('users').replaceChildren(...rows.map(userCard));
  $('user-count').textContent=rows.length+' user'+(rows.length===1?'':'s')+' shown.';
}
async function load(){
  const [rr,ll,pp,ss]=await Promise.all([
    client.from('user_reports').select('*').order('created_at',{ascending:false}),
    client.from('companion_listings').select('user_id,display_name,bio,published,moderation_status,moderation_note').order('display_name'),
    client.from('member_profiles').select('user_id,display_name,profile_kind,gender,safety_id,joined_at,email_verified_at').order('display_name'),
    client.from('support_requests').select('id,email,category,subject,message,status,created_at').order('created_at',{ascending:false}).limit(100)
  ]);
  if(rr.error||ll.error||pp.error||ss.error)throw rr.error||ll.error||pp.error||ss.error;
  profiles=pp.data||[];
  $('support-requests').replaceChildren(...(ss.data||[]).map(supportCard));
  $('reports').replaceChildren(...(rr.data||[]).map(reportCard));
  $('listings').replaceChildren(...(ll.data||[]).map(listingCard));
  renderUsers();$('admin-content').hidden=false;$('status').textContent='';
}
async function init(){
  try{
    if(!globalThis.supabase)throw Error('Services unavailable');
    client=globalThis.supabase.createClient(authConfig.supabaseUrl,authConfig.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'sathivo.auth.v1'}});
    const u=await client.auth.getUser();user=u.data.user;
    if(!user){location.replace('account.html#login');return}
    const a=await client.from('platform_admins').select('role').eq('user_id',user.id).maybeSingle();
    if(a.error||!a.data)throw Error('This account is not authorized for Sathivo admin.');
    $('user-search').addEventListener('input',renderUsers);
    await Promise.all([load(),loadStats()]);
    startPresence();
    metricsTimer=setInterval(()=>{if(document.visibilityState==='visible')void loadStats()},10000);
  }catch(e){$('status').textContent=e.message||'Could not load admin.'}
}
window.addEventListener('pagehide',()=>{
  if(metricsTimer)clearInterval(metricsTimer);
  if(presenceChannel&&client)void client.removeChannel(presenceChannel);
},{once:true});
void init();
