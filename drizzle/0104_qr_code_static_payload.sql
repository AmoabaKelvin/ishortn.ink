ALTER TABLE `QrCode` ADD `payloadType` varchar(16);--> statement-breakpoint
ALTER TABLE `QrCode` ADD `payloadFields` json;