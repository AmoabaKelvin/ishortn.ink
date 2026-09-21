-- Fix collation mismatch between BioPage (utf8mb4_0900_ai_ci) and User (utf8mb4_unicode_ci);
-- the public bio queries join BioPage.userId to User.id.
-- Same pattern as 0033, 0037, 0039, 0055, and 0060 collation fixes
ALTER TABLE `BioPage` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--> statement-breakpoint
-- New tables inherit the database default; match User so this stops recurring.
ALTER DATABASE CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
