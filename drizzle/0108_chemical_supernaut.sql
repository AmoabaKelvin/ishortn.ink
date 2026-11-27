CREATE TABLE `LinkHealth` (
	`linkId` int NOT NULL,
	`lastCheckedAt` timestamp NOT NULL,
	`lastStatus` int,
	`lastError` varchar(32),
	`consecutiveFailures` int NOT NULL DEFAULT 0,
	`brokenSince` timestamp,
	`alertedAt` timestamp,
	CONSTRAINT `LinkHealth_linkId` PRIMARY KEY(`linkId`)
);
--> statement-breakpoint
CREATE INDEX `linkHealth_lastCheckedAt_idx` ON `LinkHealth` (`lastCheckedAt`);--> statement-breakpoint
CREATE INDEX `linkHealth_brokenSince_idx` ON `LinkHealth` (`brokenSince`);