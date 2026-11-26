export const PAGE_SIZE=100;
export const $=id=>document.getElementById(id);
export const el=(tag,content,cls)=>{const n=document.createElement(tag);if(content!==undefined)n.textContent=content;if(cls)n.className=cls;return n;};
export const formatTime=value=>new Intl.DateTimeFormat('en-IN',{hour:'numeric',minute:'2-digit'}).format(new Date(value));
export const formatDate=value=>new Intl.DateTimeFormat('en-IN',{dateStyle:'medium'}).format(new Date(value));
export async function getMessages(client,userId,before=null){
 let q=client.from('official_support_messages').select('id,user_id,sender,body,created_at,read_at').eq('user_id',userId).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(PAGE_SIZE+1);
 if(before)q=q.or('created_at.lt.'+before.created_at+',and(created_at.eq.'+before.created_at+',id.lt.'+before.id+')');
 const {data,error}=await q;if(error)throw error;return {rows:(data||[]).slice(0,PAGE_SIZE).reverse(),more:(data||[]).length>PAGE_SIZE};
}
export function mergeMessages(old,latest){const map=new Map(old.map(x=>[x.id,x]));for(const row of latest)map.set(row.id,row);return [...map.values()].sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));}
export function renderMessages(container,rows,ownSender){
 const frag=document.createDocumentFragment();let date='';
 for(const row of rows){
  const current=formatDate(row.created_at);if(current!==date){frag.append(el('div',current,'official-date'));date=current;}
  const own=row.sender===ownSender;
  const bubble=el('article',undefined,'official-bubble '+(own?'official-outgoing':'official-incoming'));
  bubble.append(el('p',row.body));
  const small=el('small',formatTime(row.created_at)+(own?(row.read_at?'  ✓✓':'  ✓'):''));if(own)small.title=row.read_at?'Read':'Sent';bubble.append(small);frag.append(bubble);
 }
 container.replaceChildren(frag);
}
export async function markRead(client,rows,userId,ownSender){
 const unread=rows.filter(r=>r.sender!==ownSender&&!r.read_at);if(!unread.length)return;
 const now=new Date().toISOString();
 const {error}=await client.from('official_support_messages').update({read_at:now}).eq('user_id',userId).neq('sender',ownSender).is('read_at',null).in('id',unread.map(r=>r.id));if(error)throw error;
 if(ownSender==='member'){
  const result=await client.from('website_notifications').update({read_at:now}).eq('user_id',userId).is('read_at',null).in('campaign_key',unread.map(r=>'official-support-reply:'+r.id));if(result.error)throw result.error;
 }
 for(const r of unread)r.read_at=now;
}
export async function sendMessage(client,userId,sender,body,id){
 const message=body.trim();if(!message||message.length>2000)throw Error('Enter 1–2000 characters.');
 if(sender==='member'){const t=await client.from('official_support_threads').upsert({user_id:userId},{onConflict:'user_id',ignoreDuplicates:true});if(t.error)throw t.error;}
 const result=await client.from('official_support_messages').insert({id,user_id:userId,sender,body:message});
 if(result.error){
  // An interrupted response may hide a committed send; verify only this exact message.
  const existing=await client.from('official_support_messages').select('id').eq('id',id).eq('user_id',userId).eq('sender',sender).eq('body',message).maybeSingle();
  if(existing.error||!existing.data)throw result.error;
 }
}
