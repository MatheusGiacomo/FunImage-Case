import { cn } from '@/lib/utils';

export default function SkeletonCard({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="card flex items-center gap-4 p-4">
        <div className="skeleton w-14 h-14 rounded-xl shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-4 w-2/3 rounded-lg" />
          <div className="skeleton h-3 w-1/2 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="skeleton aspect-[4/3] rounded-none" />
      <div className="p-4 space-y-2">
        <div className="skeleton h-4 w-3/4 rounded-lg" />
        <div className="skeleton h-3 w-1/2 rounded-lg" />
        <div className="flex justify-between mt-3">
          <div className="skeleton h-3 w-16 rounded" />
          <div className="skeleton h-3 w-12 rounded" />
        </div>
      </div>
    </div>
  );
}
