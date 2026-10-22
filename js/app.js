// Shiv Kailasa enquiry funnel. Saves to the PHP API in /api (one lead record, updated step by step).
const CFG=window.SK_CONFIG||{},API=(CFG.API||'api').replace(/\/$/,'');
const $=id=>document.getElementById(id);
const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const Q=[
{k:'purpose',t:'What are you buying for?',o:['Self-use|To live in','Investment|Rental & growth','Both|Live now, asset later']},
{k:'aware',t:'How well do you know MIHAN?',o:['I live or work nearby','I know it a little','New to me']},
{k:'bhk',t:'Which home are you considering?',o:['2 BHK|from ₹65L','3 BHK|from ₹75L','Not sure yet']},
{k:'budget',t:'Your approximate budget?',o:['₹60–70L','₹70–85L','₹85L–₹1Cr','₹1Cr+']},
{k:'when',t:'When are you looking to buy?',o:['Immediately','1–3 months','3–6 months','Just exploring']},
{k:'fund',t:'How will you fund it?',o:['Own funds','Home loan approved','Need loan guidance','Not decided yet']},
{k:'who',t:'Who is part of the decision?',o:['Just me','Me and my family','My family decides']},
{k:'why',t:'What attracted you? (pick any)',multi:1,o:['AIIMS / IIM location','MIHAN growth','Freehold land','Rental potential','Investment potential','Township & lifestyle']}];
const S={ans:{}};let i=0,slot={},L=null; // L = {id, token, ref, tag} from the server
const store={
 get(){try{return JSON.parse(localStorage.getItem('sk_lead'))}catch(e){return null}},
 set(v){try{localStorage.setItem('sk_lead',JSON.stringify(v))}catch(e){}},
 clear(){try{localStorage.removeItem('sk_lead')}catch(e){}}};
async function api(path,body){
 const r=await fetch(`${API}/${path}`,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});
 let j={};try{j=await r.json()}catch(e){}
 if(!r.ok||!j.ok){const e=new Error(j.error||'network');e.code=j.error||'network';throw e}
 return j}
const MSG={rate_limited:'Too many attempts. Please wait a few minutes and try again.',slot_full:'That slot was just taken. Please pick another.',invalid_input:'Please check your details and try again.'};
const msg=e=>MSG[e.code]||'Could not save. Check your connection and tap again.';
const dlabel=d=>new Date(d+'T12:00:00+05:30').toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'});
function bar(){const n=Q.length+1;$('bar').style.width=(i/n*100)+'%';$('stepl').textContent=i<Q.length?`Question ${i+1} of ${Q.length}`:i===Q.length?'Almost done':''}
function render(){
 bar();const q=Q[i];
 if(!q){return contact()}
 const back=i?'<button type="button" class="back btn btn-outline-secondary mt-2" id="bk">← Back</button>':'';
 const colCls=q.o.length<=3&&!q.multi?'col-12':'col-6';
 let h=`<div class="qt fs-5 fw-bold mb-3">${q.t}</div><div class="row g-2">`;
 q.o.forEach((o,n)=>{const[a,b]=o.split('|');const id=`opt${n}`;h+=`<div class="${colCls}"><input type="${q.multi?'checkbox':'radio'}" class="btn-check" name="q" id="${id}" value="${n}" autocomplete="off"><label class="opt btn btn-outline-secondary w-100 text-start py-2" for="${id}">${a}${b?`<small class="d-block text-secondary">${b}</small>`:''}</label></div>`});
 h+='</div>'+(q.multi?'<button type="button" id="nx" class="btn btn-primary w-100 mt-3">Continue →</button>':'')+back;
 $('fb').innerHTML=h;
 $('fb').querySelectorAll('input').forEach(x=>x.onchange=()=>{
  if(q.multi)return;
  S.ans[q.k]=+x.value;i++;setTimeout(render,180)});
 if(q.multi)$('nx').onclick=()=>{S.ans.why=[...$('fb').querySelectorAll('input:checked')].map(x=>+x.value);i++;render()};
 if($('bk'))$('bk').onclick=()=>{i--;render()};
}
const val=k=>{const q=Q.find(x=>x.k===k),v=S.ans[k];return Array.isArray(v)?v.map(n=>q.o[n].split('|')[0]).join(', '):v==null?'':q.o[v].split('|')[0]};
function contact(){
 $('ft').textContent='Where should we send your plan?';$('fs').textContent='Your fit result and visit options are ready.';
 $('fb').innerHTML=`<label class="l form-label mt-0" for="name">Full name</label><input id="name" type="text" class="form-control" autocomplete="name" maxlength="80">
 <label class="l form-label mt-3" for="phone">Mobile number</label><input id="phone" type="tel" class="form-control" inputmode="tel" placeholder="+91" autocomplete="tel">
 <label class="l form-label mt-3" for="email">Email (optional)</label><input id="email" type="email" class="form-control" autocomplete="email" maxlength="120">
 <input id="hp" class="hp visually-hidden" type="text" tabindex="-1" autocomplete="off" aria-hidden="true">
 <div class="hint form-text">We’ll call or WhatsApp only on this number, and use your details only for this enquiry. No spam.</div>
 <button type="button" id="go" class="btn btn-primary w-100 mt-3">See my result →</button><div class="err text-danger small mt-2" id="er"></div>
 <button type="button" id="bk" class="btn btn-outline-secondary w-100 mt-2">← Back</button>`;
 $('bk').onclick=()=>{i--;render()};
 $('go').onclick=async()=>{
  const n=$('name').value.trim(),ph=$('phone').value.replace(/\D/g,'').replace(/^(91|0)(?=\d{10}$)/,''),em=$('email').value.trim();
  if(n.length<2||!/^[6-9]\d{9}$/.test(ph)){$('er').textContent='Please add your name and a valid 10-digit mobile number';return}
  if(em&&!/^\S+@\S+\.\S+$/.test(em)){$('er').textContent='That email address doesn’t look right';return}
  $('go').disabled=true;$('er').textContent='';
  try{
   const j=await api('lead.php',{name:n,phone:ph,email:em,ans:S.ans,page:location.href,hp:$('hp').value});
   L={id:j.lead_id,token:j.token,ref:j.ref,tag:j.tag};S.name=n;
   store.set({...L,name:n,ans:S.ans});result();
  }catch(e){$('er').textContent=msg(e);$('go').disabled=false}};
}
function result(){
 i=Q.length+1;$('bar').style.width='100%';$('stepl').textContent='';
 const g=L.tag,inv=S.ans.purpose>0,first=S.name.split(' ')[0];
 const H={Hot:['Strong match, '+first,'Your plans line up well with what Shiv Kailasa offers. The best next step is to see it in person.'],Warm:['Good fit, '+first,'Shiv Kailasa looks relevant for you. A short private visit will answer most of your questions.'],Nurture:['Thanks, '+first,'You’re still exploring, which is fine. We’ll share availability and floor plans so you can decide at your pace.']}[g];
 $('ft').textContent=H[0];$('fs').textContent='';
 const fact=inv?'Existing owners report rental of ₹30,000+ per month (₹45,000 for a furnished 3 BHK), on freehold land opposite AIIMS &amp; IIM.':'A 30-acre township, 60% open space, with its own supermarket, bank and hotel, and a community of doctors, bankers and retired officers.';
 const intro=S.ans.aware===2?'<div class="info alert alert-secondary mt-3 mb-0"><b>MIHAN in 30 seconds:</b> it is Nagpur’s employment and business corridor. AIIMS and IIM sit right here, and Shiv Kailasa is directly opposite them, on freehold land.</div>':'';
 const badgeCls=g==='Nurture'?'badge rounded-pill text-bg-secondary':'badge rounded-pill text-bg-primary';
 $('fb').innerHTML=`<span class="${badgeCls}">${g==='Hot'?'Priority visit':g==='Warm'?'Recommended visit':'Details first'}</span><p class="mt-3 mb-0">${H[1]}</p><div class="info alert alert-secondary mt-3 mb-0">${fact}</div>${intro}<div id="bk2"></div>`;
 if(g==='Nurture'){$('bk2').innerHTML='<button type="button" id="ok" class="btn btn-primary w-100 mt-3">Send me availability &amp; floor plans</button><button type="button" id="sv" class="btn btn-outline-secondary w-100 mt-2">I’d like to book a visit anyway</button>';
  $('ok').onclick=async()=>{try{await api('lead-update.php',{lead_id:L.id,token:L.token,action:'info_request'})}catch(e){$('bk2').insertAdjacentHTML('beforeend','<div class="err text-danger small mt-2">'+esc(msg(e))+'</div>');return}$('bk2').innerHTML='<div class="info alert alert-secondary mt-3 mb-0"><b>Done.</b> We’ll WhatsApp you current availability, pricing and floor plans. You can book a visit anytime from this page.</div>'};
  $('sv').onclick=booking}else booking();
 $('enquire').scrollIntoView({block:'start'});
}
async function booking(){
 slot={};
 $('bk2').innerHTML='<div class="hint form-text mt-3">Loading available slots…</div>';
 let days;
 try{days=(await api('slots.php')).days}catch(e){
  $('bk2').innerHTML='<div class="err text-danger small mt-2">Could not load visit slots.</div><button type="button" id="rt" class="btn btn-outline-secondary mt-2">Try again</button>';$('rt').onclick=booking;return}
 $('bk2').innerHTML=`<div class="qt fs-5 fw-bold mt-3">Reserve your private site visit</div>
 <div class="hint form-text">1. Pick a day</div><div class="pills d-flex flex-wrap gap-2 my-2" id="pd">${days.map((x,n)=>`<button type="button" class="pill btn btn-outline-primary" data-n="${n}">${dlabel(x.date)}</button>`).join('')}</div>
 <div class="hint form-text">2. Pick a time</div><div class="pills d-flex flex-wrap gap-2 my-2" id="pt"><span class="hint form-text">Choose a day first</span></div>
 <div class="hint form-text">3. People visiting</div><div class="pills d-flex flex-wrap gap-2 my-2" id="pv">${[1,2,3,4].map(n=>`<button type="button" class="pill btn btn-outline-primary" data-n="${n}">${n}${n===4?'+':''}</button>`).join('')}</div>
 <button type="button" id="rv" class="btn btn-primary w-100 mt-3">Reserve my visit</button><div class="err text-danger small mt-2" id="er2"></div>`;
 const on=(box,b)=>$(box).querySelectorAll('.pill').forEach(x=>x.classList.toggle('active',x===b));
 $('pd').querySelectorAll('.pill').forEach(b=>b.onclick=()=>{
  on('pd',b);slot.d=days[+b.dataset.n];slot.t=null;
  $('pt').innerHTML=slot.d.slots.map((t,n)=>`<button type="button" class="pill btn btn-outline-primary${t.left<1?' text-decoration-line-through':''}" data-n="${n}"${t.left<1?' disabled':''}>${esc(t.label)}${t.left<1?' · full':''}</button>`).join('');
  $('pt').querySelectorAll('.pill').forEach(p=>p.onclick=()=>{on('pt',p);slot.t=slot.d.slots[+p.dataset.n]})});
 $('pv').querySelectorAll('.pill').forEach(b=>b.onclick=()=>{on('pv',b);slot.v=+b.dataset.n});
 $('rv').onclick=async()=>{
  if(!slot.d||!slot.t||!slot.v){$('er2').textContent='Please choose a day, a time and the number of people';return}
  $('rv').disabled=true;$('er2').textContent='';
  try{await api('book.php',{lead_id:L.id,token:L.token,date:slot.d.date,time:slot.t.time,visitors:slot.v});ticket()}
  catch(e){
   if(e.code==='invalid_token'){store.clear();location.reload();return}
   if(e.code==='slot_full'){await booking();$('er2').textContent=msg(e);return}
   $('er2').textContent=msg(e);$('rv').disabled=false}};
}
function ticket(){
 const{d,t,v}=slot,dl=dlabel(d.date),[h,m]=t.time.split(':').map(Number),p=n=>String(n).padStart(2,'0'),day=d.date.replace(/-/g,''),end=h*60+m+90;
 const cal='https://calendar.google.com/calendar/render?action=TEMPLATE&ctz=Asia/Kolkata&text='+encodeURIComponent('Site visit: Shiv Kailasa')+'&dates='+day+'T'+p(h)+p(m)+'00/'+day+'T'+p(Math.floor(end/60))+p(end%60)+'00&location='+encodeURIComponent('Shiv Kailasa, MIHAN, Nagpur (opp. AIIMS & IIM)')+'&details='+encodeURIComponent('Booking '+L.ref);
 const text=['Hello Shiv Kailasa Team,','I am interested in Shiv Kailasa properties.','Name: '+S.name,'Requirement: '+(val('why')||val('bhk')),'Purpose: '+val('purpose'),'Budget: '+val('budget'),'Purchase Timeline: '+val('when'),'Preferred Visit: '+dl+', '+t.label,'Booking: '+L.ref,'Please contact me regarding the property.'].join('\n');
 const num=String(CFG.WHATSAPP||'').replace(/\D/g,''),wa='https://wa.me/'+(num.length>=11?num:'')+'?text='+encodeURIComponent(text);
 $('ft').textContent='You’re booked';
 $('fb').innerHTML=`<div class="ticket card"><div class="top card-header bg-primary text-white d-flex justify-content-between fw-bold"><span>SITE VISIT PASS</span><span>${esc(L.ref)}</span></div>
 <div class="bd card-body"><span class="hint form-text">Date &amp; time</span><b class="d-block fs-5">${esc(dl)} · ${esc(t.label)}</b><span class="hint form-text d-block mt-2">Guest</span><b class="d-block fs-5">${esc(S.name)} · ${v}${v===4?'+':''} ${v===1?'person':'people'}</b></div>
 <div class="ft card-footer small text-secondary">Shiv Kailasa, MIHAN, Nagpur · Opposite AIIMS &amp; IIM. Our team will confirm on WhatsApp and share the exact location pin.</div></div>
 <a class="lnk pri btn btn-primary d-block mt-3" href="${wa}" target="_blank" rel="noopener">💬 Send details on WhatsApp</a><a class="lnk btn btn-outline-primary d-block mt-2" href="${cal}" target="_blank" rel="noopener">📅 Add to Google Calendar</a>`;
 $('stepl').textContent='Booking confirmed';
 store.clear();
}
const saved=store.get();
if(saved&&saved.id){L=saved;S.name=saved.name;S.ans=saved.ans||{};result()}else render();
