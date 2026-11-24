ALTER TABLE `Link` ADD `statsShareToken` varchar(64);--> statement-breakpoint
ALTER TABLE `Link` ADD `statsSharedAt` timestamp;--> statement-breakpoint
ALTER TABLE `Link` ADD CONSTRAINT `statsShareToken_idx` UNIQUE(`statsShareToken`);