const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

function getPagination(query) {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  return { page, limit, skip: (page - 1) * limit };
}

function paginationMeta(page, limit, total) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page * limit < total,
    hasPreviousPage: page > 1,
  };
}

module.exports = { getPagination, paginationMeta };
