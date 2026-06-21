import { pdfjs } from 'react-pdf';
// Lesson 8: bundle the worker through Vite's `?url` loader so the runtime
// version is always in lockstep with the pinned `pdfjs-dist@3.11.174` and we
// no longer depend on unpkg CDN reachability (offline / firewalled / 200MB
// books all need the worker to be available reliably).
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.js?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
