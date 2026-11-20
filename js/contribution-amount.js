// Enforce the visible upper limit on typing, paste and mobile input.
// The checkout API independently validates the same amount range.
export function normalizeCustomAmount(value, previous=''){
 if(!/^[0-9]*$/.test(value))return previous;
 const digits=value.replace(/^0+(?=[0-9])/,'');
 return Number(digits)>10000?'10000':digits;
}
export function bindCustomAmountLimit(input){
 let accepted='';
 const limit=()=>{
  accepted=normalizeCustomAmount(input.value,accepted);
  if(input.value!==accepted)input.value=accepted;
 };
 input.addEventListener('input',limit);
 input.addEventListener('change',limit);
 limit();
}
