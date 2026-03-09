DROP INDEX `token_idx` ON `AccountTransfer`;--> statement-breakpoint
DROP INDEX `domain_idx` ON `BlockedDomain`;--> statement-breakpoint
DROP INDEX `folderId_idx` ON `FolderPermission`;--> statement-breakpoint
DROP INDEX `linkId_idx` ON `LinkTag`;--> statement-breakpoint
DROP INDEX `slug_idx` ON `Team`;--> statement-breakpoint
DROP INDEX `token_idx` ON `TeamInvite`;--> statement-breakpoint
DROP INDEX `userId_idx` ON `User`;--> statement-breakpoint
ALTER TABLE `Token` MODIFY COLUMN `token` varchar(255);--> statement-breakpoint
CREATE INDEX `status_createdAt_idx` ON `CustomDomain` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `domain_idx` ON `Link` (`domain`);--> statement-breakpoint
CREATE INDEX `listing_idx` ON `Link` (`userId`,`teamId`,`isQrCode`,`archived`);--> statement-breakpoint
CREATE INDEX `linkId_createdAt_idx` ON `LinkVisit` (`linkId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `linkId_idx` ON `QrCode` (`linkId`);--> statement-breakpoint
CREATE INDEX `token_idx` ON `Token` (`token`);--> statement-breakpoint
CREATE INDEX `linkId_createdAt_idx` ON `UniqueLinkVisit` (`linkId`,`createdAt`);