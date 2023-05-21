/**
 * Intercept OS signals and make them a normal exit.
 *
 * This ensures that unload events are called reliably on most signals
 * that terminate the process. SIGKILL cannot be intercepted.
 *
 * When Deno exits due to a signal, the OS closes child processes
 * automatically. It is only necessary to use this if unload events
 * *must* be processed.
 *
 * This uses unstable APIs.
 */
export function exitOnSignal(): void {
  Deno.addSignalListener("SIGINT", () => Deno.exit(130));
  Deno.addSignalListener("SIGTERM", () => Deno.exit(133));
  Deno.addSignalListener("SIGQUIT", () => Deno.exit(134));
  Deno.addSignalListener("SIGHUP", () => Deno.exit(135));
}
