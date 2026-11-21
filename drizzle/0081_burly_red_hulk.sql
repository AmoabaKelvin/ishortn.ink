ALTER TABLE `Token` ADD `name` varchar(64);--> statement-breakpoint
ALTER TABLE `Token` ADD `prefix` varchar(8);--> statement-breakpoint
ALTER TABLE `Token` ADD `lastUsedAt` timestamp;