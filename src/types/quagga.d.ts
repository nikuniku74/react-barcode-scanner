declare module 'quagga' {
  interface QuaggaConfig {
    inputStream: {
      name: string;
      type: string;
      target: HTMLVideoElement;
      constraints?: {
        width?: { ideal: number };
        height?: { ideal: number };
        facingMode?: string;
      };
    };
    decoder: {
      readers: string[];
      debug?: {
        showCanvas?: boolean;
        showPatterns?: boolean;
        showFrequency?: boolean;
        showErrors?: boolean;
      };
    };
    locator?: {
      halfSample?: boolean;
      patchSize?: string;
    };
    numOfWorkers?: number;
    frequency?: number;
  }

  interface CodeResult {
    code: string;
    format: string;
  }

  interface QuaggaResult {
    codeResult: CodeResult;
  }

  const Quagga: {
    init: (config: QuaggaConfig, callback: (err: any) => void) => void;
    start: () => void;
    stop: () => void;
    onDetected: (callback: (result: QuaggaResult) => void) => void;
  };

  export default Quagga;
}
