export interface ApiResponse<T> {
  data: T;
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface SearchParams {
  lat: number;
  lng: number;
  radiusKm: number;
  category: string;
}
