CREATE TABLE `UserAttribution` (
	`userId` varchar(32) NOT NULL,
	`utmSource` varchar(255),
	`utmMedium` varchar(255),
	`utmCampaign` varchar(255),
	`utmTerm` varchar(255),
	`utmContent` varchar(255),
	`clickId` varchar(255),
	`clickIdType` varchar(16),
	`landingPath` varchar(255),
	`referrerHost` varchar(255),
	`firstSeenAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `UserAttribution_userId` PRIMARY KEY(`userId`)
);
--> statement-breakpoint
CREATE INDEX `utmCampaign_idx` ON `UserAttribution` (`utmCampaign`);