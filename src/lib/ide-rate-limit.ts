import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory rate limiter (works fine on Vercel serverless with these limits)
const store = new Map<string, { count: number; resetAt: number }>();

interface RateLimitOptions {
  windowMs: number;  // time window in ms
  max: number;       // max requests per window
}

export function rateLimit(options: RateLimitOptions) {
  return function check(key: string): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    const record = store.get(key);

    if (!record || now > record.resetAt) {
      store.set(key, { count: 1, resetAt: now + options.windowMs });
      return { allowed: true };
    }

    if (record.count >= options.max) {
      return { allowed: false, retryAfter: Math.ceil((record.resetAt - now) / 1000) };
    }

    record.count++;
    return { allowed: true };
  };
}

// Pre-configured limiters for each endpoint
export const chatLimiter = rateLimit({ windowMs: 60_000, max: 20 });      // 20 requests/min
export const meLimiter = rateLimit({ windowMs: 60_000, max: 30 });         // 30 requests/min
export const conversationsLimiter = rateLimit({ windowMs: 60_000, max: 30 }); // 30 requests/min

export function rateLimitResponse(retryAfter: number) {
  return NextResponse.json(
    { error: 'Too many requests', retryAfter },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, x-ide-token',
      },
    }
  );
}