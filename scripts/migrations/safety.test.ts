import { describe, expect, test } from "bun:test";

import { dangers, splitStatements } from "./safety";

describe("dangers", () => {
  test("allows additive changes", () => {
    expect(
      dangers([
        "ALTER TABLE `User` ADD `droppedEventCount` int DEFAULT 0;",
        "CREATE TABLE `Campaign` (`id` serial PRIMARY KEY, `name` varchar(255) NOT NULL);",
        "CREATE INDEX `campaign_user_idx` ON `Campaign` (`userId`);",
        "ALTER TABLE `Link` ADD CONSTRAINT `fk` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE cascade ON UPDATE no action;",
        "ALTER TABLE `Link` ADD `updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP;",
      ]),
    ).toEqual([]);
  });

  test.each([
    ["DROP TABLE `Old`;", "drops a database object"],
    ["ALTER TABLE `User` DROP COLUMN `plan`;", "drops a column"],
    ["ALTER TABLE `Link` DROP INDEX `alias_idx`;", "drops a column"],
    ["ALTER TABLE `Link` MODIFY COLUMN `alias` varchar(20);", "changes a column"],
    ["ALTER TABLE `Link` CHANGE `alias` `slug` varchar(255);", "changes a column"],
    ["RENAME TABLE `Link` TO `ShortLink`;", "renames"],
    ["ALTER TABLE `Link` RENAME COLUMN `alias` TO `slug`;", "renames"],
    ["TRUNCATE TABLE `LinkVisit`;", "empties a table"],
    ["DELETE FROM `LinkVisit` WHERE `createdAt` < now();", "deletes rows"],
    ["UPDATE `User` SET `plan` = 'free';", "rewrites existing rows"],
  ])("flags %s", (statement, reason) => {
    expect(dangers([statement]).join(" ")).toContain(reason);
  });
});

test("splitStatements follows drizzle's breakpoints", () => {
  expect(
    splitStatements("ALTER TABLE a ADD b int;--> statement-breakpoint\nALTER TABLE a ADD c int;\n"),
  ).toEqual(["ALTER TABLE a ADD b int;", "ALTER TABLE a ADD c int;"]);
});
