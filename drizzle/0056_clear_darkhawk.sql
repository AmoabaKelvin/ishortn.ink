-- Step 1: Dedupe existing UniqueLinkVisit rows before adding the UNIQUE constraint.
-- Keeps the row with the smallest id for each (linkId, ipHash) pair.
DELETE u1 FROM `UniqueLinkVisit` u1
INNER JOIN `UniqueLinkVisit` u2
  ON u1.linkId = u2.linkId
  AND u1.ipHash = u2.ipHash
  AND u1.id > u2.id;
--> statement-breakpoint
-- Step 2: Replace the non-unique composite index with a UNIQUE constraint.
-- Makes ON DUPLICATE KEY UPDATE correct under concurrent inserts.
DROP INDEX `unique_visit_idx` ON `UniqueLinkVisit`;--> statement-breakpoint
ALTER TABLE `UniqueLinkVisit` ADD CONSTRAINT `unique_visit_idx` UNIQUE(`linkId`,`ipHash`);
