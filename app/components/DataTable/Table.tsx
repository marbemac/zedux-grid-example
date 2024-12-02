import { Link } from "@tanstack/react-router";
import {
  AtomProvider,
  useAtomContext,
  useAtomInstance,
  useAtomSelector,
  useAtomValue,
} from "@zedux/react";
import { forwardRef, memo, useEffect } from "react";
import AutoSizer from "react-virtualized-auto-sizer";
import {
  type GridChildComponentProps,
  VariableSizeGrid as Grid,
} from "react-window";

import {
  getObjectColumns,
  objectColumnsFromInstance,
  objectFetcherAtom,
} from "~/atoms/objects";
import {
  dataTableAtom,
  dataTableCellAtom,
  getRowIdAtIndex,
  getRowIdsPopulated,
  getTotalRowCount,
} from "./atoms";

export const DataTable = ({ objectId }: { objectId: string }) => {
  console.log("DataTable.render");

  const objectInstance = useAtomInstance(objectFetcherAtom, [{ objectId }]);
  const dtInstance = useAtomInstance(dataTableAtom, [{ objectId }]);

  const columns = useAtomSelector(getObjectColumns, { objectId });
  const totalRowCount = useAtomSelector(getTotalRowCount, { objectId });
  const rowIdsPopulated = useAtomSelector(getRowIdsPopulated, { objectId });

  if (!rowIdsPopulated) {
    return <div className="p-5">Loading row ids...</div>;
  }

  if (columns.length === 0) {
    return <div className="p-5">No columns.. should not happen</div>;
  }

  return (
    <AtomProvider instances={[objectInstance, dtInstance]}>
      <AutoSizer>
        {({ height, width }) => (
          <Grid
            columnCount={columns.length}
            columnWidth={(index) => columns[index]!.width}
            estimatedColumnWidth={120}
            overscanColumnCount={1}
            height={height}
            rowCount={totalRowCount + 1} // +1 for the DTHeaders row
            rowHeight={() => 32}
            estimatedRowHeight={32}
            overscanRowCount={10}
            width={width}
            innerElementType={GridInner}
            itemData={{ objectId }}
          >
            {DTCellWrapper}
          </Grid>
        )}
      </AutoSizer>
    </AtomProvider>
  );
};

// eslint-disable-next-line react/display-name
const GridInner = forwardRef(
  (
    { children, ...rest }: { children: React.ReactNode },
    ref: React.Ref<HTMLDivElement>
  ) => {
    return (
      <div ref={ref} {...rest}>
        <DTHeaders />

        {children}
      </div>
    );
  }
);

const DTHeaders = () => {
  const objectFetcher = useAtomContext(objectFetcherAtom, true);

  /**
   * @QUESTION These docs seem to suggest we can pass the instance, but it doesn't work
   *
   * ..edit.. ah I see, need a separate selector that accepts specific instance..
   *
   * https://omnistac.github.io/zedux/docs/walkthrough/react-context#using-selectors
   */
  // const columns = useAtomSelector(objectColumns, objectFetcher);
  const columns = useAtomSelector(objectColumnsFromInstance, objectFetcher);

  return (
    <div className="sticky top-0 z-10 flex min-w-max border-b bg-black">
      {columns.map((c) => (
        <DTHeaderCell column={c} key={c.id} />
      ))}
    </div>
  );
};

const DTHeaderCell = ({
  column,
}: {
  column: { id: string; name: string; width: number };
}) => {
  return (
    <div
      className="flex h-8 items-center border-r px-2"
      style={{ width: column.width }}
      title={column.id}
    >
      <div className="truncate font-semibold">{column.id}</div>
    </div>
  );
};

const DTCellWrapper = memo(({ rowIndex, ...rest }: GridChildComponentProps) => {
  if (rowIndex === 0) {
    // Row 0 is reserved for the headers row
    return null;
  }

  const normalizedRowIndex = rowIndex - 1; // -1 for the DTHeaders row

  return <DTCell rowIndex={normalizedRowIndex} {...rest} />;
});

const DTCell = ({
  rowIndex,
  columnIndex,
  style,
  data: { objectId },
}: GridChildComponentProps) => {
  const dt = useAtomInstance(dataTableAtom, [{ objectId }]);

  const rowId = useAtomSelector(getRowIdAtIndex, {
    objectId,
    index: rowIndex,
  });

  const content = rowId ? (
    <DTCellContent
      objectId={objectId}
      rowId={rowId}
      columnIndex={columnIndex}
    />
  ) : (
    "..."
  );

  /** If we haven't loaded the rowIds for this bucket of rows yet, populate them */
  useEffect(() => {
    if (!rowId) {
      dt.exports.populateRowIds(rowIndex);
    }
  }, [rowId, rowIndex]);

  // const position = columnIndex === 0 ? "sticky" : "absolute";

  return (
    <div
      className="flex items-center border-b border-r px-2 gap-1"
      // style={{ ...style, position }}
      style={style}
    >
      {content}
    </div>
  );
};

const DTCellContent = ({
  objectId,
  rowId,
  columnIndex,
}: {
  objectId: string;
  rowId: string;
  columnIndex: number;
}) => {
  const cell = useAtomValue(dataTableCellAtom, [
    { objectId, rowId, columnIndex },
  ]);

  return (
    <>
      <div className="flex-1 truncate">{cell.attribute || "..."}</div>

      {cell.attribute && columnIndex === 0 ? (
        <Link
          to="/objects/$objectId/$recordId"
          params={{ objectId, recordId: rowId }}
        >
          {"->"}
        </Link>
      ) : null}
    </>
  );
};
