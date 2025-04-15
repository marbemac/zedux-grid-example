import { type AnyRouter } from "@tanstack/react-router";
import {
  atom,
  type Ecosystem,
  injectEcosystem,
  injectEffect,
  injectSignal,
} from "@zedux/react";

export const currentRouteAtom = atom("current-route", () => {
  /**
   * @NOTE I'd create a custom injector that checks if the current ecosystem's
   * context matches the expected shape and throws a user-friendly error if not.
   */
  const { router } = (injectEcosystem() as Ecosystem<{ router: AnyRouter }>)
    .context;

  const signal = injectSignal({
    routeId: router.state.matches[router.state.matches.length - 1]!.routeId,
    params: router.state.matches[0]!.params,
    search: router.state.matches[0]!.search,
  });

  injectEffect(() => {
    return router.subscribe("onLoad", () => {
      signal.set({
        routeId: router.state.matches[router.state.matches.length - 1]!.routeId,
        params: router.state.matches[0]!.params,
        search: router.state.matches[0]!.search,
      });
    });
  }, [router]);

  return signal;
});
