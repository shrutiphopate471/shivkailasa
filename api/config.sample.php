<?php
// Copy to api/config.php (local) or ~/sk-config.php (live, outside public_html) and fill in.
return [
    'db' => [
        'host' => 'localhost',
        'name' => '',
        'user' => '',
        'pass' => '',
    ],
    'salt' => 'change-me',
    'allowed_origin' => '', // e.g. 'https://yourdomain.com' on live; blank = no check (local only)
    'rate_window' => 3600,
    'limits' => ['lead' => 10, 'update' => 30, 'book' => 20],
    'days_ahead' => 7,
    'closed_weekdays' => [], // e.g. [0] to close Sundays
    'blocked_dates' => [],
    'slot_times' => ['10:00', '12:00', '15:00', '17:00'],
    'slot_capacity' => 6,

    // Google Sheet sync (optional): deploy google-apps-script/sheet-sync.gs as a Web
    // App and paste its /exec URL + secret here. Leave sheet_webhook_url blank to disable.
    'sheet_webhook_url' => '',
    'sheet_secret' => '',
];
