// Shiv Kailasa enquiry funnel. Contact step creates the lead; later answers autosave to the same record.
// Backend: Supabase (RPC functions). Order: 1) contact  2) why  3) purpose  4) bhk  5) budget
const CFG = window.SK_CONFIG || {};
const $ = id => document.getElementById(id);
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Suspicious input / query detector: script tags, SQL-injection patterns, template injection, encoded brackets.
const BAD = /(<[^>]*>|<\/?script|javascript:|data:text|\bon\w+\s*=|\bunion\b[\s\S]*\bselect\b|\bselect\b[\s\S]*\bfrom\b|\b(drop|insert|delete|update|alter|truncate|exec)\b[\s\S]*\b(table|from|into|set|database)\b|--|\/\*|\*\/|;\s*(drop|select|insert|update|delete)|'\s*or\s*'?\d|\bor\b\s+\d+\s*=\s*\d+|\$\{|\{\{|%3c|%3e|%27|%22|\x00)/i;
// Page URL sent with the lead: no hash, and only whitelisted, clean marketing params (utm_*, gclid, fbclid).
const pageUrl = () => {
  try {
    const u = new URL(location.href), keep = new URLSearchParams();
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'].forEach(k => {
      const v = u.searchParams.get(k); if (v && /^[\w.\-~ ]{1,100}$/.test(v) && !BAD.test(v)) keep.set(k, v)
    });
    const q = keep.toString(); return (u.origin + u.pathname + (q ? '?' + q : '')).slice(0, 300)
  } catch (e) { return '' }
};
const Q = [
  { k: 'contact' },
  { k: 'why', t: 'What brings you to Shiv Kailasa? (pick any)', multi: 1, o: ['AIIMS / IIM location', 'MIHAN growth', 'Freehold land', 'Rental potential', 'Investment potential', 'Township & lifestyle'] },
  { k: 'purpose', map: 1, t: 'What are you buying for?', o: ['Residential|To live in', 'Investment|Rental & growth',] },
  { k: 'bhk', t: 'Which home are you considering?', o: ['2 BHK|from ₹65L', '3 BHK|from ₹75L', 'Not sure yet'] },
  { k: 'budget', t: 'Your approximate budget?', o: ['₹60–70L', '₹70–85L', '₹85L–₹1Cr', '₹1Cr+'] }];
const S = { ans: {} }; let i = 0, slot = {}, L = null; // L = {id, token, ref, tag} from the server
const store = {
  get() { try { return JSON.parse(localStorage.getItem('sk_lead')) } catch (e) { return null } },
  set(v) { try { localStorage.setItem('sk_lead', JSON.stringify(v)) } catch (e) { } },
  clear() { try { localStorage.removeItem('sk_lead') } catch (e) { } }
};
const persist = (done) => { if (L) store.set({ ...L, name: S.name, ans: S.ans, done: !!done, ts: Date.now() }) };

// ---- Supabase connection ----
const SB_URL = 'https://mykqxhgvjzseybsmumvi.supabase.co';
const SB_KEY = 'sb_publishable_vk2O9C04smi-Nu0T0jqNJA_Abi80o4Y';
const upd = b => ['update_lead', { p_lead_id: b.lead_id, p_token: b.token, p_ans: b.ans || {}, p_action: b.action || null }];
const RPC = {
  'lead.php': b => ['create_lead', { p_name: b.name, p_phone: b.phone, p_email: b.email || '', p_ans: b.ans || {}, p_page: b.page || '', p_hp: b.hp || '' }],
  'lead_update.php': upd,
  'lead-update.php': upd,
  'slots.php': () => ['get_slots', {}],
  'book.php': b => ['book_visit', { p_lead_id: b.lead_id, p_token: b.token, p_date: b.date, p_time: b.time, p_visitors: b.visitors }]
};
async function api(path, body) {
  const [fn, args] = RPC[path](body || {});
  const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 15000);
  let r;
  try {
    r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SB_KEY },
      body: JSON.stringify(args),
      signal: ac.signal, credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store'
    });
  } catch (e) { const er = new Error('network'); er.code = 'network'; throw er } finally { clearTimeout(tm) }
  let j = {}; try { j = await r.json() } catch (e) { }
  if (!r.ok || !j.ok) { const e = new Error(j.error || 'network'); e.code = j.error || 'network'; throw e }
  return j
}
// ---- end Supabase connection ----

const MSG = { rate_limited: 'Too many attempts. Please wait a few minutes and try again.', slot_full: 'That slot was just taken. Please pick another.', invalid_input: 'Please check your details and try again.' };
const msg = e => MSG[e.code] || 'Could not save. Check your connection and tap again.';
const dlabel = d => new Date(d + 'T12:00:00+05:30').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
function bar() {
  const n = Q.length; $('bar').style.width = (Math.min(i, n) / n * 100) + '%';
  $('stepl').textContent = i < n ? `Step ${i + 1} of ${n}` : '';
}
// Contact step (i = 0) is the first step; once the lead exists, Back stops at the "why" step (i = 1).
function goBack() { if (i <= 1) return; i--; render() }
// Background autosave of one answer. Never blocks the UI; the last step re-sends everything.
function sync(k) {
  if (!L) return;
  api('lead_update.php', { lead_id: L.id, token: L.token, ans: { [k]: S.ans[k] } }).catch(() => { })
}
async function finish() {
  $('fb').innerHTML = '<div class="hint form-text mt-3">Finding your best fit…</div>';
  try {
    const j = await api('lead_update.php', { lead_id: L.id, token: L.token, ans: { purpose: S.ans.purpose, bhk: S.ans.bhk, budget: S.ans.budget } });
    L.tag = j.tag; persist(true); result();
  } catch (e) {
    if (e.code === 'invalid_token') { store.clear(); location.reload(); return }
    $('fb').innerHTML = `<div class="err text-danger small mt-3">${esc(msg(e))}</div><button type="button" id="rt2" class="btn btn-primary w-100 mt-2">Try again</button><button type="button" id="bk" class="btn btn-outline-secondary w-100 mt-2">← Back</button>`;
    $('rt2').onclick = finish; $('bk').onclick = goBack
  }
}
function render() {
  bar(); const q = Q[i];
  if (!q) return result();
  if (q.k === 'contact') return contact();
  $('ft').textContent = 'Is Shiv Kailasa right for you?'; $('fs').textContent = '5 quick steps · about 60 seconds';
  const back = i > 1 ? '<button type="button" class="back btn btn-outline-secondary mt-2" id="bk">← Back</button>' : '';
  const bkm = i > 1 ? '<button type="button" class="back btn btn-outline-secondary" id="bk">← Back</button>' : '';
  let pick = S.ans[q.k];
  const colCls = q.o.length <= 3 && !q.multi ? 'col-12' : 'col-6';
  let h = `<div class="qt fs-5 fw-bold mb-3">${q.t}</div><div class="row g-2">`;
  q.o.forEach((o, n) => { const [a, b] = o.split('|'); const id = `opt${n}`; h += `<div class="${colCls}"><input type="${q.multi ? 'checkbox' : 'radio'}" class="btn-check" name="q" id="${id}" value="${n}" autocomplete="off"${q.multi && (S.ans[q.k] || []).includes(n) ? ' checked' : ''}${q.map && pick === n ? ' checked' : ''}><label class="opt btn btn-outline-secondary w-100 text-start py-2" for="${id}">${a}${b ? `<small class="d-block text-secondary">${b}</small>` : ''}</label></div>` });
  h += '</div>' + (q.multi ? '<button type="button" id="nx" class="btn btn-primary w-100 mt-3">Continue →</button>' : '') + (q.map ? `<div id="nb"></div><div class="err text-danger small mt-2" id="er3"></div><div class="d-flex gap-2 mt-3">${bkm}<button type="button" id="nx" class="btn btn-primary flex-grow-1">Next →</button></div>` : back);
  $('fb').innerHTML = h;
  const showX = () => { if (pick === 0) nearby($('nb')); else if (pick === 1) invest($('nb')) }; // Residential -> Nearby, Investment -> calculator
  $('fb').querySelectorAll('input').forEach(x => x.onchange = () => {
    if (q.map) { pick = +x.value; $('er3').textContent = ''; showX(); return }
    if (q.multi) return;
    S.ans[q.k] = +x.value; persist(false);
    if (q.k === 'budget') { finish(); return }
    sync(q.k); i++; setTimeout(render, 180)
  });
  if (q.multi) $('nx').onclick = () => { S.ans.why = [...$('fb').querySelectorAll('input:checked')].map(x => +x.value); persist(false); sync('why'); i++; render() };
  if (q.map) {
    showX();
    $('nx').onclick = () => { if (pick == null) { $('er3').textContent = 'Please choose one option'; return } S.ans[q.k] = pick; persist(false); sync(q.k); i++; render() };
  }
  if ($('bk')) $('bk').onclick = goBack;
}
const val = k => { const q = Q.find(x => x.k === k), v = S.ans[k]; return Array.isArray(v) ? v.map(n => q.o[n].split('|')[0]).join(', ') : v == null ? '' : q.o[v].split('|')[0] };
function contact() {
  bar();
  $('ft').textContent = 'Plan Your Private Visit'; $('fs').textContent = 'We’ll use your details only for this enquiry.';
  $('fb').innerHTML = `<label class="l form-label mt-0" for="name">Full name</label><input id="name" type="text" data-recording-sensitive class="form-control" autocomplete="name" maxlength="80">
 <label class="l form-label mt-3" for="phone">Mobile number</label><div class="input-group"><span class="input-group-text">+91</span><input id="phone" type="tel" data-recording-sensitive class="form-control" inputmode="numeric" maxlength="10" pattern="[6-9][0-9]{9}" placeholder="10-digit mobile number" autocomplete="tel-national"></div><div class="text-danger small mt-1" id="phn"></div>
 <label class="l form-label mt-3" for="email">Email</label><input id="email" type="email" data-recording-sensitive class="form-control" autocomplete="email" maxlength="120" required>
 <input id="hp" class="hp visually-hidden" type="text" tabindex="-1" autocomplete="off" aria-hidden="true">
 <div class="hint form-text">We’ll call or WhatsApp only on this number, and use your details only for this enquiry. No spam.</div>
 <button type="button" id="go" class="btn btn-primary w-100 mt-3">Continue →</button><div class="err text-danger small mt-2" id="er"></div>`;
  // Phone: digits only, max 10. A number that does not start with 6-9 is not Indian: show a note.
  const NOTE = 'Only Indian mobile numbers are accepted. It should be 10 digits and start with 6, 7, 8 or 9.';
  $('phone').addEventListener('input', e => {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length === 12 && v.startsWith('91')) v = v.slice(2); // pasted/autofilled +91
    else if (v.length === 11 && v.startsWith('0')) v = v.slice(1); // pasted 0 prefix
    e.target.value = v = v.slice(0, 10);
    const bad = v.length > 0 && !/^[6-9]/.test(v);
    e.target.classList.toggle('is-invalid', bad);
    $('phn').textContent = bad ? NOTE : '';
  });
  $('go').onclick = async () => {
    const n = $('name').value.trim(), ph = $('phone').value.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, ''), em = $('email').value.trim();
    if (!/^[\p{L}\p{M}][\p{L}\p{M} .'’-]{1,79}$/u.test(n)) { $('er').textContent = 'Please enter your full name (letters only)'; return }
    if (ph.length !== 10) { $('er').textContent = 'Please enter a 10-digit mobile number'; return }
    if (!/^[6-9]/.test(ph) || /^(\d)\1{9}$/.test(ph)) { $('er').textContent = NOTE; return }
    if (BAD.test(n) || BAD.test(em)) { $('er').textContent = 'Invalid characters found. Please remove special characters and try again.'; return }
    if (!em) { $('er').textContent = 'Please enter your email address'; return }
    if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(em)) { $('er').textContent = 'That email address doesn’t look right'; return }
    $('go').disabled = true; $('er').textContent = '';
    try {
      // Lead is created here (first step). Later answers autosave to the same record.
      const j = await api('lead.php', { name: n, phone: ph, email: em, ans: {}, page: pageUrl(), hp: $('hp').value });
      L = { id: j.lead_id, token: j.token, ref: j.ref }; S.name = n;
      persist(false); i++; render();
    } catch (e) { $('er').textContent = msg(e); $('go').disabled = false }
  };
}
function result() {
  i = Q.length; $('bar').style.width = '100%'; $('stepl').textContent = '';
  const g = L.tag || 'Nurture', inv = S.ans.purpose > 0, first = S.name.split(' ')[0];
  const H = { Hot: ['Strong match, ' + first, 'Your plans line up well with what Shiv Kailasa offers. The best next step is to see it in person.'], Warm: ['Good fit, ' + first, 'Shiv Kailasa looks relevant for you. A short private visit will answer most of your questions.'], Nurture: ['Thanks, ' + first, 'You’re still exploring, which is fine. We’ll share availability and floor plans so you can decide at your pace.'] }[g];
  $('ft').textContent = H[0]; $('fs').textContent = '';
  const fact = inv ? 'Existing owners report rental of ₹30,000+ per month (₹45,000 for a furnished 3 BHK), on freehold land opposite AIIMS &amp; IIM.' : 'A 30-acre township, 60% open space, with its own supermarket, bank and hotel, and a community of doctors, bankers and retired officers.';
  const badgeCls = g === 'Nurture' ? 'badge rounded-pill text-bg-secondary' : 'badge rounded-pill text-bg-primary';
  $('fb').innerHTML = `<span class="${badgeCls}">${g === 'Hot' ? 'Priority visit' : g === 'Warm' ? 'Recommended visit' : 'Details first'}</span><p class="mt-3 mb-0">${H[1]}</p><div class="info alert alert-secondary mt-3 mb-0">${fact}</div><div id="bk2"></div>`;
  if (g === 'Nurture') {
    $('bk2').innerHTML = '<button type="button" id="ok" class="btn btn-primary w-100 mt-3">Send me availability &amp; floor plans</button><button type="button" id="sv" class="btn btn-outline-secondary w-100 mt-2">I’d like to book a visit anyway</button>';
    $('ok').onclick = async () => { try { await api('lead-update.php', { lead_id: L.id, token: L.token, action: 'info_request' }) } catch (e) { $('bk2').insertAdjacentHTML('beforeend', '<div class="err text-danger small mt-2">' + esc(msg(e)) + '</div>'); return } $('bk2').innerHTML = '<div class="info alert alert-secondary mt-3 mb-0"><b>Done.</b> We’ll WhatsApp you current availability, pricing and floor plans. You can book a visit anytime from this page.</div>' };
    $('sv').onclick = booking
  } else booking();
  $('enquire').scrollIntoView({ block: 'start' });
}
async function booking() {
  slot = {};
  $('bk2').innerHTML = '<div class="hint form-text mt-3">Loading available slots…</div>';
  let days;
  try { days = (await api('slots.php')).days } catch (e) {
    $('bk2').innerHTML = '<div class="err text-danger small mt-2">Could not load visit slots.</div><button type="button" id="rt" class="btn btn-outline-secondary mt-2">Try again</button>'; $('rt').onclick = booking; return
  }
  $('bk2').innerHTML = `<div class="qt fs-5 fw-bold mt-3">Reserve your private site visit</div>
 <div class="hint form-text">1. Pick a day</div><div class="pills d-flex flex-wrap gap-2 my-2" id="pd">${days.map((x, n) => `<button type="button" class="pill btn btn-outline-primary" data-n="${n}">${dlabel(x.date)}</button>`).join('')}</div>
 <div class="hint form-text">2. Pick a time</div><div class="pills d-flex flex-wrap gap-2 my-2" id="pt"><span class="hint form-text">Choose a day first</span></div>
 <div class="hint form-text">3. People visiting</div><div class="pills d-flex flex-wrap gap-2 my-2" id="pv">${[1, 2, 3, 4].map(n => `<button type="button" class="pill btn btn-outline-primary" data-n="${n}">${n}${n === 4 ? '+' : ''}</button>`).join('')}</div>
 <button type="button" id="rv" class="btn btn-primary w-100 mt-3">Reserve my visit</button><div class="err text-danger small mt-2" id="er2"></div>`;
  const on = (box, b) => $(box).querySelectorAll('.pill').forEach(x => x.classList.toggle('active', x === b));
  $('pd').querySelectorAll('.pill').forEach(b => b.onclick = () => {
    on('pd', b); slot.d = days[+b.dataset.n]; slot.t = null;
    $('pt').innerHTML = slot.d.slots.map((t, n) => `<button type="button" class="pill btn btn-outline-primary${t.left < 1 ? ' text-decoration-line-through' : ''}" data-n="${n}"${t.left < 1 ? ' disabled' : ''}>${esc(t.label)}${t.left < 1 ? ' · full' : ''}</button>`).join('');
    $('pt').querySelectorAll('.pill').forEach(p => p.onclick = () => { on('pt', p); slot.t = slot.d.slots[+p.dataset.n] })
  });
  $('pv').querySelectorAll('.pill').forEach(b => b.onclick = () => { on('pv', b); slot.v = +b.dataset.n });
  $('rv').onclick = async () => {
    if (!slot.d || !slot.t || !slot.v) { $('er2').textContent = 'Please choose a day, a time and the number of people'; return }
    $('rv').disabled = true; $('er2').textContent = '';
    try { await api('book.php', { lead_id: L.id, token: L.token, date: slot.d.date, time: slot.t.time, visitors: slot.v }); ticket() }
    catch (e) {
      if (e.code === 'invalid_token') { store.clear(); location.reload(); return }
      if (e.code === 'slot_full') { await booking(); $('er2').textContent = msg(e); return }
      $('er2').textContent = msg(e); $('rv').disabled = false
    }
  };
}
function ticket() {
  const { d, t, v } = slot, dl = dlabel(d.date), [h, m] = t.time.split(':').map(Number), p = n => String(n).padStart(2, '0'), day = d.date.replace(/-/g, ''), end = h * 60 + m + 90;
  const cal = 'https://calendar.google.com/calendar/render?action=TEMPLATE&ctz=Asia/Kolkata&text=' + encodeURIComponent('Site visit: Shiv Kailasa') + '&dates=' + day + 'T' + p(h) + p(m) + '00/' + day + 'T' + p(Math.floor(end / 60)) + p(end % 60) + '00&location=' + encodeURIComponent('Shiv Kailasa, MIHAN, Nagpur (opp. AIIMS & IIM)') + '&details=' + encodeURIComponent('Booking ' + L.ref);
  const text = ['Hello Shiv Kailasa Team,', 'I am interested in Shiv Kailasa properties.', 'Name: ' + S.name, 'Interested in: ' + (val('why') || val('bhk')), 'Home: ' + val('bhk'), 'Purpose: ' + val('purpose'), 'Budget: ' + val('budget'), 'Preferred Visit: ' + dl + ', ' + t.label, 'Booking: ' + L.ref, 'Please contact me regarding the property.'].join('\n');
  // WhatsApp number: works with 10-digit (7972096750) or 12-digit (917972096750).
  let num = String(CFG.WHATSAPP || '').replace(/\D/g, '');
  if (num.length === 10) num = '91' + num;
  const wa = 'https://wa.me/' + num + '?text=' + encodeURIComponent(text);
  // Final submission done: hand the pass to thank-you.html (one-time, 2 min) and REPLACE this history entry,
  // so Back never returns to the booking form.
  let ok = true;
  try { sessionStorage.setItem('sk_thanks', JSON.stringify({ ref: L.ref, name: S.name, date: dl, time: t.label, v, wa, cal, ts: Date.now() })) } catch (e) { ok = false }
  store.clear();
  if (ok) location.replace('thank-you.html');
  else { $('ft').textContent = 'You’re booked'; $('fb').innerHTML = `<p class="mb-0">Booking <b>${esc(L.ref)}</b> is confirmed. Our team will confirm on WhatsApp.</p>`; $('stepl').textContent = 'Booking confirmed' }
}

// =====================================================================
// Nearby widget (shown on the "What are you buying for?" step). Pure frontend, no Supabase change.
// =====================================================================
// ---- EDIT THESE ----
// cat: work | health | school | travel | city.  km = approx distance, car/bike = minutes, a = angle on the map (deg)
const PLACES = [
  { e: '✈️', n: 'Nagpur Airport', cat: 'travel', km: 5, car: 10, bike: 9, a: -130 },
  { e: '💼', n: 'MIHAN SEZ & IT parks', cat: 'work', km: 3, car: 7, bike: 6, a: -35 },
  { e: '🏥', n: 'AIIMS Nagpur (opposite)', cat: 'health', km: 0.5, car: 2, bike: 2, a: 35 },
  { e: '🎓', n: 'IIM Nagpur (opposite)', cat: 'school', km: 0.5, car: 2, bike: 2, a: 145 },
  { e: '🛣️', n: 'Samruddhi Expressway', cat: 'travel', km: 8, car: 15, bike: 18, a: 95 },
  { e: '🏙️', n: 'Nagpur city centre', cat: 'city', km: 15, car: 30, bike: 35, a: -75 }
];
const CATS = [['all', 'All'], ['work', 'Work'], ['health', 'Health'], ['school', 'Schools'], ['travel', 'Travel'], ['city', 'City life']];
const DAILY = [['🛒', 'Alma Mart supermarket'], ['🏦', 'SBI bank'], ['🧪', 'Pathology lab'], ['👕', 'Tumble Dry laundry'], ['🍛', 'Biryani'], ['🍔', 'Fast food'], ['🏨', 'Sayaji Group 4-star hotel']];
const AMEN = [['🏊', 'Swimming pool'], ['🏋️', 'Fully equipped gym'], ['🏓', 'Indoor games'], ['🌳', '60% open space, only 40% built']];
const INV_MIN = 65; // lakh, calculator starts here
// ---- end EDIT ----

let xCss = false;
function xStyles() {
  if (xCss) return; xCss = true;
  const s = document.createElement('style');
  s.textContent = `
.xk .xchip{border-radius:50rem}
.xk .xmap{position:relative;width:100%;aspect-ratio:100/70;border:1px solid var(--bs-border-color);border-radius:.75rem;overflow:hidden;background:var(--bs-tertiary-bg)}
.xk .xmap svg{position:absolute;inset:0;width:100%;height:100%}
.xk .xpin{position:absolute;transform:translate(-50%,-50%);width:2rem;height:2rem;border-radius:50%;border:2px solid var(--bs-primary);background:var(--bs-body-bg);font-size:.9rem;line-height:1;padding:0;display:flex;align-items:center;justify-content:center}
.xk .xpin.on{background:var(--bs-primary)}
.xk .xpin.dim{opacity:.25}
.xk .xrow{display:flex;justify-content:space-between;gap:.5rem;width:100%;text-align:left}
.xk input[type=range]{width:100%;accent-color:var(--bs-primary)}
.xk .xbars{display:flex;align-items:flex-end;gap:8px;height:90px}
.xk .xbars i{flex:1;background:var(--bs-primary);border-radius:6px 6px 0 0;opacity:.85}`;
  document.head.appendChild(s);
}
function nearby(el) {
  if (!el) return; xStyles(); el.className = 'xk';
  const st = { tab: 'near', cat: 'all', mode: 'car', sel: -1 };
  const tabs = [['near', '📍 Nearby'], ['daily', '☀️ Daily life'], ['amen', '✨ Amenities']];
  const pill = (on, attr, label) => `<button type="button" class="btn btn-sm xchip ${on ? 'btn-primary' : 'btn-outline-secondary'}" ${attr}>${label}</button>`;
  const rows = a => `<div class="d-flex flex-column gap-2">${a.map(x => `<div class="xrow border rounded-3 px-3 py-2 small"><span>${x[0]} ${x[1]}</span><span class="text-secondary">In township</span></div>`).join('')}</div>`;
  function draw() {
    let h = `<div class="d-flex flex-wrap gap-2 mt-3">${tabs.map(t => pill(st.tab === t[0], `data-tab="${t[0]}"`, t[1])).join('')}</div>`;
    if (st.tab === 'near') {
      const list = PLACES.filter(p => st.cat === 'all' || p.cat === st.cat);
      const sel = PLACES[st.sel] && list.includes(PLACES[st.sel]) ? PLACES[st.sel] : null;
      const mins = p => st.mode === 'car' ? p.car : p.bike;
      const pos = p => { const r = Math.min(Math.max(mins(p) / 20 * 31, 13), 31), t = p.a * Math.PI / 180; return [50 + r * Math.cos(t), 35 + r * Math.sin(t)] };
      const pins = PLACES.map((p, n) => { const [x, y] = pos(p); return `<button type="button" class="xpin btn${sel === p ? ' on' : ''}${list.includes(p) ? '' : ' dim'}" style="left:${x}%;top:${y / 0.7}%" data-pin="${n}" aria-label="${esc(p.n)}">${p.e}</button>` }).join('');
      const route = sel ? (([x, y]) => `<line x1="50" y1="35" x2="${x}" y2="${y}" stroke="var(--bs-primary)" stroke-width=".8" stroke-dasharray="2 1.5"/>`)(pos(sel)) : '';
      h += `<div class="d-flex flex-wrap gap-2 mt-2">${CATS.map(c => pill(st.cat === c[0], `data-cat="${c[0]}"`, c[1])).join('')}</div>
<div class="xmap mt-2"><svg viewBox="0 0 100 70" aria-hidden="true"><path d="M47 0 L49 70" stroke="currentColor" stroke-opacity=".18" stroke-width="2.6" fill="none"/><path d="M0 45 Q50 36 100 26" stroke="currentColor" stroke-opacity=".18" stroke-width="2.6" fill="none"/><circle cx="50" cy="35" r="15.5" fill="none" stroke="currentColor" stroke-opacity=".4" stroke-dasharray="1.6 1.6" stroke-width=".4"/><circle cx="50" cy="35" r="31" fill="none" stroke="currentColor" stroke-opacity=".4" stroke-dasharray="1.6 1.6" stroke-width=".4"/><g fill="currentColor" fill-opacity=".6" font-size="3"><text x="66.5" y="38">10 min</text><text x="82" y="38">20 min</text><text x="2" y="52">Wardha Road</text><text x="51" y="68.5">to Samruddhi Expwy</text></g>${route}</svg>
<div class="btn-group btn-group-sm position-absolute top-0 end-0 m-2" style="z-index:2"><button type="button" class="btn ${st.mode === 'car' ? 'btn-primary' : 'btn-secondary'}" data-mode="car">🚗 Car</button><button type="button" class="btn ${st.mode === 'bike' ? 'btn-primary' : 'btn-secondary'}" data-mode="bike">🛵 Two-wheeler</button></div>
<button type="button" class="xpin btn on" style="left:50%;top:50%;pointer-events:none" aria-label="Shiv Kailasa">★</button>${pins}</div>
<div class="border rounded-3 p-2 mt-2"><b>${sel ? esc(sel.n) : 'Shiv Kailasa'}</b><div class="text-secondary small">${sel ? `~${sel.km} km · ${mins(sel)} min by ${st.mode === 'car' ? 'car' : 'two-wheeler'} from your new home` : 'Tap a pin or a place below to see the route from your new home.'}</div></div>
<div class="d-flex flex-column gap-2 mt-2">${list.map(p => `<button type="button" class="btn btn-outline-secondary btn-sm xrow${sel === p ? ' active' : ''}" data-pin="${PLACES.indexOf(p)}"><span>${p.e} ${esc(p.n)}</span><span>~${p.km} km · ${mins(p)} min</span></button>`).join('')}</div>
<div class="text-secondary small mt-2">Approximate distances, for illustration.</div>`;
    } else h += `<div class="mt-2">${rows(st.tab === 'daily' ? DAILY : AMEN)}</div>`;
    el.innerHTML = h;
    el.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { st.tab = b.dataset.tab; draw() });
    el.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => { st.cat = b.dataset.cat; st.sel = -1; draw() });
    el.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { st.mode = b.dataset.mode; draw() });
    el.querySelectorAll('[data-pin]').forEach(b => b.onclick = () => { st.sel = +b.dataset.pin; draw() });
  }
  draw();
}

// Investment calculator (shown when "Investment" is chosen on the purpose step)
function invest(el) {
  if (!el) return; xStyles(); el.className = 'xk';
  const st = { a: INV_MIN, g: 8, y: 5, r: 3 };
  const fmt = v => v >= 100 ? (Math.round(v) / 100) + 'Cr' : (Math.round(v * 10) / 10) + 'L';
  const sl = (id, label, min, max, step, cur) => `<div class="mt-3"><div class="d-flex justify-content-between"><label for="${id}">${label}</label><b id="${id}v"></b></div><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${cur}"></div>`;
  const box = (id, t) => `<div class="col-6"><div class="border rounded-3 p-3 h-100 bg-body-tertiary"><div class="text-secondary small">${t}</div><b class="fs-5" id="${id}"></b></div></div>`;
  el.innerHTML = `<div class="alert alert-secondary mt-3 mb-0 py-2"><b>Investment starts at ₹${INV_MIN}L</b></div>`
    + sl('ia', 'Investment amount', INV_MIN, 200, 1, st.a) + sl('ig', 'Expected yearly appreciation', 0, 20, 1, st.g) + sl('iy', 'Holding period', 1, 15, 1, st.y) + sl('ir', 'Rental yield', 0, 6, .5, st.r)
    + `<div class="row g-2 mt-3">${box('ov', 'Estimated value')}${box('og', 'Capital gain')}${box('orent', 'Rental income')}${box('ot', 'Total return')}</div>
<div class="xbars mt-3" id="ib" aria-hidden="true"></div>
<div class="text-secondary small mt-2">Illustrative only. Real estate returns are not guaranteed and depend on market conditions.</div>`;
  const calc = () => {
    const { a, g, y, r } = st, worth = a * Math.pow(1 + g / 100, y), gain = worth - a, rent = a * r / 100 * y;
    $('iav').textContent = '₹' + fmt(a); $('igv').textContent = g + '%'; $('iyv').textContent = y + (y === 1 ? ' year' : ' years'); $('irv').textContent = r + '%';
    $('ov').textContent = '₹' + fmt(worth); $('og').textContent = '₹' + fmt(gain); $('orent').textContent = '₹' + fmt(rent); $('ot').textContent = '₹' + fmt(gain + rent);
    $('ib').innerHTML = Array.from({ length: 5 }, (_, n) => `<i style="height:${Math.round(a * Math.pow(1 + g / 100, y * (n + 1) / 5) / worth * 100)}%"></i>`).join('');
  };
  [['ia', 'a'], ['ig', 'g'], ['iy', 'y'], ['ir', 'r']].forEach(([id, k]) => $(id).oninput = () => { st[k] = +$(id).value; calc() });
  calc();
}

// Resume: finished lead goes straight to booking, a half-filled one continues where it stopped.
let saved = store.get();
if (saved && Date.now() - (saved.ts || 0) > 864e5) { store.clear(); saved = null } // saved token expires after 24h
if (saved && saved.id) {
  L = { id: saved.id, token: saved.token, ref: saved.ref, tag: saved.tag }; S.name = saved.name; S.ans = saved.ans || {};
  if (saved.done) result();
  else { i = S.ans.why == null ? 1 : S.ans.purpose == null ? 2 : S.ans.bhk == null ? 3 : 4; render() }
} else render();