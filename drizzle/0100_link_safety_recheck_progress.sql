ALTER TABLE `LinkSafetyRecheck` ADD `checksDone` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `LinkSafetyRecheck` ADD `lastCheckedAt` timestamp;--> statement-breakpoint
ALTER TABLE `LinkSafetyRecheck` ADD `result` varchar(16);