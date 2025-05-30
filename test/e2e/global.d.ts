interface TestResults {
  rmsCount: number;
  rmsValues: number[];
  lastTimestamp: number;
  basicTest?: {
    nodeProperties?: any;
    customProperties?: any;
    success: boolean;
    error?: string;
  };
  connectionTest?: {
    connectionSuccessful: boolean;
    rmsCount: number;
    rmsValues: number[];
    averageRMS: number;
    success: boolean;
    error?: string;
  };
  [key: string]: any; // 追加のプロパティを許可
}

declare global {
  interface Window {
    audioContext?: AudioContext;
    testResults?: TestResults;
    getTestResults(): TestResults;
    stopTest(): void;
    startAutomaticTest(): Promise<TestResults>;
    runFullTest: () => Promise<{
      basicTest?: {
        success: boolean;
        nodeProperties?: any;
        customProperties?: any;
      };
      connectionTest?: {
        success: boolean;
        connectionSuccessful: boolean;
        rmsCount: number;
        averageRMS: number;
        rmsValues?: number[];
      };
    }>;
  }
}

// モジュール宣言
declare module '/index.js' {
  export function createAudioInspectNode(context: AudioContext, options?: any): any;
}

export {};
