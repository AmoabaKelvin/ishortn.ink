ALTER TABLE `Link` ADD `createdByUserId` varchar(32);--> statement-breakpoint
UPDATE `Link` SET `createdByUserId` = `userId` WHERE `createdByUserId` IS NULL;
