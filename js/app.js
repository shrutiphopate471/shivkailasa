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
  { k: 'purpose', t: 'What are you buying for?', o: ['Residential|To live in', 'Investment|Rental & growth',] },
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
    // L.tag = j.tag; persist(true);
    // gtag('event', 'funnel_complete', { event_category: 'enquiry', event_label: j.tag || 'unknown' });
    // result();
    L.tag = j.tag; persist(true);
    // Google Analytics (GA4) — fires when all 5 quiz steps are answered
    gtag('event', 'funnel_complete', {
      event_category: 'enquiry',
      event_label: j.tag || 'unknown'
    });
    // Meta Pixel — tells Meta that someone completed the full quiz
    // j.tag is the lead quality tag: Hot, Warm, or Nurture
    fbq('track', 'CompleteRegistration', {
      content_name: 'Quiz Complete',
      status: j.tag || 'unknown'
    });
    result();
  } catch (e) {
    if (e.code === 'invalid_token') { store.clear(); location.reload(); return }
    $('fb').innerHTML = `<div class="err text-danger small mt-3">${esc(msg(e))}</div><button type="button" id="rt2" class="btn btn-primary w-100 mt-2">Try again</button><button type="button" id="bk" class="btn btn-outline-secondary w-100 mt-2">← Back</button>`;
    $('rt2').onclick = finish; $('bk').onclick = goBack
  }
}
function render() {
  bar(); const q = Q[i];
  if (q) gtag('event', 'quiz_step_view', { event_category: 'funnel', event_label: q.k, step_number: i + 1 });
  if (!q) return result();
  if (q.k === 'contact') return contact();
  $('ft').textContent = 'Is Shiv Kailasa right for you?'; $('fs').textContent = '5 quick steps · about 60 seconds';
  const back = i > 1 ? '<button type="button" class="back btn btn-outline-secondary mt-2" id="bk">← Back</button>' : '';
  const colCls = q.o.length <= 3 && !q.multi ? 'col-12' : 'col-6';
  let h = `<div class="qt fs-5 fw-bold mb-3">${q.t}</div><div class="row g-2">`;
  q.o.forEach((o, n) => { const [a, b] = o.split('|'); const id = `opt${n}`; h += `<div class="${colCls}"><input type="${q.multi ? 'checkbox' : 'radio'}" class="btn-check" name="q" id="${id}" value="${n}" autocomplete="off"${q.multi && (S.ans[q.k] || []).includes(n) ? ' checked' : ''}><label class="opt btn btn-outline-secondary w-100 text-start py-2" for="${id}">${a}${b ? `<small class="d-block text-secondary">${b}</small>` : ''}</label></div>` });
  h += '</div>' + (q.multi ? '<button type="button" id="nx" class="btn btn-primary w-100 mt-3">Continue →</button>' : '') + back;
  $('fb').innerHTML = h;
  $('fb').querySelectorAll('input').forEach(x => x.onchange = () => {
    if (q.multi) return;
    S.ans[q.k] = +x.value; persist(false);
    if (q.k === 'budget') { finish(); return }
    sync(q.k); i++; setTimeout(render, 180)
  });
  if (q.multi) $('nx').onclick = () => { S.ans.why = [...$('fb').querySelectorAll('input:checked')].map(x => +x.value); persist(false); sync('why'); i++; render() };
  if ($('bk')) $('bk').onclick = goBack;
}
const val = k => { const q = Q.find(x => x.k === k), v = S.ans[k]; return Array.isArray(v) ? v.map(n => q.o[n].split('|')[0]).join(', ') : v == null ? '' : q.o[v].split('|')[0] };
function contact() {
  bar();
  $('ft').textContent = 'Plan Your Free Site Visit'; $('fs').textContent = 'We’ll use your details only for this enquiry.';
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
      // // --- TRACKING: Lead created ---
      // gtag('event', 'generate_lead', {
      //   event_category: 'enquiry',
      //   event_label: 'contact_step',
      //   value: 500,
      //   currency: 'INR'
      // });
      // gtag('set', 'user_data', { email: em, phone_number: '+91' + ph });
      // // --- END TRACKING ---


      // --- TRACKING: Lead created ---
      // Google Analytics (GA4) — sends lead event to GA4
      gtag('event', 'generate_lead', {
        event_category: 'enquiry',
        event_label: 'contact_step',
        value: 500,
        currency: 'INR'
      });
      // GA4 enhanced conversions — sends hashed user data for better attribution
      gtag('set', 'user_data', {
        email: em,
        phone_number: '+91' + ph
      });
      // Meta Pixel — sends Lead event to Facebook/Instagram ads
      // This tells Meta that someone submitted the contact form (name + phone + email)
      // Meta uses this to find more people like this person
      fbq('track', 'Lead', {
        content_name: 'Shiv Kailasa Enquiry',
        content_category: 'Real Estate',
        value: 500,
        currency: 'INR'
      });
      // --- END TRACKING ---

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
  // --- TRACKING: Visit booked ---
  // Google Analytics (GA4) — fires when someone confirms a site visit booking
  gtag('event', 'book_site_visit', {
    event_category: 'booking',
    event_label: L.ref,
    value: 2000,
    currency: 'INR'
  });
  // Meta Pixel — tells Meta that someone booked a site visit
  // This is the highest intent action on the site
  // L.ref is the unique booking reference number
  fbq('track', 'Schedule', {
    content_name: 'Site Visit Booked',
    value: 2000,
    currency: 'INR'
  });
  // --- END TRACKING ---
  const { d, t, v } = slot, dl = dlabel(d.date),
    // function ticket() {
    //   gtag('event', 'book_site_visit', { event_category: 'booking', event_label: L.ref, value: 2000, currency: 'INR' });
    //   const { d, t, v } = slot, dl = dlabel(d.date),
    [h, m] = t.time.split(':').map(Number), p = n => String(n).padStart(2, '0'), day = d.date.replace(/-/g, ''), end = h * 60 + m + 90;
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

// Resume: finished lead goes straight to booking, a half-filled one continues where it stopped.
let saved = store.get();
if (saved && Date.now() - (saved.ts || 0) > 864e5) { store.clear(); saved = null } // saved token expires after 24h
if (saved && saved.id) {
  L = { id: saved.id, token: saved.token, ref: saved.ref, tag: saved.tag }; S.name = saved.name; S.ans = saved.ans || {};
  if (saved.done) result();
  else { i = S.ans.why == null ? 1 : S.ans.purpose == null ? 2 : S.ans.bhk == null ? 3 : 4; render() }
} else render();