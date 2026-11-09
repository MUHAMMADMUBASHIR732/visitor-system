import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Visit } from '@/lib/types';
import { VisitRow } from './VisitRow';
import { Card, EmptyState, Skeleton } from './ui';

interface Props {
  visits: Visit[] | undefined;
  loading?: boolean;
  onOpen: (v: Visit) => void;
  showHost?: boolean;
  showElapsed?: boolean;
  emptyTitle: string;
  emptyBody?: string;
  emptyAction?: ReactNode;
  trailing?: (v: Visit) => ReactNode;
}

export function VisitList({ visits, loading, onOpen, showHost, showElapsed, emptyTitle, emptyBody, emptyAction, trailing }: Props) {
  return (
    <Card className="overflow-hidden">
      {loading ? (
        <ul aria-busy>
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-center gap-3.5 border-b border-line px-5 py-4 last:border-b-0">
              <Skeleton className="size-11 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3.5 w-56 max-w-full" />
              </div>
              <Skeleton className="h-7 w-20 rounded-full" />
            </li>
          ))}
        </ul>
      ) : !visits || visits.length === 0 ? (
        <EmptyState icon={<Inbox className="size-6" />} title={emptyTitle} body={emptyBody} action={emptyAction} />
      ) : (
        <ul>
          {visits.map((v) => (
            <VisitRow key={v.id} visit={v} onOpen={onOpen} showHost={showHost} showElapsed={showElapsed} trailing={trailing?.(v)} />
          ))}
        </ul>
      )}
    </Card>
  );
}
