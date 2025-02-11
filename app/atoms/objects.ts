import {
  atom,
  injectPromise,
  type AtomGetters,
  type AtomInstanceType,
} from "@zedux/react";
import { fetchObjectDefinition } from "~/utils/api";

export const objectFetcherAtom = atom(
  "object-fetcher",
  ({ objectId }: { objectId: string }) => {
    const objectApi = injectPromise(
      () => fetchObjectDefinition({ data: objectId }),
      [objectId]
    );

    return objectApi;
  }
);

export const getObjectColumns = (
  { get }: AtomGetters,
  { objectId }: { objectId: string }
) => get(objectFetcherAtom, [{ objectId }]).data?.columns || [];

export const getObjectColumnAtIndex = (
  { get }: AtomGetters,
  { objectId, index }: { objectId: string; index: number }
) => get(objectFetcherAtom, [{ objectId }]).data?.columns[index];

export const objectColumnsFromInstance = (
  { get }: AtomGetters,
  instance: AtomInstanceType<typeof objectFetcherAtom>
  /**
   * @QUESTION Better way to do this? Kind of awkward to have selectors with mildy different
   * implementations (this one vs getObjectColumnAtIndex).
   */
) => get(instance).data?.columns || [];
