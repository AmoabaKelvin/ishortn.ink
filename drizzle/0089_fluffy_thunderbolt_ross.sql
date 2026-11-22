ALTER TABLE `AudienceFeedback` ADD `acquisitionAnsweredAt` timestamp;--> statement-breakpoint
ALTER TABLE `AudienceFeedback` ADD `acquisitionDismissedAt` timestamp;--> statement-breakpoint
ALTER TABLE `AudienceFeedback` ADD `acquisitionDismissCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `acquisitionAnsweredAt_idx` ON `AudienceFeedback` (`acquisitionAnsweredAt`);