import {authConfig} from './auth-config.js?v=20260926-1';
const $=id=>document.getElementById(id);
let client,user,messageChannel,bookingChannel;
const el=(t,x,c)=>{const n=document.createElement(t);if(x!==undefined)n.textContent=x;if(c)n.className=c;return n};
const fmt=d=>d?new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(d)):'';
function initials(name){return String(name||'S').trim().slice(0,1).toUpperCase()}
function card(r){
 const a=el('a',undefined,'chat-list-card');a.href='chat.html?booking='+encodeURIComponent(r.booking_id);
 const avatar=el('span',initials(r.other_display_name),'chat-list-avatar');
 const main=el('div',undefined,'chat-list-main'),top=el('div',undefined,'chat-list-top');
 top.append(el('strong',r.other_display_name||'Sathivo member'),el('time',fmt(r.last_message_at||r.requested_for)));
 const preview=el('p',r.last_message||'Chat is ready. Say hello 👋','chat-list-preview');
 if(r.last_message_type==='image')preview.classList.add('photo-preview');
 main.append(top,preview,el('small',r.category+' · '+r.booking_status,'chat-list-meta'));
 a.append(avatar,main);
 const unread=Number(r.unread_count||0);if(unread>0){const b=el('span',unread>99?'99+':String(unread),'chat-unread-count');a.append(b)}
 return a;
}
function skeletons(){
 return Array.from({length:4},()=>{const n=el('div',undefined,'chat-list-card skeleton-card');n.innerHTML='<span class="skeleton-dot"></span><div class="skeleton-lines"><i></i><i></i><i></i></div>';return n});
}
async function load(){
 $('empty').hidden=true;$('chats').replaceChildren(...skeletons());$('status').textContent='Loading chats…';
 const {data,error}=await client.rpc('get_chat_list');if(error)throw error;
 const rows=data||[];$('chats').replaceChildren(...rows.map(card));$('empty').hidden=rows.length>0;$('status').textContent=rows.length?rows.length+' chat'+(rows.length===1?'':'s'):'';
}
async function init(){try{
 if(!globalThis.supabase)throw Error('Services unavailable');
 client=globalThis.supabase.createClient(authConfig.supabaseUrl,authConfig.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'sathivo.auth.v1'}});
 const u=await client.auth.getUser();user=u.data.user;if(!user){location.replace('account.html#login');return}
 await load();
 messageChannel=client.channel('chats-inbox-messages:'+user.id).on('postgres_changes',{event:'*',schema:'public',table:'booking_messages'},()=>void load()).subscribe();
 bookingChannel=client.channel('chats-inbox-bookings:'+user.id).on('postgres_changes',{event:'*',schema:'public',table:'booking_requests'},()=>void load()).subscribe();
 }catch(e){$('status').textContent=e.message||'Could not load chats.';$('chats').replaceChildren()}}
window.addEventListener('pagehide',()=>{if(messageChannel)void client.removeChannel(messageChannel);if(bookingChannel)void client.removeChannel(bookingChannel)});
void init();