import { Dashboard } from '@/components/dashboard/components/dashboard-block';
import { ParamsProps } from '@/types';

export default async function page({ searchParams }: ParamsProps) {
  const { viewport } = await searchParams;
  return <Dashboard viewport={viewport} />;
}
