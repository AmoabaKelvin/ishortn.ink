ALTER TABLE `Link` ADD `verifiedClicksEnabled` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `LinkVisit` ADD `visitId` char(36);--> statement-breakpoint
ALTER TABLE `LinkVisit` ADD `verifiedAt` timestamp;--> statement-breakpoint
ALTER TABLE `LinkVisit` ADD CONSTRAINT `visitId_idx` UNIQUE(`visitId`);
