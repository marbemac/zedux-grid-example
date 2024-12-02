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
  type AtomGetters,
} from "@zedux/react";
import { getObjectColumnAtIndex } from "~/atoms/objects";
import { recordAttributeAtom } from "~/atoms/records";

import { fetchRowIds } from "~/utils/api";

const DEFAULT_POPULATE_IDS_ROW_LIMIT = 100;

export const dataTableAtom = atom(
  "data-table",
  ({ objectId }: { objectId: string }) => {
    const store = injectStore({
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
    const populateRowIds = injectCallback(
      async (fromRowIndex = 0) => {
        const offset =
          Math.floor(fromRowIndex / DEFAULT_POPULATE_IDS_ROW_LIMIT) *
          DEFAULT_POPULATE_IDS_ROW_LIMIT;

        const alreadyPopulating =
          rowIdBucketsBeingPopulated.current.has(offset);
        if (alreadyPopulating) {
          return;
        }

        rowIdBucketsBeingPopulated.current.add(offset);

        const { rows, totalRowCount } = await fetchRowIds({
          data: { objectId, limit: DEFAULT_POPULATE_IDS_ROW_LIMIT, offset },
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
      },
      [objectId]
    );

    injectEffect(() => {
      // Populate first bucket of rows when the atom is created
      void populateRowIds();
    }, []);

    return api(store).setExports({ populateRowIds });
  }
);

export const getRowIdAtIndex = (
  { get }: AtomGetters,
  { objectId, index }: { objectId: string; index: number }
) => get(dataTableAtom, [{ objectId }]).rows[index];

export const getTotalRowCount = (
  { get }: AtomGetters,
  { objectId }: { objectId: string }
) => get(dataTableAtom, [{ objectId }]).totalRowCount;

export const getRowIdsPopulated = (
  { get }: AtomGetters,
  { objectId }: { objectId: string }
) => get(dataTableAtom, [{ objectId }]).rowIdsPopulated;

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
