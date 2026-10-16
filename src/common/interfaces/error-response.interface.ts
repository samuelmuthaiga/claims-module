export interface FieldError {
  key: string;
  message: string;
}

export interface ErrorResponse {
  [key: string]: unknown;
  success: false;
  statusCode: number;
  error: string;
  errorCode: string;
  message: string;
  errors?: FieldError[];
  details?: unknown;
  requestId?: string;
  path?: string;
  timestamp: string;
}
