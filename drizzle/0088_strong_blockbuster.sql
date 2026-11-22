ALTER TABLE `CustomDomain` ADD `reviewStatus` enum('held','approved','rejected');--> statement-breakpoint
ALTER TABLE `CustomDomain` ADD `reviewReason` varchar(255);--> statement-breakpoint
ALTER TABLE `CustomDomain` ADD `reviewedAt` timestamp;--> statement-breakpoint
ALTER TABLE `CustomDomain` ADD `registrableDomainRegisteredAt` timestamp;--> statement-breakpoint
ALTER TABLE `CustomDomain` ADD `registrar` varchar(255);--> statement-breakpoint
ALTER TABLE `CustomDomain` ADD `rdapLookupFailed` boolean DEFAULT false;--> statement-breakpoint
CREATE INDEX `reviewStatus_idx` ON `CustomDomain` (`reviewStatus`);