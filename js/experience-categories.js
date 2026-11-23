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

/* Presentation metadata only; canonical categories and stored values stay intact. */
export const experienceVisuals=Object.freeze({
 "Conversation":Object.freeze({tone:"sky",icon:"💬"}),
 "Coffee":Object.freeze({tone:"peach",icon:"☕"}),
 "Movies":Object.freeze({tone:"lilac",icon:"🎬"}),
 "Shopping":Object.freeze({tone:"rose",icon:"🛍️"}),
 "Events":Object.freeze({tone:"amber",icon:"🎟️"}),
 "Walking":Object.freeze({tone:"blue",icon:"🚶"}),
 "City Exploration":Object.freeze({tone:"yellow",icon:"📍"}),
 "College Projects Help":Object.freeze({tone:"mint",icon:"📚"}),
 "Study Partner":Object.freeze({tone:"lilac",icon:"📖"}),
 "Language Practice":Object.freeze({tone:"teal",icon:"🗣️"}),
 "Interview Practice":Object.freeze({tone:"peach",icon:"🎤"}),
 "Digital Help":Object.freeze({tone:"sky",icon:"💻"}),
 "New City Buddy":Object.freeze({tone:"teal",icon:"🧭"}),
 "Hospital Visit Companion":Object.freeze({tone:"mint",icon:"🏥"}),
 "Appointment Companion":Object.freeze({tone:"yellow",icon:"📅"}),
 "Senior Social Companion":Object.freeze({tone:"rose",icon:"🤝"}),
 "Sports & Fitness Partner":Object.freeze({tone:"green",icon:"🏃"}),
 "Gaming Partner":Object.freeze({tone:"lilac",icon:"🎮"}),
 "Photography & Creative Partner":Object.freeze({tone:"rose",icon:"📸"}),
 "Online chat":Object.freeze({tone:"sky",icon:"💬"}),
 "Phone conversation":Object.freeze({tone:"amber",icon:"📞"}),
});
export const experienceVisual=value=>experienceVisuals[value]||{tone:'rose',icon:'✦'};
export const meetingModeVisuals=Object.freeze({online:{tone:'sky',icon:'💻'},'in-person':{tone:'mint',icon:'🤝'},both:{tone:'green',icon:'🌿'}});
export const meetingModeVisual=value=>meetingModeVisuals[value]||{tone:'rose',icon:'✦'};
