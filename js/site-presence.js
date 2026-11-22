import {getSathivoPublicClient} from './supabase-client.js?v=20261025-polish-1';

function browserKey(){
  const storageKey='sathivo.presence.browser.v1';
  try{
    let id=localStorage.getItem(storageKey);
    if(!id){id=crypto.randomUUID();localStorage.setItem(storageKey,id)}
    return id;
  }catch{return crypto.randomUUID()}
}

function indiaDate(){
  try{
    const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const map=Object.fromEntries(parts.map(p=>[p.type,p.value]));
    return `${map.year}-${map.month}-${map.day}`;
  }catch{return new Date().toISOString().slice(0,10)}
}

async function recordVisit(client,visitorId){
  const key='sathivo.visit.sent.v1';
  const now=Date.now(),date=indiaDate();
  try{
    const last=JSON.parse(localStorage.getItem(key)||'null');
    if(last?.date===date&&Number(last?.at)>0&&now-Number(last.at)<15*60*1000)return;
  }catch{}
  try{
    const page=location.pathname.split('/').pop()||'index.html';
    const {error}=await client.functions.invoke('track-site-visit',{body:{visitor_id:visitorId,page}});
    if(error)return;
    try{localStorage.setItem(key,JSON.stringify({date,at:now}))}catch{}
  }catch{}
}

async function init(){
  try{
    const client=await getSathivoPublicClient();
    const visitorId=browserKey();
    void recordVisit(client,visitorId);

    const channel=client.channel('site-presence-v1',{config:{presence:{key:visitorId}}});
    // Realtime permits at most five Presence updates per client per 30 seconds.
    // Throttle to four, debounce short tab switches, and never untrack twice.
    const presenceWindowMs=30000;
    const presenceBudget=4;
    const hiddenGraceMs=9000;
    const presenceCalls=[];
    let subscribed=false,tracked=false,inFlight=false,closed=false;
    let hiddenTimer=null,retryTimer=null;
    function clearHiddenTimer(){if(hiddenTimer){clearTimeout(hiddenTimer);hiddenTimer=null}}
    function clearRetryTimer(){if(retryTimer){clearTimeout(retryTimer);retryTimer=null}}
    async function syncPresence(){
      if(closed||!subscribed||inFlight)return;
      const shouldBeOnline=document.visibilityState==='visible';
      if(shouldBeOnline===tracked)return;
      const now=Date.now();
      while(presenceCalls.length&&now-presenceCalls[0]>=presenceWindowMs)presenceCalls.shift();
      if(presenceCalls.length>=presenceBudget){
        clearRetryTimer();
        retryTimer=setTimeout(()=>{retryTimer=null;void syncPresence()},
          Math.max(1000,presenceWindowMs-(now-presenceCalls[0])+500));
        return;
      }
      // Reserve one token before awaiting so rapid events cannot race.
      presenceCalls.push(now);
      inFlight=true;
      let succeeded=false;
      try{
        const result=shouldBeOnline
          ?await channel.track({page:location.pathname.split('/').pop()||'index.html',online_at:new Date().toISOString()})
          :await channel.untrack();
        succeeded=result==='ok';
        if(succeeded)tracked=shouldBeOnline;
      }catch{
        // Network/Realtime failure should not affect the visitor's page.
      }finally{
        inFlight=false;
        if(!closed&&subscribed&&succeeded&&
          (document.visibilityState==='visible')!==tracked){
          scheduleVisibility();
        }
      }
    }
    function scheduleVisibility(){
      clearHiddenTimer();
      if(closed||!subscribed)return;
      if(document.visibilityState==='visible'){
        void syncPresence();
      }else if(tracked){
        // A tab that is briefly hidden should not churn track/untrack.
        hiddenTimer=setTimeout(()=>{hiddenTimer=null;void syncPresence()},hiddenGraceMs);
      }
    }
    channel.subscribe(status=>{
      if(closed)return;
      if(status==='SUBSCRIBED'){
        subscribed=true;
        tracked=false;
        scheduleVisibility();
      }else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED'){
        subscribed=false;
        tracked=false;
        clearHiddenTimer();
      }
    });
    document.addEventListener('visibilitychange',()=>{
      scheduleVisibility();
      if(document.visibilityState==='visible')void recordVisit(client,visitorId);
    });
    window.addEventListener('pagehide',event=>{
      clearHiddenTimer();
      clearRetryTimer();
      if(!event.persisted){
        // Closing the channel releases Presence automatically. Calling
        // untrack() as well would create an unnecessary extra event.
        closed=true;
        void client.removeChannel(channel);
      }else if(tracked){
        // Preserve the BFCache channel, but mark background tabs offline.
        void syncPresence();
      }
    });
    window.addEventListener('pageshow',event=>{
      if(event.persisted){
        scheduleVisibility();
        void recordVisit(client,visitorId);
      }
    });
  }catch{}
}
void init();
