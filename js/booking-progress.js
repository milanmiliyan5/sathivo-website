// Customer-facing booking tracker. Purely a view of the existing booking status;
// do not infer that an actual conversation has happened just because chat is open.
const make=(tag,text,className)=>{
 const node=document.createElement(tag);
 if(text!==undefined&&text!==null)node.textContent=text;
 if(className)node.className=className;
 return node;
};

export function renderBookingProgress(booking){
 const status=String(booking?.status||'');
 const known=new Set(['pending','accepted','declined','cancelled','completed']);
 if(!known.has(status))return null;

 const wasAccepted=Boolean(booking.agreed_hourly_rate);
 const resolved={
  pending:{
   states:['complete','waiting','locked'],
   labels:['Request Sent','Accepted','Chat & Plan'],
   captions:['Done','Waiting','Locked'],
   marks:['✓','◷','🔒'],
   heading:'Waiting for companion’s response',
   description:'Your request has been sent. You can check its status here anytime. When booking emails are enabled, we’ll also email you when your companion accepts.'
  },
  accepted:{
   states:['complete','complete','ready'],
   labels:['Request Sent','Accepted','Chat & Plan'],
   captions:['Done','Done','Ready'],
   marks:['✓','✓','✉'],
   heading:'Your request has been accepted!',
   description:'Your private chat is open. Confirm the time, place and plan together before meeting.'
  },
  declined:{
   states:['complete','declined','locked'],
   labels:['Request Sent','Declined','Chat & Plan'],
   captions:['Done','Not accepted','Locked'],
   marks:['✓','×','🔒'],
   heading:'This request wasn’t accepted',
   description:'This request is closed. You can browse other available companions and send a new request.'
  },
  cancelled:{
   states:['complete',wasAccepted?'complete':'cancelled',wasAccepted?'closed':'locked'],
   labels:['Request Sent',wasAccepted?'Accepted':'Cancelled','Chat & Plan'],
   captions:['Done',wasAccepted?'Done':'Cancelled',wasAccepted?'Closed':'Locked'],
   marks:['✓',wasAccepted?'✓':'×',wasAccepted?'×':'🔒'],
   heading:'This booking was cancelled',
   description:'This booking is closed. You can explore other companions if you’d like to make a new plan.'
  },
  completed:{
   states:['complete','complete','complete'],
   labels:['Request Sent','Accepted','Chat & Plan'],
   captions:['Done','Done','Completed'],
   marks:['✓','✓','✓'],
   heading:'Booking completed',
   description:'Your booking is marked completed. You can leave a review below if you’d like.'
  }
 }[status];

 const section=make('section',undefined,'booking-progress booking-progress-'+status);
 section.setAttribute('aria-label','Booking progress');
 const kicker=make('p','YOUR BOOKING PROGRESS','booking-progress-kicker');
 section.append(kicker);

 const steps=make('ol',undefined,'booking-progress-steps');
 resolved.labels.forEach((label,index)=>{
  const step=make('li',undefined,'booking-progress-step is-'+resolved.states[index]);
  const icon=make('span',resolved.marks[index],'booking-progress-icon');
  icon.setAttribute('aria-hidden','true');
  const labelText=make('strong',label,'booking-progress-label');
  const detail=make('small',resolved.captions[index],'booking-progress-caption');
  step.append(icon,labelText,detail);
  steps.append(step);
 });
 section.append(steps);

 const note=make('div',undefined,'booking-progress-note');
 const heading=make('strong',resolved.heading,'booking-progress-heading');
 const text=make('p',resolved.description);
 note.append(heading,text);

 if(status==='accepted'){
  const chat=make('a','Open Private Chat ↗','button button-primary booking-progress-chat');
  chat.href='chat.html?booking='+encodeURIComponent(booking.id);
  note.append(chat);
 }
 section.append(note);
 return section;
}
