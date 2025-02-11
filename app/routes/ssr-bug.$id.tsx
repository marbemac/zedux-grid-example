import { createFileRoute, Link } from "@tanstack/react-router";
import { useAtomSelector, useAtomState, type AtomGetters } from "@zedux/react";
import { currentRouteAtom } from "~/atoms/current-route";

export const Route = createFileRoute("/ssr-bug/$id")({
  component: RouteComponent,
});

function RouteComponent() {
  const [{ params }] = useAtomState(currentRouteAtom);

  return <div className="p-10">Current id param: {params.id}</div>;
}
