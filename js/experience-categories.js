// Canonical Sathivo companionship experiences shared by website profile and
// discovery. Values are stored in Supabase; preserve legacy casing forever.
export const experienceCategoryGroups=Object.freeze([
 {title:'Social & Outings',items:['Conversation','Coffee','Movies','Shopping','Events','Walking','City Exploration']},
 {title:'Education & Career',items:['College Projects Help','Study Partner','Language Practice','Interview Practice']},
 {title:'Everyday Help & Companionship',items:['Digital Help','New City Buddy','Hospital Visit Companion','Appointment Companion','Senior Social Companion']},
 {title:'Sports & Hobbies',items:['Sports & Fitness Partner','Gaming Partner','Photography & Creative Partner']},
 {title:'Online & Remote',items:['Online chat','Phone conversation']},
]);
export const experienceCategories=Object.freeze(experienceCategoryGroups.flatMap(group=>group.items));
// Display spelling may change; stored values must remain stable for old bookings.
export const experienceLabel=value=>({
 'Online chat':'Online Chat',
 'Phone conversation':'Phone Conversation',
})[value]||value;

export const experienceSafetyNotes=Object.freeze({
 'College Projects Help':'Planning, explanations and collaborative learning only. Students must complete their own assessed work.',
 'Hospital Visit Companion':'Scheduled, non-medical companionship only. Not an emergency, ambulance, nursing, diagnosis or treatment service.',
 'Appointment Companion':'Company for planned appointments only. No medical, legal or professional representation.',
 'Digital Help':'General device and form guidance only. Never share OTPs, passwords, UPI PINs or banking access.',
 'Senior Social Companion':'Friendly social companionship only. Not personal care, medication management, nursing or emergency response.',
 'Sports & Fitness Partner':'Recreational activities only, not professional coaching, medical guidance or rehabilitation.',
 'Photography & Creative Partner':'Ask consent before recording or photographing people.',
 'New City Buddy':'Plan meetings in public places. Do not share your exact home address.',
});
export const experienceSafetyNote=value=>experienceSafetyNotes[value]||'18+ · Strictly platonic · Agree on a safe plan and respect boundaries.';
