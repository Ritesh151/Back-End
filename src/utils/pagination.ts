export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginationResult<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const calculatePagination = (
  page: number,
  limit: number,
  total: number
): PaginationResult<{
  skip: number;
  limit: number;
}> => {
  const sanitizedPage = Math.max(1, page);
  const sanitizedLimit = Math.max(1, Math.min(limit, 100));
  const totalPages = Math.ceil(total / sanitizedLimit);

  return {
    items: [],
    pagination: {
      page: sanitizedPage,
      limit: sanitizedLimit,
      total,
      totalPages,
    },
  };
};

export const getPaginationQuery = (query: {
  page?: string;
  limit?: string;
}): PaginationParams => {
  const page = parseInt(query.page || '1', 10);
  const limit = parseInt(query.limit || '10', 10);

  return {
    page,
    limit,
  };
};
