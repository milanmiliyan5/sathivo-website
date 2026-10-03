self.addEventListener('push',event=>{
 let data={};try{data=event.data?.json()||{}}catch{data={body:event.data?.text()||'You have a new Sathivo update.'}}
 const title=data.title||'Sathivo';
 const options={body:data.body||'You have a new Sathivo update.',tag:data.tag||'sathivo-update',renotify:true,data:{url:data.url||''}};
 event.waitUntil(self.registration.showNotification(title,options));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const raw=event.notification?.data?.url||'';
 const target=new URL(raw||'./',self.registration.scope).href;
 event.waitUntil((async()=>{
  const clientsList=await clients.matchAll({type:'window',includeUncontrolled:true});
  for(const client of clientsList){
   if('focus' in client){
    try{await client.navigate(target)}catch{}
    return client.focus();
   }
  }
  return clients.openWindow(target);
 })());
});