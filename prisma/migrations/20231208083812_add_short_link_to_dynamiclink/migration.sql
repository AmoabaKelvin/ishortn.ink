/*
  Warnings:

  - Added the required column `shortLink` to the `DynamicLinkChildLink` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `DynamicLinkChildLink` ADD COLUMN `shortLink` VARCHAR(191) NOT NULL;
