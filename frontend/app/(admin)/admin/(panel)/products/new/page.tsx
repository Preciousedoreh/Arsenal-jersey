import { PageHeader } from '@/components/admin/ui';
import { ProductForm } from '@/components/admin/ProductForm';

export default function NewProductPage() {
  return (
    <>
      <PageHeader title="New product" description="Add a jersey or other item: details, photos, price, sizes and opening stock." />
      <ProductForm />
    </>
  );
}
