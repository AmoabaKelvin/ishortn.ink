ALTER TABLE `BioPageView` ADD `viewId` char(36);--> statement-breakpoint
ALTER TABLE `BioPageView` ADD CONSTRAINT `viewId_idx` UNIQUE(`viewId`);