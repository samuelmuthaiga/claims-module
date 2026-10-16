import { Paginated } from '../dto/pagination-response.dto';

export const paginate = <T>(rows: T[], page: number, limit: number): Paginated<T> => {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  return {
    data: rows.slice(start, start + limit),
    meta: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
};
