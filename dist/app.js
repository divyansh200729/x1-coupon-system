const $ = id => document.getElementById(id);
const config = window.X1_CONFIG || {};
const configured = Boolean(config.supabaseUrl && config.supabaseAnonKey);
let client, customer, busy = false, returning = false;
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let currentScreen = 'register';
const show = (screen, recordHistory = true) => {
  const backwards = screen === 'register';
  const previous = currentScreen;
  if (recordHistory && previous !== screen) history.pushState({screen}, '', location.href);
  currentScreen = screen;
  ['register','coupon'].forEach(id => $(id).hidden = id !== screen);
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
    if (quick && (direction === 'right' ? dx > 85 && Math.abs(dy) < 40 : dx < -85 && Math.abs(dy) < 40)) action();
  }, {passive:true});
}

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
function render(recordHistory = true) {
  show('coupon', recordHistory);
  $('greeting').textContent = 'Your laptop coupon';
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
$('login-toggle').onclick = () => {
  returning = !returning;
  for (const id of ['name', 'email']) {
    $(id).required = !returning;
    $(id).hidden = returning;
    document.querySelector(`label[for="${id}"]`).hidden = returning;
  }
  $('registration-consent').hidden = returning;
  $('consent').required = !returning;
  $('continue').textContent = returning ? 'View my coupon →' : 'Get my ₹1,100 coupon →';
  $('login-toggle').textContent = returning ? 'New customer? Register here' : 'Already registered? Use your mobile number';
  message('');
};
$('details-form').addEventListener('submit', event => {event.preventDefault(); run(async () => {
  const phone = '+91' + $('phone').value.trim();
  if(!/^\+91[6-9][0-9]{9}$/.test(phone)) throw Error('Enter a valid 10-digit Indian mobile number.');
  const name = $('name').value.trim(), email = $('email').value.trim();
  if(!returning && name.length < 2) throw Error('Please enter your full name.');
  if(!client) throw Error(configured ? 'The coupon service is still connecting. Please try again.' : 'Registration is unavailable until the store connects its customer database.');
  customer = returning ? await rpc('lookup_coupon_by_mobile',{p_phone:phone}) : await rpc('register_coupon_by_mobile',{p_phone:phone,p_name:name,p_email:email});
  if(!customer) throw Error('No coupon found for this number. Please register first.');
  sessionStorage.setItem('x1-customer-phone',phone); $('view-coupon').hidden=false; render();
});});
$('logout').onclick = () => run(async () => {
  sessionStorage.removeItem('x1-customer-phone'); customer = null; $('view-coupon').hidden=true; $('details-form').reset(); show('register');
});
history.replaceState({screen:'register'}, '', location.href);
window.addEventListener('popstate', event => {
  if(busy) return;
  if(event.state?.screen === 'coupon' && customer) render(false);
  else show('register', false);
});
const backToDetails = () => { if(!busy && currentScreen === 'coupon') history.back(); };
const forwardToCoupon = () => { if(!busy && customer && currentScreen === 'register') render(); };
$('customer-back').onclick = backToDetails;
$('view-coupon').onclick = forwardToCoupon;
addSwipe($('coupon'), 'right', backToDetails);
addSwipe($('register'), 'left', forwardToCoupon);
async function init() {
  if(!configured) {
    message('Registration is unavailable until the store connects its customer database.');
    $('continue').disabled = true;
    return;
  }
  try {
    const {createClient} = await import('https://esm.sh/@supabase/supabase-js@2');
    client = createClient(config.supabaseUrl,config.supabaseAnonKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    const phone = sessionStorage.getItem('x1-customer-phone');
    if(phone) { customer = await rpc('lookup_coupon_by_mobile',{p_phone:phone}); if(customer) { $('view-coupon').hidden=false; render(); } }
  } catch(error) { message(`Could not connect to the coupon service: ${error.message || 'Please reload.'}`); }
}
init();


let refreshing = false;
async function refreshCoupon() {
 if (!customer || busy || refreshing || document.hidden) return;
 refreshing = true;
 const phone = customer.phone;
 try {
  const next = await rpc('lookup_coupon_by_mobile',{p_phone:phone});
  if(!customer || customer.phone !== phone) return;
  if (next) { const newlyRedeemed = !customer.redeemed_at && next.redeemed_at; customer = next; if(currentScreen === 'coupon') render(); if(newlyRedeemed) { celebrateRedemption(); message('Your coupon was redeemed by X1 Smartech. Enjoy your ₹1,100 saving!'); } }
 } catch { message('Status could not refresh. Retrying automatically.'); }
 finally { refreshing = false; }
}
setInterval(refreshCoupon,3000);

document.addEventListener('visibilitychange',()=>{if(!document.hidden) refreshCoupon();});
