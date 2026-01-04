-- Fix collation mismatch between FolderPermission table (utf8mb4_0900_ai_ci) and User table (utf8mb4_unicode_ci)
-- Same pattern as 0033_fix_team_collation.sql and 0037_fix_customdomain_collation.sql
ALTER TABLE `FolderPermission` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
