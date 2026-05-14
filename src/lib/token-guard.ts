const failedAttempts = new Map<string, { count: number; blockedUntil: number }>();

export function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const record = failedAttempts.get(ip) ?? { count: 0, blockedUntil: 0 };

  if (now < record.blockedUntil) return; // already blocked, don't reset count

  record.count++;
  if (record.count >= 10) {
    // Block for 15 minutes after 10 failed attempts
    record.blockedUntil = now + 15 * 60 * 1000;
    record.count = 0;
  }

  failedAttempts.set(ip, record);
}

export function isBlocked(ip: string): boolean {
  const record = failedAttempts.get(ip);
  if (!record) return false;
  return Date.now() < record.blockedUntil;
}