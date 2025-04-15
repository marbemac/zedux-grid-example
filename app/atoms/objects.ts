import { atom, injectPromise, type Ecosystem, type NodeOf } from "@zedux/react";
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

// export const getObjectColumns = (
//   { get }: Ecosystem,
//   { objectId }: { objectId: string }
// ) => get(objectFetcherAtom, [{ objectId }]).data?.columns || [];

export const getObjectColumnAtIndex = (
  { get }: Ecosystem,
  { objectId, index }: { objectId: string; index: number }
) => get(objectFetcherAtom, [{ objectId }]).data?.columns[index];

// export const objectColumnsFromInstance = (
//   { get }: Ecosystem,
//   instance: NodeOf<typeof objectFetcherAtom>
/**
 * @QUESTION Better way to do this? Kind of awkward to have selectors with mildy
 * different implementations (this one vs getObjectColumnAtIndex).
 *
 * @ANSWER I think you mean `getObjectColumns`, not `getObjectColumnsAtIndex`.
 * Yes, you can accept either argument in a single selector. Though note that if
 * you pass both, two instances of the selector will be cached (which is fine
 * unless the operation is expensive).
 *
 * I've switched to that approach.
 */
// ) => get(instance).data?.columns || [];

/**
 * @NOTE here's the combined selector, using a discriminated union parameter:
 */
export const getObjectColumns = (
  { getNode }: Ecosystem,
  {
    objectId,
    objectFetcher,
  }:
    | { objectFetcher: NodeOf<typeof objectFetcherAtom>; objectId?: never }
    | { objectFetcher?: never; objectId: string }
) => {
  const resolvedInstance =
    typeof objectId === "string"
      ? getNode(objectFetcherAtom, [{ objectId }])
      : objectFetcher;

  return resolvedInstance.get().data?.columns || [];
};
