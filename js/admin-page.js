import {authConfig} from './auth-config.js?v=20260926-1';

const $=id=>document.getElementById(id);
let client,user,profiles=[],metricsTimer,presenceChannel;
const nf=new Intl.NumberFormat('en-IN');
const fmt=d=>d?new Intl.DateTimeFormat('en-IN',{dateStyle:'medium'}).format(new Date(d)):'—';

function node(tag,text,className){
  const n=document.createElement(tag);
  if(text!==undefined)n.textContent=text;
  if(className)n.className=className;
  return n;
}
function td(label,content){
  const cell=node('td');
  cell.dataset.label=label;
  if(content instanceof Node)cell.append(content);else cell.textContent=content??'—';
  return cell;
}
function pill(status){
  const n=node('span',status||'unknown','status-pill');
  n.dataset.status=String(status||'').toLowerCase();
  return n;
}
function emptyRow(cols,text){
  const tr=node('tr',undefined,'empty-row');
  const cell=node('td',text);
  cell.colSpan=cols;
  tr.append(cell);
  return tr;
}
function metric(id,value){
  const n=$(id);
  if(n)n.textContent=nf.format(Number(value||0));
}
function setStatus(message){
  $('status').textContent=message||'';
}
function setRefreshing(on){
  const b=$('refresh-dashboard');
  if(!b)return;
  b.classList.toggle('is-loading',on);
  b.textContent=on?'↻ Refreshing…':'↻ Refresh';
}
async function loadStats(){
  const {data,error}=await client.functions.invoke('admin-dashboard-stats');
  if(error){
    $('metrics-updated').textContent='Dashboard refresh failed';
    return;
  }
  const row=Array.isArray(data)?data[0]:data;
  if(!row)return;
  metric('metric-accounts',row.total_accounts);
  metric('metric-today-bookings',row.bookings_today);
  metric('metric-total-bookings',row.total_bookings);
  metric('metric-male',row.male_users);
  metric('metric-female',row.female_users);
  $('gender-note').textContent=nf.format(Number(row.gender_other_or_unset||0))+' account'+(Number(row.gender_other_or_unset||0)===1?'':'s')+' have Other / Prefer not to say / no gender selected.';
  $('metrics-updated').textContent='Updated '+new Intl.DateTimeFormat('en-IN',{hour:'numeric',minute:'2-digit',second:'2-digit'}).format(new Date())+' · auto refresh 10 sec';
}
function updateOnline(){
  if(!presenceChannel)return;
  metric('metric-online',Object.keys(presenceChannel.presenceState()||{}).length);
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
  setStatus(error?error.message:'Support request updated.');
  if(!error)await load();
}
async function setReport(id,status){
  const {error}=await client.from('user_reports').update({status}).eq('id',id);
  setStatus(error?error.message:'Report updated.');
  if(!error)await load();
}
async function setListing(userId,status){
  const note=status==='suspended'?(prompt('Moderation note (optional)')||''):null;
  const {error}=await client.from('companion_listings').update({moderation_status:status,moderation_note:note}).eq('user_id',userId);
  setStatus(error?error.message:'Listing updated.');
  if(!error)await load();
}
function userRow(p){
  const tr=node('tr');
  const who=node('div',undefined,'user-cell');
  who.append(node('strong',p.display_name||'Unnamed member'),node('small',p.profile_kind||'member'));

  const sid=node('code',p.safety_id||'No Safety ID','safety-code');
  const type=node('span',p.profile_kind||'member','gender-pill');
  const gender=p.gender==='male'?'Male':p.gender==='female'?'Female':p.gender==='other'?'Other':p.gender==='prefer_not_to_say'?'Prefer not to say':'Not set';
  const email=node('div',undefined,'primary-cell');
  email.append(node('strong',p.email_verified_at?'Verified':'Not verified'),node('small',p.email_verified_at?'Email verified':'Verification pending'));
  const internal=node('span',p.user_id,'mono-id');

  tr.append(
    td('User',who),
    td('Safety ID',sid),
    td('Type',type),
    td('Gender',gender),
    td('Email',email),
    td('Joined',fmt(p.joined_at)),
    td('Internal ID',internal)
  );
  return tr;
}
function renderUsers(){
  const q=$('user-search').value.trim().toLowerCase();
  const rows=!q?profiles:profiles.filter(p=>[p.display_name,p.safety_id,p.user_id,p.gender,p.profile_kind].some(v=>String(v||'').toLowerCase().includes(q)));
  const tbody=$('users');
  tbody.replaceChildren(...(rows.length?rows.map(userRow):[emptyRow(7,'No matching users found.')]));
  $('user-count').textContent=rows.length+' user'+(rows.length===1?'':'s')+' shown.';
}
function supportRow(r){
  const tr=node('tr');
  const subject=node('div',undefined,'primary-cell');
  subject.append(node('strong',r.subject||'No subject'),node('small',String(r.message||'').slice(0,90)||'No message'));
  const actions=node('div',undefined,'action-group');
  for(const s of ['reviewed','resolved','closed']){
    const b=node('button',s,'admin-btn');
    b.type='button';
    b.onclick=()=>void setSupport(r.id,s);
    actions.append(b);
  }
  tr.append(
    td('Subject',subject),
    td('Category',r.category||'—'),
    td('Email',r.email||'—'),
    td('Date',fmt(r.created_at)),
    td('Status',pill(r.status)),
    td('Action',actions)
  );
  return tr;
}
function reportRow(r){
  const tr=node('tr');
  const details=node('div',undefined,'primary-cell');
  details.append(node('strong',String(r.details||'No extra details.').slice(0,100)));
  const actions=node('div',undefined,'action-group');
  for(const s of ['reviewed','actioned','dismissed']){
    const b=node('button',s,'admin-btn');
    b.type='button';
    b.onclick=()=>void setReport(r.id,s);
    actions.append(b);
  }
  tr.append(
    td('Reason',r.reason||'—'),
    td('Details',details),
    td('Status',pill(r.status)),
    td('Action',actions)
  );
  return tr;
}
function listingRow(r){
  const tr=node('tr');
  const companion=node('div',undefined,'primary-cell');
  companion.append(node('strong',r.display_name||'Unnamed companion'),node('small',String(r.bio||'No bio').slice(0,90)));
  const actions=node('div',undefined,'action-group');
  const next=r.moderation_status==='active'?'suspended':'active';
  const b=node('button',r.moderation_status==='active'?'Suspend':'Restore','admin-btn'+(r.moderation_status==='active'?' danger':''));
  b.type='button';
  b.onclick=()=>void setListing(r.user_id,next);
  actions.append(b);
  tr.append(
    td('Companion',companion),
    td('Bio',String(r.bio||'—').slice(0,120)),
    td('Status',pill(r.moderation_status)),
    td('Action',actions)
  );
  return tr;
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
  $('support-requests').replaceChildren(...((ss.data||[]).length?(ss.data||[]).map(supportRow):[emptyRow(6,'No support requests.')]));
  $('reports').replaceChildren(...((rr.data||[]).length?(rr.data||[]).map(reportRow):[emptyRow(4,'No reports.')]));
  $('listings').replaceChildren(...((ll.data||[]).length?(ll.data||[]).map(listingRow):[emptyRow(4,'No companion listings.')]));
  renderUsers();
  $('admin-content').hidden=false;
  setStatus('');
}
function closeSidebar(){
  $('admin-sidebar').classList.remove('is-open');
  $('sidebar-backdrop').hidden=true;
  $('sidebar-toggle').setAttribute('aria-expanded','false');
}
function initUi(){
  $('sidebar-toggle').addEventListener('click',()=>{
    const open=!$('admin-sidebar').classList.contains('is-open');
    $('admin-sidebar').classList.toggle('is-open',open);
    $('sidebar-backdrop').hidden=!open;
    $('sidebar-toggle').setAttribute('aria-expanded',String(open));
  });
  $('sidebar-backdrop').addEventListener('click',closeSidebar);
  document.querySelectorAll('.sidebar-link').forEach(a=>a.addEventListener('click',()=>{
    document.querySelectorAll('.sidebar-link').forEach(x=>x.classList.remove('is-active'));
    a.classList.add('is-active');
    closeSidebar();
  }));
}
async function refreshAll(){
  setRefreshing(true);
  try{
    await Promise.all([load(),loadStats()]);
  }catch(e){
    setStatus(e.message||'Could not refresh admin data.');
  }finally{
    setRefreshing(false);
  }
}
async function init(){
  initUi();
  try{
    if(!globalThis.supabase)throw Error('Services unavailable');
    client=globalThis.supabase.createClient(authConfig.supabaseUrl,authConfig.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'sathivo.auth.v1'}});
    const u=await client.auth.getUser();
    user=u.data.user;
    if(!user){location.replace('account.html#login');return}
    const a=await client.from('platform_admins').select('role').eq('user_id',user.id).maybeSingle();
    if(a.error||!a.data)throw Error('This account is not authorized for Sathivo admin.');

    $('admin-email').textContent=user.email||a.data.role||'Authorized admin';
    $('user-search').addEventListener('input',renderUsers);
    $('refresh-dashboard').addEventListener('click',()=>void refreshAll());
    $('admin-logout').addEventListener('click',async()=>{
      await client.auth.signOut();
      location.replace('account.html#login');
    });

    await refreshAll();
    startPresence();
    metricsTimer=setInterval(()=>{if(document.visibilityState==='visible')void loadStats()},10000);
  }catch(e){
    setStatus(e.message||'Could not load admin.');
  }
}
window.addEventListener('pagehide',()=>{
  if(metricsTimer)clearInterval(metricsTimer);
  if(presenceChannel&&client)void client.removeChannel(presenceChannel);
},{once:true});

void init();
