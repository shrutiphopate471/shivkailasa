<?php
// Creates the lead after contact details. Same phone within 24h reuses the same record.
require __DIR__ . '/bootstrap.php';
$in = input();

// Honeypot: bots fill the hidden field. Pretend success, save nothing.
if (!empty($in['hp'])) out(['ok' => true, 'lead_id' => uuid4(), 'token' => 'x', 'ref' => 'SK-000000', 'tag' => 'Nurture']);
limit('lead', cfg()['limits']['lead'] ?? 10);

// Allowed answers (same order as the questions in js/app.js) and scoring.
const OPTS = [
    'purpose' => ['Self-use', 'Investment', 'Both'],
    'aware'   => ['I live or work nearby', 'I know it a little', 'New to me'],
    'bhk'     => ['2 BHK', '3 BHK', 'Not sure yet'],
    'budget'  => ['₹60–70L', '₹70–85L', '₹85L–₹1Cr', '₹1Cr+'],
    'when'    => ['Immediately', '1–3 months', '3–6 months', 'Just exploring'],
    'fund'    => ['Own funds', 'Home loan approved', 'Need loan guidance', 'Not decided yet'],
    'who'     => ['Just me', 'Me and my family', 'My family decides'],
    'why'     => ['AIIMS / IIM location', 'MIHAN growth', 'Freehold land', 'Rental potential', 'Investment potential', 'Township & lifestyle'],
];
const PTS = ['when' => [3, 2, 1, 0], 'fund' => [3, 3, 1, 0], 'who' => [2, 2, 1], 'aware' => [2, 1, 0], 'budget' => [2, 3, 3, 3]];

$bad = fn() => out(['ok' => false, 'error' => 'invalid_input'], 422);
$name = trim((string)($in['name'] ?? ''));
$phone = preg_replace('/^(91|0)(?=\d{10}$)/', '', preg_replace('/\D/', '', (string)($in['phone'] ?? '')));
$email = trim((string)($in['email'] ?? ''));
if (mb_strlen($name) < 2 || mb_strlen($name) > 80 || !preg_match('/^[6-9]\d{9}$/', $phone)) $bad();
if ($email !== '' && (strlen($email) > 120 || !filter_var($email, FILTER_VALIDATE_EMAIL))) $bad();

$a = is_array($in['ans'] ?? null) ? $in['ans'] : [];
$lab = [];
$score = 0;
foreach (OPTS as $k => $opts) {
    $v = $a[$k] ?? null;
    if ($k === 'why') {
        $picked = array_unique(array_filter(is_array($v) ? $v : [], fn($n) => is_int($n) && isset($opts[$n])));
        $lab[$k] = implode(', ', array_map(fn($n) => $opts[$n], $picked));
        continue;
    }
    if (!is_int($v) || !isset($opts[$v])) $bad();
    $lab[$k] = $opts[$v];
    $score += PTS[$k][$v] ?? 0;
}
$tag = $score >= 10 ? 'Hot' : ($score >= 6 ? 'Warm' : 'Nurture');

$token = bin2hex(random_bytes(24));
$th = hash('sha256', $token);
$page = mb_substr((string)($in['page'] ?? ''), 0, 255);
$pdo = db();

$s = $pdo->prepare('SELECT id FROM leads WHERE phone = ? AND created_at > (NOW() - INTERVAL 24 HOUR) ORDER BY created_at DESC LIMIT 1');
$s->execute([$phone]);
$id = $s->fetchColumn();

$f = [$name, $email ?: null, $lab['purpose'], $lab['aware'], $lab['bhk'], $lab['budget'], $lab['when'], $lab['fund'], $lab['who'], $lab['why'], $score, $tag, $th];
if ($id) {
    $pdo->prepare('UPDATE leads SET name=?,email=?,purpose=?,awareness=?,bhk=?,budget=?,timeline=?,funding=?,decision_maker=?,attracted=?,score=?,tag=?,token_hash=? WHERE id=?')
        ->execute([...$f, $id]);
} else {
    $id = uuid4();
    $pdo->prepare('INSERT INTO leads (name,email,purpose,awareness,bhk,budget,timeline,funding,decision_maker,attracted,score,tag,token_hash,id,phone,source_page) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
        ->execute([...$f, $id, $phone, $page]);
}
out(['ok' => true, 'lead_id' => $id, 'token' => $token, 'ref' => lead_ref($id), 'tag' => $tag]);
