/**
 * Link Services - Aggregated exports
 * This file provides backward-compatible exports from all link service modules
 */

// Shared utilities
export { constructCacheKey, getDateRangeFromFilter } from "./link-shared";

// CRUD operations
export {
  getLinks,
  getLink,
  getLinkByAlias,
  createLink,
  updateLink,
  deleteLink,
  shortenLinkWithAutoAlias,
  retrieveOriginalUrl,
} from "./link-crud.service";

// Analytics operations
export {
  getLinkVisits,
  getAllUserAnalytics,
  getStats,
  resetLinkStatistics,
} from "./link-analytics.service";

// Bulk operations
export {
  bulkDeleteLinks,
  bulkArchiveLinks,
  bulkToggleLinkStatus,
  bulkCreateLinks,
} from "./link-bulk.service";

// Password operations
export {
  verifyLinkPassword,
  changeLinkPassword,
} from "./link-password.service";

// Status operations
export {
  togglePublicStats,
  toggleLinkStatus,
  toggleArchive,
  checkAliasAvailability,
} from "./link-status.service";

// Utility operations
export {
  exportAllUserLinks,
  checkPresenceOfVercelHeaders,
} from "./link-utils.service";
