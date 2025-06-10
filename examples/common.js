// 共通のユーティリティ関数とスタイル

// AudioInspectライブラリのロード
import AudioInspect from '../dist/index.js';

// 共通スタイル
export const commonStyle = `
  body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    margin: 0;
    padding: 20px;
    background-color: #f5f5f5;
  }
  
  .container {
    max-width: 1200px;
    margin: 0 auto;
    background: white;
    padding: 30px;
    border-radius: 10px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  }
  
  h1 {
    color: #333;
    text-align: center;
    margin-bottom: 30px;
  }
  
  .controls {
    margin-bottom: 30px;
    text-align: center;
  }
  
  button {
    background: #007bff;
    color: white;
    border: none;
    padding: 10px 20px;
    margin: 5px;
    border-radius: 5px;
    cursor: pointer;
    font-size: 16px;
  }
  
  button:hover {
    background: #0056b3;
  }
  
  button:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
  
  .results {
    margin-top: 20px;
    padding: 20px;
    background: #f8f9fa;
    border-radius: 5px;
    border-left: 4px solid #007bff;
  }
  
  .result-item {
    margin: 10px 0;
    padding: 10px;
    background: white;
    border-radius: 3px;
    font-family: monospace;
  }
  
  .error {
    color: #dc3545;
    background: #f8d7da;
    border-color: #f5c6cb;
  }
  
  .status {
    margin: 10px 0;
    padding: 10px;
    border-radius: 3px;
  }
  
  .status.recording {
    background: #d4edda;
    color: #155724;
  }
  
  .status.processing {
    background: #fff3cd;
    color: #856404;
  }
  
  .canvas-container {
    margin: 20px 0;
    text-align: center;
  }
  
  canvas {
    border: 1px solid #ddd;
    background: white;
  }
`;

// 共通のオーディオセットアップ
export class AudioSetup {
  constructor() {
    this.audioContext = null;
    this.stream = null;
    this.source = null;
    this.audioInspectNode = null;
    this.isRecording = false;
  }

  async initialize() {
    try {
      // オーディオコンテキストの作成
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // マイクアクセスの取得
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        } 
      });
      
      // MediaStreamSourceの作成
      this.source = this.audioContext.createMediaStreamSource(this.stream);
      
      console.log('Audio setup completed');
      return true;
    } catch (error) {
      console.error('Audio setup failed:', error);
      throw error;
    }
  }

  async startAnalysis(featureName, options = {}) {
    if (!this.audioContext || !this.source) {
      throw new Error('Audio not initialized');
    }

    try {
      // AudioWorkletの登録
      await this.audioContext.audioWorklet.addModule('../dist/AudioInspectProcessor.global.js');
      
      // AudioInspectNodeの作成
      this.audioInspectNode = new AudioInspect.AudioInspectNode(this.audioContext, {
        featureName: featureName,
        bufferSize: 2048,
        hopSize: 1024,
        inputChannelCount: 1,
        ...options
      });
      
      // 音声解析の開始
      this.source.connect(this.audioInspectNode);
      
      this.isRecording = true;
      console.log(`Started analysis: ${featureName}`);
      
      return this.audioInspectNode;
    } catch (error) {
      console.error('Failed to start analysis:', error);
      throw error;
    }
  }

  stopAnalysis() {
    if (this.audioInspectNode) {
      this.source.disconnect(this.audioInspectNode);
      this.audioInspectNode.dispose();
      this.audioInspectNode = null;
    }
    this.isRecording = false;
    console.log('Analysis stopped');
  }

  cleanup() {
    this.stopAnalysis();
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.source = null;
  }
}

// 結果表示のユーティリティ
export class ResultDisplay {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.results = [];
  }

  addResult(data, timestamp = Date.now()) {
    const resultDiv = document.createElement('div');
    resultDiv.className = 'result-item';
    
    const timeStr = new Date(timestamp).toLocaleTimeString();
    const dataStr = typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data);
    
    resultDiv.innerHTML = `
      <strong>${timeStr}:</strong><br>
      <pre>${dataStr}</pre>
    `;
    
    this.container.appendChild(resultDiv);
    
    // 最新10件のみ表示
    while (this.container.children.length > 10) {
      this.container.removeChild(this.container.firstChild);
    }
    
    // 最新の結果にスクロール
    resultDiv.scrollIntoView({ behavior: 'smooth' });
  }

  addError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'result-item error';
    errorDiv.innerHTML = `<strong>Error:</strong> ${message}`;
    this.container.appendChild(errorDiv);
  }

  clear() {
    this.container.innerHTML = '';
  }
}

// ステータス表示
export class StatusDisplay {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
  }

  setStatus(message, type = 'info') {
    this.container.className = `status ${type}`;
    this.container.textContent = message;
  }

  setRecording() {
    this.setStatus('🔴 Recording and analyzing...', 'recording');
  }

  setStopped() {
    this.setStatus('⏹️ Stopped', 'info');
  }

  setProcessing() {
    this.setStatus('⚙️ Processing...', 'processing');
  }
}

// キャンバス描画ユーティリティ
export class CanvasVisualizer {
  constructor(canvasId, width = 800, height = 400) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.canvas.width = width;
    this.canvas.height = height;
    this.width = width;
    this.height = height;
  }

  clear() {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  drawWaveform(data) {
    this.clear();
    
    if (!data || !Array.isArray(data)) return;
    
    this.ctx.strokeStyle = '#007bff';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    
    const step = this.width / data.length;
    
    for (let i = 0; i < data.length; i++) {
      const x = i * step;
      const y = (data[i] + 1) * this.height / 2;
      
      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }
    
    this.ctx.stroke();
  }

  drawSpectrum(frequencyData) {
    this.clear();
    
    if (!frequencyData || !Array.isArray(frequencyData)) return;
    
    const barWidth = this.width / frequencyData.length;
    
    for (let i = 0; i < frequencyData.length; i++) {
      const barHeight = (frequencyData[i] / 255) * this.height;
      
      this.ctx.fillStyle = `hsl(${(i / frequencyData.length) * 360}, 70%, 50%)`;
      this.ctx.fillRect(i * barWidth, this.height - barHeight, barWidth, barHeight);
    }
  }

  drawRealTimeValue(value, label, unit = '') {
    this.clear();
    
    // 背景
    this.ctx.fillStyle = '#f8f9fa';
    this.ctx.fillRect(0, 0, this.width, this.height);
    
    // 値の表示
    this.ctx.fillStyle = '#333';
    this.ctx.font = 'bold 48px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    
    const valueText = typeof value === 'number' ? value.toFixed(3) : String(value);
    this.ctx.fillText(valueText + unit, this.width / 2, this.height / 2 - 20);
    
    // ラベル
    this.ctx.font = '24px Arial';
    this.ctx.fillStyle = '#666';
    this.ctx.fillText(label, this.width / 2, this.height / 2 + 40);
  }
}

export default {
  AudioSetup,
  ResultDisplay,
  StatusDisplay,
  CanvasVisualizer,
  commonStyle
};