import {getSathivoClient} from './supabase-client.js?v=20261006-1';

const items=[
  ['Home','./','<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 10.5 12 3.6l8.5 6.9v9.1a1.4 1.4 0 0 1-1.4 1.4h-5.2v-6.1h-3.8V21H4.9a1.4 1.4 0 0 1-1.4-1.4z"/></svg>'],
  ['Explore','companions.html','<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 8.6c0 5-8.8 10.9-8.8 10.9S3.2 13.6 3.2 8.6A4.6 4.6 0 0 1 12 6.8a4.6 4.6 0 0 1 8.8 1.8Z"/></svg>'],
  ['Requests','requests.html','<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.8h8.1L20 8.7v10.6a1.7 1.7 0 0 1-1.7 1.7H7a1.7 1.7 0 0 1-1.7-1.7V5.5A1.7 1.7 0 0 1 7 3.8Z"/><path d="M14.7 3.9v5h5M8.6 13h6.8M8.6 16.4h4.6"/></svg>'],
  ['Chats','chats.html','<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.2h16v11.2a2 2 0 0 1-2 2H9l-4.8 2.7.8-4.7H4a2 2 0 0 1-2-2V7.2a2 2 0 0 1 2-2Z"/><path d="M7.2 10.5h9.6M7.2 13.7h6.4"/></svg>'],
  ['Account','account.html','<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.2" r="3.2"/><path d="M5.5 20c.6-3.5 3-5.5 6.5-5.5s5.9 2 6.5 5.5"/></svg>']
];

function badge(n){
  const b=document.createElement('span');
  b.className='mobile-nav-badge';
  b.hidden=!n;
  b.textContent=n>99?'99+':String(n||0);
  return b;
}

async function init(){
  const nav=document.createElement('nav');
  nav.className='mobile-bottom-nav';
  nav.setAttribute('aria-label','Primary mobile navigation');

  const path=location.pathname.split('/').pop()||'index.html',refs={};
  for(const [label,href,icon] of items){
    const a=document.createElement('a');
    a.href=href;
    if((href==='./'&&['','index.html'].includes(path))||path===href)a.setAttribute('aria-current','page');

    const iconWrap=document.createElement('span');
    iconWrap.className='mobile-nav-icon';
    iconWrap.innerHTML=icon;

    const t=document.createElement('small');
    t.textContent=label;
    a.append(iconWrap,t);

    if(label==='Requests'||label==='Chats'){
      const b=badge(0);
      a.append(b);
      refs[label]=b;
    }
    nav.append(a);
  }

  document.body.append(nav);

  try{
    const client=await getSathivoClient();
    const u=await client.auth.getUser(),user=u.data.user;
    if(!user)return;

    const refresh=async()=>{
      const [rq,cq]=await Promise.all([
        client.from('booking_requests').select('id',{count:'exact',head:true}).eq('companion_id',user.id).eq('status','pending'),
        client.rpc('get_unread_chat_count')
      ]);
      const rn=rq.error?0:(rq.count||0),cn=cq.error?0:Number(cq.data||0);
      refs.Requests.textContent=rn>99?'99+':String(rn);
      refs.Requests.hidden=rn===0;
      refs.Chats.textContent=cn>99?'99+':String(cn);
      refs.Chats.hidden=cn===0;
    };

    await refresh();
    const c1=client.channel('mobile-nav-bookings:'+user.id).on('postgres_changes',{event:'*',schema:'public',table:'booking_requests'},()=>void refresh()).subscribe();
    const c2=client.channel('mobile-nav-messages:'+user.id).on('postgres_changes',{event:'*',schema:'public',table:'booking_messages'},()=>void refresh()).subscribe();
    window.addEventListener('pagehide',()=>{void client.removeChannel(c1);void client.removeChannel(c2)},{once:true});
  }catch{}
}
void init();
