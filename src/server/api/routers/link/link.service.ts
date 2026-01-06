/**
 * Link Service - Re-export Aggregator
 *
 * This file maintains backward compatibility by re-exporting all functions
 * from the modular services directory. The actual implementations have been
 * split into focused service files under ./services/
 *
 * Service breakdown:
 * - link-shared.ts: Shared utilities (constructCacheKey, getDateRangeFromFilter)
 * - link-crud.service.ts: CRUD operations (getLinks, getLink, createLink, updateLink, deleteLink, etc.)
 * - link-analytics.service.ts: Analytics operations (getLinkVisits, getAllUserAnalytics, getStats, resetLinkStatistics)
 * - link-bulk.service.ts: Bulk operations (bulkDeleteLinks, bulkArchiveLinks, bulkToggleLinkStatus, bulkCreateLinks)
 * - link-password.service.ts: Password operations (verifyLinkPassword, changeLinkPassword)
 * - link-status.service.ts: Status operations (togglePublicStats, toggleLinkStatus, toggleArchive, checkAliasAvailability)
 * - link-utils.service.ts: Utility operations (exportAllUserLinks, checkPresenceOfVercelHeaders)
 */

export * from "./services";
