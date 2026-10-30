const $ = id => document.getElementById(id);
const config = window.X1_CONFIG || {};
const demo = !config.supabaseUrl || !config.supabaseAnonKey;
let client, customer, pending, busy = false;
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let currentScreen = 'register';
const show = screen => {
  const backwards = screen === 'register';
  const previous = currentScreen;
  currentScreen = screen;
  ['register','verify','coupon'].forEach(id => $(id).hidden = id !== screen);
  if (previous !== screen && !reducedMotion()) {
    $(screen).getAnimations().forEach(animation => animation.cancel());
    $(screen).animate([
      {opacity:0,transform:`translateX(${backwards ? '-20' : '20'}px) translateY(8px)`},
      {opacity:1,transform:'translateX(0) translateY(0)'}
    ],{duration:380,easing:'cubic-bezier(.2,.8,.2,1)'});
  }
  if (previous !== screen) {
    const heading = $(screen).querySelector('h2');
    heading.tabIndex = -1;
    heading.focus({preventScroll:true});
    const panel = document.querySelector('.panel');
    if (panel.getBoundingClientRect().top < 0) panel.scrollIntoView({behavior:reducedMotion() ? 'instant' : 'smooth',block:'start'});
  }
};
// Use intentional gestures on non-interactive areas; ordinary scrolling stays native.
function addSwipe(element, direction, action) {
  let start;
  element.addEventListener('touchstart', event => {
    start = event.touches.length === 1 && !event.target.closest('input,button,a,label')
      ? {x:event.touches[0].clientX,y:event.touches[0].clientY,time:Date.now()} : null;
  }, {passive:true});
  element.addEventListener('touchcancel', () => { start = null; }, {passive:true});
  element.addEventListener('touchend', event => {
    if (!start || !event.changedTouches.length) return;
    const dx = event.changedTouches[0].clientX-start.x;
    const dy = event.changedTouches[0].clientY-start.y;
    const quick = Date.now()-start.time < 650;
    start = null;
    if (quick && (direction === 'right' ? dx > 85 && Math.abs(dy) < 40 : dy > 90 && Math.abs(dx) < 45)) action();
  }, {passive:true});
}
addSwipe($('verify'), 'right', () => { if (!busy) $('back').click(); });
const message = text => $('message').textContent = text;
function celebrateRedemption() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const layer = document.createElement('div');
  layer.className = 'celebration';
  layer.setAttribute('aria-hidden', 'true');
  const colors = ['#ac72ed', '#5789f2', '#ed87be', '#ffd36e', '#82dacf'];
  for (let burst = 0; burst < 5; burst++) {
    const x = 15 + Math.random() * 70;
    const y = 15 + Math.random() * 45;
    for (let i = 0; i < 20; i++) {
      const spark = document.createElement('i');
      const angle = (i / 20) * Math.PI * 2;
      const distance = 55 + Math.random() * 85;
      spark.className = 'firework-spark';
      spark.style.left = `${x}%`;
      spark.style.top = `${y}%`;
      spark.style.background = colors[i % colors.length];
      spark.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
      spark.style.setProperty('--dy', `${Math.sin(angle) * distance}px`);
      spark.style.animationDelay = `${burst * 330}ms`;
      layer.append(spark);
    }
  }
  document.body.append(layer);
  setTimeout(() => layer.remove(), 3500);
}
async function run(action) {
  if (busy) return;
  busy = true; message('');
  document.querySelectorAll('button').forEach(b => b.disabled = true);
  try { await action(); } catch(error) { message(error.message || 'Something went wrong. Please try again.'); }
  finally { busy = false; document.querySelectorAll('button').forEach(b => b.disabled = false); }
}
function render() {
  show('coupon');
  const greetingName = customer.name.trim();
  $('greeting').textContent = `Hi, ${greetingName.charAt(0).toLocaleUpperCase('en-IN')}${greetingName.slice(1)}!`;
  $('coupon-phone').textContent = `LINKED TO ${customer.phone}`;
  const used = Boolean(customer.redeemed_at);
  $('status').textContent = used ? `✓ Redeemed on ${new Date(customer.redeemed_at).toLocaleString('en-IN')}` : '✦ Ready to redeem';
  $('redeem-hint').textContent = used ? 'This mobile number has already used its ₹1,100 coupon. Show this confirmation at X1 Smartech.' : 'Show your mobile number to X1 Smartech staff. Only staff can redeem your coupon. This page updates automatically.';
}
async function rpc(name, args = {}) {
  const {data,error} = await client.rpc(name,args);
  if(error) throw error;
  return Array.isArray(data) ? data[0] : data;
}
const readDemo = () => JSON.parse(localStorage.getItem('x1-preview-records') || '{}');
function saveDemo() { const records = readDemo(); records[customer.phone] = customer; localStorage.setItem('x1-preview-records',JSON.stringify(records)); }
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
    customer = readDemo()[pending.phone] || {...pending, redeemed_at:null,created_at:new Date().toISOString()}; saveDemo();
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
$('logout').onclick = () => run(async () => { if(!demo) {const {error} = await client.auth.signOut(); if(error) throw error;} customer = null; pending = null; $('details-form').reset(); show('register'); });
async function init() {
  $('demo-badge').hidden = !demo;
  if(demo) return;
  try {
    const {createClient} = await import('https://esm.sh/@supabase/supabase-js@2');
    client = createClient(config.supabaseUrl,config.supabaseAnonKey,{auth:{storageKey:"x1-customer-auth"}});
    const {data,error} = await client.auth.getSession(); if(error) throw error;
    if(data.session) { customer = await rpc('get_my_coupon'); if(customer) render(); }
  } catch(error) { message('Could not connect to the coupon service. Please reload or contact X1 Smartech.'); document.querySelectorAll('button').forEach(b=>b.disabled=true); }
}
init();


let refreshing = false;
async function refreshCoupon() {
 if (!customer || busy || refreshing || document.hidden) return;
 refreshing = true;
 try {
  const next = demo ? readDemo()[customer.phone] : await rpc('get_my_coupon');
  if (next) { const newlyRedeemed = !customer.redeemed_at && next.redeemed_at; customer = next; render(); if(newlyRedeemed) { celebrateRedemption(); message('Your coupon was redeemed by X1 Smartech. Enjoy your ₹1,100 saving!'); } }
 } catch { message('Status could not refresh. Retrying automatically.'); }
 finally { refreshing = false; }
}
setInterval(refreshCoupon,3000);
window.addEventListener('storage',event=>{if(event.key==='x1-preview-records') refreshCoupon();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden) refreshCoupon();});
