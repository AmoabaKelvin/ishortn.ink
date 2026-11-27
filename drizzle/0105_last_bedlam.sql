ALTER TABLE `Token` ADD `teamId` int;--> statement-breakpoint
ALTER TABLE `Token` ADD `createdByUserId` varchar(32);--> statement-breakpoint
CREATE INDEX `teamId_idx` ON `Token` (`teamId`);