import { createConnectTransport } from "@connectrpc/connect-web";

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

export const transport = createConnectTransport({
  baseUrl,
  useBinaryFormat: false,
  fetch: (input, init) =>
    fetch(input, {
      ...init,
      credentials: "include",
    }),
});
