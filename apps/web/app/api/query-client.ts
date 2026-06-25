import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";

import { parseApiError } from "./client";

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      console.error("[Query Error]", { error, queryKey: query.queryKey });
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, _mutation) => {
      console.error("[Mutation Error]", { error });
    },
  }),
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const status = (error as { status?: number }).status;
        if (typeof status === "number" && status >= 400 && status < 500) {
          return false;
        }
        return failureCount < 3;
      },
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

export { parseApiError };
