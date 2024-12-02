import { createFileRoute, Outlet } from "@tanstack/react-router";

import { DataTable } from "~/components/DataTable";

export const Route = createFileRoute("/objects/$objectId")({
  component: ObjectComponent,
});

function ObjectComponent() {
  const { objectId } = Route.useParams();

  return (
    <div className="h-screen flex">
      <div className="flex-1 overflow-hidden">
        <DataTable objectId={objectId} />
      </div>

      <Outlet />
    </div>
  );
}
