-- Fix collation mismatch between CustomDomain table (utf8mb4_0900_ai_ci) and User table (utf8mb4_unicode_ci)
-- This ensures joins between CustomDomain.userId and User.id work correctly
-- Same fix as 0033_fix_team_collation.sql but for CustomDomain
ALTER TABLE `CustomDomain` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
