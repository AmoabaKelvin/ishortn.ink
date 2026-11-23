CREATE TABLE `LinkPreviousAddress` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`linkId` int NOT NULL,
	`domain` varchar(255) NOT NULL,
	`alias` varchar(20) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `LinkPreviousAddress_id` PRIMARY KEY(`id`),
	CONSTRAINT `linkPreviousAddress_domain_alias` UNIQUE(`domain`,`alias`)
);
--> statement-breakpoint
CREATE INDEX `linkPreviousAddress_linkId_idx` ON `LinkPreviousAddress` (`linkId`);