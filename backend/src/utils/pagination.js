/**
 * Pagination utilities for Cognify API
 * 
 * Standard pagination parameters:
 * - page: Current page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * 
 * Response format:
 * {
 *   data: [...],
 *   pagination: {
 *     page: 1,
 *     limit: 20,
 *     total: 100,
 *     pages: 5
 *   }
 * }
 */

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Parse pagination parameters from request query
 * @param {Object} query - Express request.query object
 * @returns {Object} { page, limit, offset }
 */
export function parsePagination(query = {}) {
    const page = Math.max(1, parseInt(query.page, 10) || DEFAULT_PAGE);
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(query.limit, 10) || DEFAULT_LIMIT));
    const offset = (page - 1) * limit;

    return { page, limit, offset };
}

/**
 * Build paginated response object
 * @param {Array} data - The data array for current page
 * @param {number} total - Total count of items
 * @param {Object} pagination - { page, limit }
 * @returns {Object} Standardized paginated response
 */
export function buildPaginatedResponse(data, total, { page, limit }) {
    const totalCount = parseInt(total, 10) || 0;
    const totalPages = Math.ceil(totalCount / limit);

    return {
        data,
        pagination: {
            page,
            limit,
            total: totalCount,
            pages: totalPages
        }
    };
}

/**
 * Get pagination metadata for SQL queries
 * Returns the LIMIT and OFFSET clauses
 * @param {Object} pagination - { limit, offset }
 * @returns {Object} { limitClause, offsetClause, params }
 */
export function getPaginationClauses(pagination) {
    const { limit, offset } = pagination;
    return {
        limitClause: `LIMIT $${pagination.paramIndex}`,
        offsetClause: `OFFSET $${pagination.paramIndex + 1}`,
        params: [limit, offset]
    };
}

/**
 * Build complete paginated SQL query with count
 * @param {string} baseQuery - The base SELECT query (without ORDER BY, LIMIT, OFFSET)
 * @param {string} countQuery - The COUNT query (SELECT COUNT(*) ...)
 * @param {string} orderByClause - The ORDER BY clause
 * @param {Array} baseParams - Parameters for the base query
 * @param {Object} pagination - { limit, offset, paramIndex }
 * @returns {Object} { dataQuery, countQuery: countSql, params }
 */
export function buildPaginatedQuery(baseQuery, countQuery, orderByClause, baseParams = [], pagination) {
    const { limit, offset } = pagination;
    const paramCount = baseParams.length;

    const dataQuery = `${baseQuery} ${orderByClause} LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    const params = [...baseParams, limit, offset];

    return {
        dataQuery,
        countQuery,
        params
    };
}

export default {
    parsePagination,
    buildPaginatedResponse,
    getPaginationClauses,
    buildPaginatedQuery,
    DEFAULT_PAGE,
    DEFAULT_LIMIT,
    MAX_LIMIT
};
