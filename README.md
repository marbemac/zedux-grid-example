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

![example](https://i.imgur.com/0Nb8hAv.gif)

</details>

## Organization

- The mock API is in [app/utils/api.ts](app/utils/api.ts)
- The [app/atoms](app/atoms) folder contains the atoms for objects (an object has many records) and records.
- The [app/routes/objects.$objectId.tsx](app/routes/objects.$objectId.tsx) file uses the data table component to render the records for a particular object.
- The [app/routes/objects.$objectId.$recordId.tsx](app/routes/objects.$objectId.$recordId.tsx) file renders the details panel when clicking on a specific record in the data table.
- The [app/components/DataTable](app/components/DataTable) folder contains the atoms and react components for the data table itself.
