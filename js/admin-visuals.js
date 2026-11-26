// Small, dependency-free charts. Data is an authorized, manual-refresh snapshot.
const $=id=>document.getElementById(id);
const fmt=new Intl.NumberFormat('en-IN');
const colors={visitors:'#6b2146',signups:'#0f766e',bookings:'#b45309'};
const labels={visitors:'Daily unique browsers',signups:'New accounts',bookings:'New bookings'};
const count=v=>Math.max(0,Number.isFinite(Number(v))?Number(v):0);
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const svg=(tag,attrs={},text)=>{const e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));if(text!==undefined)e.textContent=text;return e;};
const dateLabel=d=>new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(d+'T00:00:00Z'));
export function seriesWindow(days,range,key){
 const rows=Array.isArray(days)?days.slice(-range):[];
 const values=rows.map(r=>count(r[key]));
 const max=Math.max(1,...values);
 const step=Math.max(1,Math.ceil(max/4));
 return {rows,values,max:step*4,step,total:values.reduce((a,b)=>a+b,0)};
}
export function donutParts(items){
 const total=items.reduce((a,x)=>a+count(x[1]),0);
 let start=0;
 return {total,parts:items.map(([label,value,color])=>{const n=count(value),end=total?start+n/total*100:0;const part={label,n,color,start,end};start=end;return part;})};
}
let summary=null,stats=null,range=7,key='visitors';
function setText(id,text){const e=$(id);if(e)e.textContent=text;}
function makeLegend(items,root){
 root.replaceChildren(...items.map(([label,n,color])=>{const row=node('div',undefined,'visual-legend-row'),dot=node('span',undefined,'visual-dot');dot.style.backgroundColor=color;row.append(dot,node('span',label),node('strong',fmt.format(count(n))));return row;}));
}
function renderGrowth(){
 if(!summary)return;
 const {rows,values,max,step,total}=seriesWindow(summary.days,range,key);
 if(!rows.length)return;
 setText('visual-growth-total',fmt.format(total));
 setText('visual-growth-label',labels[key]+(key==='visitors'&&range>1?' · sum of daily counts':'')+' · '+(range===1?'Today':range+' days')+' · IST');
 const root=$('visual-growth-plot'),chart=svg('svg',{viewBox:'0 0 620 224',role:'img','aria-label':labels[key]+' over '+range+' day(s), total '+total});
 const x=i=>rows.length===1?333:48+i*(552/(rows.length-1)), y=n=>180-n/max*154;
 for(let i=0;i<=4;i++){const v=i*step,yy=y(v);chart.append(svg('line',{x1:48,x2:600,y1:yy,y2:yy,stroke:'#e9e2e7','stroke-width':1}),svg('text',{x:39,y:yy+4,'text-anchor':'end',fill:'#796b75','font-size':10},fmt.format(v)));}
 const points=values.map((n,i)=>x(i)+','+y(n));
 if(values.length>1){chart.append(svg('polygon',{points:x(0)+',180 '+points.join(' ')+' '+x(values.length-1)+',180',fill:colors[key],opacity:.08}),svg('polyline',{points:points.join(' '),fill:'none',stroke:colors[key],'stroke-width':2.7,'stroke-linejoin':'round','stroke-linecap':'round'}));}
 values.forEach((n,i)=>{const circle=svg('circle',{cx:x(i),cy:y(n),r:range===30?2.5:4,fill:colors[key],stroke:'white','stroke-width':1.2});circle.append(svg('title',{},dateLabel(rows[i].day)+': '+fmt.format(n)));chart.append(circle);});
 const ticks=rows.length<=7?rows.map((_,i)=>i):[0,6,12,18,24,29];
 for(const i of ticks){if(i<rows.length)chart.append(svg('text',{x:x(i),y:204,fill:'#796b75','font-size':10,'text-anchor':i===0&&rows.length>1?'start':i===rows.length-1&&rows.length>1?'end':'middle'},dateLabel(rows[i].day)));}
 root.replaceChildren(chart);
 $('visual-growth-table').replaceChildren(...rows.map((r,i)=>{const tr=node('tr');tr.append(node('td',dateLabel(r.day)),node('td',fmt.format(values[i])));return tr;}));
}
function renderBookings(){
 if(!stats)return;
 const items=[['Pending',count(stats.pending_bookings),'#b45309'],['Accepted',count(stats.accepted_bookings),'#3b82a0'],['Completed',count(stats.completed_bookings),'#15803d'],['Cancelled',count(stats.cancelled_bookings),'#c24157'],['Declined',count(stats.declined_bookings),'#9b8192']];
 const known=items.reduce((n,r)=>n+r[1],0),remaining=Math.max(0,count(stats.total_bookings)-known);
 if(remaining)items.push(['Other',remaining,'#d7ccd4']);
 const {total,parts}=donutParts(items);
 $('visual-donut').style.background=total?'conic-gradient('+parts.filter(p=>p.n).map(p=>p.color+' '+p.start+'% '+p.end+'%').join(',')+')':'#ede7eb';
 setText('visual-booking-total',fmt.format(total));makeLegend(items,$('visual-booking-legend'));
}
function bars(root,items){
 const max=Math.max(1,...items.map(x=>count(x[1])));
 root.replaceChildren(...(items.length?items.map(([label,n,color])=>{
  const row=node('div',undefined,'visual-bar-row'),head=node('div',undefined,'visual-bar-label'),track=node('div',undefined,'visual-bar-track'),bar=node('div',undefined,'visual-bar-fill');
  head.append(node('span',label),node('strong',fmt.format(count(n))));bar.style.width=(count(n)/max*100)+'%';bar.style.backgroundColor=color;track.append(bar);row.append(head,track);return row;
 }):[node('p','No records in this snapshot.','panel-note')]));
}
export function renderAdminVisuals(data,metrics){
 summary=data;stats=metrics;renderGrowth();renderBookings();
 bars($('visual-gender'),[['Male',metrics.male_users,'#477b9b'],['Female',metrics.female_users,'#a44d78'],['Other / unset',metrics.gender_other_or_unset,'#b6a2b0']]);
 bars($('visual-cities'),(data.cities||[]).map(r=>[r.city,r.count,'#8f426a']));
 const ranked=data.top_companions||[];
 $('visual-top-companions').replaceChildren(...(ranked.length?ranked.map((r,i)=>{
  const row=node('div',undefined,'visual-rank-row'),rank=node('span',String(i+1),'visual-rank-number'),copy=node('div',undefined,'primary-cell');copy.append(node('strong',r.name),node('small',fmt.format(count(r.completed))+' completed bookings'));row.append(rank,copy,node('strong',fmt.format(count(r.points))+' pts'));return row;
 }):[node('p','No qualifying companions in the saved ranking.','panel-note')]));
 setText('visual-status','Snapshot updated · Manual refresh');
}
export function visualUnavailable(metrics){
 if(metrics){stats=metrics;renderBookings();bars($('visual-gender'),[['Male',metrics.male_users,'#477b9b'],['Female',metrics.female_users,'#a44d78'],['Other / unset',metrics.gender_other_or_unset,'#b6a2b0']]);}
 setText('visual-status','Chart data unavailable. Refresh All to retry; previous charts may be stale.');
}
export function initAdminVisuals(){
 for(const button of document.querySelectorAll('[data-chart-range]'))button.addEventListener('click',()=>{
  range=Number(button.dataset.chartRange);
  document.querySelectorAll('[data-chart-range]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));renderGrowth();
 });
 for(const button of document.querySelectorAll('[data-chart-series]'))button.addEventListener('click',()=>{
  key=button.dataset.chartSeries;
  document.querySelectorAll('[data-chart-series]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));renderGrowth();
 });
 for(const link of document.querySelectorAll('[data-quick-section]'))link.addEventListener('click',e=>{
  const section=link.dataset.quickSection,nav=document.querySelector('.sidebar-link[data-section="'+section+'"]');
  if(nav&&!nav.hidden){e.preventDefault();nav.click();}
 });
}
