// Display the stored creation time in the viewer's local timezone.
const formatter=new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit',hour12:true});
const parse=value=>typeof value==='string'&&value.trim()?new Date(value):new Date(NaN);
export function notificationDate(value){
 const date=parse(value);
 return Number.isFinite(date.getTime())?formatter.format(date):'';
}
export function notificationAge(value,now=Date.now()){
 const date=parse(value);
 if(!Number.isFinite(date.getTime()))return '';
 const elapsed=now-date.getTime();
 if(elapsed<0)return 'Scheduled';
 const minutes=Math.floor(elapsed/60000);
 if(minutes<1)return 'Just now';
 if(minutes<60)return minutes+' min ago';
 if(minutes<1440)return Math.floor(minutes/60)+' hr ago';
 const days=Math.floor(minutes/1440);
 return days+(days===1?' day ago':' days ago');
}
