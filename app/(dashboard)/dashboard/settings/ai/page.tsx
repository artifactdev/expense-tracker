import BreadCrumb from '@/components/breadcrumb';
import { AISettingsForm } from '@/components/forms/ai-settings-form/ai-settings-form';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';

const breadcrumbItems = [
  { title: 'Settings', link: '/dashboard/settings/ai' },
  { title: 'AI', link: '/dashboard/settings/ai' },
];

export default function AISettingsPage() {
  return (
    <div className='flex-1 space-y-2 p-4 pt-6 sm:space-y-4 md:p-8'>
      <BreadCrumb items={breadcrumbItems} />
      <div className='flex items-start justify-between'>
        <Heading
          maxWidthClass='max-w-[calc(100%-175px)]'
          title='AI Settings'
          description='Configure your AI endpoint, model, and feature toggles'
        />
      </div>
      <Separator />
      <div className='max-w-2xl'>
        <AISettingsForm />
      </div>
    </div>
  );
}
