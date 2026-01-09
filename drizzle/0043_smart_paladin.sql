ALTER TABLE `QrPreset` ADD `logoImage` longtext;--> statement-breakpoint
ALTER TABLE `QrPreset` ADD `logoSize` int DEFAULT 25 NOT NULL;--> statement-breakpoint
ALTER TABLE `QrPreset` ADD `logoMargin` int DEFAULT 4 NOT NULL;--> statement-breakpoint
ALTER TABLE `QrPreset` ADD `logoBorderRadius` int DEFAULT 8 NOT NULL;