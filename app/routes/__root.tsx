import {
  Link,
  Outlet,
  ScrollRestoration,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { Meta, Scripts } from "@tanstack/start";
import type { QueryClient } from "@tanstack/react-query";

import { DefaultCatchBoundary } from "~/components/DefaultCatchBoundary";
import { NotFound } from "~/components/NotFound";
import appCss from "~/styles/app.css?url";
import { Providers } from "~/providers";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  errorComponent: (props) => {
    return (
      <RootDocument>
        <DefaultCatchBoundary {...props} />
      </RootDocument>
    );
  },
  notFoundComponent: () => <NotFound />,
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <head>
        <Meta />
      </head>
      <body>
        <Providers>
          <div className="flex min-h-screen">
            <div className="w-48 shrink-0 border-r flex flex-col gap-3 p-5">
              <div>
                <Link to="/objects/$objectId" params={{ objectId: "object-1" }}>
                  Object 1
                </Link>
              </div>
              <div>
                <Link to="/objects/$objectId" params={{ objectId: "object-2" }}>
                  Object 2
                </Link>
              </div>
              <div>
                <Link to="/objects/$objectId" params={{ objectId: "object-3" }}>
                  Object 3
                </Link>
              </div>
            </div>

            {/* <div className="flex-1 overflow-hidden">{children}</div> */}
            <div className="flex-1">{children}</div>
          </div>
        </Providers>

        <ScrollRestoration />
        <TanStackRouterDevtools position="bottom-right" />
        <ReactQueryDevtools buttonPosition="bottom-left" />
        <Scripts />
      </body>
    </html>
  );
}
