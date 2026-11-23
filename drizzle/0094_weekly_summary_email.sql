CREATE TABLE `WeeklySummaryEmail` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`userId` varchar(32) NOT NULL,
	`weekStart` date NOT NULL,
	`clicks` int NOT NULL,
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `WeeklySummaryEmail_id` PRIMARY KEY(`id`),
	CONSTRAINT `weeklySummaryEmail_week_user` UNIQUE(`weekStart`,`userId`)
);
--> statement-breakpoint
ALTER TABLE `User` ADD `weeklySummaryEnabled` boolean DEFAULT true NOT NULL;