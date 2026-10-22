<?php
// Updates the SAME lead (never inserts). Currently: "send me availability & floor plans".
require __DIR__ . '/bootstrap.php';
$in = input();
limit('update', cfg()['limits']['update'] ?? 30);
$l = lead_auth($in);
if (($in['action'] ?? '') !== 'info_request') out(['ok' => false, 'error' => 'invalid_input'], 422);
if ($l['status'] === 'in_progress')
    db()->prepare("UPDATE leads SET status='info_requested' WHERE id=?")->execute([$l['id']]);
sheet_sync($l['id']);
out(['ok' => true]);
