"use client"

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';

export default function IdeAuthPage() {
  const { user, isLoaded } = useUser();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      window.location.href = '/sign-in?redirect_url=/ide-auth';
      return;
    }

    fetch('/api/ide/auth', { method: 'POST' })
      .then(r => r.json())
      .then(({ token }) => {
        window.location.href = `slidedevai://auth?token=${token}`;
        setStatus('success');
      })
      .catch(() => setStatus('error'));
  }, [isLoaded, user]);

  return (
    <div className="flex h-screen items-center justify-center flex-col gap-4">
      {status === 'loading' && <p className="text-muted-foreground">Connecting SlideDevAI IDE...</p>}
      {status === 'success' && <p className="text-green-600">✅ Redirecting to IDE... you can close this tab.</p>}
      {status === 'error' && <p className="text-red-500">Something went wrong. Please try again.</p>}
    </div>
  );
}