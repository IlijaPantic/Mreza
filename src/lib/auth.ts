import { useQuery } from "@connectrpc/connect-query";
import { Code, ConnectError } from "@connectrpc/connect";

import { getMe } from "@/gen/mreza/v1/admin-AdminService_connectquery";
import type { AdminUser } from "@/gen/mreza/v1/admin_pb";

export function useCurrentAdmin() {
  const q = useQuery(getMe, {});

  const isUnauthenticated =
    q.isError &&
    q.error instanceof ConnectError &&
    q.error.code === Code.Unauthenticated;

  const admin: AdminUser | undefined = isUnauthenticated
    ? undefined
    : q.data?.me;

  return {
    admin,
    isLoading: q.isPending,
    isUnauthenticated,
    error: q.error,
    refetch: q.refetch,
  };
}

export async function logoutAdmin(): Promise<void> {
  await fetch("/auth/logout", {
    method: "POST",
    credentials: "include",
  });
  window.location.href = "/admin/login";
}
