ALTER TABLE `Tag` DROP INDEX `unique_tag_workspace`;--> statement-breakpoint
ALTER TABLE `Tag` ADD CONSTRAINT `unique_tag_team` UNIQUE(`name`,`teamId`);--> statement-breakpoint
ALTER TABLE `Team` ADD `deletedAt` timestamp;--> statement-breakpoint
CREATE INDEX `deletedAt_idx` ON `Team` (`deletedAt`);