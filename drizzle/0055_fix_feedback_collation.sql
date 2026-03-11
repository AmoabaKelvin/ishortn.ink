-- Fix collation mismatch between Feedback table (utf8mb4_0900_ai_ci) and User table (utf8mb4_unicode_ci)
-- Same pattern as 0033, 0037, and 0039 collation fixes
ALTER TABLE `Feedback` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
