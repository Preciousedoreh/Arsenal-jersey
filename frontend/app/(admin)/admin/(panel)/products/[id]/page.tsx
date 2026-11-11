import { Suspense } from 'react';
import { EditProduct } from '@/components/admin/EditProduct';

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <EditProduct id={id} />
    </Suspense>
  );
}
