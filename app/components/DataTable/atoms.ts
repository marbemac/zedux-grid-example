import {
  api,
  atom,
  createStore,
  injectAtomInstance,
  injectAtomSelector,
  injectCallback,
  injectEffect,
  injectRef,
  injectStore,
  type AnyAtomInstance,
  type AtomGetters,
  type AtomInstanceType,
} from "@zedux/react";
import { Children } from "react";
import type { GridChildComponentProps } from "react-window";

import { getObjectColumnAtIndex } from "~/atoms/objects";
import { recordAttributeAtom } from "~/atoms/records";

const DEFAULT_POPULATE_IDS_ROW_LIMIT = 100;

export type DataTableRowIdFetcher = AnyAtomInstance<{
  Exports: {
    fetchRowIds: (args: {
      limit: number;
      offset: number;
    }) => Promise<{ rows: { id: string }[]; totalRowCount: number }>;
  };
}>;

export const dataTableAtom = atom(
  "data-table",
  ({
    objectId,
    rowIdFetcher,
  }: {
    objectId: string;
    rowIdFetcher: DataTableRowIdFetcher;
  }) => {
    const store = injectStore({
      objectId,
      rowIdsPopulated: false,
      totalRowCount: 0,
      rows: [] as string[],
    });

    /**
     * @QUESTION is this the correct way to create stable internal state? some other way?
     */
    const rowIdBucketsBeingPopulated = injectRef(new Set<number>());

    /**
     * Calls fetchRowIds with the offset + limit that corresponds to the "bucket" of rows that
     * the `fromRowIndex` falls into.
     */
    const populateRowIds = injectCallback(async (fromRowIndex = 0) => {
      const offset =
        Math.floor(fromRowIndex / DEFAULT_POPULATE_IDS_ROW_LIMIT) *
        DEFAULT_POPULATE_IDS_ROW_LIMIT;

      const alreadyPopulating = rowIdBucketsBeingPopulated.current.has(offset);
      if (alreadyPopulating) {
        return;
      }

      rowIdBucketsBeingPopulated.current.add(offset);

      const { rows, totalRowCount } = await rowIdFetcher.exports.fetchRowIds({
        limit: DEFAULT_POPULATE_IDS_ROW_LIMIT,
        offset,
      });

      store.setStateDeep((s) => {
        const newRows = [...s.rows];
        for (const rowIndex in rows) {
          const ri = Number(rowIndex);
          newRows[offset + ri] = rows[ri]!.id;
        }

        return {
          rowIdsPopulated: true,
          totalRowCount,
          rows: newRows,
        };
      });

      rowIdBucketsBeingPopulated.current.delete(offset);
    }, []);

    injectEffect(() => {
      // Populate first bucket of rows when the atom is created
      void populateRowIds();
    }, []);

    return api(store).setExports({ populateRowIds });
  }
);

export const objectIdFromInstance = (
  { get }: AtomGetters,
  instance: AtomInstanceType<typeof dataTableAtom>
) => get(instance).objectId;

export const getRowIdAtIndex = (
  { get }: AtomGetters,
  {
    instance,
    index,
  }: { instance: AtomInstanceType<typeof dataTableAtom>; index: number }
) => get(instance).rows[index];

export const getTotalRowCount = (
  { get }: AtomGetters,
  instance: AtomInstanceType<typeof dataTableAtom>
) => get(instance).totalRowCount;

export const getRowIdsPopulated = (
  { get }: AtomGetters,
  instance: AtomInstanceType<typeof dataTableAtom>
) => get(instance).rowIdsPopulated;

/**
 * @QUESTION how to think about organizing atom "scope/size"? For example, this could go into the dataTableAtom.
 * Any general guidelines re how to think about when to break up atoms into smaller atoms, vs expand the api surface
 * of an existing atom?
 */
export const renderedCursorAtom = atom("rendered-cursor", () => {
  const store = injectStore({
    minRow: 0,
    maxRow: 0,
    minColumn: 0,
    maxColumn: 0,
  });

  return api(store).setExports({
    updateFromChildren: (
      children: React.ReactElement<GridChildComponentProps>[]
    ) => {
      let minRow = Number.POSITIVE_INFINITY;
      let maxRow = Number.NEGATIVE_INFINITY;
      let minColumn = Number.POSITIVE_INFINITY;
      let maxColumn = Number.NEGATIVE_INFINITY;

      Children.forEach(children, (child) => {
        const { columnIndex, rowIndex } = child.props;

        minRow = Math.min(minRow, rowIndex);
        maxRow = Math.max(maxRow, rowIndex);
        minColumn = Math.min(minColumn, columnIndex);
        maxColumn = Math.max(maxColumn, columnIndex);
      });

      store.setState({ minRow, maxRow, minColumn, maxColumn });
    },
  });
});

/**
 * @QUESTION can selectors / "scoped" state be exposed via an atom's api?
 */
export const getRenderedMinRow = ({ get }: AtomGetters) =>
  get(renderedCursorAtom).minRow;

export const getRenderedMaxRow = ({ get }: AtomGetters) =>
  get(renderedCursorAtom).maxRow;

export const dataTableCellAtom = atom(
  "data-table-cell",
  ({
    objectId,
    rowId,
    columnIndex,
  }: {
    objectId: string;
    rowId: string;
    columnIndex: number;
  }) => {
    const column = injectAtomSelector(getObjectColumnAtIndex, {
      objectId,
      index: columnIndex,
    })!;

    const recordAttribute = injectAtomInstance(recordAttributeAtom, [
      { objectId, recordId: rowId, columnId: column.id },
    ]);

    const composedStore = injectStore(() =>
      createStore({ attribute: recordAttribute.store })
    );

    composedStore.use({ attribute: recordAttribute.store });

    injectEffect(() => {
      recordAttribute.exports.populate();

      return () => {
        recordAttribute.exports.cancelPopulate();
      };
    }, [recordAttribute]);

    return composedStore;
  },
  {
    ttl: 0,
  }
);
