import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { createEcosystem, EcosystemProvider } from "@zedux/react";
import { useMemo } from "react";

export const Providers = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const queryClient = useQueryClient();

  const ecosystem = useMemo(
    () =>
      createEcosystem({
        id: "root",
        ssr: typeof window === "undefined",
        context: {
          router,
          queryClient,
        },
      }),
    [router, queryClient]
  );

  return (
    <EcosystemProvider ecosystem={ecosystem}>{children}</EcosystemProvider>
  );
};
