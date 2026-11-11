import { AdminShell } from '@/components/admin/AdminShell';

/** Every admin page except sign-in lives inside the shell (session check + sidebar). */
export default function PanelLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AdminShell>{children}</AdminShell>;
}
