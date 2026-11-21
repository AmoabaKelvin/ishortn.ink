CREATE TABLE `ReservedAlias` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`domain` varchar(255) NOT NULL,
	`alias` varchar(20) NOT NULL,
	`reason` enum('deleted','purged','blocked') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ReservedAlias_id` PRIMARY KEY(`id`),
	CONSTRAINT `reservedAlias_domain_alias` UNIQUE(`domain`,`alias`)
);
