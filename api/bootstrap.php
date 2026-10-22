<?php
// Shared helpers for every API endpoint.
date_default_timezone_set('Asia/Kolkata');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function out(array $d, int $code = 200) {
    http_response_code($code);
    echo json_encode($d, JSON_UNESCAPED_UNICODE);
    exit;
}

set_exception_handler(function ($e) {
    error_log('[shiv-kailasa] ' . $e);
    out(['ok' => false, 'error' => 'server_error'], 500);
});

// Config lives outside the public folder if possible: ~/sk-config.php, else api/config.php
function cfg(): array {
    static $c = null;
    if ($c === null) {
        foreach ([dirname(__DIR__, 2) . '/sk-config.php', __DIR__ . '/config.php'] as $f) {
            if (is_file($f)) { $c = require $f; break; }
        }
        if ($c === null) out(['ok' => false, 'error' => 'server_config'], 500);
    }
    return $c;
}

function db(): PDO {
    static $p = null;
    if (!$p) {
        $d = cfg()['db'];
        $p = new PDO("mysql:host={$d['host']};dbname={$d['name']};charset=utf8mb4", $d['user'], $d['pass'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
        $p->exec("SET time_zone = '+05:30'");
    }
    return $p;
}

// POST + JSON only, same-origin check, returns the decoded body.
function input(): array {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') out(['ok' => false, 'error' => 'method'], 405);
    $o = cfg()['allowed_origin'] ?? '';
    if ($o && !empty($_SERVER['HTTP_ORIGIN']) && rtrim($_SERVER['HTTP_ORIGIN'], '/') !== rtrim($o, '/'))
        out(['ok' => false, 'error' => 'origin'], 403);
    $j = json_decode(file_get_contents('php://input') ?: '', true);
    if (!is_array($j)) out(['ok' => false, 'error' => 'bad_request'], 400);
    return $j;
}

// Simple per-IP rate limit stored in MySQL (hits per time window).
function limit(string $bucket, int $max): void {
    $c = cfg();
    $ip = hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . ($c['salt'] ?? ''));
    $w = $c['rate_window'] ?? 3600;
    $start = intdiv(time(), $w) * $w;
    $pdo = db();
    $pdo->prepare('INSERT INTO rate_limits (ip_hash,bucket,window_start,hits) VALUES (?,?,?,1)
                   ON DUPLICATE KEY UPDATE hits = hits + 1')->execute([$ip, $bucket, $start]);
    $s = $pdo->prepare('SELECT hits FROM rate_limits WHERE ip_hash=? AND bucket=? AND window_start=?');
    $s->execute([$ip, $bucket, $start]);
    if ((int)$s->fetchColumn() > $max) out(['ok' => false, 'error' => 'rate_limited'], 429);
    if (random_int(1, 50) === 1) $pdo->prepare('DELETE FROM rate_limits WHERE window_start < ?')->execute([$start - $w * 2]);
}

function uuid4(): string {
    $b = random_bytes(16);
    $b[6] = chr(ord($b[6]) & 0x0f | 0x40);
    $b[8] = chr(ord($b[8]) & 0x3f | 0x80);
    $h = bin2hex($b);
    return sprintf('%s-%s-%s-%s-%s', substr($h, 0, 8), substr($h, 8, 4), substr($h, 12, 4), substr($h, 16, 4), substr($h, 20));
}

function lead_ref(string $id): string { return 'SK-' . strtoupper(substr(str_replace('-', '', $id), 0, 6)); }

// Every update must carry the lead_id AND the secret token returned when the lead was created.
function lead_auth(array $in): array {
    $s = db()->prepare('SELECT * FROM leads WHERE id = ?');
    $s->execute([(string)($in['lead_id'] ?? '')]);
    $l = $s->fetch();
    if (!$l || !hash_equals($l['token_hash'], hash('sha256', (string)($in['token'] ?? ''))))
        out(['ok' => false, 'error' => 'invalid_token'], 403);
    return $l;
}

// Bookable dates: tomorrow onwards, skipping closed weekdays and blocked dates.
function open_dates(): array {
    $c = cfg();
    $o = [];
    for ($n = 1; $n <= 30 && count($o) < $c['days_ahead']; $n++) {
        $d = new DateTimeImmutable("+$n day");
        $k = $d->format('Y-m-d');
        if (in_array((int)$d->format('w'), $c['closed_weekdays'], true) || in_array($k, $c['blocked_dates'], true)) continue;
        $o[] = $k;
    }
    return $o;
}
