import { lazy } from 'react';

/**
 * `React.lazy` requires a module with a `default` export. This helper lets
 * us lazy-load NAMED exports (which is what nearly every component in this
 * codebase uses) without rewriting all of them.
 *
 *   const PdfViewer = lazyNamed(() => import('./PdfViewer.jsx'), 'PdfViewer');
 */
export function lazyNamed(loader, name) {
  return lazy(() =>
    loader().then((mod) => ({ default: mod[name] ?? mod.default })),
  );
}
