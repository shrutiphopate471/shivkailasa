<?php
require __DIR__ . '/bootstrap.php';
$in = input();

if (!empty($in['hp'])) out(['ok' => true, 'lead_id' => uuid4(), 'token' => 'x', 'ref' => 'SK-000000', 'tag' => 'Nurture']);
limit('lead', cfg()['limits']['lead'] ?? 10);

$WHY = ['AIIMS / IIM location', 'MIHAN growth', 'Freehold land', 'Rental potential', 'Investment potential', 'Township & lifestyle'];

$name  = trim((string)($in['name'] ?? ''));
$phone = preg_replace('/^(91|0)(?=\d{10}$)/', '', preg_replace('/\D/', '', (string)($in['phone'] ?? '')));
$email = trim((string)($in['email'] ?? ''));
if (mb_strlen($name) < 2 || mb_strlen($name) > 80 || !preg_match('/^[6-9]\d{9}$/', $phone)) out(['ok' => false, 'error' => 'invalid_input'], 422);
if ($email !== '' && (strlen($email) > 120 || !filter_var($email, FILTER_VALIDATE_EMAIL))) out(['ok' => false, 'error' => 'invalid_input'], 422);

$v = $in['ans']['why'] ?? [];
$picked = array_unique(array_filter(is_array($v) ? $v : [], fn($n) => is_int($n) && isset($WHY[$n])));
$why = implode(', ', array_map(fn($n) => $WHY[$n], $picked));

$token = bin2hex(random_bytes(24));
$th = hash('sha256', $token);
$page = mb_substr((string)($in['page'] ?? ''), 0, 255);
$pdo = db();

$s = $pdo->prepare('SELECT id FROM leads WHERE phone = ? AND created_at > (NOW() - INTERVAL 24 HOUR) ORDER BY created_at DESC LIMIT 1');
$s->execute([$phone]);
$id = $s->fetchColumn();

if ($id) {
    $pdo->prepare('UPDATE leads SET name=?, email=?, attracted=?, token_hash=? WHERE id=?')
        ->execute([$name, $email ?: null, $why, $th, $id]);
} else {
    $id = uuid4();
    $pdo->prepare('INSERT INTO leads (id, token_hash, name, phone, email, attracted, source_page, status) VALUES (?,?,?,?,?,?,?, "in_progress")')
        ->execute([$id, $th, $name, $phone, $email ?: null, $why, $page]);
}
sheet_sync($id);
out(['ok' => true, 'lead_id' => $id, 'token' => $token, 'ref' => lead_ref($id)]);