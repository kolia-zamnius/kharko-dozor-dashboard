/** `staleTime: pollMs / 2` keeps `useQuery` from short-circuiting against fresh cache on the interval tick. */
export function pollingOptions(
  pollMs: number,
  opts?: { background?: boolean; staleTime?: number },
): { staleTime: number; refetchInterval: number; refetchIntervalInBackground: boolean } {
  return {
    staleTime: opts?.staleTime ?? pollMs / 2,
    refetchInterval: pollMs,
    refetchIntervalInBackground: opts?.background ?? false,
  };
}
