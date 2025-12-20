-- Fix collation mismatch between Team tables (utf8mb4_0900_ai_ci) and User table (utf8mb4_unicode_ci)
-- This ensures joins between TeamMember.userId and User.id work correctly
ALTER TABLE `Team` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;--> statement-breakpoint
ALTER TABLE `TeamMember` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;--> statement-breakpoint
ALTER TABLE `TeamInvite` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
