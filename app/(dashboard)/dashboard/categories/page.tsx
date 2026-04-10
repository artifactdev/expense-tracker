import BreadCrumb from '@/components/breadcrumb';
import { CategoriesContent } from '@/components/dashboard/categories/categories-content';

const breadcrumbItems = [{ title: 'Categories', link: '/dashboard/categories' }];

export default function CategoriesPage() {
  return (
    <div className='flex-1 space-y-2 p-4 pt-6 sm:space-y-4 md:p-8'>
      <BreadCrumb items={breadcrumbItems} />
      <CategoriesContent />
    </div>
  );
}
