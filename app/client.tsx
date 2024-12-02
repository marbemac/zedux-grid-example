/// <reference types="vinxi/types/client" />

// import { scan } from "react-scan";
import { hydrateRoot } from "react-dom/client";
import { StartClient } from "@tanstack/start";
import { createRouter } from "./router";
// import { useEffect } from "react";

const router = createRouter();

const WithScan = () => {
  // useEffect(() => {
  //   scan({
  //     enabled: true,
  //     log: true, // logs render info to console (default: false)
  //   });
  // }, []);

  return <StartClient router={router} />;
};

hydrateRoot(document!, <WithScan />);
