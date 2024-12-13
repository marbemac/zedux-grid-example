import {
  api,
  atom,
  injectEffect,
  injectAtomInstance,
  injectStore,
  injectCallback,
  injectAtomGetters,
  type AtomGetters,
} from "@zedux/react";

import {
  fetchRecordsData,
  type ColumnId,
  type RecordId,
  fetchRecordIds,
} from "~/utils/api";

const FETCH_DATA_DELAY = 500;
const STALE_DATA_THRESHOLD = 5_000;

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
           * @QUESTION Should runPendingDataFetch use injectCallback for the
           * batch update functionality?
           */
          getInstance(recordAttributeAtom, [
            { objectId, recordId, columnId },
          ]).exports.setValue(recordsData[recordId]![columnId]);
        }
      }

      store.setStateDeep({
        hasPopulatedAnyRowData: true,
        pendingDataFetch: null,
      });

      // queue another fetch in case the pending queue grew while we were fetching
      queuePopulateRecordData();
    }

    return api(store).setExports({
      populateAttribute: async (rowId: RecordId, columnId: ColumnId) => {
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

      cancelPopulateAttribute: async (rowId: RecordId, columnId: ColumnId) => {
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
    });
  }
);

export const activeRecordIdAtom = atom<RecordId | null>(
  "active-record-id",
  null
);

export const isRecordActive = (
  { get }: AtomGetters,
  { recordId }: { recordId: RecordId }
) => get(activeRecordIdAtom) === recordId && Boolean(recordId);

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
    const store = injectStore({
      value: undefined as string | undefined,
      version: 0, // Tracking this just to show in the UI when a record attribute is re-fetched, for example purposes
      populatedAt: null as number | null,
    });

    const records = injectAtomInstance(recordsAtom, [{ objectId }]);

    const populate = injectCallback(
      (force = false) => {
        const { value, version, populatedAt } = store.getState();

        /**
         * Consider the value stale if it was populated more than X seconds ago, and refetch it.
         */
        const isStale =
          populatedAt && Date.now() - STALE_DATA_THRESHOLD > populatedAt;

        if (!force && value !== undefined && !isStale) {
          return;
        }

        records.exports.populateAttribute(recordId, columnId);
      },
      [store, records]
    );

    const cancelPopulate = injectCallback(() => {
      records.exports.cancelPopulateAttribute(recordId, columnId);
    }, [records]);

    const setValue = injectCallback((value: string) => {
      store.setState((s) => ({
        value,
        populatedAt: new Date().getTime(),
        version: s.version + 1,
      }));
    }, []);

    injectEffect(() => {
      // Populate this record attribute on mount
      populate();

      return () => {
        // Cancel the population - this is relevant if the record attribute is mounted and unmounted quickly,
        // for example when scrolling through a table
        cancelPopulate();
      };
    }, []);

    /**
     * @QUESTION is there a way to prevent consumers from setting the state directly? Forcing them to use
     * setValue basically.
     */
    return api(store).setExports({
      populate,
      cancelPopulate,
      setValue,
    });
  }
);

export const recordIdFetcherAtom = atom(
  "record-id-fetcher",
  ({ objectId }: { objectId: string }) => {
    return api().setExports({
      fetchRowIds: ({ limit, offset }: { limit: number; offset: number }) => {
        return fetchRecordIds({
          data: { objectId, limit, offset },
        });
      },
    });
  }
);
