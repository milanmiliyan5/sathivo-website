import {getSathivoClient} from './supabase-client.js?v=20261025-polish-1';
import {bindCustomAmountLimit} from './contribution-amount.js?v=20261120-amount-limit-1';
const $=id=>document.getElementById(id);
let client,allowed=false,busy=false,pendingId=null;
const status=(s,success=false)=>{$('contribution-status').textContent=s;$('contribution-status').dataset.success=String(success)};
const api=async body=>{const {data,error}=await client.functions.invoke('sathivo-contribution-checkout',{body});if(error)throw Error('Contribution request unavailable. If a payment was attempted, check its status or contact support before retrying.');return data};
const amount=()=>{const a=document.querySelector('input[name=amount]:checked')?.value;return a==='custom'?Number($('custom-amount').value):Number(a)};
const state=()=>{$('contribution-fieldset').disabled=!allowed||busy||!!pendingId;$('contribution-refresh').hidden=!pendingId||busy};
function sdk(){return new Promise((resolve,reject)=>{if(window.Razorpay)return resolve();const script=document.createElement('script');script.src='https://checkout.razorpay.com/v1/checkout.js';script.onload=resolve;script.onerror=reject;document.head.append(script)})}
function remember(id){pendingId=id;try{if(id)sessionStorage.setItem('sathivo.contribution.pending',id);else sessionStorage.removeItem('sathivo.contribution.pending')}catch{}state()}
function displayReceipt(r){if(r.status==='captured'){status('Thank you! Your ₹'+(r.amount_paise/100)+' contribution is verified. ♡',true);remember(null)}else if(r.status==='refunded'||r.status==='partially_refunded'){status('Your contribution has a recorded refund. Contact Support for details.');remember(null)}else if(r.status==='failed'){status('Payment attempt failed. Check your bank before trying again.');remember(null)}else{status('Awaiting verified payment status. Do not pay again until you have checked the result.');state()}}
async function check(){if(!pendingId)return;busy=true;state();try{displayReceipt(await api({action:'receipt',id:pendingId}))}catch(e){status(e.message)}finally{busy=false;state()}}
$('contribution-refresh').addEventListener('click',()=>void check());
bindCustomAmountLimit($('custom-amount'));
function syncCustomAmount(){
 const custom=document.querySelector('input[name=amount]:checked')?.value==='custom';
 $('custom-label').hidden=!custom;
 $('custom-amount').disabled=!custom;
}
$('contribution-form').addEventListener('change',syncCustomAmount);
syncCustomAmount();
$('contribution-form').addEventListener('submit',async e=>{
 e.preventDefault();if(!allowed||busy||pendingId)return;
 const n=amount();if(!Number.isInteger(n)||n<10||n>10000){status('Enter a whole rupee amount from ₹10–₹10,000.');return}
 if(!$('contribution-consent').checked){status('Please confirm this is an optional contribution.');return}
 busy=true;state();status('Preparing secure checkout…');
 try{await sdk();const o=await api({action:'create',amount_paise:n*100});remember(o.id);
 const checkout=new window.Razorpay({key:o.key_id,amount:o.amount,currency:o.currency,order_id:o.order_id,name:'Sathivo',description:'Voluntary platform support',theme:{color:'#963b60'},handler:async r=>{busy=true;state();status('Verifying your payment…');try{displayReceipt(await api({action:'verify',id:o.id,payment_id:r.razorpay_payment_id,signature:r.razorpay_signature}))}catch(e){status(e.message)}finally{busy=false;state()}},modal:{ondismiss:()=>{busy=false;state();status('Checkout closed. Check payment status before making another contribution.')}}});
 checkout.on('payment.failed',()=>{busy=false;state();status('Payment attempt failed. Check payment status before trying again.')});checkout.open();status('Complete your payment in Razorpay.');}
 catch(e){busy=false;state();status(e.message||'Could not open checkout.')}
});
async function init(){try{client=await getSathivoClient();const r=await api({action:'status'});const u=await client.auth.getUser();if(u.data.user){try{pendingId=sessionStorage.getItem('sathivo.contribution.pending')}catch{}}
 allowed=!!r.enabled&&!!u.data.user;
 if(pendingId){await check();return}
 if(!r.enabled)status('Contributions are not open yet. Sathivo remains free to use.');
 else if(!u.data.user){status('Sign in to make an optional contribution.');$('contribution-login').hidden=false}
 else status('Choose an amount to continue.');state();
 }catch{status('Contributions are temporarily unavailable. Sathivo remains free to use.');state()}}
void init();