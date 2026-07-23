'use client';

import { usePathname } from 'next/navigation';
import NewIssuesWatcher from './NewIssuesWatcher';
import { isChromelessPath } from '@/lib/marketing-routes';

export default function BackgroundWatchers() {
  const pathname = usePathname();
  if (isChromelessPath(pathname)) return null;

  return (
    <>
      <NewIssuesWatcher />
    </>
  );
}
