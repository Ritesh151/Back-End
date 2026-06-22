import { Response } from 'express';

export interface SuccessResponse {
  success: boolean;
  message: string;
  data: unknown;
}

export interface ErrorResponse {
  success: boolean;
  message: string;
  error?: unknown;
}

export interface PaginatedResponse<T> {
  success: boolean;
  message: string;
  data: {
    items: T[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export class APIResponse {
  static success<T>(
    res: Response,
    data: T,
    message = 'Request successful',
    statusCode = 200
  ): Response<SuccessResponse> {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
    });
  }

  static error(
    res: Response,
    message: string,
    error?: unknown,
    statusCode = 400
  ): Response<ErrorResponse> {
    return res.status(statusCode).json({
      success: false,
      message,
      error,
    });
  }

  static paginated<T>(
    res: Response,
    items: T[],
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    },
    message = 'Request successful',
    statusCode = 200
  ): Response<PaginatedResponse<T>> {
    return res.status(statusCode).json({
      success: true,
      message,
      data: {
        items,
        pagination,
      },
    });
  }

  static successWithLeads<T extends Array<unknown>>(
    res: Response,
    leads: T,
    message = 'Leads fetched successfully',
    statusCode = 200
  ): Response<SuccessResponse> {
    return res.status(statusCode).json({
      success: true,
      message,
      data: {
        leads,
        pagination: {
          page: 1,
          limit: leads.length,
          total: leads.length,
          totalPages: 1,
        },
      },
    });
  }
}