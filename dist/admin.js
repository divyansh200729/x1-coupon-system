const $ = id => document.getElementById(id);
const config = window.X1_CONFIG || {};
const demo = !config.supabaseUrl || !config.supabaseAnonKey;
let client, active = false, loading = false, redeeming = false, page = 0, rows = [];
const PAGE_SIZE = 25;
const msg = text => $('admin-message').textContent = text;
const readDemo = () => JSON.parse(localStorage.getItem('x1-preview-records') || '{}');
async function rpc(name,args={}) {const {data,error}=await client.rpc(name,args);if(error) throw error;return data;}
function display(records) {
  $('records').replaceChildren(); $('empty').hidden = records.length > 0;
  for (const customer of records) {
    const tr=document.createElement('tr');
    const identity=document.createElement('td'); identity.textContent=customer.name;
    const email=document.createElement('small'); email.textContent=customer.email;identity.append(email);tr.append(identity);
    for(const value of [customer.phone,customer.created_at ? new Date(customer.created_at).toLocaleString('en-IN') : 'Preview']) {const td=document.createElement('td');td.textContent=value;tr.append(td);}
    const status=document.createElement('td');const badge=document.createElement('span');badge.className='badge'+(customer.redeemed_at?' used':'');badge.textContent=customer.redeemed_at?'Redeemed':'Ready to redeem';status.append(badge);
    if(customer.redeemed_at) {const time=document.createElement('small');time.textContent=new Date(customer.redeemed_at).toLocaleString('en-IN');status.append(time);}tr.append(status);
    const action=document.createElement('td');const button=document.createElement('button');button.textContent=customer.redeemed_at?'Redeemed ✓':'Redeem ₹1,100';button.disabled=Boolean(customer.redeemed_at)||redeeming;button.onclick=()=>redeem(customer);action.append(button);tr.append(action);$('records').append(tr);
  }
  $('prev').disabled=page===0; $('next').disabled=records.length<PAGE_SIZE;$('page-label').textContent=`Page ${page+1}`;
}
async function refresh() {
  if(!active||loading||redeeming) return; loading=true;
  try {
    const search=$('search').value.trim(), filter=$('filter').value;
    if(demo) rows=Object.values(readDemo()).filter(c=>(filter==='all'||(filter==='redeemed'?!!c.redeemed_at:!c.redeemed_at))&&[c.name,c.phone,c.email].some(v=>v.toLowerCase().includes(search.toLowerCase()))).sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||'')).slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE);
    else rows=await rpc('admin_list_customers',{p_search:search,p_status:filter,p_offset:page*PAGE_SIZE});
    display(rows);$('sync-status').textContent=`${demo?'Local preview · ':''}Updated ${new Date().toLocaleTimeString('en-IN')} · Auto-refresh every 3s`;
  } catch(error) {msg(error.message);$('sync-status').textContent='Unable to sync · retrying';}
  finally {loading=false;}
}
function confirm(customer) {
  return new Promise(resolve=>{
    const dialog=document.createElement('dialog');dialog.className='redeem-dialog';dialog.setAttribute('aria-labelledby','confirmation-title');
    dialog.innerHTML='<div class="warning-icon" aria-hidden="true">!</div><span class="eyebrow">STAFF CONFIRMATION</span><h2 id="confirmation-title">Redeem this coupon?</h2><p class="warning-question"></p><p id="redeem-warning-description">Confirm the customer is at X1 Smartech. This uses their ₹1,100 coupon permanently. They won’t receive another until the next offer.</p><button class="yes">Confirm redemption →</button><button class="secondary no" autofocus>Cancel, keep coupon</button>';
    dialog.querySelector('.warning-question').textContent=`${customer.name} · ${customer.phone}`;
    const finish=value=>{dialog.close();dialog.remove();resolve(value);};dialog.querySelector('.yes').onclick=()=>finish(true);dialog.querySelector('.no').onclick=()=>finish(false);dialog.oncancel=event=>{event.preventDefault();finish(false);};document.body.append(dialog);dialog.showModal();
  });
}
async function redeem(customer) {
  if(redeeming) return;redeeming=true;display(rows);
  try {
    if(!await confirm(customer)) return;
    if(demo) {const records=readDemo();if(!records[customer.phone]) throw Error('Customer record no longer exists.');records[customer.phone].redeemed_at ||= new Date().toISOString();localStorage.setItem('x1-preview-records',JSON.stringify(records));}
    else await rpc('admin_redeem_coupon',{p_phone:customer.phone});
    msg('Coupon redeemed. The customer page will update automatically.');
  } catch(error) {msg(error.message);} finally {redeeming=false;await refresh();}
}
async function openDashboard() {
  if(!demo && !await rpc('is_coupon_admin')) throw Error('This account is not authorized as X1 Smartech staff.');
  active=true;$('login').hidden=true;$('dashboard').hidden=false;msg('');await refresh();
}
$('login-form').onsubmit=async event=>{event.preventDefault();const button=event.submitter;button.disabled=true;try {const {error}=await client.auth.signInWithPassword({email:$('admin-email').value.trim(),password:$('password').value});if(error) throw error;await openDashboard();}catch(error){msg(error.message);}finally{button.disabled=false;$('password').value='';}};
$('demo-enter').onclick=()=>openDashboard();
$('admin-logout').onclick=async()=>{try {if(!demo){const {error}=await client.auth.signOut();if(error) throw error;}active=false;rows=[];$('records').replaceChildren();$('dashboard').hidden=true;$('login').hidden=false;msg('');}catch(error){msg(error.message);}};
let debounce; $('search').oninput=()=>{clearTimeout(debounce);debounce=setTimeout(()=>{page=0;refresh();},250);};$('filter').onchange=()=>{page=0;refresh();};$('prev').onclick=()=>{if(page>0){page--;refresh();}};$('next').onclick=()=>{page++;refresh();};
window.addEventListener('storage',event=>{if(event.key==='x1-preview-records')refresh();});setInterval(()=>{if(!document.hidden)refresh();},3000);
async function init(){
 $('preview-note').hidden=!demo;$('demo-enter').hidden=!demo;$('login-form').hidden=demo;
 if(demo)return;
 try {const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2');client=createClient(config.supabaseUrl,config.supabaseAnonKey,{auth:{storageKey:'x1-admin-auth'}});const {data,error}=await client.auth.getSession();if(error)throw error;if(data.session)await openDashboard();}
 catch(error){msg(error.message);}
}
init();

document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});

