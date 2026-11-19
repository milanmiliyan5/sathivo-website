// Keep exactly one native radio selected; color all stars up to that value.
export function bindFeedbackRating(form){
  if(!form)return;
  const radios=Array.from(form.querySelectorAll('input[name="rating"]'));
  function sync(){
    const rating=Number(radios.find(r=>r.checked)?.value||0);
    for(const radio of radios){
      radio.closest('label')?.classList.toggle('rating-filled',Number(radio.value)<=rating);
    }
  }
  for(const radio of radios)radio.addEventListener('change',sync);
  // Native reset updates checked values after the reset event.
  form.addEventListener('reset',()=>queueMicrotask(sync));
  sync();
}
