CREATE TABLE `LinkMilestone` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`linkId` int NOT NULL,
	`userId` varchar(32) NOT NULL,
	`threshold` int NOT NULL,
	`notifiedAt` timestamp,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `LinkMilestone_id` PRIMARY KEY(`id`),
	CONSTRAINT `link_threshold_unique` UNIQUE(`linkId`,`threshold`)
);
--> statement-breakpoint
CREATE INDEX `linkId_idx` ON `LinkMilestone` (`linkId`);