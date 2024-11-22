ALTER TABLE `User` ADD `monthlyLinkCount` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `User` ADD `lastLinkCountReset` timestamp DEFAULT (now());