import {authConfig} from './auth-config.js?v=20260926-1';
import {sendBookingPush} from './push-events.js?v=20261004-1';
const $=id=>document.getElementById(id);let client,user,rows=[],filter='pending',channel;
const fmt=d=>new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(d));
const el=(t,x,c)=>{const n=document.createElement(t);if(x!==undefined)n.textContent=x;if(c)n.className=c;return n};
function visible(r){if(filter==='all')return true;if(filter==='closed')return ['declined','cancelled','completed'].includes(r.status);return r.status===filter}
function card(r){
 const n=el('article',undefined,'booking-card request-card');n.id='request-'+r.id;
 const top=el('div',undefined,'booking-top'),identity=el('div',undefined,'request-identity'),avatar=el('span',(r.customer_display_name||'S').trim().slice(0,1).toUpperCase(),'request-avatar'),left=el('div');
 left.append(el('h2',r.customer_display_name||'Sathivo member'),el('div',undefined,'booking-meta'));left.lastChild.append(el('span',r.category),el('span',r.meeting_mode==='in-person'?'In person':'Online'),el('span',fmt(r.requested_for)),el('span',r.duration_minutes+' min'));const price=el('div',undefined,'deal-box');if(r.listed_hourly_rate)price.append(el('span','Listed ₹'+Number(r.listed_hourly_rate).toLocaleString('en-IN')+'/hr'));if(r.offered_hourly_rate)price.append(el('strong','Customer offer ₹'+Number(r.offered_hourly_rate).toLocaleString('en-IN')+'/hr'));if(r.agreed_hourly_rate)price.append(el('strong','Agreed ₹'+Number(r.agreed_hourly_rate).toLocaleString('en-IN')+'/hr','deal-agreed'));left.append(price);identity.append(avatar,left);top.append(identity,el('span',r.status,'status-pill'));n.append(top);
 if(r.note)n.append(el('p',r.note,'booking-note'));
 const a=el('div',undefined,'booking-actions');
 if(r.status==='pending'){
  const accept=el('button',r.offered_hourly_rate?'Accept ₹'+Number(r.offered_hourly_rate).toLocaleString('en-IN')+'/hr':'Accept request','button button-primary'),decline=el('button','Decline request','button button-outline');
  accept.onclick=()=>{n.classList.add('request-accepting');accept.disabled=decline.disabled=true;void update(r.id,'accepted')};
  decline.onclick=()=>{if(confirm('Decline this booking request?')){accept.disabled=decline.disabled=true;void update(r.id,'declined')}};a.append(accept,decline);
 }else if(r.status==='accepted'){
  const chat=el('a','Open chat & photos ↗','button button-primary');chat.href='chat.html?booking='+encodeURIComponent(r.id);
  const done=el('button','Mark completed','button button-outline');done.onclick=()=>void update(r.id,'completed');a.append(chat,done);
 }
 if(a.childNodes.length)n.append(a);if(r.status==='accepted'&&r.agreed_hourly_rate)n.append(el('p','Deal recorded at ₹'+Number(r.agreed_hourly_rate).toLocaleString('en-IN')+'/hour. Coordinate details in chat. Payment stays outside Sathivo.','payment-note'));return n;
}
function render(){
 const list=rows.filter(visible);$('requests').replaceChildren(...list.map(card));$('empty').hidden=list.length>0;$('status').textContent=list.length?(String(list.length)+' request'+(list.length===1?'':'s')+' here.'):'';
 const id=new URL(location.href).searchParams.get('id');if(id){const target=document.getElementById('request-'+id);if(target){target.classList.add('request-highlight');setTimeout(()=>target.scrollIntoView({behavior:'smooth',block:'center'}),50)}}
}
async function load(){
 $('requests').replaceChildren(...Array.from({length:3},()=>{const n=el('article',undefined,'booking-card request-skeleton');n.innerHTML='<div class="request-identity"><span class="skeleton-dot"></span><div class="skeleton-lines"><i></i><i></i><i></i></div></div>';return n}));
 const {data,error}=await client.from('booking_requests').select('*').eq('companion_id',user.id).order('created_at',{ascending:false});if(error)throw error;rows=data||[];$('request-filters').hidden=false;render()
}
async function update(id,status){$('status').textContent=status==='accepted'?'Accepting request…':'Updating request…';const {error}=await client.from('booking_requests').update({status}).eq('id',id);if(error){$('status').textContent=error.message;return}$('status').textContent='Sending notification…';await sendBookingPush(client,id,status);if(status==='accepted'){location.href='chat.html?booking='+encodeURIComponent(id);return}await load()}
async function markLinkedNotification(){const id=new URL(location.href).searchParams.get('id');if(!id)return;await client.from('notifications').update({read_at:new Date().toISOString()}).eq('user_id',user.id).eq('link','requests.html?id='+id).is('read_at',null)}
async function init(){try{
 if(!globalThis.supabase)throw Error('Services unavailable');client=globalThis.supabase.createClient(authConfig.supabaseUrl,authConfig.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'sathivo.auth.v1'}});
 const u=await client.auth.getUser();user=u.data.user;if(!user){location.replace('account.html#login');return}
 document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));render()});
 await markLinkedNotification();await load();
 channel=client.channel('incoming-requests:'+user.id).on('postgres_changes',{event:'*',schema:'public',table:'booking_requests'},()=>void load()).subscribe();
 }catch(e){$('status').textContent=e.message||'Could not load requests.'}}
window.addEventListener('pagehide',()=>{if(channel)void client.removeChannel(channel)});void init();