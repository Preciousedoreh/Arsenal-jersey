'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useId, useState } from 'react';
import { Lock } from 'lucide-react';
import { Alert, FormField, inputClass } from '@/components/admin/ui';
import { Logo } from '@/components/ui/Brand';
import { Button } from '@/components/ui/Button';
import { adminApi } from '@/lib/admin-api';
import { ApiError } from '@/lib/api';

/** Only same-site admin paths are accepted as a post-login destination (no open redirects). */
const safeNext = (value: string | null) => (value && /^\/admin(\/|$)/.test(value) && !value.startsWith('//') ? value : '/admin');

export function LoginForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get('next'));
  const emailId = useId();
  const passwordId = useId();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await adminApi.signIn(email.trim(), password);
      const { data } = await adminApi.me();
      if (data.role !== 'ADMIN') {
        await adminApi.signOut().catch(() => undefined);
        setError('This account does not have admin access.');
        return;
      }
      router.replace(next);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setError('Wrong email or password.');
      else if (err instanceof ApiError && err.status === 429) setError(err.message);
      else setError(err instanceof Error ? err.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <form onSubmit={onSubmit} className="border border-line border-t-[3px] border-t-primary bg-white p-7" noValidate>
          <h1 className="headline flex items-center gap-2 text-3xl">
            <Lock aria-hidden className="size-5 text-gold" /> Admin sign in
          </h1>
          <div className="mt-6 space-y-4">
            <FormField label="Email" htmlFor={emailId}>
              <input id={emailId} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            </FormField>
            <FormField label="Password" htmlFor={passwordId}>
              <input id={passwordId} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
            </FormField>
          </div>
          {error && (
            <div className="mt-4">
              <Alert>{error}</Alert>
            </div>
          )}
          <Button type="submit" fullWidth arrow disabled={busy || !email || !password} className="mt-6 h-11">
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  );
}
