<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);
echo "1 start<br>";
echo "PHP " . PHP_VERSION . "<br>";
require __DIR__ . '/bootstrap.php';
echo "2 bootstrap ok<br>";
$c = cfg();
echo "3 cfg ok<br>";
$pdo = db();
echo "4 db ok<br>";
echo implode(', ', $pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN));