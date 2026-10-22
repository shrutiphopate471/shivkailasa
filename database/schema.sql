-- Import in phpMyAdmin (select your database first).
CREATE TABLE IF NOT EXISTS leads (
  id CHAR(36) PRIMARY KEY,
  token_hash CHAR(64) NOT NULL,
  name VARCHAR(80) NOT NULL,
  phone CHAR(10) NOT NULL,
  email VARCHAR(120) NULL,
  purpose VARCHAR(40), awareness VARCHAR(40), bhk VARCHAR(40), budget VARCHAR(40),
  timeline VARCHAR(40), funding VARCHAR(40), decision_maker VARCHAR(40),
  attracted VARCHAR(255),
  score TINYINT UNSIGNED NOT NULL DEFAULT 0,
  tag ENUM('Hot','Warm','Nurture') NOT NULL DEFAULT 'Nurture',
  status ENUM('in_progress','info_requested','visit_booked','contacted','closed') NOT NULL DEFAULT 'in_progress',
  visit_date DATE NULL, visit_time TIME NULL, visitors TINYINT UNSIGNED NULL,
  source_page VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_phone_created (phone, created_at),
  KEY idx_status (status),
  KEY idx_visit (visit_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Rows are created automatically on first booking; edit capacity here to change one slot.
CREATE TABLE IF NOT EXISTS visit_slots (
  slot_date DATE NOT NULL,
  slot_time TIME NOT NULL,
  capacity TINYINT UNSIGNED NOT NULL,
  booked TINYINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (slot_date, slot_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rate_limits (
  ip_hash CHAR(64) NOT NULL,
  bucket VARCHAR(20) NOT NULL,
  window_start INT UNSIGNED NOT NULL,
  hits INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (ip_hash, bucket, window_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
