// Compare section values against the last confirmed database save, not visits or drafts.
const trim=value=>String(value??'').trim();
const validText=(value,min,max)=>value.length>=min&&value.length<=max;
const kinds=['customer','companion','both'];
const genders=['male','female','other','prefer_not_to_say'];
const modes=['online','in-person','both'];
const isCompanion=kind=>kind==='companion'||kind==='both';
function sectionValues(p){
 const kind=trim(p.profile_kind),companion=isCompanion(kind);
 return {
  personal:{kind,name:trim(p.display_name),gender:trim(p.gender),location:trim(p.location_id),city:trim(p.city_name),languages:trim(p.languages),interests:trim(p.interests),avatar:companion?trim(p.avatar_path):'',bio:companion?trim(p.bio):''},
  companion:{kind,categories:companion&&Array.isArray(p.categories)?[...new Set(p.categories)].sort():[],mode:companion?trim(p.meeting_mode):'',availability:companion?trim(p.availability):'',rate:companion?Number(p.hourly_rate):0},
  privacy:{adult:p.adult_confirmed===true,boundaries:p.boundaries_accepted===true}
 };
}
export function profileSectionCompletion(saved,draft,{pendingPhoto=false}={}){
 const result={personal:false,companion:false,privacy:false};
 if(!saved||!draft)return result;
 const a=sectionValues(saved),b=sectionValues(draft),p=a.personal,c=a.companion;
 const equal=section=>JSON.stringify(a[section])===JSON.stringify(b[section]);
 result.personal=kinds.includes(p.kind)&&validText(p.name,2,60)&&genders.includes(p.gender)&&!!p.location&&validText(p.city,2,80)&&validText(p.languages,2,160)&&(!isCompanion(p.kind)||(!!p.avatar&&validText(p.bio,20,600)))&&equal('personal')&&!pendingPhoto;
 result.companion=isCompanion(c.kind)&&c.categories.length>0&&modes.includes(c.mode)&&Number.isInteger(c.rate)&&c.rate>=1&&c.rate<=100000&&equal('companion');
 result.privacy=a.privacy.adult&&a.privacy.boundaries&&equal('privacy');
 return result;
}
