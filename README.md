# Zedux Data Grid Example

A more advanced Zedux example.

- Virtualized table (grid) that loads rendered rows + columns on demand
- Tracks the stale time of each cell independently
- Re-uses the fetched data when rendering outside the table (for example, on a "details" panel)

Running it:

1. `yarn`
2. `yarn dev`
3. Open http://localhost:3000

<details>
  <summary>Example GIF</summary>

![2024-12-02 18 49 14](https://github.com/user-attachments/assets/394179f4-7dcc-441c-b39b-dcbb4a6b5894)

</details>

## Organization

- The mock API is in [app/utils/api.ts](app/utils/api.ts)
- The [app/atoms](app/atoms) folder contains the atoms for objects (an object has many records) and records.
- The [app/routes/objects.$objectId.tsx](app/routes/objects.$objectId.tsx) file uses the data table component to render the records for a particular object.
- The [app/routes/objects.$objectId.$recordId.tsx](app/routes/objects.$objectId.$recordId.tsx) file renders the details panel when clicking on a specific record in the data table.
- The [app/components/DataTable](app/components/DataTable) folder contains the atoms and react components for the data table itself.
