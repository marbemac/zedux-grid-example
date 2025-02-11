import { type AnyRouter } from "@tanstack/react-router";
import {
  atom,
  type Ecosystem,
  injectAtomGetters,
  injectEffect,
  injectStore,
} from "@zedux/react";

export const currentRouteAtom = atom("current-route", () => {
  const { router } = (
    injectAtomGetters().ecosystem as Ecosystem<{ router: AnyRouter }>
  ).context;

  console.log("router", {
    routeId: router.state.matches[router.state.matches.length - 1]!.routeId,
    params: router.state.matches[0]!.params,
    search: router.state.matches[0]!.search,
  });

  const store = injectStore({
    routeId: router.state.matches[router.state.matches.length - 1]!.routeId,
    params: router.state.matches[0]!.params,
    search: router.state.matches[0]!.search,
  });

  injectEffect(() => {
    return router.subscribe("onLoad", () => {
      store.setState({
        routeId: router.state.matches[router.state.matches.length - 1]!.routeId,
        params: router.state.matches[0]!.params,
        search: router.state.matches[0]!.search,
      });
    });
  }, [router]);

  return store;
});
