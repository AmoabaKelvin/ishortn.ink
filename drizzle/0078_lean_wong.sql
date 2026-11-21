CREATE TABLE `EmailSuppression` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`email` varchar(255) NOT NULL,
	`suppressionType` enum('bounced','complained') NOT NULL,
	`userId` varchar(32),
	`detail` varchar(255),
	`lastEventAt` timestamp NOT NULL,
	`clearedAt` timestamp,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `EmailSuppression_id` PRIMARY KEY(`id`),
	CONSTRAINT `emailSuppression_email_type_idx` UNIQUE(`email`,`suppressionType`)
);
--> statement-breakpoint
CREATE INDEX `emailSuppression_lastEventAt_idx` ON `EmailSuppression` (`lastEventAt`);