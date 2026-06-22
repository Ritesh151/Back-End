import { z } from 'zod';

export const paginationQuerySchema = z.object({
  query: z.object({
    page: z.string().optional().default('1'),
    limit: z.string().optional().default('10'),
    keyword: z.string().optional(),
    category: z.string().optional(),
    minRating: z.string().optional(),
    minLeadScore: z.string().optional(),
    websiteStatus: z.string().optional(),
  }),
});

export type PaginationQueryDTO = z.infer<typeof paginationQuerySchema>;
