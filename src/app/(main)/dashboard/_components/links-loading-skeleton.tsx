import { Skeleton } from "@/components/ui/skeleton";

const LinkSkeletonLoader = () => {
  return (
    <div className="flex items-center justify-between rounded-md bg-gray-100 px-6 py-4">
      <div className="flex w-full flex-col gap-2">
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-6 w-6 rounded-full" />
        </div>
        <Skeleton className="h-4 w-60" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    </div>
  );
};

export const LinksSkeletonLoader = () => {
  return (
    <div className="space-y-2">
      {Array<number>(5)
        .fill(0)
        .map((_, index) => (
          <LinkSkeletonLoader key={index} />
        ))}
    </div>
  );
};

export default LinksSkeletonLoader;
