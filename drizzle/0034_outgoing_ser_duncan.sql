-- Note: unique_tag_workspace -> unique_tag_team rename was consolidated into 0032
-- This migration only adds the deletedAt column for soft delete
ALTER TABLE `Team` ADD `deletedAt` timestamp;--> statement-breakpoint
CREATE INDEX `deletedAt_idx` ON `Team` (`deletedAt`);
