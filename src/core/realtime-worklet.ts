import { AudioInspectError } from '../types.js';

export interface PrepareWorkletOptions {
  moduleUrl?: string;
}

const loadedModulesByContext = new WeakMap<BaseAudioContext, Set<string>>();

function getDefaultWorkletModuleUrl(): string {
  if (typeof location !== 'undefined' && typeof location.href === 'string') {
    return new URL('/core/AudioInspectProcessor.js', location.href).href;
  }

  return '/core/AudioInspectProcessor.js';
}

function getLoadedModuleSet(context: BaseAudioContext): Set<string> {
  const existing = loadedModulesByContext.get(context);
  if (existing) {
    return existing;
  }

  const created = new Set<string>();
  loadedModulesByContext.set(context, created);
  return created;
}

export async function prepareWorklet(
  context: BaseAudioContext,
  options: PrepareWorkletOptions = {}
): Promise<void> {
  const moduleUrl = options.moduleUrl ?? getDefaultWorkletModuleUrl();
  const loaded = getLoadedModuleSet(context);

  if (loaded.has(moduleUrl)) {
    return;
  }

  if (!context.audioWorklet || typeof context.audioWorklet.addModule !== 'function') {
    throw new AudioInspectError('WORKLET_NOT_SUPPORTED', 'AudioWorklet is not supported in this context');
  }

  try {
    await context.audioWorklet.addModule(moduleUrl);
    loaded.add(moduleUrl);
  } catch (error) {
    throw new AudioInspectError(
      'MODULE_LOAD_FAILED',
      `Failed to load AudioWorklet module: ${moduleUrl}`,
      error
    );
  }
}
