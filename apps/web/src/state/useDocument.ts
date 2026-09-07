/**
 * Opening a document.
 *
 * A hook rather than inline `fetch`, for the reason every data fetch wants one:
 * the failure paths. A stale response arriving after the user has switched
 * documents must not overwrite the new one, and a request in flight must not
 * leave a component setting state after it has unmounted.
 *
 * Deliberately not a query library. One fetch with one cancellation flag is
 * less code than configuring one, and it is the whole of what this needs.
 */

import { useEffect, useState } from 'react';
import type { ChantDoc } from '@siksamitra/format';

export interface OpenDocument {
  readonly doc: ChantDoc | null;
  readonly error: string | null;
}

export function useDocument(slug: string): OpenDocument {
  const [state, setState] = useState<OpenDocument>({ doc: null, error: null });

  useEffect(() => {
    let live = true;
    setState({ doc: null, error: null });

    fetch(`/chants/${encodeURIComponent(slug)}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((doc: ChantDoc) => { if (live) setState({ doc, error: null }); })
      .catch((e: Error) => { if (live) setState({ doc: null, error: e.message }); });

    // The flag, not an AbortController: an aborted fetch rejects, which would
    // set an error for a document nobody is waiting for any more.
    return () => { live = false; };
  }, [slug]);

  return state;
}
