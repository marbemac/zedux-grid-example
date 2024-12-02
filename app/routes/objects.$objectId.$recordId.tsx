import { createFileRoute, Link } from "@tanstack/react-router";
import { useAtomInstance, useAtomSelector, useAtomValue } from "@zedux/react";
import { useEffect } from "react";

import { getObjectColumns } from "~/atoms/objects";
import { activeRecordIdAtom, recordAttributeAtom } from "~/atoms/records";
import type { ColumnId, RecordId } from "~/utils/api";

export const Route = createFileRoute("/objects/$objectId/$recordId")({
  component: ObjectRecordComponent,
});

function ObjectRecordComponent() {
  const { objectId, recordId } = Route.useParams();

  const activeRecordId = useAtomInstance(activeRecordIdAtom);
  useEffect(() => {
    activeRecordId.setState(recordId);

    return () => {
      activeRecordId.setState(null);
    };
  }, [recordId]);

  return (
    <div className="border-l p-5 w-80 overflow-auto">
      <RecordPanel objectId={objectId} recordId={recordId} />
    </div>
  );
}

const RecordPanel = ({
  objectId,
  recordId,
}: {
  objectId: string;
  recordId: string;
}) => {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <h1 className="text-lg font-semibold">Record ID: {recordId}</h1>
        <div>
          <Link to=".." className="p-1">
            X
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <RecordPanelAttributes objectId={objectId} recordId={recordId} />
      </div>
    </div>
  );
};

const RecordPanelAttributes = ({
  objectId,
  recordId,
}: {
  objectId: string;
  recordId: string;
}) => {
  const columns = useAtomSelector(getObjectColumns, { objectId });

  return columns.map((column) => (
    <RecordPanelAttribute
      key={column.id}
      objectId={objectId}
      recordId={recordId}
      columnId={column.id}
    />
  ));
};

const RecordPanelAttribute = ({
  objectId,
  recordId,
  columnId,
}: {
  objectId: string;
  recordId: RecordId;
  columnId: ColumnId;
}) => {
  const recordAttribute = useAtomValue(recordAttributeAtom, [
    { objectId, recordId, columnId },
  ]);

  return (
    <div className="flex gap-1 items-center">
      <div className="font-semibold">{columnId}:</div>

      <div className="flex-1">
        {recordAttribute.value ? String(recordAttribute.value) : "..."}
      </div>

      {recordAttribute.value ? (
        <div className="text-xs opacity-50">v{recordAttribute.version}</div>
      ) : null}
    </div>
  );
};
