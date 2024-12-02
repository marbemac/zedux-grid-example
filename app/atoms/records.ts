import {
  api,
  atom,
  injectEffect,
  injectAtomInstance,
  injectStore,
  injectCallback,
  injectAtomGetters,
} from "@zedux/react";

import { fetchRecordsData, type ColumnId, type RecordId } from "~/utils/api";

const FETCH_DATA_DELAY = 500;

export const recordsAtom = atom(
  "records",
  ({ objectId }: { objectId: string }) => {
    const { getInstance } = injectAtomGetters();

    const store = injectStore({
      /**
       * @QUESTION is a store the best place to put these properties? They're internal to this store, and we don't
       * need to run effects or re-render on changes to these or anything.
       */
      pendingCellsToFetch: {} as Record<RecordId, Record<ColumnId, true>>,
      pendingDataFetch: null as NodeJS.Timeout | null,
      hasPopulatedAnyRowData: false,
    });

    const queuePopulateRecordData = () => {
      const { pendingCellsToFetch, pendingDataFetch, hasPopulatedAnyRowData } =
        store.getState();

      if (!pendingDataFetch && Object.keys(pendingCellsToFetch).length > 0) {
        store.setStateDeep({
          pendingDataFetch: setTimeout(
            () => {
              void runPendingDataFetch();
            },
            hasPopulatedAnyRowData ? FETCH_DATA_DELAY : 0
          ),
        });
      }
    };

    async function runPendingDataFetch() {
      const recordIds = new Set<RecordId>();
      const columnIds = new Set<ColumnId>();
      const { pendingCellsToFetch } = store.getState();

      for (const recordId in pendingCellsToFetch) {
        recordIds.add(recordId);
        for (const columnId in pendingCellsToFetch[recordId]) {
          columnIds.add(columnId);
        }
      }

      store.setState((s) => ({
        ...s,
        pendingCellsToFetch: {},
      }));

      const recordsData = await fetchRecordsData({
        data: {
          objectId,
          recordIds: Array.from(recordIds),
          columnIds: Array.from(columnIds),
        },
      });

      for (const recordId in recordsData) {
        for (const columnId in recordsData[recordId]) {
          /**
           * @QUESTION Is this getInstance().setState() approach correct? Should runPendingDataFetch
           * use injectCallback for the batch update functionality?
           */
          getInstance(recordAttributeAtom, [
            { objectId, recordId, columnId },
          ]).setState(recordsData[recordId]![columnId]);
        }
      }

      store.setStateDeep({
        hasPopulatedAnyRowData: true,
        pendingDataFetch: null,
      });

      // queue another fetch in case the pending queue grew while we were fetching
      queuePopulateRecordData();
    }

    const populateAttribute = injectCallback(
      async (rowId: RecordId, columnId: ColumnId) => {
        const { pendingCellsToFetch } = store.getState();
        if (pendingCellsToFetch[rowId]?.[columnId]) {
          return;
        }

        store.setStateDeep({
          pendingCellsToFetch: {
            [rowId]: {
              [columnId]: true,
            },
          },
        });

        queuePopulateRecordData();
      },
      [objectId]
    );

    const cancelPopulateAttribute = injectCallback(
      async (rowId: RecordId, columnId: ColumnId) => {
        store.setState((s) => {
          const newPendingCells = { ...s.pendingCellsToFetch };

          if (newPendingCells[rowId]) {
            delete newPendingCells[rowId][columnId];

            if (Object.keys(newPendingCells[rowId]).length === 0) {
              delete newPendingCells[rowId];
            }
          }

          return { ...s, pendingCellsToFetch: newPendingCells };
        });
      },
      [objectId]
    );

    return api(store).setExports({
      populateAttribute,
      cancelPopulateAttribute,
    });
  }
);

export const recordAttributeAtom = atom(
  "record-attribute",
  ({
    objectId,
    recordId,
    columnId,
  }: {
    objectId: string;
    recordId: string;
    columnId: string;
  }) => {
    const store = injectStore<string>();

    const records = injectAtomInstance(recordsAtom, [{ objectId }]);

    const populate = injectCallback(
      (force = false) => {
        const value = store.getState();
        if (!force && value !== undefined) {
          return;
        }

        records.exports.populateAttribute(recordId, columnId);
      },
      [store, records]
    );

    const cancelPopulate = injectCallback(() => {
      records.exports.cancelPopulateAttribute(recordId, columnId);
    }, [records]);

    injectEffect(() => {
      // Populate this record attribute on mount
      populate();

      return () => {
        // Cancel the population - this is relevant if the record attribute is mounted and unmounted quickly,
        // for example when scrolling through a table
        cancelPopulate();
      };
    }, []);

    return api(store).setExports({ populate, cancelPopulate });
  }
);
