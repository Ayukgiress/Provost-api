import type { NextFunction, Request, Response } from 'express';
import { RequestIdMiddleware } from './request-id.middleware.js';

describe('RequestIdMiddleware', () => {
  it('logs only route metadata and replaces untrusted client IDs', () => {
    const info = vi.fn();
    const middleware = new RequestIdMiddleware({
      getPino: () => ({ info }),
    } as never);
    const finishHandlers: Array<() => void> = [];
    const headers: Record<string, string> = {};
    const req = {
      header: vi.fn().mockReturnValue('person@example.com'),
      method: 'GET',
      baseUrl: '/me/profile',
      route: { path: '/' },
    } as unknown as Request;
    const res = {
      setHeader: (key: string, value: string) => {
        headers[key] = value;
      },
      once: (_event: string, handler: () => void) => {
        finishHandlers.push(handler);
      },
      statusCode: 200,
    } as unknown as Response;

    middleware.use(req, res, vi.fn() as NextFunction);
    finishHandlers.forEach((handler) => handler());

    expect(headers['X-Request-Id']).toMatch(/^[0-9a-f-]{36}$/i);
    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        route: '/me/profile/',
        statusCode: 200,
      }),
      'HTTP request completed',
    );
    const logged = JSON.stringify(info.mock.calls);
    expect(logged).not.toContain('person@example.com');
    expect(logged).not.toContain('authorization');
  });
});
