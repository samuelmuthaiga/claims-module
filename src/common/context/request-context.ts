import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  requestId: string;
  ip: string;
}

/** Per-request data (id, caller IP) readable from services without threading it through every call. */
export const requestContext = new AsyncLocalStorage<RequestContext>();
