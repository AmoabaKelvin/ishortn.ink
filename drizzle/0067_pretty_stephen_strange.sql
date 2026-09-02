ALTER TABLE `GeoRule` MODIFY COLUMN `type` enum('country','continent','device','os') NOT NULL;--> statement-breakpoint
ALTER TABLE `Link` ADD `activateAt` datetime;