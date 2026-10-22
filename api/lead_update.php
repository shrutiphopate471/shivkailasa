<?php
require __DIR__ . '/bootstrap.php';
$in = input();
limit('lead_update', cfg()['limits']['lead_update'] ?? 60);
$l = lead_auth($in);   // lead_id + token check

$OPTS = [
    'purpose' => ['Self-use', 'Investment', 'Both'],
    'bhk'     => ['2 BHK', '3 BHK', 'Not sure yet'],
    'budget'  => ['₹60–70L', '₹70–85L', '₹85L–₹1Cr', '₹1Cr+'],
];
$a = is_array($in['ans'] ?? null) ? $in['ans'] : [];
$cur = ['purpose' => $l['purpose'], 'bhk' => $l['bhk'], 'budget' => $l['budget']];

foreach ($OPTS as $k => $opts) {
    if (array_key_exists($k, $a)) {
        if (!is_int($a[$k]) || !isset($opts[$a[$k]])) out(['ok' => false, 'error' => 'invalid_input'], 422);
        $cur[$k] = $opts[$a[$k]];
    }
}

// Score: purpose + budget (max 6)
$score = 0;
$score += [ 'Self-use' => 2, 'Investment' => 2, 'Both' => 3 ][$cur['purpose']] ?? 0;
$score += [ '₹60–70L' => 1, '₹70–85L' => 2, '₹85L–₹1Cr' => 3, '₹1Cr+' => 3 ][$cur['budget']] ?? 0;
$tag = $score >= 6 ? 'Hot' : ($score >= 4 ? 'Warm' : 'Nurture');

db()->prepare('UPDATE leads SET purpose=?, bhk=?, budget=?, score=?, tag=? WHERE id=?')
    ->execute([$cur['purpose'], $cur['bhk'], $cur['budget'], $score, $tag, $l['id']]);
sheet_sync($l['id']);
out(['ok' => true, 'tag' => $tag, 'score' => $score]);