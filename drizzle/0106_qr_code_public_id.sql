ALTER TABLE `QrCode` ADD `publicId` varchar(16);--> statement-breakpoint
ALTER TABLE `QrCode` ADD CONSTRAINT `qrcode_publicId_unique` UNIQUE(`publicId`);