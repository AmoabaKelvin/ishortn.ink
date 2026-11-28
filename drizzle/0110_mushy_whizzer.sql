ALTER TABLE `BioBlock` MODIFY COLUMN `blockType` enum('link','heading','text','social','divider','email','embed','image') NOT NULL;--> statement-breakpoint
ALTER TABLE `BioBlock` ADD `imageWidth` int;--> statement-breakpoint
ALTER TABLE `BioBlock` ADD `imageHeight` int;