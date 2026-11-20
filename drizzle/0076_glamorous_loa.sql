ALTER TABLE `CustomDomain` ADD `wwwHostnameReleased` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `User` ADD `restrictedAt` timestamp;--> statement-breakpoint
ALTER TABLE `User` ADD `restrictedReason` varchar(255);