import { Suspense } from 'react';
import { LoginForm } from '@/components/admin/LoginForm';

export default function AdminLoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
