CREATE TABLE `GeoRule` (
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
ALTER TABLE `LinkVisit` ADD `matchedGeoRuleId` int;--> statement-breakpoint
CREATE INDEX `linkId_idx` ON `GeoRule` (`linkId`);--> statement-breakpoint
CREATE INDEX `priority_idx` ON `GeoRule` (`linkId`,`priority`);--> statement-breakpoint
CREATE INDEX `geoRuleId_idx` ON `LinkVisit` (`matchedGeoRuleId`);