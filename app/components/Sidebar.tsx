import { Link } from "@tanstack/react-router";

export const Sidebar = () => {
  return (
    <div className="w-48 shrink-0 border-r flex flex-col gap-3 p-5">
      <div>
        <Link
          to="/objects/$objectId"
          params={{ objectId: "object-1" }}
          className="data-[status=active]:underline"
        >
          Object 1
        </Link>
      </div>
      <div>
        <Link
          to="/objects/$objectId"
          params={{ objectId: "object-2" }}
          className="data-[status=active]:underline"
        >
          Object 2
        </Link>
      </div>
      <div>
        <Link
          to="/objects/$objectId"
          params={{ objectId: "object-3" }}
          className="data-[status=active]:underline"
        >
          Object 3
        </Link>
      </div>
    </div>
  );
};
