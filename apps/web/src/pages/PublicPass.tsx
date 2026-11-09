import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { PassCard } from '@/components/PassCard';
import { EmptyState, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import type { PublicPass as PublicPassData } from '@/lib/types';
import { LinkIcon } from 'lucide-react';

/** The page a visitor opens from their invitation. No sign-in needed. */
export default function PublicPass() {
  const { token = '' } = useParams();
  const { data, isPending, isError } = useQuery({
    queryKey: ['public-pass', token],
    queryFn: () => api<PublicPassData>(`/public/pass/${encodeURIComponent(token)}`, { auth: false }),
    refetchInterval: 30_000,
    retry: false,
  });

  return (
    <div className="flex min-h-dvh flex-col items-center px-4 pt-8 pb-16">
      <Logo />
      <div className="mt-6 w-full max-w-sm flex-1">
        {isPending && <Skeleton className="mx-auto mt-16 h-[560px] w-full max-w-[340px] rounded-[30px]" />}
        {isError && (
          <EmptyState
            icon={<LinkIcon className="size-6" />}
            title="This pass link is not valid"
            body="Open the link from your invitation again, or ask your host to send a new one."
          />
        )}
        {data && (
          <>
            <div className="mt-2 text-center">
              <h1 className="text-2xl font-bold">Your visit pass</h1>
              <p className="mt-1 text-[15px] text-soft">Show this at the front desk when you arrive.</p>
            </div>
            <div className="mt-4">
              <PassCard
                pass={{
                  name: data.visitorName,
                  company: data.company,
                  hostName: data.hostName,
                  purpose: data.purpose,
                  expectedFrom: data.expectedFrom,
                  expectedTo: data.expectedTo,
                  status: data.status,
                  passToken: data.passToken,
                  passCode: data.passCode,
                }}
              />
            </div>
            <p className="mt-8 text-center text-sm text-soft">Visiting for: {data.purpose}</p>
          </>
        )}
      </div>
    </div>
  );
}
