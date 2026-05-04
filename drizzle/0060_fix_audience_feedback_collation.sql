-- Fix collation mismatch between AudienceFeedback table (utf8mb4_0900_ai_ci) and User table (utf8mb4_unicode_ci)
-- Same pattern as 0033, 0037, 0039, and 0055 collation fixes
ALTER TABLE `AudienceFeedback` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
