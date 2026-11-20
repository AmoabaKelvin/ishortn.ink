CREATE TABLE `ApiAccessSunset` (
	`id` int NOT NULL,
	`sunsetAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ApiAccessSunset_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `User` ADD `apiSunsetNoticeSentAt` timestamp;--> statement-breakpoint
ALTER TABLE `User` ADD `apiSunsetReminderSentAt` timestamp;