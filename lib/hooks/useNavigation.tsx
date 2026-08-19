import { useRouter } from "next/navigation";
import { useTransition } from "react";

// Hook to track route changes and show loading state
export function useNavigationLoading() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const push = (href: string) => {
    startTransition(() => {
      router.push(href);
    });
  };

  return { isPending, push };
}