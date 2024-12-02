import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <div className="p-5">
      <h3>Click an object on the left.</h3>
    </div>
  );
}
