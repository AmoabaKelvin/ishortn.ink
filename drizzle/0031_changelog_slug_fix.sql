ALTER TABLE `User` DROP COLUMN `lastViewedChangelogDate`;--> statement-breakpoint
ALTER TABLE `User` ADD `lastViewedChangelogSlug` varchar(100);
