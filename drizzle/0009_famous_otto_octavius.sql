CREATE TABLE `CustomDomain` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`domain` varchar(255),
	`userId` varchar(32) NOT NULL,
	`createdAt` timestamp DEFAULT (now()),
	`status` enum('pending','active','invalid') DEFAULT 'pending',
	CONSTRAINT `CustomDomain_id` PRIMARY KEY(`id`),
	CONSTRAINT `CustomDomain_domain_unique` UNIQUE(`domain`)
);
--> statement-breakpoint
CREATE INDEX `userId_idx` ON `CustomDomain` (`userId`);