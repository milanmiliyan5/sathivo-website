import {updateSidebarBadges,sidebarBadgeSections,sidebarReadAcknowledgements,safeBadgeCount} from './admin-sidebar-badges.js?v=20261122-manual-refresh-1';
import {refreshContributions} from './admin-contributions.js?v=20261122-manual-refresh-1';
import {initMaintenance} from './admin-maintenance.js?v=20261122-manual-refresh-1';
import {runRecovery} from './booking-recovery.js?v=20261116-1';
import {getSathivoClient} from './supabase-client.js?v=20261025-polish-1';
import {todayAccounts} from './admin-account-date.js?v=20261115-1';
const $=id=>document.getElementById(id);
let client,user,profiles=[],bookings=[],supports=[],reports=[],listings=[],presenceChannel;
let registeredUsersAvailable=false,accountRequest=null;
const nf=new Intl.NumberFormat('en-IN');
const fmt=d=>d?new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeZone:'Asia/Kolkata'}).format(new Date(d)):'—';
const fmtDateTime=d=>d?new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(d)):'—';

function node(tag,text,className){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n}
function td(label,content){const cell=node('td');cell.dataset.label=label;if(content instanceof Node)cell.append(content);else cell.textContent=content??'—';return cell}
function pill(status){const n=node('span',status||'unknown','status-pill');n.dataset.status=String(status||'').toLowerCase();return n}
function emptyRow(cols,text){const tr=node('tr',undefined,'empty-row'),cell=node('td',text);cell.colSpan=cols;tr.append(cell);return tr}
function metric(id,value){const n=$(id);if(n)n.textContent=nf.format(Number(value||0))}
function setStatus(message){$('status').textContent=message||''}
function value(id){return $(id)?.value??'all'}
function includesAny(values,q){return values.some(v=>String(v??'').toLowerCase().includes(q))}
function setRefreshing(on){const b=$('refresh-dashboard');if(!b)return;b.classList.toggle('is-loading',on);b.disabled=on;b.textContent=on?'↻ Refreshing all…':'↻ Refresh All'}

let badgeRequest=null,badgeSnapshot=null,badgeCounts=null;
const acknowledgingSections=new Set();
async function refreshSidebarBadges(){
 if(!client||!user)return null;
 if(badgeRequest)return badgeRequest;
 badgeRequest=(async()=>{
   const {data,error}=await client.rpc('sathivo_admin_sidebar_badges');
   if(error)throw error;
   if(!data||typeof data!=='object'||!data.snapshot)throw Error('Invalid sidebar badge response');
   badgeSnapshot=data.snapshot;
   badgeCounts=data;
   updateSidebarBadges(document,data);
   return data;
 })().catch(e=>{
   console.warn('Admin activity badges unavailable:',e?.message||'Connection problem');
   return null;
 }).finally(()=>{badgeRequest=null;});
 return badgeRequest;
}
// Navigation never reloads all tables. Only acknowledge items already in a successful
// initial/manual snapshot; no new records are hidden without first being loaded.
async function onSidebarSectionSelected(section){
  const key=sidebarBadgeSections[section];
  if(!key||!sidebarReadAcknowledgements.includes(key)||!client||!user||!badgeSnapshot)return;
  if(acknowledgingSections.has(key)||!safeBadgeCount(badgeCounts?.[key]))return;
  if(key==='users'&&!registeredUsersAvailable)return;
  if(key==='contributions'&&$('contribution-admin-status').textContent.includes('unavailable'))return;
  acknowledgingSections.add(key);
  try{
    const {error}=await client.rpc('sathivo_admin_mark_sidebar_seen',{
      p_section:key,p_seen_through:badgeSnapshot,
    });
    if(error)throw error;
    // The next manual refresh will fetch counts again. Clear only the acknowledged
    // badge in this browser; preserve other sections and newly arriving records.
    badgeCounts={...badgeCounts,[key]:0};
    updateSidebarBadges(document,badgeCounts);
  }catch(e){console.warn('Could not acknowledge new '+key+' items:',e?.message||'Connection problem')}
  finally{acknowledgingSections.delete(key)}
}

let statsRequest=null;
function loadStats(){
 if(!statsRequest)statsRequest=fetchStats().finally(()=>{statsRequest=null});
 return statsRequest;
}
async function fetchStats(){
  const {data,error}=await client.functions.invoke('admin-dashboard-stats');
  if(error){$('metrics-updated').textContent='Dashboard refresh failed';throw error}
  const row=Array.isArray(data)?data[0]:data;
  if(!row)throw Error('Dashboard statistics unavailable');
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
  $('metrics-updated').textContent='Updated '+new Intl.DateTimeFormat('en-IN',{hour:'numeric',minute:'2-digit',second:'2-digit'}).format(new Date())+' · Manual refresh';
}

// The presence connection stays subscribed for accurate counts; the displayed
// snapshot updates on first connection and when the owner presses Refresh only.
function updateOnline(){if(!presenceChannel)return;metric('metric-online',Object.keys(presenceChannel.presenceState()||{}).length)}
function startPresence(){
  let initialSnapshotShown=false;
  $('metric-online').textContent='—';
  presenceChannel=client.channel('site-presence-v1')
    .on('presence',{event:'sync'},()=>{
      if(!initialSnapshotShown){initialSnapshotShown=true;updateOnline();}
    })
    .subscribe(status=>{
      if(status==='SUBSCRIBED'&&!initialSnapshotShown)updateOnline();
      else if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status))$('metric-online').textContent='—';
    });
}

async function setSupport(id,status){
  const {error}=await client.from('support_requests').update({status}).eq('id',id);
  setStatus(error?error.message:'Support request updated.');
  if(!error){
    const row=supports.find(r=>r.id===id);
    if(row)row.status=status;
    renderSupport();renderFeedback();renderRecentActivity();
    setStatus('Support status saved. Use Refresh for updated dashboard totals.');
  }
}
async function setReport(id,status){
  const {error}=await client.from('user_reports').update({status}).eq('id',id);
  setStatus(error?error.message:'Report updated.');
  if(!error){
    const row=reports.find(r=>r.id===id);
    if(row)row.status=status;
    renderReports();renderRecentActivity();
    setStatus('Report status saved. Use Refresh for updated dashboard totals.');
  }
}
async function setListing(userId,status){
  const note=status==='suspended'?(prompt('Moderation note (optional)')||''):null;
  const {error}=await client.from('companion_listings').update({moderation_status:status,moderation_note:note}).eq('user_id',userId);
  setStatus(error?error.message:'Listing updated.');
  if(!error){
    const row=listings.find(r=>r.user_id===userId);
    if(row){row.moderation_status=status;row.moderation_note=note;}
    renderListings();
    setStatus('Listing status saved. Use Refresh for updated dashboard totals.');
  }
}

function userRow(p){
  const tr=node('tr'),who=node('div',undefined,'user-cell');
  who.append(node('strong',p.display_name||'Unnamed member'),node('small',p.has_profile ? (p.profile_kind||'member') : 'Profile incomplete'));
  const sid=node('code',p.safety_id||'No Safety ID','safety-code');
  const type=node('span',p.has_profile ? (p.profile_kind||'member') : 'Signup only','gender-pill');
  const gender=p.gender==='male'?'Male':p.gender==='female'?'Female':p.gender==='other'?'Other':p.gender==='prefer_not_to_say'?'Prefer not to say':'Not set';
  const email=node('div',undefined,'primary-cell');
  email.append(node('strong',p.email_verified_at?'Verified':'Not verified'),node('small',p.email_verified_at?'Email verified':'Verification pending'));
  tr.append(td('User',who),td('Safety ID',sid),td('Type',type),td('Gender',gender),td('Email',email),td('Joined',fmt(p.joined_at)),td('Internal ID',node('span',p.user_id,'mono-id')));
  return tr;
}
function renderUsers(){
  const dateFilter=value('user-date-filter');
  const todays=registeredUsersAvailable?todayAccounts(profiles):null;
  if(todays===null)$('metric-accounts-today').textContent='—';
  else metric('metric-accounts-today',todays.length);
  if(dateFilter==='today'&&todays===null){
    $('users').replaceChildren(emptyRow(7,'Today’s registered accounts are temporarily unavailable. Refresh to try again.'));
    $('user-count').textContent='Daily signup count unavailable.';
    return;
  }
  const source=dateFilter==='today'?todays:profiles;
  const q=$('user-search').value.trim().toLowerCase(),gender=value('user-gender-filter'),type=value('user-type-filter');
  const rows=source.filter(p=>{
    const qOk=!q||includesAny([p.display_name,p.safety_id,p.user_id,p.gender,p.profile_kind],q);
    const g=String(p.gender||'unset'),gOk=gender==='all'||g===gender;
    const tOk=type==='all'||p.profile_kind===type;
    return qOk&&gOk&&tOk;
  });
  $('users').replaceChildren(...(rows.length?rows.map(userRow):[emptyRow(7,'No matching users found.')]));
  $('user-count').textContent=rows.length+' of '+source.length+' registered account'+(source.length===1?'':'s')+(dateFilter==='today'?' today (IST)':'')+' shown. '+source.filter(p=>!p.has_profile).length+' incomplete profile(s).';
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
    td('Status',(()=>{const x=node('div',undefined,'primary-cell');x.append(pill(b.status));if(b.status==='completed'){const reopen=node('button','Reopen booking','admin-btn');reopen.type='button';reopen.onclick=()=>void adminReopen(b,reopen);x.append(reopen);}if(b.status==='cancelled'&&b.cancel_reason)x.append(node('small','Reason: '+String(b.cancel_reason).replaceAll('_',' ')+(b.cancel_note?' · '+b.cancel_note:'')));return x})()),
    td('Created',fmtDateTime(b.created_at))
  );
  return tr;
}
async function adminReopen(b,button){
 const reason=window.prompt('Reason for correcting this completed booking (5–500 characters):');
 if(!reason||reason.trim().length<5||reason.trim().length>500)return;
 if(!window.confirm('Reopen this booking? Both participants will be notified, and your action will be logged.'))return;
 button.disabled=true;
 try{await runRecovery(client,b.id,'admin_reopen',reason.trim());setStatus('Booking reopened. Admin action recorded. Press Refresh to reload booking details.');}
 catch(e){setStatus(e.message||'Could not reopen booking.');}
 finally{button.disabled=false;}
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

// Initial load and explicit refresh share the authorized full signup API.
function fetchRegisteredUsers(){
  if(!accountRequest)accountRequest=Promise.resolve().then(()=>client.functions.invoke('admin-users-list')).catch(error=>({data:null,error})).finally(()=>{accountRequest=null});
  return accountRequest;
}
async function load(){
  const [rr,ll,pp,ss,bb]=await Promise.all([
    client.from('user_reports').select('id,reporter_id,reported_user_id,booking_id,reason,details,status,created_at').order('created_at',{ascending:false}).limit(250),
    client.from('companion_listings').select('user_id,display_name,bio,published,moderation_status,moderation_note').order('display_name').limit(500),
    fetchRegisteredUsers(),
    client.from('support_requests').select('id,email,category,subject,message,status,rating,feedback_type,created_at').order('created_at',{ascending:false}).limit(500),
    client.from('booking_requests').select('id,customer_id,companion_id,category,meeting_mode,requested_for,duration_minutes,status,created_at,customer_display_name,companion_display_name,listed_hourly_rate,offered_hourly_rate,agreed_hourly_rate,cancel_reason,cancel_note,cancelled_by,cancelled_at').order('created_at',{ascending:false}).limit(500)
  ]);
  const failure=[rr,ll,ss,bb].find(x=>x.error);if(failure)throw failure.error;
  let users=!pp.error&&Array.isArray(pp.data?.users)?pp.data.users:null;
  registeredUsersAvailable=users!==null;
  if(!users){
    const fallback=await client.from('member_profiles')
      .select('user_id,display_name,profile_kind,gender,safety_id,joined_at,email_verified_at')
      .order('joined_at',{ascending:false}).limit(1000);
    if(fallback.error)throw fallback.error;
    users=(fallback.data||[]).map(p=>({...p,has_profile:true}));
    setStatus('Some new signups may be missing. Account list is temporarily using saved profiles.');
  }else setStatus('');
  reports=rr.data||[];listings=ll.data||[];profiles=users;supports=ss.data||[];bookings=bb.data||[];
  renderAll();$('admin-content').hidden=false;
}

function closeSidebar(){$('admin-sidebar').classList.remove('is-open');$('sidebar-backdrop').hidden=true;$('sidebar-toggle').setAttribute('aria-expanded','false')}
function initUi(){
  // Bind sign-out before authorization checks so a user without admin access
  // can always leave the current session and sign in with the owner account.
  $('admin-logout').addEventListener('click',async()=>{
    const button=$('admin-logout');
    if(button.disabled)return;
    button.disabled=true;
    button.textContent='Signing out…';
    setStatus('Signing out…');
    try{
      const authClient=client||await getSathivoClient();
      const {error}=await authClient.auth.signOut();
      if(error)throw error;
      location.replace('account.html#login');
    }catch(e){
      setStatus('Could not sign out: '+(e?.message||'Please try again.'));
      button.textContent='Log out';
      button.disabled=false;
    }
  });
  $('sidebar-toggle').addEventListener('click',()=>{const open=!$('admin-sidebar').classList.contains('is-open');$('admin-sidebar').classList.toggle('is-open',open);$('sidebar-backdrop').hidden=!open;$('sidebar-toggle').setAttribute('aria-expanded',String(open))});
  $('sidebar-backdrop').addEventListener('click',closeSidebar);
  document.querySelectorAll('.sidebar-link').forEach(a=>a.addEventListener('click',()=>{document.querySelectorAll('.sidebar-link').forEach(x=>x.classList.remove('is-active'));a.classList.add('is-active');closeSidebar();void onSidebarSectionSelected(a.dataset.section)}));
  $('today-accounts-card').addEventListener('click',()=>{
    $('user-search').value='';
    $('user-gender-filter').value='all';
    $('user-type-filter').value='all';
    $('user-date-filter').value='today';
    renderUsers();
    const usersLink=document.querySelector('.sidebar-link[data-section="users-section"]');
    if(usersLink)usersLink.click();
    else location.hash='users-section';

  });
  const renderBindings=[
    ['user-date-filter','change',renderUsers],['user-search','input',renderUsers],['user-gender-filter','change',renderUsers],['user-type-filter','change',renderUsers],
    ['booking-search','input',renderBookings],['booking-status-filter','change',renderBookings],['booking-mode-filter','change',renderBookings],
    ['support-search','input',renderSupport],['support-status-filter','change',renderSupport],
    ['feedback-search','input',renderFeedback],['feedback-rating-filter','change',renderFeedback],['feedback-status-filter','change',renderFeedback],
    ['report-search','input',renderReports],['report-status-filter','change',renderReports],
    ['listing-search','input',renderListings],['listing-status-filter','change',renderListings]
  ];
  for(const [id,event,fn] of renderBindings)$(id).addEventListener(event,fn);
}

let dashboardRequest=null;
async function refreshAll(){
  // Coalesce double clicks and wait for *all* sections to finish.
  if(dashboardRequest)return dashboardRequest;
  setRefreshing(true);
  dashboardRequest=(async()=>{
    try{
      const [, , , badges]=await Promise.all([load(),loadStats(),refreshContributions(client),refreshSidebarBadges()]);
      updateOnline();
      if(!badges||$('contribution-admin-status').textContent.includes('unavailable')){
        setStatus('Some admin sections could not be refreshed. Try Refresh again.');
        return false;
      }
      if(!registeredUsersAvailable){
        setStatus('Other sections updated, but the complete signup list is temporarily unavailable.');
        return false;
      }
      setStatus('All admin sections updated. Use Refresh to load new activity.');
      return true;
    }catch(e){
      setStatus('Could not refresh all admin data: '+(e?.message||'Connection problem'));
      return false;
    }finally{
      setRefreshing(false);
      dashboardRequest=null;
    }
  })();
  return dashboardRequest;
}

async function init(){
  initUi();
  try{
    
    client=await getSathivoClient();
    const u=await client.auth.getUser();user=u.data.user;
    if(!user){location.replace('account.html#login');return}
    const a=await client.from('platform_admins').select('role').eq('user_id',user.id).maybeSingle();
    if(a.error)throw Error('Could not verify admin access. Try Refresh or log out and sign in again.');
    if(!a.data)throw Error('This account is not authorized for Sathivo admin. Log out and sign in with the owner account.');
    $('admin-email').textContent=user.email||a.data.role||'Authorized admin';
    $('refresh-dashboard').addEventListener('click',()=>void refreshAll());
    initMaintenance(client,user.id);
    await refreshAll();startPresence();
    const initialSection=location.hash.slice(1);
    if(initialSection&&sidebarBadgeSections[initialSection])void onSidebarSectionSelected(initialSection);
    window.addEventListener('hashchange',()=>{const section=location.hash.slice(1);if(sidebarBadgeSections[section])void onSidebarSectionSelected(section)});

  }catch(e){setStatus(e.message||'Could not load admin.')}
}
window.addEventListener('pagehide',event=>{

  if(!event.persisted&&presenceChannel&&client)void client.removeChannel(presenceChannel);
});
window.addEventListener('pageshow',event=>{
  if(!event.persisted||!presenceChannel)return;
  updateOnline();

});
void init();
