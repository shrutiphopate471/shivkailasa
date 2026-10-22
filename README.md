# Shiv Kailasa: enquiry funnel + visit booking

HTML + SCSS + vanilla JS front end, PHP + MySQL backend. Ek enquiry = ek `leads` row.

## Folder
- `index.html`, `css/style.css` (compiled from `scss/style.scss`), `js/app.js`, `js/config.js`
- `api/`: `lead.php` (create), `lead-update.php`, `slots.php`, `book.php`, `bootstrap.php`
- `database/schema.sql`: tables `leads`, `visit_slots`, `rate_limits`

## Local run
1. XAMPP/MySQL start karein, phpMyAdmin mein ek database banayein aur `database/schema.sql` import karein.
2. `api/config.sample.php` ko `api/config.php` naam se copy karke DB details bharein.
3. `npm install && npm run build` (SCSS -> CSS; `npm run watch` development ke liye).
4. Project folder mein `php -S localhost:8000` chalayein, phir http://localhost:8000 kholein.
5. `js/config.js` mein apna WhatsApp number (country code ke saath, jaise `919876543210`) daalein.

## Live deploy (cPanel)
1. Hosting par MySQL database + user banayein, `schema.sql` import karein.
2. Sirf ye upload karein: `index.html`, `css/`, `js/`, `api/`, `.htaccess`. (`scss/`, `database/`, `node_modules/` nahi.)
3. Config ko `public_html` ke bahar `~/sk-config.php` naam se rakhein (ya `api/config.php`), `salt` badlein, `allowed_origin` apna domain karein.
4. AutoSSL se HTTPS on karein, phir pura funnel live test karein.

## Google Sheet sync (optional)
Every lead create/update/booking is pushed to a Google Sheet in real time via a Web App webhook.
1. Create a Google Sheet, open Extensions > Apps Script, paste `google-apps-script/sheet-sync.gs`, set `SECRET`.
2. Deploy > New deployment > type "Web app" > execute as "Me" > access "Anyone". Copy the `/exec` URL.
3. In `api/config.php`, set `sheet_webhook_url` to that URL and `sheet_secret` to match. Leave `sheet_webhook_url` blank to disable.
4. Sync is best-effort: if the webhook is down, the lead still saves (error only goes to the PHP error log).

## Behaviour notes
- Lead contact details ke baad banti hai; baaki steps usi lead ko update karte hain. Server har update par `lead_id` + secret token check karta hai.
- Same mobile number 24 ghante mein dobara aaye to naya row nahi banta, wahi record update hota hai.
- Score/tag server par nikalta hai (browser par nahi). Slot capacity transaction mein check hoti hai.
- WhatsApp: booking save hone ke baad ticket par "Send details on WhatsApp" button aata hai; user ko Send dabana padta hai.
- Leads dekhne ke liye abhi phpMyAdmin use karein (admin dashboard baad ka phase hai).

## Testing checklist
Mobile + desktop, galat phone/email, double-click, refresh beech mein, full slot, galat token, WhatsApp na khule, backup restore.
