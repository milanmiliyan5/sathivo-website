// Routine reminders stay in history but not in the activity feed or badge.
export const routineNotificationTitles=Object.freeze(['Pending booking reminder','Unread message reminder','Ready to publish your companion profile?','Request sent','Request sent successfully','Booking request sent']);
export function importantNotificationQuery(query,table){
 return table==='notifications'?query.not('title','in','('+routineNotificationTitles.map(title=>'"'+title+'"').join(',')+')'):query;
}
export function notificationType(row){
 const title=String(row.title||'').toLowerCase();
 if(title.includes('support')&&(title.includes('reply')||title.includes('replied')||title.includes('respond')))return 'support';
 if(row.kind==='nearby')return 'nearby';
 if(row.kind==='message')return 'message';
 if(title.includes('accepted')||title.includes('completed'))return 'accepted';
 if(title.includes('declined')||title.includes('cancelled'))return 'closed';
 if(row.kind==='system'||row.source==='website_notifications')return 'system';
 return 'booking';
}
