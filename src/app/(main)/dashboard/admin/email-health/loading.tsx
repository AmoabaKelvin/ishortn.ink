import { Skeleton } from "@/components/ui/skeleton";

export default function AdminEmailHealthLoading() {
  return (
    <div>
      <div className="mb-8">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="mt-1 h-4 w-72" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-[106px] rounded-xl" />
        ))}
      </div>

      <Skeleton className="mt-8 h-[360px] rounded-lg" />
    </div>
  );
}
