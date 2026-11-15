const istDate = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'});
export function todayAccounts(rows, now = new Date()){
  const day=istDate.format(now);
  return rows.filter(row=>{
    if(!row.joined_at)return false;
    const joined=new Date(row.joined_at);
    return Number.isFinite(joined.getTime())&&istDate.format(joined)===day;
  });
}
