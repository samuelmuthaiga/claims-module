export interface ApiResponse<T> {
  success: true;
  statusCode: number;
  data: T;
  message?: string;
  meta?: Record<string, string | number | boolean | null>;
  timestamp: string;
}
