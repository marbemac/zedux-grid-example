import {
  api,
  atom,
  AtomTemplate,
  Ecosystem,
  injectAtomInstance,
  injectAtomValue,
  injectCallback,
  injectEffect,
  injectMappedSignal,
  injectRef,
  injectSignal,
  type AnyAtomInstance,
  type AtomGetters,
  type NodeOf,
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
    const signal = injectSignal({
      objectId,
      rowIdsPopulated: false,
      totalRowCount: 0,
      rows: [] as string[],
    });

    /**
     * @QUESTION is this the correct way to create stable internal state? some
     * other way?
     *
     * @ANSWER This is fine. I'd prefer `injectSignal` in case you need to
     * inspect changes (e.g. for debugging).
     *
     * But sometimes a ref is necessary for performance. I've profiled this app
     * and it's nowhere near bottlenecking. So bottom line: It doesn't matter.
     * Either's fine.
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

      signal.mutate((s) => {
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

    return api(signal).setExports({ populateRowIds });
  }
);

export const objectIdFromInstance = (
  { get }: AtomGetters,
  instance: NodeOf<typeof dataTableAtom>
) => get(instance).objectId;

export const getRowIdAtIndex = (
  { get }: AtomGetters,
  { instance, index }: { instance: NodeOf<typeof dataTableAtom>; index: number }
) => get(instance).rows[index];

export const rowIdAtIndexAtom = atom(
  "row-id-at-index",
  ({
    instance,
    index,
  }: {
    instance: NodeOf<typeof dataTableAtom>;
    index: number;
  }) => {
    const rowId = injectAtomValue(getRowIdAtIndex, [{ instance, index }]);

    injectEffect(() => {
      if (!rowId) {
        instance.exports.populateRowIds(index);
      }
    }, [index, rowId]);

    return rowId;
  },
  { ttl: 0 }
);

export const getTotalRowCount = (
  { get }: AtomGetters,
  instance: NodeOf<typeof dataTableAtom>
) => get(instance).totalRowCount;

export const getRowIdsPopulated = (
  { get }: AtomGetters,
  instance: NodeOf<typeof dataTableAtom>
) => get(instance).rowIdsPopulated;

/**
 * @QUESTION how to think about organizing atom "scope/size"? For example, this
 * could go into the dataTableAtom. Any general guidelines re how to think about
 * when to break up atoms into smaller atoms, vs expand the api surface of an
 * existing atom?
 *
 * @ANSWER it's mostly down to preference. My rule of thumb is the smaller the
 * better. Atoms do very well broken up. But in very big, very complex UIs, that
 * could mean working with hundreds of atoms.
 *
 * You can also create wrapper atoms that combine functionality from several
 * broken-out pieces. Atoms are made to be composable specifically for this -
 * exports can be merged, promises can be `Promise.all`'d, signals can be
 * composed with `injectMappedSignal`.
 */
export const renderedCursorAtom = atom("rendered-cursor", () => {
  const signal = injectSignal({
    minRow: 0,
    maxRow: 0,
    minColumn: 0,
    maxColumn: 0,
  });

  return api(signal).setExports({
    /**
     * @NOTE these two exports are selectors. They call `signal.get`, which is
     * reactive. Pass these exports directly to `ecosystem.get` or
     * `useAtomValue` to reactively update when only these selected properties
     * change
     */
    getRenderedMaxRow: () => signal.get().maxRow,

    getRenderedMinRow: () => signal.get().minRow,

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

      signal.set({ minRow, maxRow, minColumn, maxColumn });
    },
  });
});

/**
 * @QUESTION can selectors / "scoped" state be exposed via an atom's api?
 *
 * @ANSWER Yes, any atom can export selector functions. I've switched to that
 * approach (see `renderedCursorAtom` above).
 *
 * It's also possible to create atom factories or extend the `AtomTemplate`
 * class to attach these selectors to the template rather than an instance.
 */
// export const getRenderedMinRow = ({ get }: AtomGetters) =>
//   get(renderedCursorAtom).minRow;

// export const getRenderedMaxRow = ({ get }: AtomGetters) =>
//   get(renderedCursorAtom).maxRow;

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
    const column = injectAtomValue(getObjectColumnAtIndex, [
      {
        objectId,
        index: columnIndex,
      },
    ])!;

    const recordAttribute = injectAtomInstance(recordAttributeAtom, [
      { objectId, recordId: rowId, columnId: column.id },
    ]);

    const composedSignal = injectMappedSignal({ attribute: recordAttribute });

    injectEffect(() => {
      recordAttribute.exports.populate();

      return () => {
        recordAttribute.exports.cancelPopulate();
      };
    }, [recordAttribute]);

    return composedSignal;
  },
  {
    ttl: 0,
  }
);
