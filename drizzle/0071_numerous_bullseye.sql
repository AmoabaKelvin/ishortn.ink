ALTER TABLE `User` ADD `droppedEventCount` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `User` ADD `eventTrackingPausedAt` timestamp;