ALTER TABLE `User` ADD `promoNoticeSentFor` varchar(32);--> statement-breakpoint
CREATE INDEX `eventTrackingPausedAt_idx` ON `User` (`eventTrackingPausedAt`);