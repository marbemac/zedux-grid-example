import {
  api,
  atom,
  injectEffect,
  injectAtomInstance,
  injectSignal,
  injectCallback,
  injectEcosystem,
  Ecosystem,
  ParamsOf,
  AtomInstance,
  ZeduxNode,
  injectSelf,
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
    const ecosystem = injectEcosystem();

    const signal = injectSignal({
      /**
       * @QUESTION is a store the best place to put these properties? They're
       * internal to this store, and we don't need to run effects or re-render
       * on changes to these or anything.
       *
       * @ANSWER Yes, I'd probably put these in a <store|signal>. If you know
       * nothing needs to react to changes, you can put them in a ref, but I
       * recommend keeping everything reactive - sometimes you do want to
       * observe value changes later, even if just for debugging.
       *
       * You can pass `{ reactive: false }` as the second argument to
       * `injectSignal` to prevent the injecting atom from reevaluating on
       * changes. Though I'd try to avoid that too - the reevaluations are
       * usually very cheap. It isn't worth the potential footgun of making
       * changes later, forgetting this isn't reactive.
       */
      pendingCellsToFetch: {} as Record<RecordId, Record<ColumnId, true>>,
      pendingDataFetch: null as NodeJS.Timeout | null,
      hasPopulatedAnyRowData: false,
    });

    const queuePopulateRecordData = () => {
      const { pendingCellsToFetch, pendingDataFetch, hasPopulatedAnyRowData } =
        signal.get();

      if (!pendingDataFetch && Object.keys(pendingCellsToFetch).length > 0) {
        signal.mutate({
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
      const { pendingCellsToFetch } = signal.get();

      for (const recordId in pendingCellsToFetch) {
        recordIds.add(recordId);
        for (const columnId in pendingCellsToFetch[recordId]) {
          columnIds.add(columnId);
        }
      }

      signal.set((s) => ({
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

      /**
       * @NOTE batch
       */
      ecosystem.batch(() => {
        for (const recordId in recordsData) {
          for (const columnId in recordsData[recordId]) {
            /**
             * @QUESTION Should runPendingDataFetch use injectCallback for the
             * batch update functionality?
             *
             * @ANSWER It doesn't make sense to batch an entire async function.
             * However, these `setValue` and `mutate` calls after the `await`
             * here can all be batched.
             *
             * I've switched to that approach.
             */
            ecosystem
              .getNode(recordAttributeAtom, [{ objectId, recordId, columnId }])
              .exports.setValue(recordsData[recordId]![columnId]);

            /**
             * @NOTE That should probably use `ecosystem.hydrate` instead of
             * `ecosystem.getNode`. Getting nodes statically like this creates
             * them if they don't exist. If the user's scrolling quickly through
             * the grid, a low `ttl` might destroy some nodes before their data
             * comes in here. This call will then re-create them with no
             * dependents.
             *
             * That's fine if you want to cache all nodes, which is how you had
             * it. And maybe it's good for this example's cell `version`
             * feature. But I added `ttl: 0` to `record-attribute` which made
             * this issue apparent.
             *
             * I think `ecosystem.hydrate` is a good middle ground. It still
             * keeps everything you've fetched from the server cached inside
             * `ecosystem.hydration`. But it lets any atoms wrapping those
             * values get cleaned up when not in use, slimming up your ecosystem
             * graph for better DX. When they're recreated, they'll rehydrate.
             */
            // ecosystem.hydrate({
            //   [recordAttributeAtom.getNodeId(ecosystem, [
            //     { objectId, recordId, columnId },
            //   ])]: recordsData[recordId]![columnId],
            // });
          }
        }

        signal.mutate({
          hasPopulatedAnyRowData: true,
          pendingDataFetch: null,
        });
      });

      // queue another fetch in case the pending queue grew while we were fetching
      queuePopulateRecordData();
    }

    return api(signal).setExports({
      populateAttribute: async (rowId: RecordId, columnId: ColumnId) => {
        const { pendingCellsToFetch } = signal.get();
        if (pendingCellsToFetch[rowId]?.[columnId]) {
          return;
        }

        signal.mutate({
          pendingCellsToFetch: {
            [rowId]: {
              [columnId]: true,
            },
          },
        });

        queuePopulateRecordData();
      },

      cancelPopulateAttribute: async (rowId: RecordId, columnId: ColumnId) => {
        signal.set((s) => {
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
  { get }: Ecosystem,
  { recordId }: { recordId: RecordId }
) => get(activeRecordIdAtom) === recordId && Boolean(recordId);

/**
 * @NOTE I added this interval to show how every cell in the table reacts to state updates.
 */
const intervalAtom = atom("interval", () => {
  const signal = injectSignal(0);

  injectEffect(() => {
    const intervalId = setInterval(() => {
      signal.set((state) => (state + 1) % 2);
    }, 1000);

    return () => clearInterval(intervalId);
  }, []);

  return signal;
});

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
    const signal = injectSignal({
      value: undefined as string | undefined,
      version: 0, // Tracking this just to show in the UI when a record attribute is re-fetched, for example purposes
      populatedAt: null as number | null,
    });

    /**
     * @NOTE Some advanced usage by the way: This is the code I used to find and
     * clean up `record-attribute` instances that were created with no
     * dependents.
     *
     * It schedules a job using Zedux's new async scheduler. The job will always
     * run in a microtask after the node is initialized. It then attempts
     * destruction, which will only succeed if the node has no dependents.
     */
    // const self = injectSelf();
    // if (self.status === "Initializing") {
    //   injectEcosystem().asyncScheduler.schedule({
    //     j: () => {
    //       if (!self.o.size) {
    //         console.log("destroying defunct node", self.id);
    //       }

    //       self.destroy(); // destroys only if there are no observers
    //     },
    //     T: 4,
    //   });
    // }

    const records = injectAtomInstance(recordsAtom, [{ objectId }]);
    const intervalInstance = injectAtomInstance(intervalAtom);

    const populate = injectCallback((force = false) => {
      const { value, version, populatedAt } = signal.get();

      /**
       * Consider the value stale if it was populated more than X seconds ago, and refetch it.
       */
      const isStale =
        populatedAt && Date.now() - STALE_DATA_THRESHOLD > populatedAt;

      if (!force && value !== undefined && !isStale) {
        return;
      }

      records.exports.populateAttribute(recordId, columnId);
    }, []);

    const cancelPopulate = injectCallback(() => {
      records.exports.cancelPopulateAttribute(recordId, columnId);
    }, []);

    const setValue = injectCallback((value: string) => {
      signal.set((s) => ({
        value: value ? `${value} ${intervalInstance.get()}` : value,
        populatedAt: new Date().getTime(),
        version: s.version + 1,
      }));
    }, []);

    injectEffect(() => {
      // Populate this record attribute on mount
      populate();

      const cleanupListener = intervalInstance.on("change", ({ newState }) => {
        signal.mutate(({ value }) => ({
          value: value ? `${value.slice(0, -2)} ${newState}` : value,
        }));
      });

      return () => {
        // Cancel the population - this is relevant if the record attribute is mounted and unmounted quickly,
        // for example when scrolling through a table
        /**
         * @NOTE this will only happen if this atom has `ttl` or is manually
         * destroyed. I've added `ttl: 0`
         */
        cancelPopulate();
        cleanupListener();
      };
    }, [intervalInstance]);

    /**
     * @QUESTION is there a way to prevent consumers from setting the state
     * directly? Forcing them to use setValue basically.
     *
     * @ANSWER Not with an atom. We're considering adding readonly atoms (see
     * https://github.com/Omnistac/zedux/issues/136). It is loosely possible
     * with selectors, which are always readonly. Export a selector that returns
     * the atom's exports (see below example)
     */
    return api(signal).setExports({
      populate,
      cancelPopulate,
      setValue,
    });
  },
  /**
   * @NOTE I'd definitely add a `ttl`. The grid endlessly creates thousands of
   * instances of this atom. While Zedux can definitely handle millions of
   * these, it hurts DX to have so many nodes in your ecosystem.
   *
   * I would not do a non-zero ttl here - that calls `setTimeout` once for every
   * stale atom instance, which would be expensive.
   *
   * `ttl: 0` is fine, but it's probably not what you're going for as this
   * forces a refetch every time the cell comes back into view. My above
   * `ecosystem.hydrate` suggestion would fix that and is probably what I'd do.
   *
   * For an even more robust solution, you could use `atomApi.setTtl(() =>
   * getReusablePromise())` where `getReusablePromise` returns a promise
   * reference that can be shared with all other currently-stale atom instances.
   * End result: All stale `record-attribute` atoms are mass destroyed once
   * every <x amount of time>.
   *
   * `.setTtl` also gives you fine-grained control over destruction. For
   * example, if cells were editable and the user edited one, you might want to
   * keep just that one atom instance around regardless how far away the user
   * scrolls or how long they stay away.
   */
  { ttl: 0 }
);

/**
 * @NOTE This is an example wrapper selector. Selectors can return anything.
 * This one returns its wrapped atom's exports.
 *
 * You can enforce that consumers only use an atom's exports by putting the atom
 * in a separate file and not exporting it. Only export wrapper selectors like
 * this or that subscribe to state changes.
 *
 * Note that since exports are constant, this particular selector's value will
 * never change unless its wrapped atom is force-destroyed.
 */
export const setRecordAttributes = (
  { getNode }: Ecosystem,
  ...params: ParamsOf<typeof recordAttributeAtom>
) => {
  return getNode(recordAttributeAtom, params).exports;
};

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
