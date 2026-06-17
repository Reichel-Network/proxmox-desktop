import type { PmxApi } from '../preload/index';

declare global {
  interface Window {
    pmx: PmxApi;
  }
}

export {};
