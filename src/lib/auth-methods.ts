import { useEffect, useState } from "react";

export type AuthMethods = {
  password: boolean;
  google: boolean;
};

const DEFAULT_METHODS: AuthMethods = { password: true, google: false };

export function useAuthMethods() {
  const [data, setData] = useState<AuthMethods | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetch("/auth/methods", { credentials: "include" })
      .then((r) => (r.ok ? (r.json() as Promise<AuthMethods>) : DEFAULT_METHODS))
      .catch(() => DEFAULT_METHODS)
      .then((m) => {
        if (cancelled) return;
        setData(m);
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { methods: data ?? DEFAULT_METHODS, isLoading };
}
