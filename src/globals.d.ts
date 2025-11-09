// This declares the `aistudio` object on the global `Window` interface
// to make TypeScript aware of it. This prevents build errors in strict mode.
interface Window {
  aistudio?: {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  };
}
