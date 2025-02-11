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
import { twJoin } from "tailwind-merge";

import {
  getObjectColumnAtIndex,
  getObjectColumns,
  objectColumnsFromInstance,
  objectFetcherAtom,
} from "~/atoms/objects";
import {
  dataTableAtom,
  dataTableCellAtom,
  getRenderedMaxRow,
  getRenderedMinRow,
  getRowIdAtIndex,
  getRowIdsPopulated,
  getTotalRowCount,
  objectIdFromInstance,
  renderedCursorAtom,
  type DataTableRowIdFetcher,
} from "./atoms";
import { isRecordActive } from "~/atoms/records";

const HEADER_HEIGHT = 40;
const ROW_HEIGHT = 36;

export const DataTable = ({
  objectId,
  rowIdFetcher,
}: {
  objectId: string;
  rowIdFetcher: DataTableRowIdFetcher;
}) => {
  const objectInstance = useAtomInstance(objectFetcherAtom, [{ objectId }], {
    suspend: false,
  });
  const dtInstance = useAtomInstance(dataTableAtom, [
    { objectId, rowIdFetcher },
  ]);

  const columns = useAtomSelector(getObjectColumns, { objectId });
  const totalRowCount = useAtomSelector(getTotalRowCount, dtInstance);
  const rowIdsPopulated = useAtomSelector(getRowIdsPopulated, dtInstance);

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
            rowHeight={(index) => (index === 0 ? HEADER_HEIGHT : ROW_HEIGHT)}
            estimatedRowHeight={ROW_HEIGHT}
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

const GridInner = forwardRef(
  (
    {
      children,
      ...rest
    }: { children: React.ReactElement<GridChildComponentProps>[] },
    ref: React.Ref<HTMLDivElement>
  ) => {
    const renderedCursor = useAtomInstance(renderedCursorAtom);

    useEffect(() => {
      renderedCursor.exports.updateFromChildren(children);
    }, [children, renderedCursor.exports]);

    return (
      <div ref={ref} {...rest}>
        <DTHeaders />

        <DTPinnedColumn />

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

  const [firstColumn, ...restColumns] = columns;

  return (
    <div className="sticky top-0 z-20 min-w-max flex">
      <DTHeaderCell column={firstColumn} key={firstColumn.id} sticky />

      {restColumns.map((c) => (
        <DTHeaderCell column={c} key={c.id} />
      ))}
    </div>
  );
};

const DTHeaderCell = ({
  column,
  sticky,
}: {
  column: { id: string; name: string; width: number };
  sticky?: boolean;
}) => {
  return (
    <div
      className={twJoin(
        "flex items-center border-r px-2 border-b bg-black",
        sticky && "sticky left-0 z-10",
        !sticky && "z-0"
      )}
      style={{ width: column.width, height: HEADER_HEIGHT }}
      title={column.id}
    >
      <div className="truncate font-semibold">{column.id}</div>
    </div>
  );
};

const DTPinnedColumn = () => {
  const dtInstance = useAtomContext(dataTableAtom, true);
  const objectId = useAtomSelector(objectIdFromInstance, dtInstance);
  const minRow = useAtomSelector(getRenderedMinRow);
  const maxRow = useAtomSelector(getRenderedMaxRow);
  const column = useAtomSelector(getObjectColumnAtIndex, {
    objectId,
    index: 0,
  });

  const width = column?.width || 100;

  const elems = [];

  // < rather than <= because we need to render 1 less to account for the sticky headers row
  for (let i = minRow; i < maxRow; i++) {
    elems.push(
      <DTCell
        key={i}
        rowIndex={i}
        columnIndex={0}
        style={{
          position: "absolute",
          height: ROW_HEIGHT,
          width,
          top: i * ROW_HEIGHT,
        }}
        data={{ objectId }}
      />
    );
  }

  return (
    <div
      className="sticky left-0 bg-gray-900 z-10"
      style={{ width, height: `calc(100% - ${HEADER_HEIGHT}px)` }}
    >
      {elems}
    </div>
  );
};

const DTCellWrapper = memo(
  ({ rowIndex, columnIndex, ...rest }: GridChildComponentProps) => {
    if (
      rowIndex === 0 || // Row 0 is reserved for the sticky headers row
      columnIndex === 0 // Column 0 is reserved for the sticky column
    ) {
      return null;
    }

    const normalizedRowIndex = rowIndex - 1; // -1 for the DTHeaders row

    return (
      <DTCell
        rowIndex={normalizedRowIndex}
        columnIndex={columnIndex}
        {...rest}
      />
    );
  }
);

const DTCell = ({
  rowIndex,
  columnIndex,
  style,
  data: { objectId },
}: GridChildComponentProps) => {
  const dtInstance = useAtomContext(dataTableAtom, true);

  const rowId = useAtomSelector(getRowIdAtIndex, {
    instance: dtInstance,
    index: rowIndex,
  });

  /**
   * If we haven't loaded the rowIds for this bucket of rows yet, populate them.
   *
   * @QUESTION would be nice to get this useEffect out of the component, but not sure how. Not end of the world though.
   */
  useEffect(() => {
    if (!rowId) {
      dtInstance.exports.populateRowIds(rowIndex);
    }
  }, [rowId, rowIndex]);

  const content = rowId ? (
    <DTCellContent
      objectId={objectId}
      rowId={rowId}
      columnIndex={columnIndex}
    />
  ) : (
    "..."
  );

  const isActive = useAtomSelector(isRecordActive, { recordId: rowId });

  const className = twJoin(
    "flex items-center border-b border-r px-2 gap-1 z-0",
    isActive && "bg-blue-600"
  );

  if (columnIndex === 0) {
    return (
      <Link
        className={className}
        to="/objects/$objectId/$recordId"
        params={{ objectId, recordId: rowId }}
        style={style}
      >
        {content}
        <div>{"->"}</div>
      </Link>
    );
  }

  return (
    <div className={className} style={style}>
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

  if (!cell.attribute.value) {
    return "...";
  }

  return (
    <>
      <div className="flex-1 truncate">{cell.attribute.value}</div>
      <div className="text-xs opacity-50">v{cell.attribute.version}</div>
    </>
  );
};
