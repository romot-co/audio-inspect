import {
  AudioSource,
  Feature,
  StreamController,
  StreamOptions,
  AudioInspectError,
  AudioInspectNodeOptions
} from '../types.js';
import { AudioInspectNode } from './AudioInspectNode.js';

// モジュール登録済みコンテキストのトラッキング
const registeredContexts = new WeakSet<BaseAudioContext>();

/**
 * AudioWorkletモジュールが登録済みかチェック
 * @param context - AudioContext
 * @returns 登録済みの場合true
 */
function isModuleRegistered(context: BaseAudioContext): boolean {
  return registeredContexts.has(context);
}

/**
 * AudioWorkletモジュールを登録済みとしてマーク
 * @param context - AudioContext
 */
function markModuleAsRegistered(context: BaseAudioContext): void {
  registeredContexts.add(context);
}

/**
 * AudioInspectProcessorモジュールを追加
 * @param context - AudioContext
 * @param processorUrl - プロセッサーファイルのURL
 */
async function addProcessorModule(context: BaseAudioContext, processorUrl: string): Promise<void> {
  try {
    await context.audioWorklet.addModule(processorUrl);
    markModuleAsRegistered(context);
  } catch (error) {
    throw new AudioInspectError(
      'INITIALIZATION_FAILED',
      `AudioInspectProcessorモジュールの追加に失敗しました: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * ストリーミング解析のコントローラー実装
 */
class StreamControllerImpl<T = unknown> implements StreamController {
  private _paused = false;
  private inspectNode: AudioInspectNode;
  private sourceNode: AudioNode;

  constructor(
    _context: AudioContext,
    sourceNode: AudioNode,
    inspectNode: AudioInspectNode,
    resultHandler?: (result: T) => void,
    errorHandler?: (error: { message: string; detail?: unknown }) => void
  ) {
    this.sourceNode = sourceNode;
    this.inspectNode = inspectNode;

    // イベントハンドラーを設定
    if (resultHandler) {
      this.inspectNode.onresult = (event): void => resultHandler(event.data as T);
    }
    if (errorHandler) {
      this.inspectNode.onerror = errorHandler;
    }

    // ソースを接続（AudioInspectNodeはAudioWorkletNodeを継承）
    this.sourceNode.connect(this.inspectNode as unknown as AudioNode);
  }

  pause(): void {
    if (!this._paused) {
      this.sourceNode.disconnect(this.inspectNode as unknown as AudioNode);
      this._paused = true;
    }
  }

  resume(): void {
    if (this._paused) {
      this.sourceNode.connect(this.inspectNode as unknown as AudioNode);
      this._paused = false;
    }
  }

  stop(): void {
    this.sourceNode.disconnect(this.inspectNode as unknown as AudioNode);
    this.inspectNode.dispose();
    this._paused = true;
  }

  get paused(): boolean {
    return this._paused;
  }
}

/**
 * ストリーミング解析を開始
 *
 * @param source - 音声ソース（MediaStream、AudioNode、AudioBuffer）
 * @param feature - 解析機能（関数または関数名の文字列）
 *                  注意: 関数オブジェクトを渡した場合でも、実際にはその名前（feature.name）が使用されます
 * @param options - ストリーミングオプション（processorModuleUrlは必須）
 * @param resultHandler - 結果を受け取るハンドラー
 * @param errorHandler - エラーを受け取るハンドラー
 * @returns ストリーミングコントローラー
 */
export async function stream<T>(
  source: AudioSource,
  feature: Feature<T> | string,
  options: StreamOptions & { processorModuleUrl: string }, // processorModuleUrlを必須に
  resultHandler?: (result: T) => void,
  errorHandler?: (error: { message: string; detail?: unknown }) => void
): Promise<StreamController> {
  // 機能名を取得（関数の場合は .name プロパティを使用）
  const featureName = typeof feature === 'string' ? feature : feature.name;
  if (!featureName) {
    throw new AudioInspectError('INVALID_INPUT', '解析機能名が指定されていません');
  }

  // AudioContextを取得または作成
  let context: AudioContext;
  let sourceNode: AudioNode;

  if (source instanceof MediaStream) {
    context = new AudioContext();
    sourceNode = context.createMediaStreamSource(source);
  } else if (source instanceof AudioNode) {
    context = source.context as AudioContext;
    sourceNode = source;
  } else if (source instanceof AudioBuffer) {
    context = new AudioContext();
    sourceNode = context.createBufferSource();
    (sourceNode as AudioBufferSourceNode).buffer = source;
    (sourceNode as AudioBufferSourceNode).start();
  } else {
    throw new AudioInspectError('UNSUPPORTED_FORMAT', 'サポートされていない音声ソース形式です');
  }

  try {
    // プロセッサモジュールを追加
    await addProcessorModule(context, options.processorModuleUrl);

    // AudioInspectNodeを作成
    const nodeOptions: AudioInspectNodeOptions = {
      featureName,
      bufferSize: options?.bufferSize || 1024,
      hopSize: options?.hopSize || 512,
      inputChannelCount: 1
    };

    const inspectNode = new AudioInspectNode(context, nodeOptions);

    // コントローラーを作成して返す
    return new StreamControllerImpl<T>(
      context,
      sourceNode,
      inspectNode,
      resultHandler,
      errorHandler
    );
  } catch (error) {
    throw new AudioInspectError(
      'INITIALIZATION_FAILED',
      `ストリーミング解析の初期化に失敗しました: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * 簡易AudioInspectNodeファクトリー関数（同期版）
 * E2Eテストや簡単な使用例向け
 * @param context - BaseAudioContext
 * @param options - ノードオプション
 * @returns AudioInspectNode
 */
export function createAudioInspectNode(
  context: BaseAudioContext,
  options?: AudioInspectNodeOptions
): AudioInspectNode {
  return new AudioInspectNode(context, options);
}

/**
 * AudioInspectNodeをプロセッサーモジュールと共に作成（非同期版）
 * @param context - BaseAudioContext
 * @param featureName - 特徴量名
 * @param processorModuleUrl - プロセッサーモジュールのURL
 * @param options - 追加オプション
 * @returns AudioInspectNode
 */
export async function createAudioInspectNodeWithModule(
  context: BaseAudioContext,
  featureName: string,
  processorModuleUrl: string,
  options?: Partial<AudioInspectNodeOptions>
): Promise<AudioInspectNode> {
  try {
    // モジュールが未登録の場合は登録
    if (!isModuleRegistered(context)) {
      await addProcessorModule(context, processorModuleUrl);
    }

    // AudioInspectNodeを作成
    const nodeOptions: AudioInspectNodeOptions = {
      featureName,
      bufferSize: 1024,
      hopSize: 512,
      inputChannelCount: 1,
      ...options
    };

    return new AudioInspectNode(context, nodeOptions);
  } catch (error) {
    throw new AudioInspectError(
      'INITIALIZATION_FAILED',
      `AudioInspectNodeの作成に失敗しました: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
