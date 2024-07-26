CREATE TABLE `UniqueLinkVisit` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`linkId` int NOT NULL,
	`ipHash` varchar(255) NOT NULL,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `UniqueLinkVisit_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `linkId_idx` ON `UniqueLinkVisit` (`linkId`);--> statement-breakpoint
CREATE INDEX `ipHash_idx` ON `UniqueLinkVisit` (`ipHash`);--> statement-breakpoint
CREATE INDEX `unique_visit_idx` ON `UniqueLinkVisit` (`linkId`,`ipHash`);