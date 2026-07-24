import { redirect } from 'next/navigation';
import { defaultNetworkPath } from '@/lib/nav';

/** Network entrypoint — jump into the subnet browser on a default netuid. */
export default function SubnetsIndexPage() {
  redirect(defaultNetworkPath());
}
