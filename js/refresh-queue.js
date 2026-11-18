// Collapse event bursts and never overlap requests. An event received during a
// request schedules one trailing refresh so the final server state is not lost.
export function createRefreshQueue(task,{delay=120,onError=()=>{}}={}){
 let timer=null,running=false,dirty=false,active=true;
 function schedule(){
  if(!active)return;
  dirty=true;
  if(running||timer!==null)return;
  timer=setTimeout(()=>{timer=null;void run()},delay);
 }
 async function run(){
  if(!active||running)return;
  dirty=false;running=true;
  try{await task()}catch(error){onError(error)}
  finally{running=false;if(active&&dirty)schedule()}
 }
 return {request:schedule,stop(){active=false;dirty=false;clearTimeout(timer);timer=null},start(){active=true;schedule()}};
}
