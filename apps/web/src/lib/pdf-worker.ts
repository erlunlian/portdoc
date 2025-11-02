import { GlobalWorkerOptions } from 'pdfjs-dist';

// Configure PDF.js worker
if (typeof window !== 'undefined' && 'Worker' in window) {
  GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
}