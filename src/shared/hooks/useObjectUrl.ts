import { useMemo, useSyncExternalStore } from "react";

/**
 * A `blob:` URL for showing a Blob in an <img> or a PDF viewer. The URL keeps the file in memory until it is revoked,
 * so it is created when something starts using it and revoked when the last user goes away.
 *
 * It is an external store on purpose: that is how React expects a resource it does not own to be handled, and it
 * stays correct when React (in development) mounts, unmounts and mounts a component again.
 */
function createStore(blob: Blob) {
  let url: string | null = null;
  const listeners = new Set<() => void>();
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (url === null) {
        url = URL.createObjectURL(blob);
        listener();
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && url !== null) {
          URL.revokeObjectURL(url);
          url = null;
        }
      };
    },
    getSnapshot: () => url,
  };
}

const noopSubscribe = () => () => {};
const nothing = () => null;

export function useObjectUrl(blob: Blob | undefined): string | null {
  const store = useMemo(() => (blob ? createStore(blob) : null), [blob]);
  return useSyncExternalStore(store?.subscribe ?? noopSubscribe, store?.getSnapshot ?? nothing);
}
