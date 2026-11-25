// Draft comparisons enforce save order. Display ticks use savedProfileTicks below.
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

// The indicators represent saved completion, never current edits or pending switches.
// Legacy complete profiles predate setup_stage. An existing public/hidden listing
// also proves previous publication, including users affected by a reset stage.
// None of these UI flags authorizes publishing.
export function savedProfileTicks(saved,{hasListing=false}={}){
 const done=profileSectionCompletion(saved,saved);
 if(!saved)return done;
 if(isCompanion(saved.profile_kind)){
  done.privacy=done.privacy&&done.personal&&done.companion&&(
   saved.setup_stage==='complete'||saved.setup_stage==null||hasListing
  );
 }
 return done;
}

// The optional database marker is UI progress, never an eligibility or permission flag.
export function nextProfileStage(saved,{hasListing=false}={}){
 if(!saved)return 'personal';
 const done=profileSectionCompletion(saved,saved);
 if(!done.personal)return 'personal';
 if(saved.profile_kind==='customer')return 'personal';
 if(!done.companion)return 'companion';
 if(savedProfileTicks(saved,{hasListing}).privacy)return 'personal';
 if(saved.setup_stage==='companion')return 'companion';
 if(saved.setup_stage==='privacy'||!done.privacy)return 'privacy';
 return 'personal';
}
export function stageAfterSave(section,kind,{saved=null,hasListing=false}={}){
 if(kind==='customer'||section==='privacy')return 'complete';
 // A completed private companion without a listing need not repeat onboarding.
 // For a listing, keep the existing pending-public-copy stage so final Privacy
 // Save still refreshes the photo/details; savedProfileTicks stays complete.
 if(!hasListing&&saved?.profile_kind!=='customer'&&savedProfileTicks(saved).privacy)return 'complete';
 return section==='personal'?'companion':'privacy';
}

export function availableProfileTabs(saved,kind){
 if(kind==='customer')return ['personal'];
 const done=profileSectionCompletion(saved,saved);
 if(!done.personal||saved?.profile_kind==='customer')return ['personal'];
 return done.companion?['personal','companion','privacy']:['personal','companion'];
}
export function profileDraftChanged(saved,draft,{pendingPhoto=false}={}){
 if(!saved||!draft)return true;
 return pendingPhoto||JSON.stringify(sectionValues(saved))!==JSON.stringify(sectionValues(draft));
}
