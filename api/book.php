<?php
// Books a visit for the lead. Availability is checked inside a DB transaction, so no double-booking.
require __DIR__ . '/bootstrap.php';
$in = input();
limit('book', cfg()['limits']['book'] ?? 20);
$l = lead_auth($in);

$date = (string)($in['date'] ?? '');
$time = (string)($in['time'] ?? '');
$v = (int)($in['visitors'] ?? 0);
if (!in_array($date, open_dates(), true) || !in_array($time, cfg()['slot_times'], true) || $v < 1 || $v > 4)
    out(['ok' => false, 'error' => 'invalid_input'], 422);

$pdo = db();
$pdo->beginTransaction();
try {
    $pdo->prepare('INSERT IGNORE INTO visit_slots (slot_date,slot_time,capacity,booked) VALUES (?,?,?,0)')
        ->execute([$date, $time, (int)cfg()['slot_capacity']]);
    $s = $pdo->prepare('SELECT capacity, booked FROM visit_slots WHERE slot_date=? AND slot_time=? FOR UPDATE');
    $s->execute([$date, $time]);
    $r = $s->fetch();

    $same = $l['visit_date'] === $date && substr((string)$l['visit_time'], 0, 5) === $time;
    if (!$same) {
        if ((int)$r['booked'] >= (int)$r['capacity']) {
            $pdo->rollBack();
            out(['ok' => false, 'error' => 'slot_full'], 409);
        }
        $pdo->prepare('UPDATE visit_slots SET booked = booked + 1 WHERE slot_date=? AND slot_time=?')->execute([$date, $time]);
        if ($l['visit_date'])  // rescheduling: free the old slot
            $pdo->prepare('UPDATE visit_slots SET booked = GREATEST(booked - 1, 0) WHERE slot_date=? AND slot_time=?')
                ->execute([$l['visit_date'], $l['visit_time']]);
    }
    $pdo->prepare("UPDATE leads SET visit_date=?, visit_time=?, visitors=?, status='visit_booked' WHERE id=?")
        ->execute([$date, $time, $v, $l['id']]);
    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    throw $e;
}
out(['ok' => true, 'ref' => lead_ref($l['id'])]);
