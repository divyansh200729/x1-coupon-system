const $ = id => document.getElementById(id);
const config = window.X1_CONFIG || {};
const demo = !config.supabaseUrl || !config.supabaseAnonKey;
let client, customer, pending, busy = false;
const show = screen => ['register','verify','coupon'].forEach(id => $(id).hidden = id !== screen);
const message = text => $('message').textContent = text;
async function run(action) {
  if (busy) return;
  busy = true; message('');
  document.querySelectorAll('button').forEach(b => b.disabled = true);
  try { await action(); } catch(error) { message(error.message || 'Something went wrong. Please try again.'); }
  finally { busy = false; document.querySelectorAll('button').forEach(b => b.disabled = false); if (customer?.redeemed_at) $('redeem').disabled = true; }
}
function render() {
  show('coupon');
  $('greeting').textContent = `Hi, ${customer.name}!`;
  $('coupon-phone').textContent = `LINKED TO ${customer.phone}`;
  const used = Boolean(customer.redeemed_at);
  $('status').textContent = used ? `✓ Redeemed on ${new Date(customer.redeemed_at).toLocaleString('en-IN')}` : '✦ Ready to redeem';
  $('redeem').textContent = used ? 'Coupon redeemed ✓' : 'Redeem my coupon →';
  $('redeem').disabled = used;
  $('redeem-hint').textContent = used ? 'This mobile number has already used its ₹1,100 coupon. Show this confirmation at X1 Smartech.' : 'At the store? Tap below when you’re ready to use your discount. This action uses your coupon once.';
}
async function rpc(name, args = {}) {
  const {data,error} = await client.rpc(name,args);
  if(error) throw error;
  return Array.isArray(data) ? data[0] : data;
}
const readDemo = () => JSON.parse(sessionStorage.getItem('x1-preview-records') || '{}');
function saveDemo() { const records = readDemo(); records[customer.phone] = customer; sessionStorage.setItem('x1-preview-records',JSON.stringify(records)); }
$('details-form').addEventListener('submit', event => {event.preventDefault(); run(async () => {
  pending = {name:$('name').value.trim(),phone:'+91'+$('phone').value.trim(),email:$('email').value.trim()};
  if(pending.name.length < 2) throw Error('Please enter your full name.');
  if(!demo) { const {error} = await client.auth.signInWithOtp({phone:pending.phone}); if(error) throw error; }
  $('otp-description').textContent = demo ? 'Preview only: enter 123456 to try the coupon flow. No SMS is sent.' : `Enter the 6-digit SMS code sent to ${pending.phone}.`;
  show('verify'); $('otp').focus();
});});
$('otp-form').addEventListener('submit', event => {event.preventDefault(); run(async () => {
  if(demo) {
    if($('otp').value !== '123456') throw Error('For this preview, use code 123456.');
    customer = readDemo()[pending.phone] || {...pending, redeemed_at:null}; saveDemo();
  } else {
    const {error} = await client.auth.verifyOtp({phone:pending.phone,token:$('otp').value,type:'sms'}); if(error) throw error;
    customer = await rpc('register_coupon_customer',{p_name:pending.name,p_email:pending.email});
  }
  $('otp').value = ''; render();
});});
$('back').onclick = () => { show('register'); message(''); $('otp').value=''; };
let resendAt = 0;
$('resend').onclick = () => run(async () => {
  if(Date.now() < resendAt) throw Error('Please wait a minute before requesting another code.');
  if(!demo) { const {error} = await client.auth.signInWithOtp({phone:pending.phone}); if(error) throw error; }
  resendAt = Date.now()+60000; message(demo ? 'Preview code: 123456. No SMS was sent.' : 'A new verification code has been sent.');
});
$('redeem').onclick = () => run(async () => {
  if(demo) { customer = readDemo()[customer.phone]; customer.redeemed_at ||= new Date().toISOString(); saveDemo(); }
  else customer = await rpc('redeem_laptop_coupon');
  render(); message(demo ? 'Preview redemption saved in this browser tab only. Live redemption requires Supabase.' : 'Your ₹1,100 coupon has been redeemed successfully.');
});
$('logout').onclick = () => run(async () => { if(!demo) {const {error} = await client.auth.signOut(); if(error) throw error;} customer = null; pending = null; $('details-form').reset(); show('register'); });
async function init() {
  $('demo-badge').hidden = !demo;
  if(demo) return;
  try {
    const {createClient} = await import('https://esm.sh/@supabase/supabase-js@2');
    client = createClient(config.supabaseUrl,config.supabaseAnonKey);
    const {data,error} = await client.auth.getSession(); if(error) throw error;
    if(data.session) { customer = await rpc('get_my_coupon'); if(customer) render(); }
  } catch(error) { message('Could not connect to the coupon service. Please reload or contact X1 Smartech.'); document.querySelectorAll('button').forEach(b=>b.disabled=true); }
}
init();
