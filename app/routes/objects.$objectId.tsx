import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useAtomInstance } from "@zedux/react";
import { recordIdFetcherAtom } from "~/atoms/records";

import { DataTable } from "~/components/DataTable";

export const Route = createFileRoute("/objects/$objectId")({
  component: ObjectComponent,
});

function ObjectComponent() {
  const { objectId } = Route.useParams();

  const rowIdFetcher = useAtomInstance(recordIdFetcherAtom, [{ objectId }]);

  return (
    <div className="h-screen flex">
      <div className="flex-1 overflow-hidden">
        <DataTable objectId={objectId} rowIdFetcher={rowIdFetcher} />
      </div>

      <Outlet />
    </div>
  );
}
