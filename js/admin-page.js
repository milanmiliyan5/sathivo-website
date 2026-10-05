import {authConfig} from './auth-config.js?v=20260926-1';

const $=id=>document.getElementById(id);
let client,user,profiles=[],bookings=[],supports=[],reports=[],listings=[],metricsTimer,presenceChannel;
const nf=new Intl.NumberFormat('en-IN');
const fmt=d=>d?new Intl.DateTimeFormat('en-IN',{dateStyle:'medium'}).format(new Date(d)):'—';
const fmtDateTime=d=>d?new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(d)):'—';

function node(tag,text,className){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n}
function td(label,content){const cell=node('td');cell.dataset.label=label;if(content instanceof Node)cell.append(content);else cell.textContent=content??'—';return cell}
function pill(status){const n=node('span',status||'unknown','status-pill');n.dataset.status=String(status||'').toLowerCase();return n}
function emptyRow(cols,text){const tr=node('tr',undefined,'empty-row'),cell=node('td',text);cell.colSpan=cols;tr.append(cell);return tr}
function metric(id,value){const n=$(id);if(n)n.textContent=nf.format(Number(value||0))}
function setStatus(message){$('status').textContent=message||''}
function value(id){return $(id)?.value??'all'}
function includesAny(values,q){return values.some(v=>String(v??'').toLowerCase().includes(q))}
function setRefreshing(on){const b=$('refresh-dashboard');if(!b)return;b.classList.toggle('is-loading',on);b.textContent=on?'↻ Refreshing…':'↻ Refresh'}

async function loadStats(){
  const {data,error}=await client.functions.invoke('admin-dashboard-stats');
  if(error){$('metrics-updated').textContent='Dashboard refresh failed';return}
  const row=Array.isArray(data)?data[0]:data;
  if(!row)return;
  metric('metric-accounts',row.total_accounts);
  metric('metric-today-bookings',row.bookings_today);
  metric('metric-total-bookings',row.total_bookings);
  metric('metric-visitors-today',row.visitors_today);
  metric('metric-total-visitors',row.total_visitors);
  metric('metric-male',row.male_users);
  metric('metric-female',row.female_users);
  metric('metric-pending',row.pending_bookings);
  metric('metric-accepted',row.accepted_bookings);
  metric('metric-completed',row.completed_bookings);
  metric('metric-cancelled',row.cancelled_bookings);
  metric('metric-published-companions',row.published_companions);
  metric('metric-open-reports',row.open_reports);
  $('gender-note').textContent=nf.format(Number(row.gender_other_or_unset||0))+' account'+(Number(row.gender_other_or_unset||0)===1?'':'s')+' have Other / Prefer not to say / no gender selected. Open support: '+nf.format(Number(row.open_support||0))+'. Declined bookings: '+nf.format(Number(row.declined_bookings||0))+'.';
  $('metrics-updated').textContent='Updated '+new Intl.DateTimeFormat('en-IN',{hour:'numeric',minute:'2-digit',second:'2-digit'}).format(new Date())+' · auto refresh 10 sec';
}

function updateOnline(){if(!presenceChannel)return;metric('metric-online',Object.keys(presenceChannel.presenceState()||{}).length)}
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
  if(!error)await refreshAll(false);
}
async function setReport(id,status){
  const {error}=await client.from('user_reports').update({status}).eq('id',id);
  setStatus(error?error.message:'Report updated.');
  if(!error)await refreshAll(false);
}
async function setListing(userId,status){
  const note=status==='suspended'?(prompt('Moderation note (optional)')||''):null;
  const {error}=await client.from('companion_listings').update({moderation_status:status,moderation_note:note}).eq('user_id',userId);
  setStatus(error?error.message:'Listing updated.');
  if(!error)await refreshAll(false);
}

function userRow(p){
  const tr=node('tr'),who=node('div',undefined,'user-cell');
  who.append(node('strong',p.display_name||'Unnamed member'),node('small',p.profile_kind||'member'));
  const sid=node('code',p.safety_id||'No Safety ID','safety-code');
  const type=node('span',p.profile_kind||'member','gender-pill');
  const gender=p.gender==='male'?'Male':p.gender==='female'?'Female':p.gender==='other'?'Other':p.gender==='prefer_not_to_say'?'Prefer not to say':'Not set';
  const email=node('div',undefined,'primary-cell');
  email.append(node('strong',p.email_verified_at?'Verified':'Not verified'),node('small',p.email_verified_at?'Email verified':'Verification pending'));
  tr.append(td('User',who),td('Safety ID',sid),td('Type',type),td('Gender',gender),td('Email',email),td('Joined',fmt(p.joined_at)),td('Internal ID',node('span',p.user_id,'mono-id')));
  return tr;
}
function renderUsers(){
  const q=$('user-search').value.trim().toLowerCase(),gender=value('user-gender-filter'),type=value('user-type-filter');
  const rows=profiles.filter(p=>{
    const qOk=!q||includesAny([p.display_name,p.safety_id,p.user_id,p.gender,p.profile_kind],q);
    const g=String(p.gender||'unset'),gOk=gender==='all'||g===gender;
    const tOk=type==='all'||p.profile_kind===type;
    return qOk&&gOk&&tOk;
  });
  $('users').replaceChildren(...(rows.length?rows.map(userRow):[emptyRow(7,'No matching users found.')]));
  $('user-count').textContent=rows.length+' of '+profiles.length+' profile'+(profiles.length===1?'':'s')+' shown.';
}

function bookingRow(b){
  const tr=node('tr');
  const customer=node('div',undefined,'primary-cell');customer.append(node('strong',b.customer_display_name||'Unnamed customer'),node('small',String(b.customer_id||'').slice(0,8)));
  const companion=node('div',undefined,'primary-cell');companion.append(node('strong',b.companion_display_name||'Unnamed companion'),node('small',String(b.companion_id||'').slice(0,8)));
  const service=node('div',undefined,'primary-cell');service.append(node('strong',b.category||'—'),node('small',(b.duration_minutes||60)+' min'));
  tr.append(
    td('Booking ID',node('span',b.id,'mono-id')),
    td('Customer',customer),
    td('Companion',companion),
    td('Service',service),
    td('Price',(()=>{const x=node('div',undefined,'primary-cell');if(b.listed_hourly_rate)x.append(node('strong','Listed ₹'+Number(b.listed_hourly_rate).toLocaleString('en-IN')+'/hr'));if(b.offered_hourly_rate)x.append(node('small','Offer ₹'+Number(b.offered_hourly_rate).toLocaleString('en-IN')+'/hr'));if(b.agreed_hourly_rate)x.append(node('small','Agreed ₹'+Number(b.agreed_hourly_rate).toLocaleString('en-IN')+'/hr'));if(!x.childNodes.length)x.append(node('span','Legacy booking'));return x})()),
    td('Mode',b.meeting_mode==='in-person'?'In person':'Online'),
    td('Requested For',fmtDateTime(b.requested_for)),
    td('Status',pill(b.status)),
    td('Created',fmtDateTime(b.created_at))
  );
  return tr;
}
function renderBookings(){
  const q=$('booking-search').value.trim().toLowerCase(),status=value('booking-status-filter'),mode=value('booking-mode-filter');
  const rows=bookings.filter(b=>{
    const qOk=!q||includesAny([b.id,b.customer_display_name,b.companion_display_name,b.customer_id,b.companion_id,b.category,b.meeting_mode,b.status],q);
    return qOk&&(status==='all'||b.status===status)&&(mode==='all'||b.meeting_mode===mode);
  });
  $('bookings').replaceChildren(...(rows.length?rows.map(bookingRow):[emptyRow(9,'No matching bookings found.')]));
  $('booking-count').textContent=rows.length+' of '+bookings.length+' loaded booking'+(bookings.length===1?'':'s')+' shown. Latest 500 are loaded.';
}

function supportRow(r){
  const tr=node('tr'),subject=node('div',undefined,'primary-cell');
  subject.append(node('strong',r.subject||'No subject'),node('small',String(r.message||'').slice(0,90)||'No message'));
  const actions=node('div',undefined,'action-group');
  for(const s of ['reviewed','resolved','closed']){const b=node('button',s,'admin-btn');b.type='button';b.onclick=()=>void setSupport(r.id,s);actions.append(b)}
  tr.append(td('Subject',subject),td('Category',r.category||'—'),td('Email',r.email||'—'),td('Date',fmtDateTime(r.created_at)),td('Status',pill(r.status)),td('Action',actions));
  return tr;
}
function renderSupport(){
  const q=$('support-search').value.trim().toLowerCase(),status=value('support-status-filter');
  const rows=supports.filter(r=>r.category!=='feedback'&&(!q||includesAny([r.subject,r.message,r.email,r.category,r.status],q))&&(status==='all'||r.status===status));
  $('support-requests').replaceChildren(...(rows.length?rows.map(supportRow):[emptyRow(6,'No matching support requests.')]));
  const total=supports.filter(r=>r.category!=='feedback').length;
  $('support-count').textContent=rows.length+' of '+total+' support request'+(total===1?'':'s')+' shown.';
}

function feedbackRow(r){
  const tr=node('tr'),copy=node('div',undefined,'primary-cell');
  copy.append(node('strong',r.subject||'Feedback'),node('small',String(r.message||'').slice(0,120)||'No message'));
  const stars=r.rating?('★'.repeat(Number(r.rating))+'☆'.repeat(5-Number(r.rating))):'—';
  const actions=node('div',undefined,'action-group');
  for(const s of ['reviewed','resolved','closed']){const b=node('button',s,'admin-btn');b.type='button';b.onclick=()=>void setSupport(r.id,s);actions.append(b)}
  const type=String(r.feedback_type||'other').replaceAll('_',' ');
  tr.append(td('Rating',node('span',stars,'feedback-stars')),td('Type',type),td('Feedback',copy),td('Email',r.email||'—'),td('Date',fmtDateTime(r.created_at)),td('Status',pill(r.status)),td('Action',actions));
  return tr;
}
function renderFeedback(){
  const q=$('feedback-search').value.trim().toLowerCase(),status=value('feedback-status-filter'),rating=value('feedback-rating-filter');
  const all=supports.filter(r=>r.category==='feedback');
  const rows=all.filter(r=>{
    const qOk=!q||includesAny([r.subject,r.message,r.email,r.feedback_type,r.status,r.rating],q);
    const ratingOk=rating==='all'||(rating==='none'?!r.rating:String(r.rating)===rating);
    return qOk&&ratingOk&&(status==='all'||r.status===status);
  });
  $('feedback-requests').replaceChildren(...(rows.length?rows.map(feedbackRow):[emptyRow(7,'No matching feedback yet.')]));
  $('feedback-count').textContent=rows.length+' of '+all.length+' feedback item'+(all.length===1?'':'s')+' shown.';
  metric('metric-feedback',all.filter(r=>['open','reviewed'].includes(r.status)).length);
}

function reportRow(r){
  const tr=node('tr'),details=node('div',undefined,'primary-cell');
  details.append(node('strong',String(r.details||'No extra details.').slice(0,100)),node('small',r.booking_id?'Booking '+String(r.booking_id).slice(0,8):'No booking linked'));
  const actions=node('div',undefined,'action-group');
  for(const s of ['reviewed','actioned','dismissed']){const b=node('button',s,'admin-btn');b.type='button';b.onclick=()=>void setReport(r.id,s);actions.append(b)}
  tr.append(td('Reason',r.reason||'—'),td('Details',details),td('Date',fmtDateTime(r.created_at)),td('Status',pill(r.status)),td('Action',actions));
  return tr;
}
function renderReports(){
  const q=$('report-search').value.trim().toLowerCase(),status=value('report-status-filter');
  const rows=reports.filter(r=>(!q||includesAny([r.reason,r.details,r.status,r.booking_id,r.reporter_id,r.reported_user_id],q))&&(status==='all'||r.status===status));
  $('reports').replaceChildren(...(rows.length?rows.map(reportRow):[emptyRow(5,'No matching reports.')]));
  $('report-count').textContent=rows.length+' of '+reports.length+' report'+(reports.length===1?'':'s')+' shown.';
}

function listingRow(r){
  const tr=node('tr'),companion=node('div',undefined,'primary-cell');
  companion.append(node('strong',r.display_name||'Unnamed companion'),node('small',String(r.bio||'No bio').slice(0,90)));
  const actions=node('div',undefined,'action-group'),next=r.moderation_status==='active'?'suspended':'active';
  const b=node('button',r.moderation_status==='active'?'Suspend':'Restore','admin-btn'+(r.moderation_status==='active'?' danger':''));
  b.type='button';b.onclick=()=>void setListing(r.user_id,next);actions.append(b);
  tr.append(td('Companion',companion),td('Bio',String(r.bio||'—').slice(0,120)),td('Published',r.published?'Yes':'No'),td('Status',pill(r.moderation_status)),td('Action',actions));
  return tr;
}
function renderListings(){
  const q=$('listing-search').value.trim().toLowerCase(),status=value('listing-status-filter');
  const rows=listings.filter(r=>(!q||includesAny([r.display_name,r.bio,r.user_id,r.moderation_status],q))&&(status==='all'||r.moderation_status===status));
  $('listings').replaceChildren(...(rows.length?rows.map(listingRow):[emptyRow(5,'No matching companion listings.')]));
  $('listing-count').textContent=rows.length+' of '+listings.length+' listing'+(listings.length===1?'':'s')+' shown.';
}

function renderRecentActivity(){
  const items=[];
  for(const p of profiles)if(p.joined_at)items.push({kind:'USER',title:p.display_name||'New member',detail:'Joined as '+(p.profile_kind||'member'),at:p.joined_at});
  for(const b of bookings)if(b.created_at)items.push({kind:'BOOK',title:(b.customer_display_name||'Customer')+' → '+(b.companion_display_name||'Companion'),detail:(b.category||'Booking')+' · '+(b.status||'unknown'),at:b.created_at});
  for(const s of supports)if(s.created_at){if(s.category==='feedback')items.push({kind:'FEED',title:s.subject||'Feedback',detail:(s.rating?s.rating+'/5 · ':'')+(s.status||'open'),at:s.created_at});else items.push({kind:'HELP',title:s.subject||'Support request',detail:(s.category||'support')+' · '+(s.status||'unknown'),at:s.created_at});}
  for(const r of reports)if(r.created_at)items.push({kind:'SAFE',title:'Report: '+(r.reason||'other'),detail:r.status||'open',at:r.created_at});
  items.sort((a,b)=>new Date(b.at)-new Date(a.at));
  const top=items.slice(0,10);
  if(!top.length){$('recent-activity').replaceChildren(node('div','No recent activity yet.','activity-empty'));return}
  $('recent-activity').replaceChildren(...top.map(item=>{
    const row=node('article',undefined,'activity-item'),icon=node('div',item.kind,'activity-icon'),copy=node('div',undefined,'activity-copy');
    copy.append(node('strong',item.title),node('span',item.detail));
    row.append(icon,copy,node('time',fmtDateTime(item.at),'activity-time'));
    return row;
  }));
}

function renderAll(){renderUsers();renderBookings();renderSupport();renderFeedback();renderReports();renderListings();renderRecentActivity()}

async function load(){
  const [rr,ll,pp,ss,bb]=await Promise.all([
    client.from('user_reports').select('id,reporter_id,reported_user_id,booking_id,reason,details,status,created_at').order('created_at',{ascending:false}).limit(250),
    client.from('companion_listings').select('user_id,display_name,bio,published,moderation_status,moderation_note').order('display_name').limit(500),
    client.from('member_profiles').select('user_id,display_name,profile_kind,gender,safety_id,joined_at,email_verified_at').order('joined_at',{ascending:false}).limit(1000),
    client.from('support_requests').select('id,email,category,subject,message,status,rating,feedback_type,created_at').order('created_at',{ascending:false}).limit(500),
    client.from('booking_requests').select('id,customer_id,companion_id,category,meeting_mode,requested_for,duration_minutes,status,created_at,customer_display_name,companion_display_name,listed_hourly_rate,offered_hourly_rate,agreed_hourly_rate').order('created_at',{ascending:false}).limit(500)
  ]);
  const failure=[rr,ll,pp,ss,bb].find(x=>x.error);if(failure)throw failure.error;
  reports=rr.data||[];listings=ll.data||[];profiles=pp.data||[];supports=ss.data||[];bookings=bb.data||[];
  renderAll();$('admin-content').hidden=false;setStatus('');
}

function closeSidebar(){$('admin-sidebar').classList.remove('is-open');$('sidebar-backdrop').hidden=true;$('sidebar-toggle').setAttribute('aria-expanded','false')}
function initUi(){
  $('sidebar-toggle').addEventListener('click',()=>{const open=!$('admin-sidebar').classList.contains('is-open');$('admin-sidebar').classList.toggle('is-open',open);$('sidebar-backdrop').hidden=!open;$('sidebar-toggle').setAttribute('aria-expanded',String(open))});
  $('sidebar-backdrop').addEventListener('click',closeSidebar);
  document.querySelectorAll('.sidebar-link').forEach(a=>a.addEventListener('click',()=>{document.querySelectorAll('.sidebar-link').forEach(x=>x.classList.remove('is-active'));a.classList.add('is-active');closeSidebar()}));
  const renderBindings=[
    ['user-search','input',renderUsers],['user-gender-filter','change',renderUsers],['user-type-filter','change',renderUsers],
    ['booking-search','input',renderBookings],['booking-status-filter','change',renderBookings],['booking-mode-filter','change',renderBookings],
    ['support-search','input',renderSupport],['support-status-filter','change',renderSupport],
    ['feedback-search','input',renderFeedback],['feedback-rating-filter','change',renderFeedback],['feedback-status-filter','change',renderFeedback],
    ['report-search','input',renderReports],['report-status-filter','change',renderReports],
    ['listing-search','input',renderListings],['listing-status-filter','change',renderListings]
  ];
  for(const [id,event,fn] of renderBindings)$(id).addEventListener(event,fn);
}

async function refreshAll(showLoading=true){
  if(showLoading)setRefreshing(true);
  try{await Promise.all([load(),loadStats()])}catch(e){setStatus(e.message||'Could not refresh admin data.')}finally{if(showLoading)setRefreshing(false)}
}

async function init(){
  initUi();
  try{
    if(!globalThis.supabase)throw Error('Services unavailable');
    client=globalThis.supabase.createClient(authConfig.supabaseUrl,authConfig.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'sathivo.auth.v1'}});
    const u=await client.auth.getUser();user=u.data.user;
    if(!user){location.replace('account.html#login');return}
    const a=await client.from('platform_admins').select('role').eq('user_id',user.id).maybeSingle();
    if(a.error||!a.data)throw Error('This account is not authorized for Sathivo admin.');
    $('admin-email').textContent=user.email||a.data.role||'Authorized admin';
    $('refresh-dashboard').addEventListener('click',()=>void refreshAll(true));
    $('admin-logout').addEventListener('click',async()=>{await client.auth.signOut();location.replace('account.html#login')});
    await refreshAll(true);startPresence();
    metricsTimer=setInterval(()=>{if(document.visibilityState==='visible')void loadStats()},10000);
  }catch(e){setStatus(e.message||'Could not load admin.')}
}
window.addEventListener('pagehide',()=>{if(metricsTimer)clearInterval(metricsTimer);if(presenceChannel&&client)void client.removeChannel(presenceChannel)},{once:true});
void init();
