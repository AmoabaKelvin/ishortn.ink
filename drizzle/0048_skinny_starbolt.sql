CREATE TABLE IF NOT EXISTS `GeoRule` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`linkId` int NOT NULL,
	`type` enum('country','continent') NOT NULL,
	`condition` enum('in','not_in') NOT NULL DEFAULT 'in',
	`values` json NOT NULL,
	`action` enum('redirect','block') NOT NULL,
	`destination` varchar(2048),
	`blockMessage` varchar(500),
	`priority` int NOT NULL DEFAULT 0,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `GeoRule_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
DROP PROCEDURE IF EXISTS add_isQrCode;
--> statement-breakpoint
CREATE PROCEDURE add_isQrCode()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'Link' AND COLUMN_NAME = 'isQrCode' AND TABLE_SCHEMA = DATABASE()
  ) THEN
    ALTER TABLE `Link` ADD `isQrCode` boolean DEFAULT false;
  END IF;
END;
--> statement-breakpoint
CALL add_isQrCode();
--> statement-breakpoint
DROP PROCEDURE IF EXISTS add_isQrCode;
--> statement-breakpoint
DROP PROCEDURE IF EXISTS add_matchedGeoRuleId;
--> statement-breakpoint
CREATE PROCEDURE add_matchedGeoRuleId()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'LinkVisit' AND COLUMN_NAME = 'matchedGeoRuleId' AND TABLE_SCHEMA = DATABASE()
  ) THEN
    ALTER TABLE `LinkVisit` ADD `matchedGeoRuleId` int;
  END IF;
END;
--> statement-breakpoint
CALL add_matchedGeoRuleId();
--> statement-breakpoint
DROP PROCEDURE IF EXISTS add_matchedGeoRuleId;
--> statement-breakpoint
DROP PROCEDURE IF EXISTS add_linkId_idx;
--> statement-breakpoint
CREATE PROCEDURE add_linkId_idx()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_NAME = 'GeoRule' AND INDEX_NAME = 'linkId_idx' AND TABLE_SCHEMA = DATABASE()
  ) THEN
    CREATE INDEX `linkId_idx` ON `GeoRule` (`linkId`);
  END IF;
END;
--> statement-breakpoint
CALL add_linkId_idx();
--> statement-breakpoint
DROP PROCEDURE IF EXISTS add_linkId_idx;
--> statement-breakpoint
DROP PROCEDURE IF EXISTS add_priority_idx;
--> statement-breakpoint
CREATE PROCEDURE add_priority_idx()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_NAME = 'GeoRule' AND INDEX_NAME = 'priority_idx' AND TABLE_SCHEMA = DATABASE()
  ) THEN
    CREATE INDEX `priority_idx` ON `GeoRule` (`linkId`,`priority`);
  END IF;
END;
--> statement-breakpoint
CALL add_priority_idx();
--> statement-breakpoint
DROP PROCEDURE IF EXISTS add_priority_idx;
--> statement-breakpoint
DROP PROCEDURE IF EXISTS add_geoRuleId_idx;
--> statement-breakpoint
CREATE PROCEDURE add_geoRuleId_idx()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_NAME = 'LinkVisit' AND INDEX_NAME = 'geoRuleId_idx' AND TABLE_SCHEMA = DATABASE()
  ) THEN
    CREATE INDEX `geoRuleId_idx` ON `LinkVisit` (`matchedGeoRuleId`);
  END IF;
END;
--> statement-breakpoint
CALL add_geoRuleId_idx();
--> statement-breakpoint
DROP PROCEDURE IF EXISTS add_geoRuleId_idx;
