// Advisory quality review for published companion listings.
// Never treat a heuristic flag as proof of abuse; an administrator must review it.
const normalize=value=>String(value??'').trim();
const normalizedBio=value=>normalize(value).toLowerCase().replace(/\s+/g,' ').replace(/[^\p{L}\p{N} ]/gu,'').trim();
const contactPattern=/(?:https?:\/\/|www\.|[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?91[\s-]?)?[6-9]\d{9}\b|whats\s?app|telegram|instagram|snapchat|(?:dm|call|text)\s+me)/i;
const solicitationPattern=/\b(?:escort|hook\s?up|sexual\s+service|intimate\s+service|adult\s+service|overnight\s+stay)\b/i;

export function duplicateBioCounts(rows=[]){
 const counts=new Map();
 for(const row of rows){
  if(!row?.published||row.moderation_status!=='active')continue;
  const bio=normalizedBio(row.bio);
  if(bio.length<30)continue;
  counts.set(bio,(counts.get(bio)||0)+1);
 }
 return counts;
}

export function assessListingQuality(row={},duplicates=new Map()){
 const flags=[];
 const bio=normalize(row.bio),name=normalize(row.display_name);
 if(!row.published||row.moderation_status!=='active')return {flags,needsReview:false,policyReview:false};
 if(name.length<2)flags.push('Missing display name');
 if(bio.length<60)flags.push('Short bio — add useful detail');
 if(!normalize(row.languages))flags.push('Languages not described');
 if(!normalize(row.interests))flags.push('Interests not described');
 if(!normalize(row.availability))flags.push('Availability not described');
 if(!row.location_id&&!normalize(row.city_name))flags.push('Location missing');
 if(!Array.isArray(row.categories)||!row.categories.length)flags.push('Activities missing');
 if(!Number.isFinite(Number(row.hourly_rate))||Number(row.hourly_rate)<=0)flags.push('Hourly rate missing');
 if(!normalize(row.photo_path))flags.push('Photo or avatar missing');
 if(bio&&contactPattern.test(bio))flags.push('Review contact details or off-platform promotion');
 if(bio&&solicitationPattern.test(bio))flags.push('Review wording for prohibited services');
 if(normalizedBio(bio).length>=30&&(duplicates.get(normalizedBio(bio))||0)>1)flags.push('Bio repeated across listings');
 return {
  flags,
  needsReview:flags.length>0,
  policyReview:flags.some(flag=>flag.startsWith('Review contact')||flag.startsWith('Review wording')),
 };
}

export function summarizeListingQuality(rows=[]){
 const duplicates=duplicateBioCounts(rows);
 const publicListings=rows.filter(row=>row?.published&&row.moderation_status==='active');
 const reviewed=publicListings.map(row=>assessListingQuality(row,duplicates));
 return {
  total:publicListings.length,
  flagged:reviewed.filter(row=>row.needsReview).length,
  policy:reviewed.filter(row=>row.policyReview).length,
  shortBio:reviewed.filter(row=>row.flags.some(flag=>flag.startsWith('Short bio'))).length,
  repeatedBios:reviewed.filter(row=>row.flags.includes('Bio repeated across listings')).length,
  duplicates,
 };
}
