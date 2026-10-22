<?php
// Lists bookable days with remaining seats per slot.
require __DIR__ . '/bootstrap.php';
$c = cfg();
$s = db()->prepare('SELECT slot_time, capacity, booked FROM visit_slots WHERE slot_date = ?');
$days = [];
foreach (open_dates() as $date) {
    $s->execute([$date]);
    $rows = [];
    foreach ($s->fetchAll() as $r) $rows[substr($r['slot_time'], 0, 5)] = $r;
    $slots = [];
    foreach ($c['slot_times'] as $t) {
        $r = $rows[$t] ?? null;
        $left = ($r ? (int)$r['capacity'] : (int)$c['slot_capacity']) - ($r ? (int)$r['booked'] : 0);
        $slots[] = ['time' => $t, 'label' => date('g:i A', strtotime($t)), 'left' => max(0, $left)];
    }
    $days[] = ['date' => $date, 'slots' => $slots];
}
out(['ok' => true, 'days' => $days]);
