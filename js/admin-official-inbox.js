import {$,el,formatTime,formatDate,getMessages,mergeMessages,renderMessages,markRead,sendMessage} from './official-support-common.js?v=20261126-1';
let client,enabled=false,selected=null,rows=[],page=0,more=false,threadMore=false,seq=0,listSeq=0,sending=false,retryId=null,retryBody='';
const limit=30;
function listStatus(message){$('official-admin-status').textContent=message;}
function replyStatus(message){$('official-admin-reply-status').textContent=message;}
function clearSelection(){seq++;selected=null;rows=[];retryId=null;retryBody='';$('official-admin-conversation').hidden=true;$('official-admin-body').value='';}
async function loadList(){
 const token=++listSeq;
 const [result,count]=await Promise.all([client.rpc('official_support_inbox',{p_offset:page*limit,p_limit:limit+1,p_status:$('official-admin-filter').value||null,p_search:$('official-admin-search').value.trim()||null}),client.from('official_support_messages').select('id',{count:'exact',head:true}).eq('sender','member').is('read_at',null)]);
 if(token!==listSeq)return true;if(result.error||count.error)throw result.error||count.error;
 const data=result.data||[];more=data.length>limit;
 const badge=$('official-admin-unread');badge.hidden=!count.count;badge.textContent=count.count>99?'99+':String(count.count||0);
 const list=$('official-admin-list');list.replaceChildren();
 for(const row of data.slice(0,limit)){
  const button=el('button',undefined,'official-admin-row');button.type='button';button.setAttribute('aria-pressed',String(selected===row.user_id));
  const name=el('strong',row.display_name),meta=el('small',row.status+' · '+formatDate(row.last_message_at)+' '+formatTime(row.last_message_at));
  const preview=el('span',row.preview||'Conversation');button.append(name,meta,preview);
  if(Number(row.unread_count)>0)button.append(el('b',String(row.unread_count),'official-admin-count'));
  button.addEventListener('click',()=>{if(sending)return;void openThread(row);});list.append(button);
 }
 if(!data.length)list.append(el('p','No support conversations found.'));
 $('official-admin-page').textContent=String(page+1);$('official-admin-prev').disabled=page===0;$('official-admin-next').disabled=!more;listStatus('');
 return true;
}
async function loadThread(older=false){
 const token=++seq,id=selected;if(!id)return true;
 try{const result=await getMessages(client,id,older?rows[0]:null);if(token!==seq||id!==selected)return true;
 if(older||!rows.length)threadMore=result.more;rows=mergeMessages(rows,result.rows);
 const box=$('official-admin-messages'),height=box.scrollHeight,top=box.scrollTop;renderMessages(box,rows,'official');
 box.scrollTop=older?top+box.scrollHeight-height:box.scrollHeight;$('official-admin-older').hidden=!threadMore;
 await markRead(client,result.rows,id,'official');if(token!==seq||id!==selected)return true;
 replyStatus('');return true;
 }catch{if(token===seq)replyStatus('Could not load conversation. Use Refresh All to retry.');return false;}
}
async function openThread(row){
 clearSelection();selected=row.user_id;$('official-admin-name').textContent=row.display_name;$('official-admin-id').textContent='Account ID: '+row.user_id;$('official-admin-thread-status').value=row.status;
 $('official-admin-messages').replaceChildren();$('official-admin-conversation').hidden=false;replyStatus('Loading conversation…');
 if(await loadThread())await loadList().catch(()=>listStatus('Could not refresh inbox.'));
}
export function initOfficialInbox(c){
 if(enabled)return;client=c;enabled=true;$('official-inbox-nav').hidden=false;$('official-inbox-section').hidden=false;
 const reset=()=>{if(sending)return;page=0;void loadList().catch(()=>listStatus('Could not load support inbox.'));};
 $('official-admin-search').addEventListener('change',reset);$('official-admin-filter').addEventListener('change',reset);
 $('official-admin-prev').onclick=()=>{if(page>0&&!sending){page--;void loadList().catch(()=>listStatus('Could not load inbox.'));}};
 $('official-admin-next').onclick=()=>{if(more&&!sending){page++;void loadList().catch(()=>listStatus('Could not load inbox.'));}};
 $('official-admin-older').onclick=()=>void loadThread(true);
 $('official-admin-thread-status').addEventListener('change',async e=>{
  const id=selected,control=e.target;if(!id)return;control.disabled=true;
  const result=await client.from('official_support_threads').update({status:control.value}).eq('user_id',id).select('status').single();
  if(result.error)replyStatus('Status not saved. Refresh and try again.');else await loadList().catch(()=>listStatus('Could not update inbox.'));
  control.disabled=false;
 });
 $('official-admin-form').addEventListener('submit',async e=>{
  e.preventDefault();const input=$('official-admin-body'),button=$('official-admin-send'),value=input.value.trim(),id=selected;if(!id||!value||sending)return;
  if(!retryId||retryBody!==value){retryId=crypto.randomUUID();retryBody=value;}sending=true;button.disabled=true;input.disabled=true;replyStatus('Sending reply…');
  try{await sendMessage(client,id,'official',value,retryId);input.value='';retryId=null;retryBody='';await loadThread();await loadList();replyStatus('Reply sent. In-app notification created.');}
  catch{replyStatus('Reply not confirmed. Refresh or try Send again.');}
  finally{sending=false;button.disabled=false;input.disabled=false;}
 });
}
export async function refreshOfficialInbox(c){
 if(!enabled||client!==c)return true;try{if(selected&&!sending){const r=await client.from('official_support_threads').select('status').eq('user_id',selected).maybeSingle();if(r.error)throw r.error;if(!r.data)clearSelection();else{$('official-admin-thread-status').value=r.data.status;if(!await loadThread())return false;}}
 return await loadList();}catch{listStatus('Could not refresh support inbox.');return false;}
}
