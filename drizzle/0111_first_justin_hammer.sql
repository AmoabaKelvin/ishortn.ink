CREATE TABLE `BioSubscriber` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`bioPageId` int NOT NULL,
	`email` varchar(254) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `BioSubscriber_id` PRIMARY KEY(`id`),
	CONSTRAINT `bio_subscriber_page_email_unique` UNIQUE(`bioPageId`,`email`)
);
--> statement-breakpoint
ALTER TABLE `BioBlock` MODIFY COLUMN `blockType` enum('link','heading','text','social','divider','email','embed','image','email_capture') NOT NULL;--> statement-breakpoint
CREATE INDEX `bioPageId_createdAt_idx` ON `BioSubscriber` (`bioPageId`,`createdAt`);