import BreadCrumb from '@/components/breadcrumb';
import { ProfileBlock } from '@/components/profile-block/profile-block';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import { prisma } from '@/lib/prisma';
import { LOCAL_USER_ID } from '@/utils/const';

const breadcrumbItems = [{ title: 'Profile', link: '/dashboard/profile' }];

export default async function ProfilePage() {
  const user = await prisma.user.findUnique({ where: { id: LOCAL_USER_ID } });

  return (
    <div className='flex-1 space-y-2 p-4 pt-6 sm:space-y-4 md:p-8'>
      <BreadCrumb items={breadcrumbItems} />
      <div className='flex items-start justify-between'>
        <Heading
          maxWidthClass='max-w-[calc(100%-175px)]'
          title='Profile'
          description='Manage your account settings'
        />
      </div>
      <Separator />
      <ProfileBlock user={user} />
    </div>
  );
}
