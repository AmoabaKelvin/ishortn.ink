CREATE TABLE `LinkVisitDailySummary` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`linkId` int NOT NULL,
	`date` date NOT NULL,
	`clicks` int NOT NULL DEFAULT 0,
	`uniqueClicks` int NOT NULL DEFAULT 0,
	CONSTRAINT `LinkVisitDailySummary_id` PRIMARY KEY(`id`),
	CONSTRAINT `link_date_unique` UNIQUE(`linkId`,`date`)
);
--> statement-breakpoint
ALTER TABLE `Token` MODIFY COLUMN `token` varchar(255);