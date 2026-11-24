export type NavigationKind = "full" | "client";

/**
 * "full" when this auth page is the document the browser loaded (its timing starts at the
 * navigation), "client" when it was reached by a Next router navigation from another page.
 */
export function getNavigationKind({
  documentUrl,
  currentPath,
  placeholderMountedBefore,
}: {
  documentUrl: string | undefined;
  currentPath: string;
  placeholderMountedBefore: boolean;
}): NavigationKind {
  if (placeholderMountedBefore || !documentUrl) return "client";
  try {
    return new URL(documentUrl).pathname === currentPath ? "full" : "client";
  } catch {
    return "client";
  }
}
