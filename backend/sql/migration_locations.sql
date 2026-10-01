CREATE TABLE IF NOT EXISTS user_locations (
    user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    latitude DOUBLE NOT NULL,
    longitude DOUBLE NOT NULL,
    accuracy DOUBLE NULL,
    heading DOUBLE NULL,
    speed DOUBLE NULL,
    navigating BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_locations_live (navigating, updated_at),
    CONSTRAINT fk_user_locations_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS location_trail (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    latitude DOUBLE NOT NULL,
    longitude DOUBLE NOT NULL,
    accuracy DOUBLE NULL,
    heading DOUBLE NULL,
    speed DOUBLE NULL,
    recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_location_trail_user_recorded (user_id, recorded_at),
    CONSTRAINT fk_location_trail_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;