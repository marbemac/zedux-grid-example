import { createServerFn } from "@tanstack/start";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const SIMULATED_LATENCY = 250;
const ROW_COUNT = 10000;
const COLUMN_COUNT = 30;

export type ObjectId = string;
export type RecordId = string;
export type ColumnId = string;

const objectDefinitions = Array.from({ length: 3 }, (_, i) => ({
  id: `object-${i + 1}`,
  name: `Object ${i + 1}`,
  columns: Array.from({ length: COLUMN_COUNT }, (_, i) => ({
    id: `c${i + 1}`,
    name: `Column ${i + 1}`,
    width: 120,
  })),
}));

export const fetchObjectDefinition = createServerFn({ method: "GET" })
  .validator((objectId: ObjectId) => objectId)
  .handler(async ({ data }) => {
    await sleep(SIMULATED_LATENCY);

    return objectDefinitions.find((o) => o.id === data);
  });

export const fetchRowIds = createServerFn({ method: "GET" })
  .validator(
    (props: { objectId: ObjectId; offset: number; limit: number }) => props
  )
  .handler(async ({ data }) => {
    await sleep(SIMULATED_LATENCY);

    return {
      totalRowCount: ROW_COUNT,
      rows: Array.from({ length: data.limit }, (_, i) => ({
        id: `r${data.offset + i}`,
      })),
    };
  });

export const fetchRecordsData = createServerFn({ method: "GET" })
  .validator(
    (props: {
      objectId: ObjectId;
      recordIds: RecordId[];
      columnIds: ColumnId[];
    }) => props
  )
  .handler(async ({ data }) => {
    await sleep(SIMULATED_LATENCY);

    const records: Record<RecordId, Record<ColumnId, string>> = {};

    for (const recordId of data.recordIds) {
      records[recordId] = {};

      for (const columnId of data.columnIds) {
        records[recordId][columnId] = `${recordId}-${columnId}`;
      }
    }

    return records;
  });
