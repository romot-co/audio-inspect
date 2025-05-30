import { test, expect } from '@playwright/test';

test.describe('AudioInspectNode E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // コンソールログをキャプチャ
    page.on('console', msg => {
      console.log(`[Browser Console ${msg.type().toUpperCase()}]: ${msg.text()}`);
    });
    
    // ページエラーをキャプチャ
    page.on('pageerror', err => {
      console.error(`[Browser Error]: ${err.message}`);
    });
    
    // テストページに移動
    await page.goto('/test-page.html');
  });

  test('AudioInspectNodeがカスタムAudioNodeとして動作することを検証', async ({ page }) => {
    const testResults = await page.evaluate(async () => {
      return (window as any).runFullTest();
    });

    console.log('Test results:', JSON.stringify(testResults, null, 2));

    // 基本テストの検証
    expect(testResults.basicTest?.success).toBe(true);
    expect(testResults.basicTest?.nodeProperties?.hasConnect).toBe(true);
    expect(testResults.basicTest?.nodeProperties?.hasDisconnect).toBe(true);
    expect(testResults.basicTest?.nodeProperties?.hasContext).toBe(true);
    expect(testResults.basicTest?.nodeProperties?.numberOfInputs).toBe(1);
    expect(testResults.basicTest?.nodeProperties?.numberOfOutputs).toBe(0);
    expect(testResults.basicTest?.nodeProperties?.isAudioWorkletNode).toBe(true);

    // カスタムプロパティの検証
    expect(testResults.basicTest?.customProperties?.featureName).toBe('getRMS');
    expect(testResults.basicTest?.customProperties?.bufferSize).toBe(1024);
    expect(testResults.basicTest?.customProperties?.hopSize).toBe(512);
    expect(testResults.basicTest?.customProperties?.hasUpdateOptions).toBe(true);
    expect(testResults.basicTest?.customProperties?.hasReset).toBe(true);

    // 接続テストの検証
    expect(testResults.connectionTest?.success).toBe(true);
    expect(testResults.connectionTest?.connectionSuccessful).toBe(true);
    expect(testResults.connectionTest?.rmsCount).toBeGreaterThanOrEqual(3);
    expect(testResults.connectionTest?.averageRMS).toBeGreaterThan(0);
    expect(testResults.connectionTest?.rmsValues?.length).toBeGreaterThan(0);
  });
});
