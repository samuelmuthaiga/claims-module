import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { requestContext } from '../context/request-context';

export interface RequestWithId extends Request {
  requestId?: string;
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: RequestWithId, res: Response, next: NextFunction): void {
    const incoming = req.headers['x-request-id'];
    const requestId =
      typeof incoming === 'string' && incoming.length <= 128 ? incoming : randomUUID();
    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);
    const forwarded = req.headers['x-forwarded-for'];
    const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0] : req.ip) ?? 'unknown';
    requestContext.run({ requestId, ip: ip.trim() }, () => next());
  }
}
