/* AudioInspectProcessor - AudioWorklet専用バンドル */
// 自己完結型バンドル - すべての依存関係を含む
"use strict";
var AudioInspectProcessorBundle = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // node_modules/webfft/lib/kissfft/KissFFT.mjs
  var import_meta, KissFFTModule, KissFFT_default;
  var init_KissFFT = __esm({
    "node_modules/webfft/lib/kissfft/KissFFT.mjs"() {
      "use strict";
      import_meta = {};
      KissFFTModule = (() => {
        var _scriptDir = import_meta.url;
        return function(moduleArg = {}) {
          var Module = moduleArg;
          var readyPromiseResolve, readyPromiseReject;
          Module["ready"] = new Promise((resolve, reject) => {
            readyPromiseResolve = resolve;
            readyPromiseReject = reject;
          });
          var moduleOverrides = Object.assign({}, Module);
          var arguments_ = [];
          var thisProgram = "./this.program";
          var quit_ = (status, toThrow) => {
            throw toThrow;
          };
          var ENVIRONMENT_IS_WEB = true;
          var ENVIRONMENT_IS_WORKER = false;
          var scriptDirectory = "";
          function locateFile(path) {
            if (Module["locateFile"]) {
              return Module["locateFile"](path, scriptDirectory);
            }
            return scriptDirectory + path;
          }
          var read_, readAsync, readBinary, setWindowTitle;
          if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
            if (ENVIRONMENT_IS_WORKER) {
              scriptDirectory = self.location.href;
            } else if (typeof document != "undefined" && document.currentScript) {
              scriptDirectory = document.currentScript.src;
            }
            if (_scriptDir) {
              scriptDirectory = _scriptDir;
            }
            if (scriptDirectory.indexOf("blob:") !== 0) {
              scriptDirectory = scriptDirectory.substr(0, scriptDirectory.replace(/[?#].*/, "").lastIndexOf("/") + 1);
            } else {
              scriptDirectory = "";
            }
            {
              read_ = (url) => {
                var xhr = new XMLHttpRequest();
                xhr.open("GET", url, false);
                xhr.send(null);
                return xhr.responseText;
              };
              if (ENVIRONMENT_IS_WORKER) {
                readBinary = (url) => {
                  var xhr = new XMLHttpRequest();
                  xhr.open("GET", url, false);
                  xhr.responseType = "arraybuffer";
                  xhr.send(null);
                  return new Uint8Array(xhr.response);
                };
              }
              readAsync = (url, onload, onerror) => {
                var xhr = new XMLHttpRequest();
                xhr.open("GET", url, true);
                xhr.responseType = "arraybuffer";
                xhr.onload = () => {
                  if (xhr.status == 200 || xhr.status == 0 && xhr.response) {
                    onload(xhr.response);
                    return;
                  }
                  onerror();
                };
                xhr.onerror = onerror;
                xhr.send(null);
              };
            }
            setWindowTitle = (title) => document.title = title;
          } else {
          }
          var out = Module["print"] || console.log.bind(console);
          var err = Module["printErr"] || console.error.bind(console);
          Object.assign(Module, moduleOverrides);
          moduleOverrides = null;
          if (Module["arguments"]) arguments_ = Module["arguments"];
          if (Module["thisProgram"]) thisProgram = Module["thisProgram"];
          if (Module["quit"]) quit_ = Module["quit"];
          var wasmBinary;
          if (Module["wasmBinary"]) wasmBinary = Module["wasmBinary"];
          var noExitRuntime = Module["noExitRuntime"] || true;
          if (typeof WebAssembly != "object") {
            abort("no native wasm support detected");
          }
          var wasmMemory;
          var wasmExports;
          var ABORT = false;
          var EXITSTATUS;
          var HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;
          function updateMemoryViews() {
            var b = wasmMemory.buffer;
            Module["HEAP8"] = HEAP8 = new Int8Array(b);
            Module["HEAP16"] = HEAP16 = new Int16Array(b);
            Module["HEAP32"] = HEAP32 = new Int32Array(b);
            Module["HEAPU8"] = HEAPU8 = new Uint8Array(b);
            Module["HEAPU16"] = HEAPU16 = new Uint16Array(b);
            Module["HEAPU32"] = HEAPU32 = new Uint32Array(b);
            Module["HEAPF32"] = HEAPF32 = new Float32Array(b);
            Module["HEAPF64"] = HEAPF64 = new Float64Array(b);
          }
          var wasmTable;
          var __ATPRERUN__ = [];
          var __ATINIT__ = [];
          var __ATPOSTRUN__ = [];
          var runtimeInitialized = false;
          function preRun() {
            if (Module["preRun"]) {
              if (typeof Module["preRun"] == "function") Module["preRun"] = [Module["preRun"]];
              while (Module["preRun"].length) {
                addOnPreRun(Module["preRun"].shift());
              }
            }
            callRuntimeCallbacks(__ATPRERUN__);
          }
          function initRuntime() {
            runtimeInitialized = true;
            callRuntimeCallbacks(__ATINIT__);
          }
          function postRun() {
            if (Module["postRun"]) {
              if (typeof Module["postRun"] == "function") Module["postRun"] = [Module["postRun"]];
              while (Module["postRun"].length) {
                addOnPostRun(Module["postRun"].shift());
              }
            }
            callRuntimeCallbacks(__ATPOSTRUN__);
          }
          function addOnPreRun(cb) {
            __ATPRERUN__.unshift(cb);
          }
          function addOnInit(cb) {
            __ATINIT__.unshift(cb);
          }
          function addOnPostRun(cb) {
            __ATPOSTRUN__.unshift(cb);
          }
          var runDependencies = 0;
          var runDependencyWatcher = null;
          var dependenciesFulfilled = null;
          function addRunDependency(id) {
            runDependencies++;
            if (Module["monitorRunDependencies"]) {
              Module["monitorRunDependencies"](runDependencies);
            }
          }
          function removeRunDependency(id) {
            runDependencies--;
            if (Module["monitorRunDependencies"]) {
              Module["monitorRunDependencies"](runDependencies);
            }
            if (runDependencies == 0) {
              if (runDependencyWatcher !== null) {
                clearInterval(runDependencyWatcher);
                runDependencyWatcher = null;
              }
              if (dependenciesFulfilled) {
                var callback = dependenciesFulfilled;
                dependenciesFulfilled = null;
                callback();
              }
            }
          }
          function abort(what) {
            if (Module["onAbort"]) {
              Module["onAbort"](what);
            }
            what = "Aborted(" + what + ")";
            err(what);
            ABORT = true;
            EXITSTATUS = 1;
            what += ". Build with -sASSERTIONS for more info.";
            var e = new WebAssembly.RuntimeError(what);
            readyPromiseReject(e);
            throw e;
          }
          var dataURIPrefix = "data:application/octet-stream;base64,";
          function isDataURI(filename) {
            return filename.startsWith(dataURIPrefix);
          }
          var wasmBinaryFile;
          wasmBinaryFile = "data:application/octet-stream;base64,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GCAZkzgCBCAHIBcgHpM4AgAgBUEIaiEFIAdBCGohByAEQQhqIQQgAUEIaiEBIABBCGohACAJQQFqIgkgBkcNAAsMAQsgBSgCACELIAlBA3QQByEIAkAgCUECSA0AIAZBAEwNACAFQYgCaiENIAlBfHEhDiAJQQNxIQogCUEBa0EDSSEPQQAhBwNAIAchAUEAIQRBACEDIA9FBEADQCAIIARBA3QiBWogACABQQN0aikCADcCACAIIAVBCHJqIAAgASAGaiIBQQN0aikCADcCACAIIAVBEHJqIAAgASAGaiIBQQN0aikCADcCACAIIAVBGHJqIAAgASAGaiIBQQN0aikCADcCACAEQQRqIQQgASAGaiEBIANBBGoiAyAORw0ACwtBACEFIAoEQANAIAggBEEDdGogACABQQN0aikCADcCACAEQQFqIQQgASAGaiEBIAVBAWoiBSAKRw0ACwsgCCkCACIvp74hFUEAIQwgByEDA0AgACADQQN0aiIFIC83AgAgAiADbCEQIAUqAgQhFEEBIQEgFSETQQAhBANAIAUgEyAIIAFBA3RqIhEqAgAiFiANIAQgEGoiBCALQQAgBCALThtrIgRBA3RqIhIqAgAiF5QgEioCBCIYIBEqAgQiGZSTkiITOAIAIAUgFCAWIBiUIBcgGZSSkiIUOAIEIAFBAWoiASAJRw0ACyADIAZqIQMgDEEBaiIMIAlHDQALIAdBAWoiByAGRw0ACwsgCBAGCwsDAAELwQEBAn8jAEEQayIBJAACfCAAvUIgiKdB/////wdxIgJB+8Ok/wNNBEBEAAAAAAAA8D8gAkGewZryA0kNARogAEQAAAAAAAAAABAEDAELIAAgAKEgAkGAgMD/B08NABoCQAJAAkACQCAAIAEQC0EDcQ4DAAECAwsgASsDACABKwMIEAQMAwsgASsDACABKwMIQQEQA5oMAgsgASsDACABKwMIEASaDAELIAErAwAgASsDCEEBEAMLIQAgAUEQaiQAIAALuBgDFH8EfAF+IwBBMGsiCCQAAkACQAJAIAC9IhpCIIinIgNB/////wdxIgZB+tS9gARNBEAgA0H//z9xQfvDJEYNASAGQfyyi4AETQRAIBpCAFkEQCABIABEAABAVPsh+b+gIgBEMWNiGmG00L2gIhY5AwAgASAAIBahRDFjYhphtNC9oDkDCEEB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IAIgC0chCiACQQFqIQIgCg0ACwsgBUGgAWogBkEDdGogADkDACAEQQBKIQIgBEEBayEEIAINAAsLRAAAAAAAAAAAIQAgA0EATgRAIAMhAgNAIAIiBEEBayECIAAgBUGgAWogBEEDdGorAwCgIQAgBA0ACwsgCCAAmiAAIAwbOQMAIAUrA6ABIAChIQBBASECIANBAEoEQANAIAAgBUGgAWogAkEDdGorAwCgIQAgAiADRyEEIAJBAWohAiAEDQALCyAIIACaIAAgDBs5AwggBUGwBGokACAHQQdxIQMgCCsDACEAIBpCAFMEQCABIACaOQMAIAEgCCsDCJo5AwhBACADayEDDAELIAEgADkDACABIAgrAwg5AwgLIAhBMGokACADC8UBAQJ/IwBBEGsiASQAAkAgAL1CIIinQf////8HcSICQfvDpP8DTQRAIAJBgIDA8gNJDQEgAEQAAAAAAAAAAEEAEAMhAAwBCyACQYCAwP8HTwRAIAAgAKEhAAwBCwJAAkACQAJAIAAgARALQQNxDgMAAQIDCyABKwMAIAErAwhBARADIQAMAwsgASsDACABKwMIEAQhAAwCCyABKwMAIAErAwhBARADmiEADAELIAErAwAgASsDCBAEmiEACyABQRBqJAAgAAuhBAEDfyABIAJGBEAgACgCAEEDdBAHIgQgAUEBQQEgAEEIaiAAEAggBCECAkAgACgCAEEDdCIDQYAETwRAIAEgAiADEAEMAQsgASADaiEAAkAgASACc0EDcUUEQAJAIAFBA3FFDQAgA0UNAANAIAEgAi0AADoAACACQQFqIQIgAUEBaiIBQQNxRQ0BIAAgAUsNAAsLAkAgAEF8cSIDQcAASQ0AIAEgA0FAaiIFSw0AA0AgASACKAIANgIAIAEgAigCBDYCBCABIAIoAgg2AgggASACKAIMNgIMIAEgAigCEDYCECABIAIoAhQ2AhQgASACKAIYNgIYIAEgAigCHDYCHCABIAIoAiA2AiAgASACKAIkNgIkIAEgAigCKDYCKCABIAIoAiw2AiwgASACKAIwNgIwIAEgAigCNDYCNCABIAIoAjg2AjggASACKAI8NgI8IAJBQGshAiABQUBrIgEgBU0NAAsLIAEgA08NAQNAIAEgAigCADYCACACQQRqIQIgAUEEaiIBIANJDQALDAELIABBBEkNACAB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";
          if (!isDataURI(wasmBinaryFile)) {
            wasmBinaryFile = locateFile(wasmBinaryFile);
          }
          function getBinarySync(file) {
            if (file == wasmBinaryFile && wasmBinary) {
              return new Uint8Array(wasmBinary);
            }
            var binary = tryParseAsDataURI(file);
            if (binary) {
              return binary;
            }
            if (readBinary) {
              return readBinary(file);
            }
            throw "sync fetching of the wasm failed: you can preload it to Module['wasmBinary'] manually, or emcc.py will do that for you when generating HTML (but not JS)";
          }
          function instantiateSync(file, info) {
            var module;
            var binary = getBinarySync(file);
            module = new WebAssembly.Module(binary);
            var instance = new WebAssembly.Instance(module, info);
            return [instance, module];
          }
          function createWasm() {
            var info = { "a": wasmImports };
            function receiveInstance(instance, module) {
              var exports = instance.exports;
              wasmExports = exports;
              wasmMemory = wasmExports["c"];
              updateMemoryViews();
              wasmTable = wasmExports["j"];
              addOnInit(wasmExports["d"]);
              removeRunDependency("wasm-instantiate");
              return exports;
            }
            addRunDependency("wasm-instantiate");
            if (Module["instantiateWasm"]) {
              try {
                return Module["instantiateWasm"](info, receiveInstance);
              } catch (e) {
                err("Module.instantiateWasm callback failed with error: " + e);
                readyPromiseReject(e);
              }
            }
            var result = instantiateSync(wasmBinaryFile, info);
            return receiveInstance(result[0]);
          }
          var callRuntimeCallbacks = (callbacks) => {
            while (callbacks.length > 0) {
              callbacks.shift()(Module);
            }
          };
          var _emscripten_memcpy_big = (dest, src, num) => HEAPU8.copyWithin(dest, src, src + num);
          var abortOnCannotGrowMemory = (requestedSize) => {
            abort("OOM");
          };
          var _emscripten_resize_heap = (requestedSize) => {
            var oldSize = HEAPU8.length;
            requestedSize >>>= 0;
            abortOnCannotGrowMemory(requestedSize);
          };
          function getCFunc(ident) {
            var func = Module["_" + ident];
            return func;
          }
          var writeArrayToMemory = (array, buffer) => {
            HEAP8.set(array, buffer);
          };
          var lengthBytesUTF8 = (str) => {
            var len = 0;
            for (var i = 0; i < str.length; ++i) {
              var c = str.charCodeAt(i);
              if (c <= 127) {
                len++;
              } else if (c <= 2047) {
                len += 2;
              } else if (c >= 55296 && c <= 57343) {
                len += 4;
                ++i;
              } else {
                len += 3;
              }
            }
            return len;
          };
          var stringToUTF8Array = (str, heap, outIdx, maxBytesToWrite) => {
            if (!(maxBytesToWrite > 0)) return 0;
            var startIdx = outIdx;
            var endIdx = outIdx + maxBytesToWrite - 1;
            for (var i = 0; i < str.length; ++i) {
              var u = str.charCodeAt(i);
              if (u >= 55296 && u <= 57343) {
                var u1 = str.charCodeAt(++i);
                u = 65536 + ((u & 1023) << 10) | u1 & 1023;
              }
              if (u <= 127) {
                if (outIdx >= endIdx) break;
                heap[outIdx++] = u;
              } else if (u <= 2047) {
                if (outIdx + 1 >= endIdx) break;
                heap[outIdx++] = 192 | u >> 6;
                heap[outIdx++] = 128 | u & 63;
              } else if (u <= 65535) {
                if (outIdx + 2 >= endIdx) break;
                heap[outIdx++] = 224 | u >> 12;
                heap[outIdx++] = 128 | u >> 6 & 63;
                heap[outIdx++] = 128 | u & 63;
              } else {
                if (outIdx + 3 >= endIdx) break;
                heap[outIdx++] = 240 | u >> 18;
                heap[outIdx++] = 128 | u >> 12 & 63;
                heap[outIdx++] = 128 | u >> 6 & 63;
                heap[outIdx++] = 128 | u & 63;
              }
            }
            heap[outIdx] = 0;
            return outIdx - startIdx;
          };
          var stringToUTF8 = (str, outPtr, maxBytesToWrite) => stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
          var stringToUTF8OnStack = (str) => {
            var size = lengthBytesUTF8(str) + 1;
            var ret = stackAlloc(size);
            stringToUTF8(str, ret, size);
            return ret;
          };
          var UTF8Decoder = typeof TextDecoder != "undefined" ? new TextDecoder("utf8") : void 0;
          var UTF8ArrayToString = (heapOrArray, idx, maxBytesToRead) => {
            var endIdx = idx + maxBytesToRead;
            var endPtr = idx;
            while (heapOrArray[endPtr] && !(endPtr >= endIdx)) ++endPtr;
            if (endPtr - idx > 16 && heapOrArray.buffer && UTF8Decoder) {
              return UTF8Decoder.decode(heapOrArray.subarray(idx, endPtr));
            }
            var str = "";
            while (idx < endPtr) {
              var u0 = heapOrArray[idx++];
              if (!(u0 & 128)) {
                str += String.fromCharCode(u0);
                continue;
              }
              var u1 = heapOrArray[idx++] & 63;
              if ((u0 & 224) == 192) {
                str += String.fromCharCode((u0 & 31) << 6 | u1);
                continue;
              }
              var u2 = heapOrArray[idx++] & 63;
              if ((u0 & 240) == 224) {
                u0 = (u0 & 15) << 12 | u1 << 6 | u2;
              } else {
                u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | heapOrArray[idx++] & 63;
              }
              if (u0 < 65536) {
                str += String.fromCharCode(u0);
              } else {
                var ch = u0 - 65536;
                str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023);
              }
            }
            return str;
          };
          var UTF8ToString = (ptr, maxBytesToRead) => ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : "";
          var ccall = function(ident, returnType, argTypes, args, opts) {
            var toC = { "string": (str) => {
              var ret2 = 0;
              if (str !== null && str !== void 0 && str !== 0) {
                ret2 = stringToUTF8OnStack(str);
              }
              return ret2;
            }, "array": (arr) => {
              var ret2 = stackAlloc(arr.length);
              writeArrayToMemory(arr, ret2);
              return ret2;
            } };
            function convertReturnValue(ret2) {
              if (returnType === "string") {
                return UTF8ToString(ret2);
              }
              if (returnType === "boolean") return Boolean(ret2);
              return ret2;
            }
            var func = getCFunc(ident);
            var cArgs = [];
            var stack = 0;
            if (args) {
              for (var i = 0; i < args.length; i++) {
                var converter = toC[argTypes[i]];
                if (converter) {
                  if (stack === 0) stack = stackSave();
                  cArgs[i] = converter(args[i]);
                } else {
                  cArgs[i] = args[i];
                }
              }
            }
            var ret = func.apply(null, cArgs);
            function onDone(ret2) {
              if (stack !== 0) stackRestore(stack);
              return convertReturnValue(ret2);
            }
            ret = onDone(ret);
            return ret;
          };
          var cwrap = function(ident, returnType, argTypes, opts) {
            var numericArgs = !argTypes || argTypes.every((type) => type === "number" || type === "boolean");
            var numericRet = returnType !== "string";
            if (numericRet && numericArgs && !opts) {
              return getCFunc(ident);
            }
            return function() {
              return ccall(ident, returnType, argTypes, arguments, opts);
            };
          };
          var wasmImports = { b: _emscripten_memcpy_big, a: _emscripten_resize_heap };
          var asm = createWasm();
          var ___wasm_call_ctors = asm["d"];
          var _kiss_fft_free = Module["_kiss_fft_free"] = asm["e"];
          var _free = Module["_free"] = asm["f"];
          var _kiss_fft_alloc = Module["_kiss_fft_alloc"] = asm["g"];
          var _malloc = Module["_malloc"] = asm["h"];
          var _kiss_fft = Module["_kiss_fft"] = asm["i"];
          var ___errno_location = asm["__errno_location"];
          var stackSave = asm["k"];
          var stackRestore = asm["l"];
          var stackAlloc = asm["m"];
          function intArrayFromBase64(s) {
            try {
              var decoded = atob(s);
              var bytes = new Uint8Array(decoded.length);
              for (var i = 0; i < decoded.length; ++i) {
                bytes[i] = decoded.charCodeAt(i);
              }
              return bytes;
            } catch (_) {
              throw new Error("Converting base64 string to bytes failed.");
            }
          }
          function tryParseAsDataURI(filename) {
            if (!isDataURI(filename)) {
              return;
            }
            return intArrayFromBase64(filename.slice(dataURIPrefix.length));
          }
          Module["ccall"] = ccall;
          Module["cwrap"] = cwrap;
          var calledRun;
          dependenciesFulfilled = function runCaller() {
            if (!calledRun) run();
            if (!calledRun) dependenciesFulfilled = runCaller;
          };
          function run() {
            if (runDependencies > 0) {
              return;
            }
            preRun();
            if (runDependencies > 0) {
              return;
            }
            function doRun() {
              if (calledRun) return;
              calledRun = true;
              Module["calledRun"] = true;
              if (ABORT) return;
              initRuntime();
              readyPromiseResolve(Module);
              if (Module["onRuntimeInitialized"]) Module["onRuntimeInitialized"]();
              postRun();
            }
            if (Module["setStatus"]) {
              Module["setStatus"]("Running...");
              setTimeout(function() {
                setTimeout(function() {
                  Module["setStatus"]("");
                }, 1);
                doRun();
              }, 1);
            } else {
              doRun();
            }
          }
          if (Module["preInit"]) {
            if (typeof Module["preInit"] == "function") Module["preInit"] = [Module["preInit"]];
            while (Module["preInit"].length > 0) {
              Module["preInit"].pop()();
            }
          }
          run();
          return moduleArg;
        };
      })();
      KissFFT_default = KissFFTModule;
    }
  });

  // node_modules/webfft/lib/kissfft/webfftWrapper.js
  var kissFFTModule, kiss_fft_alloc, kiss_fft, kiss_fft_free, KissFftWrapperWasm, webfftWrapper_default;
  var init_webfftWrapper = __esm({
    "node_modules/webfft/lib/kissfft/webfftWrapper.js"() {
      "use strict";
      init_KissFFT();
      kissFFTModule = KissFFT_default({});
      kiss_fft_alloc = kissFFTModule.cwrap("kiss_fft_alloc", "number", [
        "number",
        "number",
        "number",
        "number"
      ]);
      kiss_fft = kissFFTModule.cwrap("kiss_fft", "void", [
        "number",
        "number",
        "number"
      ]);
      kiss_fft_free = kissFFTModule.cwrap("kiss_fft_free", "void", ["number"]);
      KissFftWrapperWasm = class {
        constructor(size) {
          this.size = size;
          this.fcfg = kiss_fft_alloc(this.size, false);
          this.icfg = kiss_fft_alloc(this.size, true);
          this.inptr = kissFFTModule._malloc(this.size * 8);
          this.cin = new Float32Array(
            kissFFTModule.HEAPU8.buffer,
            this.inptr,
            this.size * 2
          );
        }
        fft = function(inputArray) {
          const outptr = kissFFTModule._malloc(this.size * 8);
          const cout = new Float32Array(
            kissFFTModule.HEAPU8.buffer,
            outptr,
            this.size * 2
          );
          this.cin.set(inputArray);
          kiss_fft(this.fcfg, this.inptr, outptr);
          let outputArray = new Float32Array(this.size * 2);
          outputArray.set(cout);
          kissFFTModule._free(outptr);
          return outputArray;
        };
        dispose() {
          kiss_fft_free(this.fcfg);
          kiss_fft_free(this.icfg);
          kissFFTModule._free(this.inptr);
        }
      };
      webfftWrapper_default = KissFftWrapperWasm;
    }
  });

  // node_modules/webfft/lib/indutny/fft.js
  function FFT_indutny(size) {
    this.size = size | 0;
    if (this.size <= 1 || (this.size & this.size - 1) !== 0)
      throw new Error("FFT size must be a power of two and bigger than 1");
    this._csize = size << 1;
    var table = new Array(this.size * 2);
    for (var i = 0; i < table.length; i += 2) {
      const angle = Math.PI * i / this.size;
      table[i] = Math.cos(angle);
      table[i + 1] = -Math.sin(angle);
    }
    this.table = table;
    var power = 0;
    for (var t = 1; this.size > t; t <<= 1) power++;
    this._width = power % 2 === 0 ? power - 1 : power;
    this._bitrev = new Array(1 << this._width);
    for (var j = 0; j < this._bitrev.length; j++) {
      this._bitrev[j] = 0;
      for (var shift = 0; shift < this._width; shift += 2) {
        var revShift = this._width - shift - 2;
        this._bitrev[j] |= (j >>> shift & 3) << revShift;
      }
    }
    this._out = null;
    this._data = null;
    this._inv = 0;
  }
  var fft_default;
  var init_fft = __esm({
    "node_modules/webfft/lib/indutny/fft.js"() {
      "use strict";
      FFT_indutny.prototype.fromComplexArray = function fromComplexArray(complex, storage) {
        var res = storage || new Array(complex.length >>> 1);
        for (var i = 0; i < complex.length; i += 2) res[i >>> 1] = complex[i];
        return res;
      };
      FFT_indutny.prototype.createComplexArray = function createComplexArray() {
        const res = new Array(this._csize);
        for (var i = 0; i < res.length; i++) res[i] = 0;
        return res;
      };
      FFT_indutny.prototype.toComplexArray = function toComplexArray(input, storage) {
        var res = storage || this.createComplexArray();
        for (var i = 0; i < res.length; i += 2) {
          res[i] = input[i >>> 1];
          res[i + 1] = 0;
        }
        return res;
      };
      FFT_indutny.prototype.completeSpectrum = function completeSpectrum(spectrum) {
        var size = this._csize;
        var half = size >>> 1;
        for (var i = 2; i < half; i += 2) {
          spectrum[size - i] = spectrum[i];
          spectrum[size - i + 1] = -spectrum[i + 1];
        }
      };
      FFT_indutny.prototype.transform = function transform(out, data) {
        if (out === data) throw new Error("Input and output buffers must be different");
        this._out = out;
        this._data = data;
        this._inv = 0;
        this._transform4();
        this._out = null;
        this._data = null;
      };
      FFT_indutny.prototype.realTransform = function realTransform(out, data) {
        if (out === data) throw new Error("Input and output buffers must be different");
        this._out = out;
        this._data = data;
        this._inv = 0;
        this._realTransform4();
        this._out = null;
        this._data = null;
      };
      FFT_indutny.prototype.inverseTransform = function inverseTransform(out, data) {
        if (out === data) throw new Error("Input and output buffers must be different");
        this._out = out;
        this._data = data;
        this._inv = 1;
        this._transform4();
        for (var i = 0; i < out.length; i++) out[i] /= this.size;
        this._out = null;
        this._data = null;
      };
      FFT_indutny.prototype._transform4 = function _transform4() {
        var out = this._out;
        var size = this._csize;
        var width = this._width;
        var step = 1 << width;
        var len = size / step << 1;
        var outOff;
        var t;
        var bitrev = this._bitrev;
        if (len === 4) {
          for (outOff = 0, t = 0; outOff < size; outOff += len, t++) {
            const off = bitrev[t];
            this._singleTransform2(outOff, off, step);
          }
        } else {
          for (outOff = 0, t = 0; outOff < size; outOff += len, t++) {
            const off = bitrev[t];
            this._singleTransform4(outOff, off, step);
          }
        }
        var inv = this._inv ? -1 : 1;
        var table = this.table;
        for (step >>= 2; step >= 2; step >>= 2) {
          len = size / step << 1;
          var quarterLen = len >>> 2;
          for (outOff = 0; outOff < size; outOff += len) {
            var limit = outOff + quarterLen;
            for (var i = outOff, k = 0; i < limit; i += 2, k += step) {
              const A = i;
              const B = A + quarterLen;
              const C = B + quarterLen;
              const D = C + quarterLen;
              const Ar = out[A];
              const Ai = out[A + 1];
              const Br = out[B];
              const Bi = out[B + 1];
              const Cr = out[C];
              const Ci = out[C + 1];
              const Dr = out[D];
              const Di = out[D + 1];
              const MAr = Ar;
              const MAi = Ai;
              const tableBr = table[k];
              const tableBi = inv * table[k + 1];
              const MBr = Br * tableBr - Bi * tableBi;
              const MBi = Br * tableBi + Bi * tableBr;
              const tableCr = table[2 * k];
              const tableCi = inv * table[2 * k + 1];
              const MCr = Cr * tableCr - Ci * tableCi;
              const MCi = Cr * tableCi + Ci * tableCr;
              const tableDr = table[3 * k];
              const tableDi = inv * table[3 * k + 1];
              const MDr = Dr * tableDr - Di * tableDi;
              const MDi = Dr * tableDi + Di * tableDr;
              const T0r = MAr + MCr;
              const T0i = MAi + MCi;
              const T1r = MAr - MCr;
              const T1i = MAi - MCi;
              const T2r = MBr + MDr;
              const T2i = MBi + MDi;
              const T3r = inv * (MBr - MDr);
              const T3i = inv * (MBi - MDi);
              const FAr = T0r + T2r;
              const FAi = T0i + T2i;
              const FCr = T0r - T2r;
              const FCi = T0i - T2i;
              const FBr = T1r + T3i;
              const FBi = T1i - T3r;
              const FDr = T1r - T3i;
              const FDi = T1i + T3r;
              out[A] = FAr;
              out[A + 1] = FAi;
              out[B] = FBr;
              out[B + 1] = FBi;
              out[C] = FCr;
              out[C + 1] = FCi;
              out[D] = FDr;
              out[D + 1] = FDi;
            }
          }
        }
      };
      FFT_indutny.prototype._singleTransform2 = function _singleTransform2(outOff, off, step) {
        const out = this._out;
        const data = this._data;
        const evenR = data[off];
        const evenI = data[off + 1];
        const oddR = data[off + step];
        const oddI = data[off + step + 1];
        const leftR = evenR + oddR;
        const leftI = evenI + oddI;
        const rightR = evenR - oddR;
        const rightI = evenI - oddI;
        out[outOff] = leftR;
        out[outOff + 1] = leftI;
        out[outOff + 2] = rightR;
        out[outOff + 3] = rightI;
      };
      FFT_indutny.prototype._singleTransform4 = function _singleTransform4(outOff, off, step) {
        const out = this._out;
        const data = this._data;
        const inv = this._inv ? -1 : 1;
        const step2 = step * 2;
        const step3 = step * 3;
        const Ar = data[off];
        const Ai = data[off + 1];
        const Br = data[off + step];
        const Bi = data[off + step + 1];
        const Cr = data[off + step2];
        const Ci = data[off + step2 + 1];
        const Dr = data[off + step3];
        const Di = data[off + step3 + 1];
        const T0r = Ar + Cr;
        const T0i = Ai + Ci;
        const T1r = Ar - Cr;
        const T1i = Ai - Ci;
        const T2r = Br + Dr;
        const T2i = Bi + Di;
        const T3r = inv * (Br - Dr);
        const T3i = inv * (Bi - Di);
        const FAr = T0r + T2r;
        const FAi = T0i + T2i;
        const FBr = T1r + T3i;
        const FBi = T1i - T3r;
        const FCr = T0r - T2r;
        const FCi = T0i - T2i;
        const FDr = T1r - T3i;
        const FDi = T1i + T3r;
        out[outOff] = FAr;
        out[outOff + 1] = FAi;
        out[outOff + 2] = FBr;
        out[outOff + 3] = FBi;
        out[outOff + 4] = FCr;
        out[outOff + 5] = FCi;
        out[outOff + 6] = FDr;
        out[outOff + 7] = FDi;
      };
      FFT_indutny.prototype._realTransform4 = function _realTransform4() {
        var out = this._out;
        var size = this._csize;
        var width = this._width;
        var step = 1 << width;
        var len = size / step << 1;
        var outOff;
        var t;
        var bitrev = this._bitrev;
        if (len === 4) {
          for (outOff = 0, t = 0; outOff < size; outOff += len, t++) {
            const off = bitrev[t];
            this._singleRealTransform2(outOff, off >>> 1, step >>> 1);
          }
        } else {
          for (outOff = 0, t = 0; outOff < size; outOff += len, t++) {
            const off = bitrev[t];
            this._singleRealTransform4(outOff, off >>> 1, step >>> 1);
          }
        }
        var inv = this._inv ? -1 : 1;
        var table = this.table;
        for (step >>= 2; step >= 2; step >>= 2) {
          len = size / step << 1;
          var halfLen = len >>> 1;
          var quarterLen = halfLen >>> 1;
          var hquarterLen = quarterLen >>> 1;
          for (outOff = 0; outOff < size; outOff += len) {
            for (var i = 0, k = 0; i <= hquarterLen; i += 2, k += step) {
              var A = outOff + i;
              var B = A + quarterLen;
              var C = B + quarterLen;
              var D = C + quarterLen;
              var Ar = out[A];
              var Ai = out[A + 1];
              var Br = out[B];
              var Bi = out[B + 1];
              var Cr = out[C];
              var Ci = out[C + 1];
              var Dr = out[D];
              var Di = out[D + 1];
              var MAr = Ar;
              var MAi = Ai;
              var tableBr = table[k];
              var tableBi = inv * table[k + 1];
              var MBr = Br * tableBr - Bi * tableBi;
              var MBi = Br * tableBi + Bi * tableBr;
              var tableCr = table[2 * k];
              var tableCi = inv * table[2 * k + 1];
              var MCr = Cr * tableCr - Ci * tableCi;
              var MCi = Cr * tableCi + Ci * tableCr;
              var tableDr = table[3 * k];
              var tableDi = inv * table[3 * k + 1];
              var MDr = Dr * tableDr - Di * tableDi;
              var MDi = Dr * tableDi + Di * tableDr;
              var T0r = MAr + MCr;
              var T0i = MAi + MCi;
              var T1r = MAr - MCr;
              var T1i = MAi - MCi;
              var T2r = MBr + MDr;
              var T2i = MBi + MDi;
              var T3r = inv * (MBr - MDr);
              var T3i = inv * (MBi - MDi);
              var FAr = T0r + T2r;
              var FAi = T0i + T2i;
              var FBr = T1r + T3i;
              var FBi = T1i - T3r;
              out[A] = FAr;
              out[A + 1] = FAi;
              out[B] = FBr;
              out[B + 1] = FBi;
              if (i === 0) {
                var FCr = T0r - T2r;
                var FCi = T0i - T2i;
                out[C] = FCr;
                out[C + 1] = FCi;
                continue;
              }
              if (i === hquarterLen) continue;
              var ST0r = T1r;
              var ST0i = -T1i;
              var ST1r = T0r;
              var ST1i = -T0i;
              var ST2r = -inv * T3i;
              var ST2i = -inv * T3r;
              var ST3r = -inv * T2i;
              var ST3i = -inv * T2r;
              var SFAr = ST0r + ST2r;
              var SFAi = ST0i + ST2i;
              var SFBr = ST1r + ST3i;
              var SFBi = ST1i - ST3r;
              var SA = outOff + quarterLen - i;
              var SB = outOff + halfLen - i;
              out[SA] = SFAr;
              out[SA + 1] = SFAi;
              out[SB] = SFBr;
              out[SB + 1] = SFBi;
            }
          }
        }
      };
      FFT_indutny.prototype._singleRealTransform2 = function _singleRealTransform2(outOff, off, step) {
        const out = this._out;
        const data = this._data;
        const evenR = data[off];
        const oddR = data[off + step];
        const leftR = evenR + oddR;
        const rightR = evenR - oddR;
        out[outOff] = leftR;
        out[outOff + 1] = 0;
        out[outOff + 2] = rightR;
        out[outOff + 3] = 0;
      };
      FFT_indutny.prototype._singleRealTransform4 = function _singleRealTransform4(outOff, off, step) {
        const out = this._out;
        const data = this._data;
        const inv = this._inv ? -1 : 1;
        const step2 = step * 2;
        const step3 = step * 3;
        const Ar = data[off];
        const Br = data[off + step];
        const Cr = data[off + step2];
        const Dr = data[off + step3];
        const T0r = Ar + Cr;
        const T1r = Ar - Cr;
        const T2r = Br + Dr;
        const T3r = inv * (Br - Dr);
        const FAr = T0r + T2r;
        const FBr = T1r;
        const FBi = -T3r;
        const FCr = T0r - T2r;
        const FDr = T1r;
        const FDi = T3r;
        out[outOff] = FAr;
        out[outOff + 1] = 0;
        out[outOff + 2] = FBr;
        out[outOff + 3] = FBi;
        out[outOff + 4] = FCr;
        out[outOff + 5] = 0;
        out[outOff + 6] = FDr;
        out[outOff + 7] = FDi;
      };
      fft_default = FFT_indutny;
    }
  });

  // node_modules/webfft/lib/indutny/webfftWrapper.js
  var IndutnyFftWrapperJavascript, webfftWrapper_default2;
  var init_webfftWrapper2 = __esm({
    "node_modules/webfft/lib/indutny/webfftWrapper.js"() {
      "use strict";
      init_fft();
      IndutnyFftWrapperJavascript = class {
        constructor(size) {
          this.size = size;
          this.indutnyFft = new fft_default(size);
        }
        fft(inputArr) {
          const outputArr = new Float32Array(2 * this.size);
          this.indutnyFft.transform(outputArr, inputArr);
          return outputArr;
        }
      };
      webfftWrapper_default2 = IndutnyFftWrapperJavascript;
    }
  });

  // node_modules/webfft/lib/cross/Cross.mjs
  var import_meta2, CrossModule, Cross_default;
  var init_Cross = __esm({
    "node_modules/webfft/lib/cross/Cross.mjs"() {
      "use strict";
      import_meta2 = {};
      CrossModule = (() => {
        var _scriptDir = import_meta2.url;
        return function(moduleArg = {}) {
          var Module = moduleArg;
          var readyPromiseResolve, readyPromiseReject;
          Module["ready"] = new Promise((resolve, reject) => {
            readyPromiseResolve = resolve;
            readyPromiseReject = reject;
          });
          var moduleOverrides = Object.assign({}, Module);
          var arguments_ = [];
          var thisProgram = "./this.program";
          var quit_ = (status, toThrow) => {
            throw toThrow;
          };
          var ENVIRONMENT_IS_WEB = true;
          var ENVIRONMENT_IS_WORKER = false;
          var scriptDirectory = "";
          function locateFile(path) {
            if (Module["locateFile"]) {
              return Module["locateFile"](path, scriptDirectory);
            }
            return scriptDirectory + path;
          }
          var read_, readAsync, readBinary, setWindowTitle;
          if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
            if (ENVIRONMENT_IS_WORKER) {
              scriptDirectory = self.location.href;
            } else if (typeof document != "undefined" && document.currentScript) {
              scriptDirectory = document.currentScript.src;
            }
            if (_scriptDir) {
              scriptDirectory = _scriptDir;
            }
            if (scriptDirectory.indexOf("blob:") !== 0) {
              scriptDirectory = scriptDirectory.substr(0, scriptDirectory.replace(/[?#].*/, "").lastIndexOf("/") + 1);
            } else {
              scriptDirectory = "";
            }
            {
              read_ = (url) => {
                var xhr = new XMLHttpRequest();
                xhr.open("GET", url, false);
                xhr.send(null);
                return xhr.responseText;
              };
              if (ENVIRONMENT_IS_WORKER) {
                readBinary = (url) => {
                  var xhr = new XMLHttpRequest();
                  xhr.open("GET", url, false);
                  xhr.responseType = "arraybuffer";
                  xhr.send(null);
                  return new Uint8Array(xhr.response);
                };
              }
              readAsync = (url, onload, onerror) => {
                var xhr = new XMLHttpRequest();
                xhr.open("GET", url, true);
                xhr.responseType = "arraybuffer";
                xhr.onload = () => {
                  if (xhr.status == 200 || xhr.status == 0 && xhr.response) {
                    onload(xhr.response);
                    return;
                  }
                  onerror();
                };
                xhr.onerror = onerror;
                xhr.send(null);
              };
            }
            setWindowTitle = (title) => document.title = title;
          } else {
          }
          var out = Module["print"] || console.log.bind(console);
          var err = Module["printErr"] || console.error.bind(console);
          Object.assign(Module, moduleOverrides);
          moduleOverrides = null;
          if (Module["arguments"]) arguments_ = Module["arguments"];
          if (Module["thisProgram"]) thisProgram = Module["thisProgram"];
          if (Module["quit"]) quit_ = Module["quit"];
          var wasmBinary;
          if (Module["wasmBinary"]) wasmBinary = Module["wasmBinary"];
          var noExitRuntime = Module["noExitRuntime"] || true;
          if (typeof WebAssembly != "object") {
            abort("no native wasm support detected");
          }
          var wasmMemory;
          var wasmExports;
          var ABORT = false;
          var EXITSTATUS;
          var HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;
          function updateMemoryViews() {
            var b = wasmMemory.buffer;
            Module["HEAP8"] = HEAP8 = new Int8Array(b);
            Module["HEAP16"] = HEAP16 = new Int16Array(b);
            Module["HEAP32"] = HEAP32 = new Int32Array(b);
            Module["HEAPU8"] = HEAPU8 = new Uint8Array(b);
            Module["HEAPU16"] = HEAPU16 = new Uint16Array(b);
            Module["HEAPU32"] = HEAPU32 = new Uint32Array(b);
            Module["HEAPF32"] = HEAPF32 = new Float32Array(b);
            Module["HEAPF64"] = HEAPF64 = new Float64Array(b);
          }
          var wasmTable;
          var __ATPRERUN__ = [];
          var __ATINIT__ = [];
          var __ATPOSTRUN__ = [];
          var runtimeInitialized = false;
          function preRun() {
            if (Module["preRun"]) {
              if (typeof Module["preRun"] == "function") Module["preRun"] = [Module["preRun"]];
              while (Module["preRun"].length) {
                addOnPreRun(Module["preRun"].shift());
              }
            }
            callRuntimeCallbacks(__ATPRERUN__);
          }
          function initRuntime() {
            runtimeInitialized = true;
            callRuntimeCallbacks(__ATINIT__);
          }
          function postRun() {
            if (Module["postRun"]) {
              if (typeof Module["postRun"] == "function") Module["postRun"] = [Module["postRun"]];
              while (Module["postRun"].length) {
                addOnPostRun(Module["postRun"].shift());
              }
            }
            callRuntimeCallbacks(__ATPOSTRUN__);
          }
          function addOnPreRun(cb) {
            __ATPRERUN__.unshift(cb);
          }
          function addOnInit(cb) {
            __ATINIT__.unshift(cb);
          }
          function addOnPostRun(cb) {
            __ATPOSTRUN__.unshift(cb);
          }
          var runDependencies = 0;
          var runDependencyWatcher = null;
          var dependenciesFulfilled = null;
          function addRunDependency(id) {
            runDependencies++;
            if (Module["monitorRunDependencies"]) {
              Module["monitorRunDependencies"](runDependencies);
            }
          }
          function removeRunDependency(id) {
            runDependencies--;
            if (Module["monitorRunDependencies"]) {
              Module["monitorRunDependencies"](runDependencies);
            }
            if (runDependencies == 0) {
              if (runDependencyWatcher !== null) {
                clearInterval(runDependencyWatcher);
                runDependencyWatcher = null;
              }
              if (dependenciesFulfilled) {
                var callback = dependenciesFulfilled;
                dependenciesFulfilled = null;
                callback();
              }
            }
          }
          function abort(what) {
            if (Module["onAbort"]) {
              Module["onAbort"](what);
            }
            what = "Aborted(" + what + ")";
            err(what);
            ABORT = true;
            EXITSTATUS = 1;
            what += ". Build with -sASSERTIONS for more info.";
            var e = new WebAssembly.RuntimeError(what);
            readyPromiseReject(e);
            throw e;
          }
          var dataURIPrefix = "data:application/octet-stream;base64,";
          function isDataURI(filename) {
            return filename.startsWith(dataURIPrefix);
          }
          var wasmBinaryFile;
          wasmBinaryFile = "data:application/octet-stream;base64,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ACACSwRAQbgeIAI2AgALIAIgBmohAUHoISEAAkACQAJAA0AgASAAKAIARwRAIAAoAggiAA0BDAILCyAALQAMQQhxRQ0BC0HoISEAA0AgAyAAKAIAIgFPBEAgASAAKAIEaiIEIANLDQMLIAAoAgghAAwACwALIAAgAjYCACAAIAAoAgQgBmo2AgQgAkF4IAJrQQdxaiIHIAVBA3I2AgQgAUF4IAFrQQdxaiIGIAUgB2oiBWshACADIAZGBEBBwB4gBTYCAEG0HkG0HigCACAAaiIANgIAIAUgAEEBcjYCBAwIC0G8HigCACAGRgRAQbweIAU2AgBBsB5BsB4oAgAgAGoiADYCACAFIABBAXI2AgQgACAFaiAANgIADAgLIAYoAgQiA0EDcUEBRw0GIANBeHEhCSADQf8BTQRAIAYoAgwiASAGKAIIIgJGBEBBqB5BqB4oAgBBfiADQQN2d3E2AgAMBwsgAiABNgIMIAEgAjYCCAwGCyAGKAIYIQggBiAGKAIMIgJHBEAgBigCCCIBIAI2AgwgAiABNgIIDAULIAZBFGoiASgCACIDRQRAIAYoAhAiA0UNBCAGQRBqIQELA0AgASEEIAMiAkEUaiIBKAIAIgMNACACQRBqIQEgAigCECIDDQALIARBADYCAAwEC0G0HiAGQShrIgBBeCACa0EHcSIBayIINgIAQcAeIAEgAmoiATYCACABIAhBAXI2AgQgACACakEoNgIEQcQeQZAiKAIANgIAIAMgBEEnIARrQQdxakEvayIAIAAgA0EQakkbIgFBGzYCBCABQfAhKQIANwIQIAFB6CEpAgA3AghB8CEgAUEIajYCAEHsISAGNgIAQeghIAI2AgBB9CFBADYCACABQRhqIQADQCAAQQc2AgQgAEEIaiECIABBBGohACACIARJDQALIAEgA0YNACABIAEoAgRBfnE2AgQgAyABIANrIgJBAXI2AgQgASACNgIAIAJB/wFNBEAgAkF4cUHQHmohAAJ/QageKAIAIgFBASACQQN2dCICcUUEQEGoHiABIAJyNgIAIAAMAQsgACgCCAshASAAIAM2AgggASADNgIMIAMgADYCDCADIAE2AggMAQtBHyEAIAJB////B00EQCACQSYgAkEIdmciAGt2QQFxIABBAXRrQT5qIQALIAMgADYCHCADQgA3AhAgAEECdEHY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";
          if (!isDataURI(wasmBinaryFile)) {
            wasmBinaryFile = locateFile(wasmBinaryFile);
          }
          function getBinarySync(file) {
            if (file == wasmBinaryFile && wasmBinary) {
              return new Uint8Array(wasmBinary);
            }
            var binary = tryParseAsDataURI(file);
            if (binary) {
              return binary;
            }
            if (readBinary) {
              return readBinary(file);
            }
            throw "sync fetching of the wasm failed: you can preload it to Module['wasmBinary'] manually, or emcc.py will do that for you when generating HTML (but not JS)";
          }
          function instantiateSync(file, info) {
            var module;
            var binary = getBinarySync(file);
            module = new WebAssembly.Module(binary);
            var instance = new WebAssembly.Instance(module, info);
            return [instance, module];
          }
          function createWasm() {
            var info = { "a": wasmImports };
            function receiveInstance(instance, module) {
              var exports = instance.exports;
              wasmExports = exports;
              wasmMemory = wasmExports["b"];
              updateMemoryViews();
              wasmTable = wasmExports["e"];
              addOnInit(wasmExports["c"]);
              removeRunDependency("wasm-instantiate");
              return exports;
            }
            addRunDependency("wasm-instantiate");
            if (Module["instantiateWasm"]) {
              try {
                return Module["instantiateWasm"](info, receiveInstance);
              } catch (e) {
                err("Module.instantiateWasm callback failed with error: " + e);
                readyPromiseReject(e);
              }
            }
            var result = instantiateSync(wasmBinaryFile, info);
            return receiveInstance(result[0]);
          }
          var callRuntimeCallbacks = (callbacks) => {
            while (callbacks.length > 0) {
              callbacks.shift()(Module);
            }
          };
          var abortOnCannotGrowMemory = (requestedSize) => {
            abort("OOM");
          };
          var _emscripten_resize_heap = (requestedSize) => {
            var oldSize = HEAPU8.length;
            requestedSize >>>= 0;
            abortOnCannotGrowMemory(requestedSize);
          };
          function getCFunc(ident) {
            var func = Module["_" + ident];
            return func;
          }
          var writeArrayToMemory = (array, buffer) => {
            HEAP8.set(array, buffer);
          };
          var lengthBytesUTF8 = (str) => {
            var len = 0;
            for (var i = 0; i < str.length; ++i) {
              var c = str.charCodeAt(i);
              if (c <= 127) {
                len++;
              } else if (c <= 2047) {
                len += 2;
              } else if (c >= 55296 && c <= 57343) {
                len += 4;
                ++i;
              } else {
                len += 3;
              }
            }
            return len;
          };
          var stringToUTF8Array = (str, heap, outIdx, maxBytesToWrite) => {
            if (!(maxBytesToWrite > 0)) return 0;
            var startIdx = outIdx;
            var endIdx = outIdx + maxBytesToWrite - 1;
            for (var i = 0; i < str.length; ++i) {
              var u = str.charCodeAt(i);
              if (u >= 55296 && u <= 57343) {
                var u1 = str.charCodeAt(++i);
                u = 65536 + ((u & 1023) << 10) | u1 & 1023;
              }
              if (u <= 127) {
                if (outIdx >= endIdx) break;
                heap[outIdx++] = u;
              } else if (u <= 2047) {
                if (outIdx + 1 >= endIdx) break;
                heap[outIdx++] = 192 | u >> 6;
                heap[outIdx++] = 128 | u & 63;
              } else if (u <= 65535) {
                if (outIdx + 2 >= endIdx) break;
                heap[outIdx++] = 224 | u >> 12;
                heap[outIdx++] = 128 | u >> 6 & 63;
                heap[outIdx++] = 128 | u & 63;
              } else {
                if (outIdx + 3 >= endIdx) break;
                heap[outIdx++] = 240 | u >> 18;
                heap[outIdx++] = 128 | u >> 12 & 63;
                heap[outIdx++] = 128 | u >> 6 & 63;
                heap[outIdx++] = 128 | u & 63;
              }
            }
            heap[outIdx] = 0;
            return outIdx - startIdx;
          };
          var stringToUTF8 = (str, outPtr, maxBytesToWrite) => stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
          var stringToUTF8OnStack = (str) => {
            var size = lengthBytesUTF8(str) + 1;
            var ret = stackAlloc(size);
            stringToUTF8(str, ret, size);
            return ret;
          };
          var UTF8Decoder = typeof TextDecoder != "undefined" ? new TextDecoder("utf8") : void 0;
          var UTF8ArrayToString = (heapOrArray, idx, maxBytesToRead) => {
            var endIdx = idx + maxBytesToRead;
            var endPtr = idx;
            while (heapOrArray[endPtr] && !(endPtr >= endIdx)) ++endPtr;
            if (endPtr - idx > 16 && heapOrArray.buffer && UTF8Decoder) {
              return UTF8Decoder.decode(heapOrArray.subarray(idx, endPtr));
            }
            var str = "";
            while (idx < endPtr) {
              var u0 = heapOrArray[idx++];
              if (!(u0 & 128)) {
                str += String.fromCharCode(u0);
                continue;
              }
              var u1 = heapOrArray[idx++] & 63;
              if ((u0 & 224) == 192) {
                str += String.fromCharCode((u0 & 31) << 6 | u1);
                continue;
              }
              var u2 = heapOrArray[idx++] & 63;
              if ((u0 & 240) == 224) {
                u0 = (u0 & 15) << 12 | u1 << 6 | u2;
              } else {
                u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | heapOrArray[idx++] & 63;
              }
              if (u0 < 65536) {
                str += String.fromCharCode(u0);
              } else {
                var ch = u0 - 65536;
                str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023);
              }
            }
            return str;
          };
          var UTF8ToString = (ptr, maxBytesToRead) => ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : "";
          var ccall = function(ident, returnType, argTypes, args, opts) {
            var toC = { "string": (str) => {
              var ret2 = 0;
              if (str !== null && str !== void 0 && str !== 0) {
                ret2 = stringToUTF8OnStack(str);
              }
              return ret2;
            }, "array": (arr) => {
              var ret2 = stackAlloc(arr.length);
              writeArrayToMemory(arr, ret2);
              return ret2;
            } };
            function convertReturnValue(ret2) {
              if (returnType === "string") {
                return UTF8ToString(ret2);
              }
              if (returnType === "boolean") return Boolean(ret2);
              return ret2;
            }
            var func = getCFunc(ident);
            var cArgs = [];
            var stack = 0;
            if (args) {
              for (var i = 0; i < args.length; i++) {
                var converter = toC[argTypes[i]];
                if (converter) {
                  if (stack === 0) stack = stackSave();
                  cArgs[i] = converter(args[i]);
                } else {
                  cArgs[i] = args[i];
                }
              }
            }
            var ret = func.apply(null, cArgs);
            function onDone(ret2) {
              if (stack !== 0) stackRestore(stack);
              return convertReturnValue(ret2);
            }
            ret = onDone(ret);
            return ret;
          };
          var cwrap = function(ident, returnType, argTypes, opts) {
            var numericArgs = !argTypes || argTypes.every((type) => type === "number" || type === "boolean");
            var numericRet = returnType !== "string";
            if (numericRet && numericArgs && !opts) {
              return getCFunc(ident);
            }
            return function() {
              return ccall(ident, returnType, argTypes, arguments, opts);
            };
          };
          var wasmImports = { a: _emscripten_resize_heap };
          var asm = createWasm();
          var ___wasm_call_ctors = asm["c"];
          var _fftCross = Module["_fftCross"] = asm["d"];
          var ___errno_location = asm["__errno_location"];
          var _malloc = Module["_malloc"] = asm["f"];
          var _free = Module["_free"] = asm["g"];
          var stackSave = asm["h"];
          var stackRestore = asm["i"];
          var stackAlloc = asm["j"];
          function intArrayFromBase64(s) {
            try {
              var decoded = atob(s);
              var bytes = new Uint8Array(decoded.length);
              for (var i = 0; i < decoded.length; ++i) {
                bytes[i] = decoded.charCodeAt(i);
              }
              return bytes;
            } catch (_) {
              throw new Error("Converting base64 string to bytes failed.");
            }
          }
          function tryParseAsDataURI(filename) {
            if (!isDataURI(filename)) {
              return;
            }
            return intArrayFromBase64(filename.slice(dataURIPrefix.length));
          }
          Module["ccall"] = ccall;
          Module["cwrap"] = cwrap;
          var calledRun;
          dependenciesFulfilled = function runCaller() {
            if (!calledRun) run();
            if (!calledRun) dependenciesFulfilled = runCaller;
          };
          function run() {
            if (runDependencies > 0) {
              return;
            }
            preRun();
            if (runDependencies > 0) {
              return;
            }
            function doRun() {
              if (calledRun) return;
              calledRun = true;
              Module["calledRun"] = true;
              if (ABORT) return;
              initRuntime();
              readyPromiseResolve(Module);
              if (Module["onRuntimeInitialized"]) Module["onRuntimeInitialized"]();
              postRun();
            }
            if (Module["setStatus"]) {
              Module["setStatus"]("Running...");
              setTimeout(function() {
                setTimeout(function() {
                  Module["setStatus"]("");
                }, 1);
                doRun();
              }, 1);
            } else {
              doRun();
            }
          }
          if (Module["preInit"]) {
            if (typeof Module["preInit"] == "function") Module["preInit"] = [Module["preInit"]];
            while (Module["preInit"].length > 0) {
              Module["preInit"].pop()();
            }
          }
          run();
          return moduleArg;
        };
      })();
      Cross_default = CrossModule;
    }
  });

  // node_modules/webfft/lib/cross/FFT.js
  function FFTCross(size) {
    this.size = size;
    this.n = size * 8;
    this.ptr = crossModule._malloc(this.n * 4);
    this.ri = new Uint8Array(crossModule.HEAPU8.buffer, this.ptr, this.n);
    this.ii = new Uint8Array(
      crossModule.HEAPU8.buffer,
      this.ptr + this.n,
      this.n
    );
    this.transform = function(real, imag, inverse) {
      var ptr = this.ptr;
      var n = this.n;
      this.ri.set(new Uint8Array(real.buffer));
      this.ii.set(new Uint8Array(imag.buffer));
      fftCross(this.size, inverse, ptr, ptr + n, ptr + n * 2, ptr + n * 3);
      var ro = new Float64Array(
        crossModule.HEAPU8.buffer,
        ptr + n * 2,
        this.size
      );
      var io = new Float64Array(
        crossModule.HEAPU8.buffer,
        ptr + n * 3,
        this.size
      );
      return { real: ro, imag: io };
    };
    this.dispose = function() {
      crossModule._free(this.ptr);
    };
  }
  var crossModule, fftCross, FFT_default;
  var init_FFT = __esm({
    "node_modules/webfft/lib/cross/FFT.js"() {
      "use strict";
      init_Cross();
      crossModule = Cross_default({});
      fftCross = crossModule.cwrap("fftCross", "void", [
        "number",
        "number",
        "number",
        "number",
        "number",
        "number"
      ]);
      FFT_default = FFTCross;
    }
  });

  // node_modules/webfft/lib/cross/webfftWrapper.js
  var CrossFftWrapperWasm, webfftWrapper_default3;
  var init_webfftWrapper3 = __esm({
    "node_modules/webfft/lib/cross/webfftWrapper.js"() {
      "use strict";
      init_FFT();
      CrossFftWrapperWasm = class {
        constructor(size) {
          this.size = size;
          this.fftcross = new FFT_default(size);
          this.real = new Float64Array(this.size);
          this.imag = new Float64Array(this.size);
        }
        fft(inputArr) {
          for (var i = 0; i < this.size; i++) {
            this.real[i] = inputArr[2 * i];
            this.imag[i] = inputArr[2 * i + 1];
          }
          const out = this.fftcross.transform(this.real, this.imag, false);
          const outputArr = new Float32Array(2 * this.size);
          for (var i = 0; i < this.size; i++) {
            outputArr[2 * i] = out.real[i];
            outputArr[2 * i + 1] = out.imag[i];
          }
          return outputArr;
        }
      };
      webfftWrapper_default3 = CrossFftWrapperWasm;
    }
  });

  // node_modules/webfft/lib/nayuki/fft.js
  function FFTNayuki(n) {
    this.n = n;
    this.levels = -1;
    for (var i = 0; i < 32; i++) {
      if (1 << i == n) {
        this.levels = i;
      }
    }
    if (this.levels == -1) {
      throw "Length is not a power of 2";
    }
    this.cosTable = new Array(n / 2);
    this.sinTable = new Array(n / 2);
    for (var i = 0; i < n / 2; i++) {
      this.cosTable[i] = Math.cos(2 * Math.PI * i / n);
      this.sinTable[i] = Math.sin(2 * Math.PI * i / n);
    }
    this.forward = function(real, imag) {
      var n2 = this.n;
      for (var i2 = 0; i2 < n2; i2++) {
        var j = reverseBits(i2, this.levels);
        if (j > i2) {
          var temp = real[i2];
          real[i2] = real[j];
          real[j] = temp;
          temp = imag[i2];
          imag[i2] = imag[j];
          imag[j] = temp;
        }
      }
      for (var size = 2; size <= n2; size *= 2) {
        var halfsize = size / 2;
        var tablestep = n2 / size;
        for (var i2 = 0; i2 < n2; i2 += size) {
          for (var j = i2, k = 0; j < i2 + halfsize; j++, k += tablestep) {
            var tpre = real[j + halfsize] * this.cosTable[k] + imag[j + halfsize] * this.sinTable[k];
            var tpim = -real[j + halfsize] * this.sinTable[k] + imag[j + halfsize] * this.cosTable[k];
            real[j + halfsize] = real[j] - tpre;
            imag[j + halfsize] = imag[j] - tpim;
            real[j] += tpre;
            imag[j] += tpim;
          }
        }
      }
      function reverseBits(x, bits) {
        var y = 0;
        for (var i3 = 0; i3 < bits; i3++) {
          y = y << 1 | x & 1;
          x >>>= 1;
        }
        return y;
      }
    };
    this.inverse = function(real, imag) {
      forward(imag, real);
    };
  }
  var fft_default2;
  var init_fft2 = __esm({
    "node_modules/webfft/lib/nayuki/fft.js"() {
      "use strict";
      fft_default2 = FFTNayuki;
    }
  });

  // node_modules/webfft/lib/nayuki/webfftWrapper.js
  var NayukiFftWrapperJavascript, webfftWrapper_default4;
  var init_webfftWrapper4 = __esm({
    "node_modules/webfft/lib/nayuki/webfftWrapper.js"() {
      "use strict";
      init_fft2();
      NayukiFftWrapperJavascript = class {
        constructor(size) {
          this.size = size;
          this.fftNayuki = new fft_default2(size);
        }
        fft(inputArr) {
          const real = new Float32Array(this.size);
          const imag = new Float32Array(this.size);
          const outputArr = new Float32Array(this.size * 2);
          for (var i = 0; i < this.size; ++i) {
            real[i] = inputArr[i * 2];
            imag[i] = inputArr[i * 2 + 1];
          }
          this.fftNayuki.forward(real, imag);
          for (var i = 0; i < this.size; ++i) {
            outputArr[i * 2] = real[i];
            outputArr[i * 2 + 1] = imag[i];
          }
          return outputArr;
        }
      };
      webfftWrapper_default4 = NayukiFftWrapperJavascript;
    }
  });

  // node_modules/webfft/lib/nayukic/NayukiCFFT.mjs
  var import_meta3, NayukiCModule, NayukiCFFT_default;
  var init_NayukiCFFT = __esm({
    "node_modules/webfft/lib/nayukic/NayukiCFFT.mjs"() {
      "use strict";
      import_meta3 = {};
      NayukiCModule = (() => {
        var _scriptDir = import_meta3.url;
        return function(moduleArg = {}) {
          var Module = moduleArg;
          var readyPromiseResolve, readyPromiseReject;
          Module["ready"] = new Promise((resolve, reject) => {
            readyPromiseResolve = resolve;
            readyPromiseReject = reject;
          });
          var moduleOverrides = Object.assign({}, Module);
          var arguments_ = [];
          var thisProgram = "./this.program";
          var quit_ = (status, toThrow) => {
            throw toThrow;
          };
          var ENVIRONMENT_IS_WEB = true;
          var ENVIRONMENT_IS_WORKER = false;
          var scriptDirectory = "";
          function locateFile(path) {
            if (Module["locateFile"]) {
              return Module["locateFile"](path, scriptDirectory);
            }
            return scriptDirectory + path;
          }
          var read_, readAsync, readBinary, setWindowTitle;
          if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
            if (ENVIRONMENT_IS_WORKER) {
              scriptDirectory = self.location.href;
            } else if (typeof document != "undefined" && document.currentScript) {
              scriptDirectory = document.currentScript.src;
            }
            if (_scriptDir) {
              scriptDirectory = _scriptDir;
            }
            if (scriptDirectory.indexOf("blob:") !== 0) {
              scriptDirectory = scriptDirectory.substr(0, scriptDirectory.replace(/[?#].*/, "").lastIndexOf("/") + 1);
            } else {
              scriptDirectory = "";
            }
            {
              read_ = (url) => {
                var xhr = new XMLHttpRequest();
                xhr.open("GET", url, false);
                xhr.send(null);
                return xhr.responseText;
              };
              if (ENVIRONMENT_IS_WORKER) {
                readBinary = (url) => {
                  var xhr = new XMLHttpRequest();
                  xhr.open("GET", url, false);
                  xhr.responseType = "arraybuffer";
                  xhr.send(null);
                  return new Uint8Array(xhr.response);
                };
              }
              readAsync = (url, onload, onerror) => {
                var xhr = new XMLHttpRequest();
                xhr.open("GET", url, true);
                xhr.responseType = "arraybuffer";
                xhr.onload = () => {
                  if (xhr.status == 200 || xhr.status == 0 && xhr.response) {
                    onload(xhr.response);
                    return;
                  }
                  onerror();
                };
                xhr.onerror = onerror;
                xhr.send(null);
              };
            }
            setWindowTitle = (title) => document.title = title;
          } else {
          }
          var out = Module["print"] || console.log.bind(console);
          var err = Module["printErr"] || console.error.bind(console);
          Object.assign(Module, moduleOverrides);
          moduleOverrides = null;
          if (Module["arguments"]) arguments_ = Module["arguments"];
          if (Module["thisProgram"]) thisProgram = Module["thisProgram"];
          if (Module["quit"]) quit_ = Module["quit"];
          var wasmBinary;
          if (Module["wasmBinary"]) wasmBinary = Module["wasmBinary"];
          var noExitRuntime = Module["noExitRuntime"] || true;
          if (typeof WebAssembly != "object") {
            abort("no native wasm support detected");
          }
          var wasmMemory;
          var wasmExports;
          var ABORT = false;
          var EXITSTATUS;
          var HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;
          function updateMemoryViews() {
            var b = wasmMemory.buffer;
            Module["HEAP8"] = HEAP8 = new Int8Array(b);
            Module["HEAP16"] = HEAP16 = new Int16Array(b);
            Module["HEAP32"] = HEAP32 = new Int32Array(b);
            Module["HEAPU8"] = HEAPU8 = new Uint8Array(b);
            Module["HEAPU16"] = HEAPU16 = new Uint16Array(b);
            Module["HEAPU32"] = HEAPU32 = new Uint32Array(b);
            Module["HEAPF32"] = HEAPF32 = new Float32Array(b);
            Module["HEAPF64"] = HEAPF64 = new Float64Array(b);
          }
          var wasmTable;
          var __ATPRERUN__ = [];
          var __ATINIT__ = [];
          var __ATPOSTRUN__ = [];
          var runtimeInitialized = false;
          function preRun() {
            if (Module["preRun"]) {
              if (typeof Module["preRun"] == "function") Module["preRun"] = [Module["preRun"]];
              while (Module["preRun"].length) {
                addOnPreRun(Module["preRun"].shift());
              }
            }
            callRuntimeCallbacks(__ATPRERUN__);
          }
          function initRuntime() {
            runtimeInitialized = true;
            callRuntimeCallbacks(__ATINIT__);
          }
          function postRun() {
            if (Module["postRun"]) {
              if (typeof Module["postRun"] == "function") Module["postRun"] = [Module["postRun"]];
              while (Module["postRun"].length) {
                addOnPostRun(Module["postRun"].shift());
              }
            }
            callRuntimeCallbacks(__ATPOSTRUN__);
          }
          function addOnPreRun(cb) {
            __ATPRERUN__.unshift(cb);
          }
          function addOnInit(cb) {
            __ATINIT__.unshift(cb);
          }
          function addOnPostRun(cb) {
            __ATPOSTRUN__.unshift(cb);
          }
          var runDependencies = 0;
          var runDependencyWatcher = null;
          var dependenciesFulfilled = null;
          function addRunDependency(id) {
            runDependencies++;
            if (Module["monitorRunDependencies"]) {
              Module["monitorRunDependencies"](runDependencies);
            }
          }
          function removeRunDependency(id) {
            runDependencies--;
            if (Module["monitorRunDependencies"]) {
              Module["monitorRunDependencies"](runDependencies);
            }
            if (runDependencies == 0) {
              if (runDependencyWatcher !== null) {
                clearInterval(runDependencyWatcher);
                runDependencyWatcher = null;
              }
              if (dependenciesFulfilled) {
                var callback = dependenciesFulfilled;
                dependenciesFulfilled = null;
                callback();
              }
            }
          }
          function abort(what) {
            if (Module["onAbort"]) {
              Module["onAbort"](what);
            }
            what = "Aborted(" + what + ")";
            err(what);
            ABORT = true;
            EXITSTATUS = 1;
            what += ". Build with -sASSERTIONS for more info.";
            var e = new WebAssembly.RuntimeError(what);
            readyPromiseReject(e);
            throw e;
          }
          var dataURIPrefix = "data:application/octet-stream;base64,";
          function isDataURI(filename) {
            return filename.startsWith(dataURIPrefix);
          }
          var wasmBinaryFile;
          wasmBinaryFile = "data:application/octet-stream;base64,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IgMNACACQRBqIQEgAigCECIDDQALIARBADYCAAwEC0G0HiAGQShrIgBBeCACa0EHcSIBayIINgIAQcAeIAEgAmoiATYCACABIAhBAXI2AgQgACACakEoNgIEQcQeQZAiKAIANgIAIAMgBEEnIARrQQdxakEvayIAIAAgA0EQakkbIgFBGzYCBCABQfAhKQIANwIQIAFB6CEpAgA3AghB8CEgAUEIajYCAEHsISAGNgIAQeghIAI2AgBB9CFBADYCACABQRhqIQADQCAAQQc2AgQgAEEIaiECIABBBGohACACIARJDQALIAEgA0YNACABIAEoAgRBfnE2AgQgAyABIANrIgJBAXI2AgQgASACNgIAIAJB/wFNBEAgAkF4cUHQHmohAAJ/QageKAIAIgFBASACQQN2dCICcUUEQEGoHiABIAJyNgIAIAAMAQsgACgCCAshASAAIAM2AgggASADNgIMIAMgADYCDCADIAE2AggMAQtBHyEAIAJB////B00EQCACQSYgAkEIdmciAGt2QQFxIABBAXRrQT5qIQALIAMgADYCHCADQgA3AhAgAEECdEHYIGohAQJAAkBBrB4oAgAiBEEBIAB0IgZxRQRAQaweIAQgBnI2AgAgASADNgIADAELIAJBGSAAQQF2a0EAIABBH0cbdCEAIAEoAgAhBANAIAQiASgCBEF4cSACRg0CIABBHXYhBCAAQQF0IQAgASAEQQRxaiIGKAIQIgQNAAsgBiADNgIQCyADIAE2AhggAyADNgIMIAMgAzYCCAwBCyABKAIIIgAgAzYCDCABIAM2AgggA0EANgIYIAMgATYCDCADIAA2AggLQbQeKAIAIgAgBU0NAEG0HiAAIAVrIgE2AgBBwB5BwB4oAgAiACAFaiICNgIAIAIgAUEBcjYCBCAAIAVBA3I2AgQgAEEIaiEADAgLQaQeQTA2AgBBACEADAcLQQAhAgsgCEUNAAJAIAYoAhwiAUECdEHYIGoiBCgCACAGRgRAIAQgAjYCACACDQFBrB5BrB4oAgBBfiABd3E2AgAMAgsgCEEQQRQgCCgCECAGRhtqIAI2AgAgAkUNAQsgAiAINgIYIAYoAhAiAQRAIAIgATYCECABIAI2AhgLIAYoAhQiAUUNACACIAE2AhQgASACNgIYCyAAIAlqIQAgBiAJaiIGKAIEIQMLIAYgA0F+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";
          if (!isDataURI(wasmBinaryFile)) {
            wasmBinaryFile = locateFile(wasmBinaryFile);
          }
          function getBinarySync(file) {
            if (file == wasmBinaryFile && wasmBinary) {
              return new Uint8Array(wasmBinary);
            }
            var binary = tryParseAsDataURI(file);
            if (binary) {
              return binary;
            }
            if (readBinary) {
              return readBinary(file);
            }
            throw "sync fetching of the wasm failed: you can preload it to Module['wasmBinary'] manually, or emcc.py will do that for you when generating HTML (but not JS)";
          }
          function instantiateSync(file, info) {
            var module;
            var binary = getBinarySync(file);
            module = new WebAssembly.Module(binary);
            var instance = new WebAssembly.Instance(module, info);
            return [instance, module];
          }
          function createWasm() {
            var info = { "a": wasmImports };
            function receiveInstance(instance, module) {
              var exports = instance.exports;
              wasmExports = exports;
              wasmMemory = wasmExports["b"];
              updateMemoryViews();
              wasmTable = wasmExports["l"];
              addOnInit(wasmExports["c"]);
              removeRunDependency("wasm-instantiate");
              return exports;
            }
            addRunDependency("wasm-instantiate");
            if (Module["instantiateWasm"]) {
              try {
                return Module["instantiateWasm"](info, receiveInstance);
              } catch (e) {
                err("Module.instantiateWasm callback failed with error: " + e);
                readyPromiseReject(e);
              }
            }
            var result = instantiateSync(wasmBinaryFile, info);
            return receiveInstance(result[0]);
          }
          var callRuntimeCallbacks = (callbacks) => {
            while (callbacks.length > 0) {
              callbacks.shift()(Module);
            }
          };
          var abortOnCannotGrowMemory = (requestedSize) => {
            abort("OOM");
          };
          var _emscripten_resize_heap = (requestedSize) => {
            var oldSize = HEAPU8.length;
            requestedSize >>>= 0;
            abortOnCannotGrowMemory(requestedSize);
          };
          function getCFunc(ident) {
            var func = Module["_" + ident];
            return func;
          }
          var writeArrayToMemory = (array, buffer) => {
            HEAP8.set(array, buffer);
          };
          var lengthBytesUTF8 = (str) => {
            var len = 0;
            for (var i = 0; i < str.length; ++i) {
              var c = str.charCodeAt(i);
              if (c <= 127) {
                len++;
              } else if (c <= 2047) {
                len += 2;
              } else if (c >= 55296 && c <= 57343) {
                len += 4;
                ++i;
              } else {
                len += 3;
              }
            }
            return len;
          };
          var stringToUTF8Array = (str, heap, outIdx, maxBytesToWrite) => {
            if (!(maxBytesToWrite > 0)) return 0;
            var startIdx = outIdx;
            var endIdx = outIdx + maxBytesToWrite - 1;
            for (var i = 0; i < str.length; ++i) {
              var u = str.charCodeAt(i);
              if (u >= 55296 && u <= 57343) {
                var u1 = str.charCodeAt(++i);
                u = 65536 + ((u & 1023) << 10) | u1 & 1023;
              }
              if (u <= 127) {
                if (outIdx >= endIdx) break;
                heap[outIdx++] = u;
              } else if (u <= 2047) {
                if (outIdx + 1 >= endIdx) break;
                heap[outIdx++] = 192 | u >> 6;
                heap[outIdx++] = 128 | u & 63;
              } else if (u <= 65535) {
                if (outIdx + 2 >= endIdx) break;
                heap[outIdx++] = 224 | u >> 12;
                heap[outIdx++] = 128 | u >> 6 & 63;
                heap[outIdx++] = 128 | u & 63;
              } else {
                if (outIdx + 3 >= endIdx) break;
                heap[outIdx++] = 240 | u >> 18;
                heap[outIdx++] = 128 | u >> 12 & 63;
                heap[outIdx++] = 128 | u >> 6 & 63;
                heap[outIdx++] = 128 | u & 63;
              }
            }
            heap[outIdx] = 0;
            return outIdx - startIdx;
          };
          var stringToUTF8 = (str, outPtr, maxBytesToWrite) => stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
          var stringToUTF8OnStack = (str) => {
            var size = lengthBytesUTF8(str) + 1;
            var ret = stackAlloc(size);
            stringToUTF8(str, ret, size);
            return ret;
          };
          var UTF8Decoder = typeof TextDecoder != "undefined" ? new TextDecoder("utf8") : void 0;
          var UTF8ArrayToString = (heapOrArray, idx, maxBytesToRead) => {
            var endIdx = idx + maxBytesToRead;
            var endPtr = idx;
            while (heapOrArray[endPtr] && !(endPtr >= endIdx)) ++endPtr;
            if (endPtr - idx > 16 && heapOrArray.buffer && UTF8Decoder) {
              return UTF8Decoder.decode(heapOrArray.subarray(idx, endPtr));
            }
            var str = "";
            while (idx < endPtr) {
              var u0 = heapOrArray[idx++];
              if (!(u0 & 128)) {
                str += String.fromCharCode(u0);
                continue;
              }
              var u1 = heapOrArray[idx++] & 63;
              if ((u0 & 224) == 192) {
                str += String.fromCharCode((u0 & 31) << 6 | u1);
                continue;
              }
              var u2 = heapOrArray[idx++] & 63;
              if ((u0 & 240) == 224) {
                u0 = (u0 & 15) << 12 | u1 << 6 | u2;
              } else {
                u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | heapOrArray[idx++] & 63;
              }
              if (u0 < 65536) {
                str += String.fromCharCode(u0);
              } else {
                var ch = u0 - 65536;
                str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023);
              }
            }
            return str;
          };
          var UTF8ToString = (ptr, maxBytesToRead) => ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : "";
          var ccall = function(ident, returnType, argTypes, args, opts) {
            var toC = { "string": (str) => {
              var ret2 = 0;
              if (str !== null && str !== void 0 && str !== 0) {
                ret2 = stringToUTF8OnStack(str);
              }
              return ret2;
            }, "array": (arr) => {
              var ret2 = stackAlloc(arr.length);
              writeArrayToMemory(arr, ret2);
              return ret2;
            } };
            function convertReturnValue(ret2) {
              if (returnType === "string") {
                return UTF8ToString(ret2);
              }
              if (returnType === "boolean") return Boolean(ret2);
              return ret2;
            }
            var func = getCFunc(ident);
            var cArgs = [];
            var stack = 0;
            if (args) {
              for (var i = 0; i < args.length; i++) {
                var converter = toC[argTypes[i]];
                if (converter) {
                  if (stack === 0) stack = stackSave();
                  cArgs[i] = converter(args[i]);
                } else {
                  cArgs[i] = args[i];
                }
              }
            }
            var ret = func.apply(null, cArgs);
            function onDone(ret2) {
              if (stack !== 0) stackRestore(stack);
              return convertReturnValue(ret2);
            }
            ret = onDone(ret);
            return ret;
          };
          var cwrap = function(ident, returnType, argTypes, opts) {
            var numericArgs = !argTypes || argTypes.every((type) => type === "number" || type === "boolean");
            var numericRet = returnType !== "string";
            if (numericRet && numericArgs && !opts) {
              return getCFunc(ident);
            }
            return function() {
              return ccall(ident, returnType, argTypes, arguments, opts);
            };
          };
          var wasmImports = { a: _emscripten_resize_heap };
          var asm = createWasm();
          var ___wasm_call_ctors = asm["c"];
          var _malloc = Module["_malloc"] = asm["d"];
          var _free = Module["_free"] = asm["e"];
          var _precalc = Module["_precalc"] = asm["f"];
          var _precalc_f = Module["_precalc_f"] = asm["g"];
          var _dispose = Module["_dispose"] = asm["h"];
          var _dispose_f = Module["_dispose_f"] = asm["i"];
          var _transform_radix2_precalc = Module["_transform_radix2_precalc"] = asm["j"];
          var _transform_radix2_precalc_f = Module["_transform_radix2_precalc_f"] = asm["k"];
          var ___errno_location = asm["__errno_location"];
          var stackSave = asm["m"];
          var stackRestore = asm["n"];
          var stackAlloc = asm["o"];
          function intArrayFromBase64(s) {
            try {
              var decoded = atob(s);
              var bytes = new Uint8Array(decoded.length);
              for (var i = 0; i < decoded.length; ++i) {
                bytes[i] = decoded.charCodeAt(i);
              }
              return bytes;
            } catch (_) {
              throw new Error("Converting base64 string to bytes failed.");
            }
          }
          function tryParseAsDataURI(filename) {
            if (!isDataURI(filename)) {
              return;
            }
            return intArrayFromBase64(filename.slice(dataURIPrefix.length));
          }
          Module["ccall"] = ccall;
          Module["cwrap"] = cwrap;
          var calledRun;
          dependenciesFulfilled = function runCaller() {
            if (!calledRun) run();
            if (!calledRun) dependenciesFulfilled = runCaller;
          };
          function run() {
            if (runDependencies > 0) {
              return;
            }
            preRun();
            if (runDependencies > 0) {
              return;
            }
            function doRun() {
              if (calledRun) return;
              calledRun = true;
              Module["calledRun"] = true;
              if (ABORT) return;
              initRuntime();
              readyPromiseResolve(Module);
              if (Module["onRuntimeInitialized"]) Module["onRuntimeInitialized"]();
              postRun();
            }
            if (Module["setStatus"]) {
              Module["setStatus"]("Running...");
              setTimeout(function() {
                setTimeout(function() {
                  Module["setStatus"]("");
                }, 1);
                doRun();
              }, 1);
            } else {
              doRun();
            }
          }
          if (Module["preInit"]) {
            if (typeof Module["preInit"] == "function") Module["preInit"] = [Module["preInit"]];
            while (Module["preInit"].length > 0) {
              Module["preInit"].pop()();
            }
          }
          run();
          return moduleArg;
        };
      })();
      NayukiCFFT_default = NayukiCModule;
    }
  });

  // node_modules/webfft/lib/nayukic/FFT.js
  function FFTNayukiC(n) {
    this.n = n;
    this.rptr = nayukiCModule._malloc(n * 4 + n * 4);
    this.iptr = this.rptr + n * 4;
    this.rarr = new Float32Array(nayukiCModule.HEAPU8.buffer, this.rptr, n);
    this.iarr = new Float32Array(nayukiCModule.HEAPU8.buffer, this.iptr, n);
    this.tables = nc_precalc_f(n);
    this.forward = function(real, imag) {
      this.rarr.set(real);
      this.iarr.set(imag);
      nc_transform_radix2_precalc_f(this.rptr, this.iptr, this.n, this.tables);
      real.set(this.rarr);
      imag.set(this.iarr);
    };
    this.dispose = function() {
      nayukiCModule._free(this.rptr);
      nc_dispose_f(this.tables);
    };
  }
  var nayukiCModule, nc_precalc, nc_dispose, nc_transform_radix2_precalc, nc_precalc_f, nc_dispose_f, nc_transform_radix2_precalc_f, FFT_default2;
  var init_FFT2 = __esm({
    "node_modules/webfft/lib/nayukic/FFT.js"() {
      "use strict";
      init_NayukiCFFT();
      nayukiCModule = NayukiCFFT_default({});
      nc_precalc = nayukiCModule.cwrap("precalc", "number", ["number"]);
      nc_dispose = nayukiCModule.cwrap("dispose", "void", ["number"]);
      nc_transform_radix2_precalc = nayukiCModule.cwrap(
        "transform_radix2_precalc",
        "void",
        ["number", "number", "number", "number"]
      );
      nc_precalc_f = nayukiCModule.cwrap("precalc_f", "number", ["number"]);
      nc_dispose_f = nayukiCModule.cwrap("dispose_f", "void", ["number"]);
      nc_transform_radix2_precalc_f = nayukiCModule.cwrap(
        "transform_radix2_precalc_f",
        "void",
        ["number", "number", "number", "number"]
      );
      FFT_default2 = FFTNayukiC;
    }
  });

  // node_modules/webfft/lib/nayukic/webfftWrapper.js
  var NayukiWasmFftWrapperWasm, webfftWrapper_default5;
  var init_webfftWrapper5 = __esm({
    "node_modules/webfft/lib/nayukic/webfftWrapper.js"() {
      "use strict";
      init_FFT2();
      NayukiWasmFftWrapperWasm = class {
        constructor(size) {
          this.size = size;
          this.fftNayuki = new FFT_default2(size);
        }
        fft(inputArr) {
          const real = new Float32Array(this.size);
          const imag = new Float32Array(this.size);
          const outputArr = new Float32Array(this.size * 2);
          for (var i = 0; i < this.size; ++i) {
            real[i] = inputArr[i * 2];
            imag[i] = inputArr[i * 2 + 1];
          }
          this.fftNayuki.forward(real, imag);
          for (var i = 0; i < this.size; ++i) {
            outputArr[i * 2] = real[i];
            outputArr[i * 2 + 1] = imag[i];
          }
          return outputArr;
        }
      };
      webfftWrapper_default5 = NayukiWasmFftWrapperWasm;
    }
  });

  // node_modules/webfft/lib/nockert/complex.js
  var FFT2, complex_default;
  var init_complex = __esm({
    "node_modules/webfft/lib/nockert/complex.js"() {
      "use strict";
      if (!FFT2) {
        FFT2 = {};
      }
      void function(namespace) {
        "use strict";
        function butterfly2(output, outputOffset, outputStride, fStride, state, m) {
          var t = state.twiddle;
          for (var i = 0; i < m; i++) {
            var s0_r = output[2 * (outputOffset + outputStride * i)], s0_i = output[2 * (outputOffset + outputStride * i) + 1];
            var s1_r = output[2 * (outputOffset + outputStride * (i + m))], s1_i = output[2 * (outputOffset + outputStride * (i + m)) + 1];
            var t1_r = t[2 * (0 + fStride * i)], t1_i = t[2 * (0 + fStride * i) + 1];
            var v1_r = s1_r * t1_r - s1_i * t1_i, v1_i = s1_r * t1_i + s1_i * t1_r;
            var r0_r = s0_r + v1_r, r0_i = s0_i + v1_i;
            var r1_r = s0_r - v1_r, r1_i = s0_i - v1_i;
            output[2 * (outputOffset + outputStride * i)] = r0_r, output[2 * (outputOffset + outputStride * i) + 1] = r0_i;
            output[2 * (outputOffset + outputStride * (i + m))] = r1_r, output[2 * (outputOffset + outputStride * (i + m)) + 1] = r1_i;
          }
        }
        function butterfly3(output, outputOffset, outputStride, fStride, state, m) {
          var t = state.twiddle;
          var m1 = m, m2 = 2 * m;
          var fStride1 = fStride, fStride2 = 2 * fStride;
          var e = t[2 * (0 + fStride * m) + 1];
          for (var i = 0; i < m; i++) {
            var s0_r = output[2 * (outputOffset + outputStride * i)], s0_i = output[2 * (outputOffset + outputStride * i) + 1];
            var s1_r = output[2 * (outputOffset + outputStride * (i + m1))], s1_i = output[2 * (outputOffset + outputStride * (i + m1)) + 1];
            var t1_r = t[2 * (0 + fStride1 * i)], t1_i = t[2 * (0 + fStride1 * i) + 1];
            var v1_r = s1_r * t1_r - s1_i * t1_i, v1_i = s1_r * t1_i + s1_i * t1_r;
            var s2_r = output[2 * (outputOffset + outputStride * (i + m2))], s2_i = output[2 * (outputOffset + outputStride * (i + m2)) + 1];
            var t2_r = t[2 * (0 + fStride2 * i)], t2_i = t[2 * (0 + fStride2 * i) + 1];
            var v2_r = s2_r * t2_r - s2_i * t2_i, v2_i = s2_r * t2_i + s2_i * t2_r;
            var i0_r = v1_r + v2_r, i0_i = v1_i + v2_i;
            var r0_r = s0_r + i0_r, r0_i = s0_i + i0_i;
            output[2 * (outputOffset + outputStride * i)] = r0_r, output[2 * (outputOffset + outputStride * i) + 1] = r0_i;
            var i1_r = s0_r - i0_r * 0.5;
            var i1_i = s0_i - i0_i * 0.5;
            var i2_r = (v1_r - v2_r) * e;
            var i2_i = (v1_i - v2_i) * e;
            var r1_r = i1_r - i2_i;
            var r1_i = i1_i + i2_r;
            output[2 * (outputOffset + outputStride * (i + m1))] = r1_r, output[2 * (outputOffset + outputStride * (i + m1)) + 1] = r1_i;
            var r2_r = i1_r + i2_i;
            var r2_i = i1_i - i2_r;
            output[2 * (outputOffset + outputStride * (i + m2))] = r2_r, output[2 * (outputOffset + outputStride * (i + m2)) + 1] = r2_i;
          }
        }
        function butterfly4(output, outputOffset, outputStride, fStride, state, m) {
          var t = state.twiddle;
          var m1 = m, m2 = 2 * m, m3 = 3 * m;
          var fStride1 = fStride, fStride2 = 2 * fStride, fStride3 = 3 * fStride;
          for (var i = 0; i < m; i++) {
            var s0_r = output[2 * (outputOffset + outputStride * i)], s0_i = output[2 * (outputOffset + outputStride * i) + 1];
            var s1_r = output[2 * (outputOffset + outputStride * (i + m1))], s1_i = output[2 * (outputOffset + outputStride * (i + m1)) + 1];
            var t1_r = t[2 * (0 + fStride1 * i)], t1_i = t[2 * (0 + fStride1 * i) + 1];
            var v1_r = s1_r * t1_r - s1_i * t1_i, v1_i = s1_r * t1_i + s1_i * t1_r;
            var s2_r = output[2 * (outputOffset + outputStride * (i + m2))], s2_i = output[2 * (outputOffset + outputStride * (i + m2)) + 1];
            var t2_r = t[2 * (0 + fStride2 * i)], t2_i = t[2 * (0 + fStride2 * i) + 1];
            var v2_r = s2_r * t2_r - s2_i * t2_i, v2_i = s2_r * t2_i + s2_i * t2_r;
            var s3_r = output[2 * (outputOffset + outputStride * (i + m3))], s3_i = output[2 * (outputOffset + outputStride * (i + m3)) + 1];
            var t3_r = t[2 * (0 + fStride3 * i)], t3_i = t[2 * (0 + fStride3 * i) + 1];
            var v3_r = s3_r * t3_r - s3_i * t3_i, v3_i = s3_r * t3_i + s3_i * t3_r;
            var i0_r = s0_r + v2_r, i0_i = s0_i + v2_i;
            var i1_r = s0_r - v2_r, i1_i = s0_i - v2_i;
            var i2_r = v1_r + v3_r, i2_i = v1_i + v3_i;
            var i3_r = v1_r - v3_r, i3_i = v1_i - v3_i;
            var r0_r = i0_r + i2_r, r0_i = i0_i + i2_i;
            if (state.inverse) {
              var r1_r = i1_r - i3_i;
              var r1_i = i1_i + i3_r;
            } else {
              var r1_r = i1_r + i3_i;
              var r1_i = i1_i - i3_r;
            }
            var r2_r = i0_r - i2_r, r2_i = i0_i - i2_i;
            if (state.inverse) {
              var r3_r = i1_r + i3_i;
              var r3_i = i1_i - i3_r;
            } else {
              var r3_r = i1_r - i3_i;
              var r3_i = i1_i + i3_r;
            }
            output[2 * (outputOffset + outputStride * i)] = r0_r, output[2 * (outputOffset + outputStride * i) + 1] = r0_i;
            output[2 * (outputOffset + outputStride * (i + m1))] = r1_r, output[2 * (outputOffset + outputStride * (i + m1)) + 1] = r1_i;
            output[2 * (outputOffset + outputStride * (i + m2))] = r2_r, output[2 * (outputOffset + outputStride * (i + m2)) + 1] = r2_i;
            output[2 * (outputOffset + outputStride * (i + m3))] = r3_r, output[2 * (outputOffset + outputStride * (i + m3)) + 1] = r3_i;
          }
        }
        function butterfly(output, outputOffset, outputStride, fStride, state, m, p) {
          var t = state.twiddle, n = state.n, scratch = new Float64Array(2 * p);
          for (var u = 0; u < m; u++) {
            for (var q1 = 0, k = u; q1 < p; q1++, k += m) {
              var x0_r = output[2 * (outputOffset + outputStride * k)], x0_i = output[2 * (outputOffset + outputStride * k) + 1];
              scratch[2 * q1] = x0_r, scratch[2 * q1 + 1] = x0_i;
            }
            for (var q1 = 0, k = u; q1 < p; q1++, k += m) {
              var tOffset = 0;
              var x0_r = scratch[2 * 0], x0_i = scratch[2 * 0 + 1];
              output[2 * (outputOffset + outputStride * k)] = x0_r, output[2 * (outputOffset + outputStride * k) + 1] = x0_i;
              for (var q = 1; q < p; q++) {
                tOffset = (tOffset + fStride * k) % n;
                var s0_r = output[2 * (outputOffset + outputStride * k)], s0_i = output[2 * (outputOffset + outputStride * k) + 1];
                var s1_r = scratch[2 * q], s1_i = scratch[2 * q + 1];
                var t1_r = t[2 * tOffset], t1_i = t[2 * tOffset + 1];
                var v1_r = s1_r * t1_r - s1_i * t1_i, v1_i = s1_r * t1_i + s1_i * t1_r;
                var r0_r = s0_r + v1_r, r0_i = s0_i + v1_i;
                output[2 * (outputOffset + outputStride * k)] = r0_r, output[2 * (outputOffset + outputStride * k) + 1] = r0_i;
              }
            }
          }
        }
        function work(output, outputOffset, outputStride, f, fOffset, fStride, inputStride, factors, state) {
          var p = factors.shift();
          var m = factors.shift();
          if (m == 1) {
            for (var i = 0; i < p * m; i++) {
              var x0_r = f[2 * (fOffset + fStride * inputStride * i)], x0_i = f[2 * (fOffset + fStride * inputStride * i) + 1];
              output[2 * (outputOffset + outputStride * i)] = x0_r, output[2 * (outputOffset + outputStride * i) + 1] = x0_i;
            }
          } else {
            for (var i = 0; i < p; i++) {
              work(
                output,
                outputOffset + outputStride * i * m,
                outputStride,
                f,
                fOffset + i * fStride * inputStride,
                fStride * p,
                inputStride,
                factors.slice(),
                state
              );
            }
          }
          switch (p) {
            case 2:
              butterfly2(output, outputOffset, outputStride, fStride, state, m);
              break;
            case 3:
              butterfly3(output, outputOffset, outputStride, fStride, state, m);
              break;
            case 4:
              butterfly4(output, outputOffset, outputStride, fStride, state, m);
              break;
            default:
              butterfly(output, outputOffset, outputStride, fStride, state, m, p);
              break;
          }
        }
        var complex = function(n, inverse) {
          if (arguments.length < 2) {
            throw new RangeError("You didn't pass enough arguments, passed `" + arguments.length + "'");
          }
          var n = ~~n, inverse = !!inverse;
          if (n < 1) {
            throw new RangeError("n is outside range, should be positive integer, was `" + n + "'");
          }
          var state = {
            n,
            inverse,
            factors: [],
            twiddle: new Float64Array(2 * n),
            scratch: new Float64Array(2 * n)
          };
          var t = state.twiddle, theta = 2 * Math.PI / n;
          for (var i = 0; i < n; i++) {
            if (inverse) {
              var phase = theta * i;
            } else {
              var phase = -theta * i;
            }
            t[2 * i] = Math.cos(phase);
            t[2 * i + 1] = Math.sin(phase);
          }
          var p = 4, v = Math.floor(Math.sqrt(n));
          while (n > 1) {
            while (n % p) {
              switch (p) {
                case 4:
                  p = 2;
                  break;
                case 2:
                  p = 3;
                  break;
                default:
                  p += 2;
                  break;
              }
              if (p > v) {
                p = n;
              }
            }
            n /= p;
            state.factors.push(p);
            state.factors.push(n);
          }
          this.state = state;
        };
        complex.prototype.simple = function(output, input, t) {
          this.process(output, 0, 1, input, 0, 1, t);
        };
        complex.prototype.process = function(output, outputOffset, outputStride, input, inputOffset, inputStride, t) {
          var outputStride = ~~outputStride, inputStride = ~~inputStride;
          var type = t == "real" ? t : "complex";
          if (outputStride < 1) {
            throw new RangeError("outputStride is outside range, should be positive integer, was `" + outputStride + "'");
          }
          if (inputStride < 1) {
            throw new RangeError("inputStride is outside range, should be positive integer, was `" + inputStride + "'");
          }
          if (type == "real") {
            for (var i = 0; i < this.state.n; i++) {
              var x0_r = input[inputOffset + inputStride * i];
              var x0_i = 0;
              this.state.scratch[2 * i] = x0_r, this.state.scratch[2 * i + 1] = x0_i;
            }
            work(output, outputOffset, outputStride, this.state.scratch, 0, 1, 1, this.state.factors.slice(), this.state);
          } else {
            if (input == output) {
              work(this.state.scratch, 0, 1, input, inputOffset, 1, inputStride, this.state.factors.slice(), this.state);
              for (var i = 0; i < this.state.n; i++) {
                var x0_r = this.state.scratch[2 * i], x0_i = this.state.scratch[2 * i + 1];
                output[2 * (outputOffset + outputStride * i)] = x0_r, output[2 * (outputOffset + outputStride * i) + 1] = x0_i;
              }
            } else {
              work(
                output,
                outputOffset,
                outputStride,
                input,
                inputOffset,
                1,
                inputStride,
                this.state.factors.slice(),
                this.state
              );
            }
          }
        };
        namespace.complex = complex;
      }(FFT2);
      complex_default = FFT2;
    }
  });

  // node_modules/webfft/lib/nockert/webfftWrapper.js
  var NockertFftWrapperJavascript, webfftWrapper_default6;
  var init_webfftWrapper6 = __esm({
    "node_modules/webfft/lib/nockert/webfftWrapper.js"() {
      "use strict";
      init_complex();
      NockertFftWrapperJavascript = class {
        constructor(size) {
          this.size = size;
          this.nockertfft = new complex_default.complex(size, false);
        }
        fft(inputArr) {
          const outputArr = new Float32Array(2 * this.size);
          this.nockertfft.simple(outputArr, inputArr, "complex");
          return outputArr;
        }
      };
      webfftWrapper_default6 = NockertFftWrapperJavascript;
    }
  });

  // node_modules/webfft/lib/mljs/fftlib.js
  function init(n) {
    if (n !== 0 && (n & n - 1) === 0) {
      _n = n;
      _initArray();
      _makeBitReversalTable();
      _makeCosSinTable();
    } else {
      throw new Error("init: radix-2 required");
    }
  }
  function fft1d(re, im) {
    fastFourierTransform(re, im, 1);
  }
  function ifft1d(re, im) {
    let n = 1 / _n;
    fastFourierTransform(re, im, -1);
    for (let i = 0; i < _n; i++) {
      re[i] *= n;
      im[i] *= n;
    }
  }
  function bt1d(re, im) {
    fastFourierTransform(re, im, -1);
  }
  function fft2d(re, im) {
    let tre = [];
    let tim = [];
    let i = 0;
    for (let y = 0; y < _n; y++) {
      i = y * _n;
      for (let x1 = 0; x1 < _n; x1++) {
        tre[x1] = re[x1 + i];
        tim[x1] = im[x1 + i];
      }
      fft1d(tre, tim);
      for (let x2 = 0; x2 < _n; x2++) {
        re[x2 + i] = tre[x2];
        im[x2 + i] = tim[x2];
      }
    }
    for (let x = 0; x < _n; x++) {
      for (let y1 = 0; y1 < _n; y1++) {
        i = x + y1 * _n;
        tre[y1] = re[i];
        tim[y1] = im[i];
      }
      fft1d(tre, tim);
      for (let y2 = 0; y2 < _n; y2++) {
        i = x + y2 * _n;
        re[i] = tre[y2];
        im[i] = tim[y2];
      }
    }
  }
  function ifft2d(re, im) {
    let tre = [];
    let tim = [];
    let i = 0;
    for (let y = 0; y < _n; y++) {
      i = y * _n;
      for (let x1 = 0; x1 < _n; x1++) {
        tre[x1] = re[x1 + i];
        tim[x1] = im[x1 + i];
      }
      ifft1d(tre, tim);
      for (let x2 = 0; x2 < _n; x2++) {
        re[x2 + i] = tre[x2];
        im[x2 + i] = tim[x2];
      }
    }
    for (let x = 0; x < _n; x++) {
      for (let y1 = 0; y1 < _n; y1++) {
        i = x + y1 * _n;
        tre[y1] = re[i];
        tim[y1] = im[i];
      }
      ifft1d(tre, tim);
      for (let y2 = 0; y2 < _n; y2++) {
        i = x + y2 * _n;
        re[i] = tre[y2];
        im[i] = tim[y2];
      }
    }
  }
  function fastFourierTransform(re, im, inv) {
    let d;
    let h;
    let ik;
    let m;
    let tmp;
    let wr;
    let wi;
    let xr;
    let xi;
    let n4 = _n >> 2;
    for (let l = 0; l < _n; l++) {
      m = _bitrev[l];
      if (l < m) {
        tmp = re[l];
        re[l] = re[m];
        re[m] = tmp;
        tmp = im[l];
        im[l] = im[m];
        im[m] = tmp;
      }
    }
    for (let k = 1; k < _n; k <<= 1) {
      h = 0;
      d = _n / (k << 1);
      for (let j = 0; j < k; j++) {
        wr = _cstb[h + n4];
        wi = inv * _cstb[h];
        for (let i = j; i < _n; i += k << 1) {
          ik = i + k;
          xr = wr * re[ik] + wi * im[ik];
          xi = wr * im[ik] - wi * re[ik];
          re[ik] = re[i] - xr;
          re[i] += xr;
          im[ik] = im[i] - xi;
          im[i] += xi;
        }
        h += d;
      }
    }
  }
  function _initArray() {
    if (typeof Uint32Array !== "undefined") {
      _bitrev = new Uint32Array(_n);
    } else {
      _bitrev = [];
    }
    if (typeof Float64Array !== "undefined") {
      _cstb = new Float64Array(_n * 1.25);
    } else {
      _cstb = [];
    }
  }
  function _makeBitReversalTable() {
    let i = 0;
    let j = 0;
    let k = 0;
    _bitrev[0] = 0;
    while (++i < _n) {
      k = _n >> 1;
      while (k <= j) {
        j -= k;
        k >>= 1;
      }
      j += k;
      _bitrev[i] = j;
    }
  }
  function _makeCosSinTable() {
    let n2 = _n >> 1;
    let n4 = _n >> 2;
    let n8 = _n >> 3;
    let n2p4 = n2 + n4;
    let t = Math.sin(Math.PI / _n);
    let dc = 2 * t * t;
    let ds = Math.sqrt(dc * (2 - dc));
    let c = _cstb[n4] = 1;
    let s = _cstb[0] = 0;
    t = 2 * dc;
    for (let i = 1; i < n8; i++) {
      c -= dc;
      dc += t * c;
      s += ds;
      ds -= t * s;
      _cstb[i] = s;
      _cstb[n4 - i] = c;
    }
    if (n8 !== 0) {
      _cstb[n8] = Math.sqrt(0.5);
    }
    for (let j = 0; j < n4; j++) {
      _cstb[n2 - j] = _cstb[j];
    }
    for (let k = 0; k < n2p4; k++) {
      _cstb[k + n2] = -_cstb[k];
    }
  }
  var _n, _bitrev, _cstb, FFT, fftlib_default;
  var init_fftlib = __esm({
    "node_modules/webfft/lib/mljs/fftlib.js"() {
      "use strict";
      _n = 0;
      _bitrev = null;
      _cstb = null;
      FFT = {
        init,
        fft1d,
        ifft1d,
        fft2d,
        ifft2d,
        fft: fft1d,
        ifft: ifft1d,
        bt: bt1d
      };
      fftlib_default = FFT;
    }
  });

  // node_modules/webfft/lib/mljs/webfftWrapper.js
  var MljsWebFftWrapperJavascript, webfftWrapper_default7;
  var init_webfftWrapper7 = __esm({
    "node_modules/webfft/lib/mljs/webfftWrapper.js"() {
      "use strict";
      init_fftlib();
      MljsWebFftWrapperJavascript = class {
        constructor(size) {
          this.size = size;
          this.FFT_mljs = fftlib_default;
          this.FFT_mljs.init(size);
        }
        fft(inputArr) {
          const input_real = new Float32Array(this.size);
          const input_imag = new Float32Array(this.size);
          const outputArr = new Float32Array(2 * this.size);
          for (var i = 0; i < this.size; ++i) {
            input_real[i] = inputArr[i * 2];
            input_imag[i] = inputArr[i * 2 + 1];
          }
          this.FFT_mljs.fft(input_real, input_imag);
          for (var i = 0; i < this.size; ++i) {
            outputArr[i * 2] = input_real[i];
            outputArr[i * 2 + 1] = input_imag[i];
          }
          return outputArr;
        }
      };
      webfftWrapper_default7 = MljsWebFftWrapperJavascript;
    }
  });

  // node_modules/webfft/lib/utils/checkCapabilities.js
  async function relaxedSimd() {
    return await WebAssembly.validate(
      new Uint8Array([
        0,
        97,
        115,
        109,
        1,
        0,
        0,
        0,
        1,
        5,
        1,
        96,
        0,
        1,
        123,
        3,
        2,
        1,
        0,
        10,
        15,
        1,
        13,
        0,
        65,
        1,
        253,
        15,
        65,
        2,
        253,
        15,
        253,
        128,
        2,
        11
      ])
    );
  }
  async function simd() {
    return await WebAssembly.validate(
      new Uint8Array([
        0,
        97,
        115,
        109,
        1,
        0,
        0,
        0,
        1,
        5,
        1,
        96,
        0,
        1,
        123,
        3,
        2,
        1,
        0,
        10,
        10,
        1,
        8,
        0,
        65,
        0,
        253,
        15,
        253,
        98,
        11
      ])
    );
  }
  async function checkBrowserCapabilities() {
    let browserName = "Other";
    let browserVersion = "Unknown";
    let osName = "Other";
    let osVersion = "Unknown";
    let uad = navigator.userAgentData;
    let ua = navigator.userAgent;
    try {
      if (uad) {
        const values = await uad.getHighEntropyValues([
          "architecture",
          "model",
          "platform",
          "platformVersion",
          "uaFullVersion"
        ]);
        const brandInfo = uad.brands.find(
          (brand) => ["Microsoft Edge", "Google Chrome", "Opera"].includes(brand.brand)
        );
        browserName = brandInfo ? brandInfo.brand : "Other";
        browserVersion = brandInfo ? `v${brandInfo.version}` : "Unknown";
        osName = values.platform ? values.platform : "Other";
        osVersion = values.platformVersion ? `v${values.platformVersion}` : "Unknown";
      }
      if (browserName === "Other" || osName === "Other") {
        const uaArr = ua.split(" ");
        const uaBrowser = uaArr[uaArr.length - 1];
        const isFirefox = /Firefox/.test(uaBrowser);
        const isSafari = /Safari/.test(uaBrowser) && !/CriOS/.test(uaBrowser) && !/Chrome/.test(uaBrowser);
        const isChrome = /CriOS/.test(uaBrowser) || /Chrome/.test(uaBrowser);
        const isEdge = /Edg/.test(uaBrowser);
        const isOpera = /OPR/.test(uaBrowser);
        const browsers = [
          {
            name: "Mozilla Firefox",
            regex: /Firefox\/(\d+\.\d+)/,
            flag: isFirefox
          },
          { name: "Safari", regex: /Version\/(\d+\.\d+)/, flag: isSafari },
          {
            name: "Google Chrome",
            regex: /CriOS|Chrome\/(\d+\.\d+)/,
            flag: isChrome
          },
          { name: "Microsoft Edge", regex: /Edg\/(\d+\.\d+)/, flag: isEdge },
          { name: "Opera", regex: /OPR\/(\d+\.\d+)/, flag: isOpera }
        ];
        for (const browser of browsers) {
          if (browser.flag) {
            browserName = browser.name;
            const versionMatch = uaBrowser.match(browser.regex);
            browserVersion = versionMatch ? versionMatch[1] : "Unknown";
            break;
          }
        }
        const osMatch = ua.match(/\(([^)]+)\)/);
        const osDetails = osMatch ? osMatch[1].split("; ") : [];
        console.log(osMatch);
        console.log(osDetails);
        const windowsVersionMap = {
          "10.0": "10",
          "6.3": "8.1",
          "6.2": "8",
          "6.1": "7",
          "6.0": "Vista",
          "5.2": "XP 64-bit",
          "5.1": "XP",
          "5.0": "2000"
        };
        const osInfo = [
          {
            name: "Windows",
            regex: /Windows NT/,
            transform: (s) => windowsVersionMap[s.split(" ")[2]],
            index: 0
          },
          {
            name: "Mac OS X",
            regex: /Mac OS X/,
            transform: (s) => s.replace("_", ".").split(" ")[3],
            index: 0
          },
          {
            name: "Linux",
            regex: /Linux/,
            transform: () => "Unknown",
            // Precise Linux version can be difficult to determine
            index: 0
          },
          {
            name: "Android",
            regex: /Android/,
            transform: (s) => s.split(" ")[1],
            index: 0
          },
          {
            name: "iOS",
            regex: /iPhone/,
            transform: (s) => s.split(" ")[1].replace("_", "."),
            index: 0
          }
        ];
        for (const os of osInfo) {
          if (os.regex.test(osDetails[0])) {
            osName = os.name;
            console.log(`osDetails: ${osDetails}`);
            osVersion = os.transform ? os.transform(osDetails[1]) : os.versionMap[osDetails[1].split(" ")[os.index]];
            break;
          }
        }
      }
    } catch (error) {
      console.error("Could not retrieve user agent data", error);
    }
    return {
      browserName,
      browserVersion,
      osName,
      osVersion,
      wasm: typeof WebAssembly === "object",
      relaxedSimd: await relaxedSimd(),
      simd: await simd()
    };
  }
  var checkCapabilities_default;
  var init_checkCapabilities = __esm({
    "node_modules/webfft/lib/utils/checkCapabilities.js"() {
      "use strict";
      checkCapabilities_default = checkBrowserCapabilities;
    }
  });

  // node_modules/webfft/lib/kissfftmodified/KissFFT.mjs
  var import_meta4, KissFFTModule2, KissFFT_default2;
  var init_KissFFT2 = __esm({
    "node_modules/webfft/lib/kissfftmodified/KissFFT.mjs"() {
      "use strict";
      import_meta4 = {};
      KissFFTModule2 = (() => {
        var _scriptDir = import_meta4.url;
        return function(moduleArg = {}) {
          var Module = moduleArg;
          var readyPromiseResolve, readyPromiseReject;
          Module["ready"] = new Promise((resolve, reject) => {
            readyPromiseResolve = resolve;
            readyPromiseReject = reject;
          });
          var moduleOverrides = Object.assign({}, Module);
          var arguments_ = [];
          var thisProgram = "./this.program";
          var quit_ = (status, toThrow) => {
            throw toThrow;
          };
          var ENVIRONMENT_IS_WEB = true;
          var ENVIRONMENT_IS_WORKER = false;
          var scriptDirectory = "";
          function locateFile(path) {
            if (Module["locateFile"]) {
              return Module["locateFile"](path, scriptDirectory);
            }
            return scriptDirectory + path;
          }
          var read_, readAsync, readBinary, setWindowTitle;
          if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
            if (ENVIRONMENT_IS_WORKER) {
              scriptDirectory = self.location.href;
            } else if (typeof document != "undefined" && document.currentScript) {
              scriptDirectory = document.currentScript.src;
            }
            if (_scriptDir) {
              scriptDirectory = _scriptDir;
            }
            if (scriptDirectory.indexOf("blob:") !== 0) {
              scriptDirectory = scriptDirectory.substr(0, scriptDirectory.replace(/[?#].*/, "").lastIndexOf("/") + 1);
            } else {
              scriptDirectory = "";
            }
            {
              read_ = (url) => {
                var xhr = new XMLHttpRequest();
                xhr.open("GET", url, false);
                xhr.send(null);
                return xhr.responseText;
              };
              if (ENVIRONMENT_IS_WORKER) {
                readBinary = (url) => {
                  var xhr = new XMLHttpRequest();
                  xhr.open("GET", url, false);
                  xhr.responseType = "arraybuffer";
                  xhr.send(null);
                  return new Uint8Array(xhr.response);
                };
              }
              readAsync = (url, onload, onerror) => {
                var xhr = new XMLHttpRequest();
                xhr.open("GET", url, true);
                xhr.responseType = "arraybuffer";
                xhr.onload = () => {
                  if (xhr.status == 200 || xhr.status == 0 && xhr.response) {
                    onload(xhr.response);
                    return;
                  }
                  onerror();
                };
                xhr.onerror = onerror;
                xhr.send(null);
              };
            }
            setWindowTitle = (title) => document.title = title;
          } else {
          }
          var out = Module["print"] || console.log.bind(console);
          var err = Module["printErr"] || console.error.bind(console);
          Object.assign(Module, moduleOverrides);
          moduleOverrides = null;
          if (Module["arguments"]) arguments_ = Module["arguments"];
          if (Module["thisProgram"]) thisProgram = Module["thisProgram"];
          if (Module["quit"]) quit_ = Module["quit"];
          var wasmBinary;
          if (Module["wasmBinary"]) wasmBinary = Module["wasmBinary"];
          var noExitRuntime = Module["noExitRuntime"] || true;
          if (typeof WebAssembly != "object") {
            abort("no native wasm support detected");
          }
          var wasmMemory;
          var wasmExports;
          var ABORT = false;
          var EXITSTATUS;
          var HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;
          function updateMemoryViews() {
            var b = wasmMemory.buffer;
            Module["HEAP8"] = HEAP8 = new Int8Array(b);
            Module["HEAP16"] = HEAP16 = new Int16Array(b);
            Module["HEAP32"] = HEAP32 = new Int32Array(b);
            Module["HEAPU8"] = HEAPU8 = new Uint8Array(b);
            Module["HEAPU16"] = HEAPU16 = new Uint16Array(b);
            Module["HEAPU32"] = HEAPU32 = new Uint32Array(b);
            Module["HEAPF32"] = HEAPF32 = new Float32Array(b);
            Module["HEAPF64"] = HEAPF64 = new Float64Array(b);
          }
          var wasmTable;
          var __ATPRERUN__ = [];
          var __ATINIT__ = [];
          var __ATPOSTRUN__ = [];
          var runtimeInitialized = false;
          function preRun() {
            if (Module["preRun"]) {
              if (typeof Module["preRun"] == "function") Module["preRun"] = [Module["preRun"]];
              while (Module["preRun"].length) {
                addOnPreRun(Module["preRun"].shift());
              }
            }
            callRuntimeCallbacks(__ATPRERUN__);
          }
          function initRuntime() {
            runtimeInitialized = true;
            callRuntimeCallbacks(__ATINIT__);
          }
          function postRun() {
            if (Module["postRun"]) {
              if (typeof Module["postRun"] == "function") Module["postRun"] = [Module["postRun"]];
              while (Module["postRun"].length) {
                addOnPostRun(Module["postRun"].shift());
              }
            }
            callRuntimeCallbacks(__ATPOSTRUN__);
          }
          function addOnPreRun(cb) {
            __ATPRERUN__.unshift(cb);
          }
          function addOnInit(cb) {
            __ATINIT__.unshift(cb);
          }
          function addOnPostRun(cb) {
            __ATPOSTRUN__.unshift(cb);
          }
          var runDependencies = 0;
          var runDependencyWatcher = null;
          var dependenciesFulfilled = null;
          function addRunDependency(id) {
            runDependencies++;
            if (Module["monitorRunDependencies"]) {
              Module["monitorRunDependencies"](runDependencies);
            }
          }
          function removeRunDependency(id) {
            runDependencies--;
            if (Module["monitorRunDependencies"]) {
              Module["monitorRunDependencies"](runDependencies);
            }
            if (runDependencies == 0) {
              if (runDependencyWatcher !== null) {
                clearInterval(runDependencyWatcher);
                runDependencyWatcher = null;
              }
              if (dependenciesFulfilled) {
                var callback = dependenciesFulfilled;
                dependenciesFulfilled = null;
                callback();
              }
            }
          }
          function abort(what) {
            if (Module["onAbort"]) {
              Module["onAbort"](what);
            }
            what = "Aborted(" + what + ")";
            err(what);
            ABORT = true;
            EXITSTATUS = 1;
            what += ". Build with -sASSERTIONS for more info.";
            var e = new WebAssembly.RuntimeError(what);
            readyPromiseReject(e);
            throw e;
          }
          var dataURIPrefix = "data:application/octet-stream;base64,";
          function isDataURI(filename) {
            return filename.startsWith(dataURIPrefix);
          }
          var wasmBinaryFile;
          wasmBinaryFile = "data:application/octet-stream;base64,AGFzbQEAAAABRQxgAX8Bf2ABfwBgAXwBfGADfHx/AXxgAnx8AXxgAnx/AXxgAABgAnx/AX9gBX9/f39/AGADf39/AGAEf39/fwF/YAABfwIHAQFhAWEAAAMSEQADBAUBAAYCBwgCCQoAAQsBBAUBcAEBAQUGAQGAAoACBggBfwFBoKIECwctCwFiAgABYwAHAWQAEQFlAAUBZgANAWcABgFoAAwBaQEAAWoAEAFrAA8BbAAOCvdnEU8BAn9BoB4oAgAiASAAQQdqQXhxIgJqIQACQCACQQAgACABTRsNACAAPwBBEHRLBEAgABAARQ0BC0GgHiAANgIAIAEPC0GkHkEwNgIAQX8LmQEBA3wgACAAoiIDIAMgA6KiIANEfNXPWjrZ5T2iROucK4rm5Vq+oKIgAyADRH3+sVfjHcc+okTVYcEZoAEqv6CiRKb4EBEREYE/oKAhBSADIACiIQQgAkUEQCAEIAMgBaJESVVVVVVVxb+goiAAoA8LIAAgAyABRAAAAAAAAOA/oiAFIASioaIgAaEgBERJVVVVVVXFP6KgoQuSAQEDfEQAAAAAAADwPyAAIACiIgJEAAAAAAAA4D+iIgOhIgREAAAAAAAA8D8gBKEgA6EgAiACIAIgAkSQFcsZoAH6PqJEd1HBFmzBVr+gokRMVVVVVVWlP6CiIAIgAqIiAyADoiACIAJE1DiIvun6qL2iRMSxtL2e7iE+oKJErVKcgE9+kr6goqCiIAAgAaKhoKALqAEAAkAgAUGACE4EQCAARAAAAAAAAOB/oiEAIAFB/w9JBEAgAUH/B2shAQwCCyAARAAAAAAAAOB/oiEAQf0XIAEgAUH9F04bQf4PayEBDAELIAFBgXhKDQAgAEQAAAAAAABgA6IhACABQbhwSwRAIAFByQdqIQEMAQsgAEQAAAAAAABgA6IhAEHwaCABIAFB8GhMG0GSD2ohAQsgACABQf8Haq1CNIa/ogvSCwEHfwJAIABFDQAgAEEIayICIABBBGsoAgAiAUF4cSIAaiEFAkAgAUEBcQ0AIAFBA3FFDQEgAiACKAIAIgFrIgJBuB4oAgBJDQEgACABaiEAAkACQEG8HigCACACRwRAIAFB/wFNBEAgAUEDdiEEIAIoAgwiASACKAIIIgNGBEBBqB5BqB4oAgBBfiAEd3E2AgAMBQsgAyABNgIMIAEgAzYCCAwECyACKAIYIQYgAiACKAIMIgFHBEAgAigCCCIDIAE2AgwgASADNgIIDAMLIAJBFGoiBCgCACIDRQRAIAIoAhAiA0UNAiACQRBqIQQLA0AgBCEHIAMiAUEUaiIEKAIAIgMNACABQRBqIQQgASgCECIDDQALIAdBADYCAAwCCyAFKAIEIgFBA3FBA0cNAkGwHiAANgIAIAUgAUF+cTYCBCACIABBAXI2AgQgBSAANgIADwtBACEBCyAGRQ0AAkAgAigCHCIDQQJ0QdggaiIEKAIAIAJGBEAgBCABNgIAIAENAUGsHkGsHigCAEF+IAN3cTYCAAwCCyAGQRBBFCAGKAIQIAJGG2ogATYCACABRQ0BCyABIAY2AhggAigCECIDBEAgASADNgIQIAMgATYCGAsgAigCFCIDRQ0AIAEgAzYCFCADIAE2AhgLIAIgBU8NACAFKAIEIgFBAXFFDQACQAJAAkACQCABQQJxRQRAQcAeKAIAIAVGBEBBwB4gAjYCAEG0HkG0HigCACAAaiIANgIAIAIgAEEBcjYCBCACQbweKAIARw0GQbAeQQA2AgBBvB5BADYCAA8LQbweKAIAIAVGBEBBvB4gAjYCAEGwHkGwHigCACAAaiIANgIAIAIgAEEBcjYCBCAAIAJqIAA2AgAPCyABQXhxIABqIQAgAUH/AU0EQCABQQN2IQQgBSgCDCIBIAUoAggiA0YEQEGoHkGoHigCAEF+IAR3cTYCAAwFCyADIAE2AgwgASADNgIIDAQLIAUoAhghBiAFIAUoAgwiAUcEQEG4HigCABogBSgCCCIDIAE2AgwgASADNgIIDAMLIAVBFGoiBCgCACIDRQRAIAUoAhAiA0UNAiAFQRBqIQQLA0AgBCEHIAMiAUEUaiIEKAIAIgMNACABQRBqIQQgASgCECIDDQALIAdBADYCAAwCCyAFIAFBfnE2AgQgAiAAQQFyNgIEIAAgAmogADYCAAwDC0EAIQELIAZFDQACQCAFKAIcIgNBAnRB2CBqIgQoAgAgBUYEQCAEIAE2AgAgAQ0BQaweQaweKAIAQX4gA3dxNgIADAILIAZBEEEUIAYoAhAgBUYbaiABNgIAIAFFDQELIAEgBjYCGCAFKAIQIgMEQCABIAM2AhAgAyABNgIYCyAFKAIUIgNFDQAgASADNgIUIAMgATYCGAsgAiAAQQFyNgIEIAAgAmogADYCACACQbweKAIARw0AQbAeIAA2AgAPCyAAQf8BTQRAIABBeHFB0B5qIQECf0GoHigCACIDQQEgAEEDdnQiAHFFBEBBqB4gACADcjYCACABDAELIAEoAggLIQAgASACNgIIIAAgAjYCDCACIAE2AgwgAiAANgIIDwtBHyEDIABB////B00EQCAAQSYgAEEIdmciAWt2QQFxIAFBAXRrQT5qIQMLIAIgAzYCHCACQgA3AhAgA0ECdEHYIGohAQJAAkACQEGsHigCACIEQQEgA3QiB3FFBEBBrB4gBCAHcjYCACABIAI2AgAgAiABNgIYDAELIABBGSADQQF2a0EAIANBH0cbdCEDIAEoAgAhAQNAIAEiBCgCBEF4cSAARg0CIANBHXYhASADQQF0IQMgBCABQQRxaiIHQRBqKAIAIgENAAsgByACNgIQIAIgBDYCGAsgAiACNgIMIAIgAjYCCAwBCyAEKAIIIgAgAjYCDCAEIAI2AgggAkEANgIYIAIgBDYCDCACIAA2AggLQcgeQcgeKAIAQQFrIgBBfyAAGzYCAAsLxicBC38jAEEQayIKJAACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAIABB9AFNBEBBqB4oAgAiBkEQIABBC2pBeHEgAEELSRsiBUEDdiIAdiIBQQNxBEACQCABQX9zQQFxIABqIgJBA3QiAUHQHmoiACABQdgeaigCACIBKAIIIgRGBEBBqB4gBkF+IAJ3cTYCAAwBCyAEIAA2AgwgACAENgIICyABQQhqIQAgASACQQN0IgJBA3I2AgQgASACaiIBIAEoAgRBAXI2AgQMDwsgBUGwHigCACIHTQ0BIAEEQAJAQQIgAHQiAkEAIAJrciABIAB0cWgiAUEDdCIAQdAeaiICIABB2B5qKAIAIgAoAggiBEYEQEGoHiAGQX4gAXdxIgY2AgAMAQsgBCACNgIMIAIgBDYCCAsgACAFQQNyNgIEIAAgBWoiCCABQQN0IgEgBWsiBEEBcjYCBCAAIAFqIAQ2AgAgBwRAIAdBeHFB0B5qIQFBvB4oAgAhAgJ/IAZBASAHQQN2dCIDcUUEQEGoHiADIAZyNgIAIAEMAQsgASgCCAshAyABIAI2AgggAyACNgIMIAIgATYCDCACIAM2AggLIABBCGohAEG8HiAINgIAQbAeIAQ2AgAMDwtBrB4oAgAiC0UNASALaEECdEHYIGooAgAiAigCBEF4cSAFayEDIAIhAQNAAkAgASgCECIARQRAIAEoAhQiAEUNAQsgACgCBEF4cSAFayIBIAMgASADSSIBGyEDIAAgAiABGyECIAAhAQwBCwsgAigCGCEJIAIgAigCDCIERwRAQbgeKAIAGiACKAIIIgAgBDYCDCAEIAA2AggMDgsgAkEUaiIBKAIAIgBFBEAgAigCECIARQ0DIAJBEGohAQsDQCABIQggACIEQRRqIgEoAgAiAA0AIARBEGohASAEKAIQIgANAAsgCEEANgIADA0LQX8hBSAAQb9/Sw0AIABBC2oiAEF4cSEFQaweKAIAIghFDQBBACAFayEDAkACQAJAAn9BACAFQYACSQ0AGkEfIAVB////B0sNABogBUEmIABBCHZnIgBrdkEBcSAAQQF0a0E+agsiB0ECdEHYIGooAgAiAUUEQEEAIQAMAQtBACEAIAVBGSAHQQF2a0EAIAdBH0cbdCECA0ACQCABKAIEQXhxIAVrIgYgA08NACABIQQgBiIDDQBBACEDIAEhAAwDCyAAIAEoAhQiBiAGIAEgAkEddkEEcWooAhAiAUYbIAAgBhshACACQQF0IQIgAQ0ACwsgACAEckUEQEEAIQRBAiAHdCIAQQAgAGtyIAhxIgBFDQMgAGhBAnRB2CBqKAIAIQALIABFDQELA0AgACgCBEF4cSAFayICIANJIQEgAiADIAEbIQMgACAEIAEbIQQgACgCECIBBH8gAQUgACgCFAsiAA0ACwsgBEUNACADQbAeKAIAIAVrTw0AIAQoAhghByAEIAQoAgwiAkcEQEG4HigCABogBCgCCCIAIAI2AgwgAiAANgIIDAwLIARBFGoiASgCACIARQRAIAQoAhAiAEUNAyAEQRBqIQELA0AgASEGIAAiAkEUaiIBKAIAIgANACACQRBqIQEgAigCECIADQALIAZBADYCAAwLCyAFQbAeKAIAIgRNBEBBvB4oAgAhAAJAIAQgBWsiAUEQTwRAIAAgBWoiAiABQQFyNgIEIAAgBGogATYCACAAIAVBA3I2AgQMAQsgACAEQQNyNgIEIAAgBGoiASABKAIEQQFyNgIEQQAhAkEAIQELQbAeIAE2AgBBvB4gAjYCACAAQQhqIQAMDQsgBUG0HigCACICSQRAQbQeIAIgBWsiATYCAEHAHkHAHigCACIAIAVqIgI2AgAgAiABQQFyNgIEIAAgBUEDcjYCBCAAQQhqIQAMDQtBACEAIAVBL2oiAwJ/QYAiKAIABEBBiCIoAgAMAQtBjCJCfzcCAEGEIkKAoICAgIAENwIAQYAiIApBDGpBcHFB2KrVqgVzNgIAQZQiQQA2AgBB5CFBADYCAEGAIAsiAWoiBkEAIAFrIghxIgEgBU0NDEHgISgCACIEBEBB2CEoAgAiByABaiIJIAdNDQ0gBCAJSQ0NCwJAQeQhLQAAQQRxRQRAAkACQAJAAkBBwB4oAgAiBARAQeghIQADQCAEIAAoAgAiB08EQCAHIAAoAgRqIARLDQMLIAAoAggiAA0ACwtBABABIgJBf0YNAyABIQZBhCIoAgAiAEEBayIEIAJxBEAgASACayACIARqQQAgAGtxaiEGCyAFIAZPDQNB4CEoAgAiAARAQdghKAIAIgQgBmoiCCAETQ0EIAAgCEkNBAsgBhABIgAgAkcNAQwFCyAGIAJrIAhxIgYQASICIAAoAgAgACgCBGpGDQEgAiEACyAAQX9GDQEgBUEwaiAGTQRAIAAhAgwEC0GIIigCACICIAMgBmtqQQAgAmtxIgIQAUF/Rg0BIAIgBmohBiAAIQIMAwsgAkF/Rw0CC0HkIUHkISgCAEEEcjYCAAsgARABIQJBABABIQAgAkF/Rg0FIABBf0YNBSAAIAJNDQUgACACayIGIAVBKGpNDQULQdghQdghKAIAIAZqIgA2AgBB3CEoAgAgAEkEQEHcISAANgIACwJAQcAeKAIAIgMEQEHoISEAA0AgAiAAKAIAIgEgACgCBCIEakYNAiAAKAIIIgANAAsMBAtBuB4oAgAiAEEAIAAgAk0bRQRAQbgeIAI2AgALQQAhAEHsISAGNgIAQeghIAI2AgBByB5BfzYCAEHMHkGAIigCADYCAEH0IUEANgIAA0AgAEEDdCIBQdgeaiABQdAeaiIENgIAIAFB3B5qIAQ2AgAgAEEBaiIAQSBHDQALQbQeIAZBKGsiAEF4IAJrQQdxIgFrIgQ2AgBBwB4gASACaiIBNgIAIAEgBEEBcjYCBCAAIAJqQSg2AgRBxB5BkCIoAgA2AgAMBAsgAiADTQ0CIAEgA0sNAiAAKAIMQQhxDQIgACAEIAZqNgIEQcAeIANBeCADa0EHcSIAaiIBNgIAQbQeQbQeKAIAIAZqIgIgAGsiADYCACABIABBAXI2AgQgAiADakEoNgIEQcQeQZAiKAIANgIADAMLQQAhBAwKC0EAIQIMCAtBuB4oAgAgAksEQEG4HiACNgIACyACIAZqIQFB6CEhAAJAAkACQANAIAEgACgCAEcEQCAAKAIIIgANAQwCCwsgAC0ADEEIcUUNAQtB6CEhAANAIAMgACgCACIBTwRAIAEgACgCBGoiBCADSw0DCyAAKAIIIQAMAAsACyAAIAI2AgAgACAAKAIEIAZqNgIEIAJBeCACa0EHcWoiByAFQQNyNgIEIAFBeCABa0EHcWoiBiAFIAdqIgVrIQAgAyAGRgRAQcAeIAU2AgBBtB5BtB4oAgAgAGoiADYCACAFIABBAXI2AgQMCAtBvB4oAgAgBkYEQEG8HiAFNgIAQbAeQbAeKAIAIABqIgA2AgAgBSAAQQFyNgIEIAAgBWogADYCAAwICyAGKAIEIgNBA3FBAUcNBiADQXhxIQkgA0H/AU0EQCAGKAIMIgEgBigCCCICRgRAQageQageKAIAQX4gA0EDdndxNgIADAcLIAIgATYCDCABIAI2AggMBgsgBigCGCEIIAYgBigCDCICRwRAIAYoAggiASACNgIMIAIgATYCCAwFCyAGQRRqIgEoAgAiA0UEQCAGKAIQIgNFDQQgBkEQaiEBCwNAIAEhBCADIgJBFGoiASgCACIDDQAgAkEQaiEBIAIoAhAiAw0ACyAEQQA2AgAMBAtBtB4gBkEoayIAQXggAmtBB3EiAWsiCDYCAEHAHiABIAJqIgE2AgAgASAIQQFyNgIEIAAgAmpBKDYCBEHEHkGQIigCADYCACADIARBJyAEa0EHcWpBL2siACAAIANBEGpJGyIBQRs2AgQgAUHwISkCADcCECABQeghKQIANwIIQfAhIAFBCGo2AgBB7CEgBjYCAEHoISACNgIAQfQhQQA2AgAgAUEYaiEAA0AgAEEHNgIEIABBCGohAiAAQQRqIQAgAiAESQ0ACyABIANGDQAgASABKAIEQX5xNgIEIAMgASADayICQQFyNgIEIAEgAjYCACACQf8BTQRAIAJBeHFB0B5qIQACf0GoHigCACIBQQEgAkEDdnQiAnFFBEBBqB4gASACcjYCACAADAELIAAoAggLIQEgACADNgIIIAEgAzYCDCADIAA2AgwgAyABNgIIDAELQR8hACACQf///wdNBEAgAkEmIAJBCHZnIgBrdkEBcSAAQQF0a0E+aiEACyADIAA2AhwgA0IANwIQIABBAnRB2CBqIQECQAJAQaweKAIAIgRBASAAdCIGcUUEQEGsHiAEIAZyNgIAIAEgAzYCAAwBCyACQRkgAEEBdmtBACAAQR9HG3QhACABKAIAIQQDQCAEIgEoAgRBeHEgAkYNAiAAQR12IQQgAEEBdCEAIAEgBEEEcWoiBigCECIEDQALIAYgAzYCEAsgAyABNgIYIAMgAzYCDCADIAM2AggMAQsgASgCCCIAIAM2AgwgASADNgIIIANBADYCGCADIAE2AgwgAyAANgIIC0G0HigCACIAIAVNDQBBtB4gACAFayIBNgIAQcAeQcAeKAIAIgAgBWoiAjYCACACIAFBAXI2AgQgACAFQQNyNgIEIABBCGohAAwIC0GkHkEwNgIAQQAhAAwHC0EAIQILIAhFDQACQCAGKAIcIgFBAnRB2CBqIgQoAgAgBkYEQCAEIAI2AgAgAg0BQaweQaweKAIAQX4gAXdxNgIADAILIAhBEEEUIAgoAhAgBkYbaiACNgIAIAJFDQELIAIgCDYCGCAGKAIQIgEEQCACIAE2AhAgASACNgIYCyAGKAIUIgFFDQAgAiABNgIUIAEgAjYCGAsgACAJaiEAIAYgCWoiBigCBCEDCyAGIANBfnE2AgQgBSAAQQFyNgIEIAAgBWogADYCACAAQf8BTQRAIABBeHFB0B5qIQECf0GoHigCACICQQEgAEEDdnQiAHFFBEBBqB4gACACcjYCACABDAELIAEoAggLIQAgASAFNgIIIAAgBTYCDCAFIAE2AgwgBSAANgIIDAELQR8hAyAAQf///wdNBEAgAEEmIABBCHZnIgFrdkEBcSABQQF0a0E+aiEDCyAFIAM2AhwgBUIANwIQIANBAnRB2CBqIQECQAJAQaweKAIAIgJBASADdCIEcUUEQEGsHiACIARyNgIAIAEgBTYCAAwBCyAAQRkgA0EBdmtBACADQR9HG3QhAyABKAIAIQIDQCACIgEoAgRBeHEgAEYNAiADQR12IQIgA0EBdCEDIAEgAkEEcWoiBCgCECICDQALIAQgBTYCEAsgBSABNgIYIAUgBTYCDCAFIAU2AggMAQsgASgCCCIAIAU2AgwgASAFNgIIIAVBADYCGCAFIAE2AgwgBSAANgIICyAHQQhqIQAMAgsCQCAHRQ0AAkAgBCgCHCIAQQJ0QdggaiIBKAIAIARGBEAgASACNgIAIAINAUGsHiAIQX4gAHdxIgg2AgAMAgsgB0EQQRQgBygCECAERhtqIAI2AgAgAkUNAQsgAiAHNgIYIAQoAhAiAARAIAIgADYCECAAIAI2AhgLIAQoAhQiAEUNACACIAA2AhQgACACNgIYCwJAIANBD00EQCAEIAMgBWoiAEEDcjYCBCAAIARqIgAgACgCBEEBcjYCBAwBCyAEIAVBA3I2AgQgBCAFaiICIANBAXI2AgQgAiADaiADNgIAIANB/wFNBEAgA0F4cUHQHmohAAJ/QageKAIAIgFBASADQQN2dCIDcUUEQEGoHiABIANyNgIAIAAMAQsgACgCCAshASAAIAI2AgggASACNgIMIAIgADYCDCACIAE2AggMAQtBHyEAIANB////B00EQCADQSYgA0EIdmciAGt2QQFxIABBAXRrQT5qIQALIAIgADYCHCACQgA3AhAgAEECdEHYIGohAQJAAkAgCEEBIAB0IgZxRQRAQaweIAYgCHI2AgAgASACNgIADAELIANBGSAAQQF2a0EAIABBH0cbdCEAIAEoAgAhBQNAIAUiASgCBEF4cSADRg0CIABBHXYhBiAAQQF0IQAgASAGQQRxaiIGKAIQIgUNAAsgBiACNgIQCyACIAE2AhggAiACNgIMIAIgAjYCCAwBCyABKAIIIgAgAjYCDCABIAI2AgggAkEANgIYIAIgATYCDCACIAA2AggLIARBCGohAAwBCwJAIAlFDQACQCACKAIcIgBBAnRB2CBqIgEoAgAgAkYEQCABIAQ2AgAgBA0BQaweIAtBfiAAd3E2AgAMAgsgCUEQQRQgCSgCECACRhtqIAQ2AgAgBEUNAQsgBCAJNgIYIAIoAhAiAARAIAQgADYCECAAIAQ2AhgLIAIoAhQiAEUNACAEIAA2AhQgACAENgIYCwJAIANBD00EQCACIAMgBWoiAEEDcjYCBCAAIAJqIgAgACgCBEEBcjYCBAwBCyACIAVBA3I2AgQgAiAFaiIEIANBAXI2AgQgAyAEaiADNgIAIAcEQCAHQXhxQdAeaiEAQbweKAIAIQECf0EBIAdBA3Z0IgUgBnFFBEBBqB4gBSAGcjYCACAADAELIAAoAggLIQYgACABNgIIIAYgATYCDCABIAA2AgwgASAGNgIIC0G8HiAENgIAQbAeIAM2AgALIAJBCGohAAsgCkEQaiQAIAALAwABC8EBAQJ/IwBBEGsiASQAAnwgAL1CIIinQf////8HcSICQfvDpP8DTQRARAAAAAAAAPA/IAJBnsGa8gNJDQEaIABEAAAAAAAAAAAQAwwBCyAAIAChIAJBgIDA/wdPDQAaAkACQAJAAkAgACABEAlBA3EOAwABAgMLIAErAwAgASsDCBADDAMLIAErAwAgASsDCEEBEAKaDAILIAErAwAgASsDCBADmgwBCyABKwMAIAErAwhBARACCyEAIAFBEGokACAAC7gYAxR/BHwBfiMAQTBrIggkAAJAAkACQCAAvSIaQiCIpyIDQf////8HcSIGQfrUvYAETQRAIANB//8/cUH7wyRGDQEgBkH8souABE0EQCAaQgBZBEAgASAARAAAQFT7Ifm/oCIARDFjYhphtNC9oCIWOQMAIAEgACAWoUQxY2IaYbTQvaA5AwhBASEDDAULIAEgAEQAAEBU+yH5P6AiAEQxY2IaYbTQPaAiFjkDACABIAAgFqFEMWNiGmG00D2gOQMIQX8hAwwECyAaQgBZBEAgASAARAAAQFT7IQnAoCIARDFjYhphtOC9oCIWOQMAIAEgACAWoUQxY2IaYbTgvaA5AwhBAiEDDAQLIAEgAEQAAEBU+yEJQKAiAEQxY2IaYbTgPaAiFjkDACABIAAgFqFEMWNiGmG04D2gOQMIQX4hAwwDCyAGQbuM8YAETQRAIAZBvPvXgARNBEAgBkH8ssuABEYNAiAaQgBZBEAgASAARAAAMH982RLAoCIARMqUk6eRDum9oCIWOQMAIAEgACAWoUTKlJOnkQ7pvaA5AwhBAyEDDAULIAEgAEQAADB/fNkSQKAiAETKlJOnkQ7pPaAiFjkDACABIAAgFqFEypSTp5EO6T2gOQMIQX0hAwwECyAGQfvD5IAERg0BIBpCAFkEQCABIABEAABAVPshGcCgIgBEMWNiGmG08L2gIhY5AwAgASAAIBahRDFjYhphtPC9oDkDCEEEIQMMBAsgASAARAAAQFT7IRlAoCIARDFjYhphtPA9oCIWOQMAIAEgACAWoUQxY2IaYbTwPaA5AwhBfCEDDAMLIAZB+sPkiQRLDQELIAAgAESDyMltMF/kP6JEAAAAAAAAOEOgRAAAAAAAADjDoCIXRAAAQFT7Ifm/oqAiFiAXRDFjYhphtNA9oiIYoSIZRBgtRFT7Iem/YyECAn8gF5lEAAAAAAAA4EFjBEAgF6oMAQtBgICAgHgLIQMCQCACBEAgA0EBayEDIBdEAAAAAAAA8L+gIhdEMWNiGmG00D2iIRggACAXRAAAQFT7Ifm/oqAhFgwBCyAZRBgtRFT7Iek/ZEUNACADQQFqIQMgF0QAAAAAAADwP6AiF0QxY2IaYbTQPaIhGCAAIBdEAABAVPsh+b+ioCEWCyABIBYgGKEiADkDAAJAIAZBFHYiAiAAvUI0iKdB/w9xa0ERSA0AIAEgFiAXRAAAYBphtNA9oiIAoSIZIBdEc3ADLooZozuiIBYgGaEgAKGhIhihIgA5AwAgAiAAvUI0iKdB/w9xa0EySARAIBkhFgwBCyABIBkgF0QAAAAuihmjO6IiAKEiFiAXRMFJICWag3s5oiAZIBahIAChoSIYoSIAOQMACyABIBYgAKEgGKE5AwgMAQsgBkGAgMD/B08EQCABIAAgAKEiADkDACABIAA5AwhBACEDDAELIBpC/////////weDQoCAgICAgICwwQCEvyEAQQAhA0EBIQIDQCAIQRBqIANBA3RqAn8gAJlEAAAAAAAA4EFjBEAgAKoMAQtBgICAgHgLtyIWOQMAIAAgFqFEAAAAAAAAcEGiIQBBASEDIAIhBEEAIQIgBA0ACyAIIAA5AyBBAiEDA0AgAyICQQFrIQMgCEEQaiACQQN0aisDAEQAAAAAAAAAAGENAAsgCEEQaiEPQQAhBCMAQbAEayIFJAAgBkEUdkGWCGsiA0EDa0EYbSIGQQAgBkEAShsiEEFobCADaiEGQYQIKAIAIgkgAkEBaiIKQQFrIgdqQQBOBEAgCSAKaiEDIBAgB2shAgNAIAVBwAJqIARBA3RqIAJBAEgEfEQAAAAAAAAAAAUgAkECdEGQCGooAgC3CzkDACACQQFqIQIgBEEBaiIEIANHDQALCyAGQRhrIQtBACEDIAlBACAJQQBKGyEEIApBAEwhDANAAkAgDARARAAAAAAAAAAAIQAMAQsgAyAHaiEOQQAhAkQAAAAAAAAAACEAA0AgDyACQQN0aisDACAFQcACaiAOIAJrQQN0aisDAKIgAKAhACACQQFqIgIgCkcNAAsLIAUgA0EDdGogADkDACADIARGIQIgA0EBaiEDIAJFDQALQS8gBmshEkEwIAZrIQ4gBkEZayETIAkhAwJAA0AgBSADQQN0aisDACEAQQAhAiADIQQgA0EATCINRQRAA0AgBUHgA2ogAkECdGoCfwJ/IABEAAAAAAAAcD6iIhaZRAAAAAAAAOBBYwRAIBaqDAELQYCAgIB4C7ciFkQAAAAAAABwwaIgAKAiAJlEAAAAAAAA4EFjBEAgAKoMAQtBgICAgHgLNgIAIAUgBEEBayIEQQN0aisDACAWoCEAIAJBAWoiAiADRw0ACwsCfyAAIAsQBCIAIABEAAAAAAAAwD+inEQAAAAAAAAgwKKgIgCZRAAAAAAAAOBBYwRAIACqDAELQYCAgIB4CyEHIAAgB7ehIQACQAJAAkACfyALQQBMIhRFBEAgA0ECdCAFaiICIAIoAtwDIgIgAiAOdSICIA50ayIENgLcAyACIAdqIQcgBCASdQwBCyALDQEgA0ECdCAFaigC3ANBF3ULIgxBAEwNAgwBC0ECIQwgAEQAAAAAAADgP2YNAEEAIQwMAQtBACECQQAhBCANRQRAA0AgBUHgA2ogAkECdGoiFSgCACENQf///wchEQJ/AkAgBA0AQYCAgAghESANDQBBAAwBCyAVIBEgDWs2AgBBAQshBCACQQFqIgIgA0cNAAsLAkAgFA0AQf///wMhAgJAAkAgEw4CAQACC0H///8BIQILIANBAnQgBWoiDSANKALcAyACcTYC3AMLIAdBAWohByAMQQJHDQBEAAAAAAAA8D8gAKEhAEECIQwgBEUNACAARAAAAAAAAPA/IAsQBKEhAAsgAEQAAAAAAAAAAGEEQEEAIQQgAyECAkAgAyAJTA0AA0AgBUHgA2ogAkEBayICQQJ0aigCACAEciEEIAIgCUoNAAsgBEUNACALIQYDQCAGQRhrIQYgBUHgA2ogA0EBayIDQQJ0aigCAEUNAAsMAwtBASECA0AgAiIEQQFqIQIgBUHgA2ogCSAEa0ECdGooAgBFDQALIAMgBGohBANAIAVBwAJqIAMgCmoiB0EDdGogA0EBaiIDIBBqQQJ0QZAIaigCALc5AwBBACECRAAAAAAAAAAAIQAgCkEASgRAA0AgDyACQQN0aisDACAFQcACaiAHIAJrQQN0aisDAKIgAKAhACACQQFqIgIgCkcNAAsLIAUgA0EDdGogADkDACADIARIDQALIAQhAwwBCwsCQCAAQRggBmsQBCIARAAAAAAAAHBBZgRAIAVB4ANqIANBAnRqAn8CfyAARAAAAAAAAHA+oiIWmUQAAAAAAADgQWMEQCAWqgwBC0GAgICAeAsiArdEAAAAAAAAcMGiIACgIgCZRAAAAAAAAOBBYwRAIACqDAELQYCAgIB4CzYCACADQQFqIQMMAQsCfyAAmUQAAAAAAADgQWMEQCAAqgwBC0GAgICAeAshAiALIQYLIAVB4ANqIANBAnRqIAI2AgALRAAAAAAAAPA/IAYQBCEAAkAgA0EASA0AIAMhAgNAIAUgAiIEQQN0aiAAIAVB4ANqIAJBAnRqKAIAt6I5AwAgAkEBayECIABEAAAAAAAAcD6iIQAgBA0ACyADQQBIDQAgAyEEA0BEAAAAAAAAAAAhAEEAIQIgCSADIARrIgYgBiAJShsiC0EATgRAA0AgAkEDdEHgHWorAwAgBSACIARqQQN0aisDAKIgAKAhACACIAtHIQogAkEBaiECIAoNAAsLIAVBoAFqIAZBA3RqIAA5AwAgBEEASiECIARBAWshBCACDQALC0QAAAAAAAAAACEAIANBAE4EQCADIQIDQCACIgRBAWshAiAAIAVBoAFqIARBA3RqKwMAoCEAIAQNAAsLIAggAJogACAMGzkDACAFKwOgASAAoSEAQQEhAiADQQBKBEADQCAAIAVBoAFqIAJBA3RqKwMAoCEAIAIgA0chBCACQQFqIQIgBA0ACwsgCCAAmiAAIAwbOQMIIAVBsARqJAAgB0EHcSEDIAgrAwAhACAaQgBTBEAgASAAmjkDACABIAgrAwiaOQMIQQAgA2shAwwBCyABIAA5AwAgASAIKwMIOQMICyAIQTBqJAAgAwvJEQMOfxx9AX4gACADKAIEIgUgAygCACIHbEEDdGohBgJAIAVBAUYEQCACQQN0IQggACEDA0AgAyABKQIANwIAIAEgCGohASADQQhqIgMgBkcNAAsMAQsgA0EIaiEIIAIgB2whCSAAIQMDQCADIAEgCSAIIAQQCiABIAJBA3RqIQEgAyAFQQN0aiIDIAZHDQALCwJAAkACQAJAAkACQCAHQQJrDgQAAQIDBAsgBEHYAGohAyAAIAVBA3RqIQEDQCABIAAqAgAgASoCACITIAMqAgAiFZQgAyoCBCIUIAEqAgQiFpSTIheTOAIAIAEgACoCBCATIBSUIBUgFpSSIhOTOAIEIAAgFyAAKgIAkjgCACAAIBMgACoCBJI4AgQgAEEIaiEAIAFBCGohASADIAJBA3RqIQMgBUEBayIFDQALDAQLIARB2ABqIgMgAiAFbEEDdGoqAgQhEyAFQQR0IQggAkEEdCEJIAMhBiAFIQQDQCAAIAVBA3RqIgEgACoCALsgASoCACIVIAYqAgAiFJQgBioCBCIWIAEqAgQiF5STIhggACAIaiIHKgIAIhkgAyoCACIelCADKgIEIhwgByoCBCIdlJMiGpIiG7tEAAAAAAAA4D+iobY4AgAgASAAKgIEuyAVIBaUIBQgF5SSIhUgGSAclCAeIB2UkiIUkiIWu0QAAAAAAADgP6KhtjgCBCAAIBsgACoCAJI4AgAgACAWIAAqAgSSOAIEIAcgEyAVIBSTlCIVIAEqAgCSOAIAIAcgASoCBCATIBggGpOUIhSTOAIEIAEgASoCACAVkzgCACABIBQgASoCBJI4AgQgAEEIaiEAIAMgCWohAyAGIAJBA3RqIQYgBEEBayIEDQALDAMLIAQoAgQhCyAFQQR0IQogBUEYbCEMIAJBGGwhDSACQQR0IQ4gBEHYAGoiASEDIAUhBCABIQYDQCAAIAVBA3RqIgcqAgAhEyAHKgIEIRUgACAMaiIIKgIAIRQgCCoCBCEWIAYqAgQhFyAGKgIAIRggASoCBCEZIAEqAgAhHiAAIAAgCmoiCSoCACIcIAMqAgQiHZQgAyoCACIaIAkqAgQiG5SSIiEgACoCBCIgkiIfOAIEIAAgHCAalCAdIBuUkyIcIAAqAgAiHZIiGjgCACAJIB8gEyAXlCAYIBWUkiIbIBQgGZQgHiAWlJIiH5IiIpM4AgQgCSAaIBMgGJQgFyAVlJMiEyAUIB6UIBkgFpSTIhSSIhWTOAIAIAAgFSAAKgIAkjgCACAAICIgACoCBJI4AgQgGyAfkyEVIBMgFJMhEyAgICGTIRQgHSAckyEWIAEgDWohASADIA5qIQMgBiACQQN0aiEGIAcCfSALBEAgFCATkyEXIBYgFZIhGCAUIBOSIRMgFiAVkwwBCyAUIBOSIRcgFiAVkyEYIBQgE5MhEyAWIBWSCzgCACAHIBM4AgQgCCAYOAIAIAggFzgCBCAAQQhqIQAgBEEBayIEDQALDAILIAVBAEwNASAEQdgAaiIHIAIgBWwiAUEEdGoiAyoCBCETIAMqAgAhFSAHIAFBA3RqIgEqAgQhFCABKgIAIRYgAkEDbCELIAAgBUEDdGohASAAIAVBBHRqIQMgACAFQRhsaiEGIAAgBUEFdGohBEEAIQgDQCAAKgIAIRcgACAAKgIEIhggAyoCACIcIAcgAiAIbCIJQQR0aiIKKgIEIh2UIAoqAgAiGiADKgIEIhuUkiIhIAYqAgAiICAHIAggC2xBA3RqIgoqAgQiH5QgCioCACIiIAYqAgQiI5SSIiSSIhkgASoCACIlIAcgCUEDdGoiCioCBCImlCAKKgIAIicgASoCBCIolJIiKSAEKgIAIiogByAJQQV0aiIJKgIEIiuUIAkqAgAiLCAEKgIEIi2UkiIukiIekpI4AgQgACAXIBwgGpQgHSAblJMiGiAgICKUIB8gI5STIhuSIhwgJSAnlCAmICiUkyIgICogLJQgKyAtlJMiH5IiHZKSOAIAIAEgGSAVlCAYIB4gFpSSkiIiICAgH5MiIIwgFJQgEyAaIBuTIhqUkyIbkzgCBCABIBwgFZQgFyAdIBaUkpIiHyApIC6TIiMgFJQgEyAhICSTIiGUkiIkkzgCACAEICIgG5I4AgQgBCAkIB+SOAIAIAMgGSAWlCAYIB4gFZSSkiIYICAgE5QgFCAalJMiGZI4AgQgAyAUICGUICMgE5STIh4gHCAWlCAXIB0gFZSSkiIXkjgCACAGIBggGZM4AgQgBiAXIB6TOAIAIARBCGohBCAGQQhqIQYgA0EIaiEDIAFBCGohASAAQQhqIQAgCEEBaiIIIAVHDQALDAELIAQoAgAhCyAHQQN0EAYhCAJAIAdBAkgNACAFQQBMDQAgBEHYAGohDSAHQXxxIQ4gB0EDcSEKIAdBAWtBA0khD0EAIQYDQCAGIQFBACEDQQAhBCAPRQRAA0AgCCADQQN0IglqIAAgAUEDdGopAgA3AgAgCCAJQQhyaiAAIAEgBWoiAUEDdGopAgA3AgAgCCAJQRByaiAAIAEgBWoiAUEDdGopAgA3AgAgCCAJQRhyaiAAIAEgBWoiAUEDdGopAgA3AgAgA0EEaiEDIAEgBWohASAEQQRqIgQgDkcNAAsLQQAhBCAKBEADQCAIIANBA3RqIAAgAUEDdGopAgA3AgAgA0EBaiEDIAEgBWohASAEQQFqIgQgCkcNAAsLIAgpAgAiL6e+IRVBACEMIAYhBANAIAAgBEEDdGoiCSAvNwIAIAIgBGwhECAJKgIEIRRBASEBIBUhE0EAIQMDQCAJIBMgCCABQQN0aiIRKgIAIhYgDSADIBBqIgMgC0EAIAMgC04bayIDQQN0aiISKgIAIheUIBIqAgQiGCARKgIEIhmUk5IiEzgCACAJIBQgFiAYlCAXIBmUkpIiFDgCBCABQQFqIgEgB0cNAAsgBCAFaiEEIAxBAWoiDCAHRw0ACyAGQQFqIgYgBUcNAAsLIAgQBQsLxQEBAn8jAEEQayIBJAACQCAAvUIgiKdB/////wdxIgJB+8Ok/wNNBEAgAkGAgMDyA0kNASAARAAAAAAAAAAAQQAQAiEADAELIAJBgIDA/wdPBEAgACAAoSEADAELAkACQAJAAkAgACABEAlBA3EOAwABAgMLIAErAwAgASsDCEEBEAIhAAwDCyABKwMAIAErAwgQAyEADAILIAErAwAgASsDCEEBEAKaIQAMAQsgASsDACABKwMIEAOaIQALIAFBEGokACAACxEAIAIgAUEBIABBCGogABAKC+YCAgJ/AnwgAEEDdEHYAGohBQJAIANFBEAgBRAGIQQMAQsgAgR/IAJBACADKAIAIAVPGwVBAAshBCADIAU2AgALIAQEQCAEIAE2AgQgBCAANgIAIAC3IQYCQCAAQQBMDQAgBEHYAGohAkEAIQMgAUUEQANAIAIgA0EDdGoiASADt0QYLURU+yEZwKIgBqMiBxALtjgCBCABIAcQCLY4AgAgA0EBaiIDIABHDQAMAgsACwNAIAIgA0EDdGoiASADt0QYLURU+yEZQKIgBqMiBxALtjgCBCABIAcQCLY4AgAgA0EBaiIDIABHDQALCyAEQQhqIQIgBp+cIQZBBCEBA0AgACABbwRAA0BBAiEDAkACQAJAIAFBAmsOAwABAgELQQMhAwwBCyABQQJqIQMLIAAgACADIAYgA7djGyIBbw0ACwsgAiABNgIAIAIgACABbSIANgIEIAJBCGohAiAAQQFKDQALCyAECxAAIwAgAGtBcHEiACQAIAALBgAgACQACwQAIwALBgAgABAFCwurFgMAQYAIC9cVAwAAAAQAAAAEAAAABgAAAIP5ogBETm4A/CkVANFXJwDdNPUAYtvAADyZlQBBkEMAY1H+ALveqwC3YcUAOm4kANJNQgBJBuAACeouAByS0QDrHf4AKbEcAOg+pwD1NYIARLsuAJzphAC0JnAAQX5fANaROQBTgzkAnPQ5AItfhAAo+b0A+B87AN7/lwAPmAUAES/vAApaiwBtH20Az342AAnLJwBGT7cAnmY/AC3qXwC6J3UA5evHAD178QD3OQcAklKKAPtr6gAfsV8ACF2NADADVgB7/EYA8KtrACC8zwA29JoA46kdAF5hkQAIG+YAhZllAKAUXwCNQGgAgNj/ACdzTQAGBjEAylYVAMmocwB74mAAa4zAABnERwDNZ8MACejcAFmDKgCLdsQAphyWAESv3QAZV9EApT4FAAUH/wAzfj8AwjLoAJhP3gC7fTIAJj3DAB5r7wCf+F4ANR86AH/yygDxhx0AfJAhAGokfADVbvoAMC13ABU7QwC1FMYAwxmdAK3EwgAsTUEADABdAIZ9RgDjcS0Am8aaADNiAAC00nwAtKeXADdV1QDXPvYAoxAYAE12/ABknSoAcNerAGN8+AB6sFcAFxXnAMBJVgA71tkAp4Q4ACQjywDWincAWlQjAAAfuQDxChsAGc7fAJ8x/wBmHmoAmVdhAKz7RwB+f9gAImW3ADLoiQDmv2AA78TNAGw2CQBdP9QAFt7XAFg73gDem5IA0iIoACiG6ADiWE0AxsoyAAjjFgDgfcsAF8BQAPMdpwAY4FsALhM0AIMSYgCDSAEA9Y5bAK2wfwAe6fIASEpDABBn0wCq3dgArl9CAGphzgAKKKQA05m0AAam8gBcd38Ao8KDAGE8iACKc3gAr4xaAG/XvQAtpmMA9L/LAI2B7wAmwWcAVcpFAMrZNgAoqNIAwmGNABLJdwAEJhQAEkabAMRZxADIxUQATbKRAAAX8wDUQ60AKUnlAP3VEAAAvvwAHpTMAHDO7gATPvUA7PGAALPnwwDH+CgAkwWUAMFxPgAuCbMAC0XzAIgSnACrIHsALrWfAEeSwgB7Mi8ADFVtAHKnkABr5x8AMcuWAHkWSgBBeeIA9N+JAOiUlwDi5oQAmTGXAIjtawBfXzYAu/0OAEiatABnpGwAcXJCAI1dMgCfFbgAvOUJAI0xJQD3dDkAMAUcAA0MAQBLCGgALO5YAEeqkAB05wIAvdYkAPd9pgBuSHIAnxbvAI6UpgC0kfYA0VNRAM8K8gAgmDMA9Ut+ALJjaADdPl8AQF0DAIWJfwBVUikAN2TAAG3YEAAySDIAW0x1AE5x1ABFVG4ACwnBACr1aQAUZtUAJwedAF0EUAC0O9sA6nbFAIf5FwBJa30AHSe6AJZpKQDGzKwArRRUAJDiagCI2YkALHJQAASkvgB3B5QA8zBwAAD8JwDqcagAZsJJAGTgPQCX3YMAoz+XAEOU/QANhowAMUHeAJI5nQDdcIwAF7fnAAjfOwAVNysAXICgAFqAkwAQEZIAD+jYAGyArwDb/0sAOJAPAFkYdgBipRUAYcu7AMeJuQAQQL0A0vIEAEl1JwDrtvYA2yK7AAoUqgCJJi8AZIN2AAk7MwAOlBoAUTqqAB2jwgCv7a4AXCYSAG3CTQAtepwAwFaXAAM/gwAJ8PYAK0CMAG0xmQA5tAcADCAVANjDWwD1ksQAxq1LAE7KpQCnN80A5qk2AKuSlADdQmgAGWPeAHaM7wBoi1IA/Ns3AK6hqwDfFTEAAK6hAAz72gBkTWYA7QW3ACllMABXVr8AR/86AGr5uQB1vvMAKJPfAKuAMABmjPYABMsVAPoiBgDZ5B0APbOkAFcbjwA2zQkATkLpABO+pAAzI7UA8KoaAE9lqADSwaUACz8PAFt4zQAj+XYAe4sEAIkXcgDGplMAb27iAO/rAACbSlgAxNq3AKpmugB2z88A0QIdALHxLQCMmcEAw613AIZI2gD3XaAAxoD0AKzwLwDd7JoAP1y8ANDebQCQxx8AKtu2AKMlOgAAr5oArVOTALZXBAApLbQAS4B+ANoHpwB2qg4Ae1mhABYSKgDcty0A+uX9AInb/gCJvv0A5HZsAAap/AA+gHAAhW4VAP2H/wAoPgcAYWczACoYhgBNveoAs+evAI9tbgCVZzkAMb9bAITXSAAw3xYAxy1DACVhNQDJcM4AMMu4AL9s/QCkAKIABWzkAFrdoAAhb0cAYhLSALlchABwYUkAa1bgAJlSAQBQVTcAHtW3ADPxxAATbl8AXTDkAIUuqQAdssMAoTI2AAi3pADqsdQAFvchAI9p5AAn/3cADAOAAI1ALQBPzaAAIKWZALOi0wAvXQoAtPlCABHaywB9vtAAm9vBAKsXvQDKooEACGpcAC5VFwAnAFUAfxTwAOEHhgAUC2QAlkGNAIe+3gDa/SoAayW2AHuJNAAF8/4Aub+eAGhqTwBKKqgAT8RaAC34vADXWpgA9MeVAA1NjQAgOqYApFdfABQ/sQCAOJUAzCABAHHdhgDJ3rYAv2D1AE1lEQABB2sAjLCsALLA0ABRVUgAHvsOAJVywwCjBjsAwEA1AAbcewDgRcwATin6ANbKyADo80EAfGTeAJtk2ADZvjEApJfDAHdY1ABp48UA8NoTALo6PABGGEYAVXVfANK99QBuksYArC5dAA5E7QAcPkIAYcSHACn96QDn1vMAInzKAG+RNQAI4MUA/9eNAG5q4gCw/cYAkwjBAHxddABrrbIAzW6dAD5yewDGEWoA98+pAClz3wC1yboAtwBRAOKyDQB0uiQA5X1gAHTYigANFSwAgRgMAH5mlAABKRYAn3p2AP39vgBWRe8A2X42AOzZEwCLurkAxJf8ADGoJwDxbsMAlMU2ANioVgC0qLUAz8wOABKJLQBvVzQALFaJAJnO4wDWILkAa16qAD4qnAARX8wA/QtKAOH0+wCOO20A4oYsAOnUhAD8tKkA7+7RAC41yQAvOWEAOCFEABvZyACB/AoA+0pqAC8c2ABTtIQATpmMAFQizAAqVdwAwMbWAAsZlgAacLgAaZVkACZaYAA/Uu4AfxEPAPS1EQD8y/UANLwtADS87gDoXcwA3V5gAGeOmwCSM+8AyRe4AGFYmwDhV7wAUYPGANg+EADdcUgALRzdAK8YoQAhLEYAWfPXANl6mACeVMAAT4b6AFYG/ADlea4AiSI2ADitIgBnk9wAVeiqAIImOADK55sAUQ2kAJkzsQCp1w4AaQVIAGWy8AB/iKcAiEyXAPnRNgAhkrMAe4JKAJjPIQBAn9wA3EdVAOF0OgBn60IA/p3fAF7UXwB7Z6QAuqx6AFX2ogAriCMAQbpVAFluCAAhKoYAOUeDAInj5gDlntQASftAAP9W6QAcD8oAxVmKAJT6KwDTwcUAD8XPANtargBHxYYAhUNiACGGOwAseZQAEGGHACpMewCALBoAQ78SAIgmkAB4PIkAqMTkAOXbewDEOsIAJvTqAPdnigANkr8AZaMrAD2TsQC9fAsApFHcACfdYwBp4d0AmpQZAKgplQBozigACe20AESfIABOmMoAcIJjAH58IwAPuTIAp/WOABRW5wAh8QgAtZ0qAG9+TQClGVEAtfmrAILf1gCW3WEAFjYCAMQ6nwCDoqEAcu1tADmNegCCuKkAazJcAEYnWwAANO0A0gB3APz0VQABWU0A4HGAAEHjHQs9QPsh+T8AAAAALUR0PgAAAICYRvg8AAAAYFHMeDsAAACAgxvwOQAAAEAgJXo4AAAAgCKC4zYAAAAAHfNpNQBBoB4LAyARAQ==";
          if (!isDataURI(wasmBinaryFile)) {
            wasmBinaryFile = locateFile(wasmBinaryFile);
          }
          function getBinarySync(file) {
            if (file == wasmBinaryFile && wasmBinary) {
              return new Uint8Array(wasmBinary);
            }
            var binary = tryParseAsDataURI(file);
            if (binary) {
              return binary;
            }
            if (readBinary) {
              return readBinary(file);
            }
            throw "sync fetching of the wasm failed: you can preload it to Module['wasmBinary'] manually, or emcc.py will do that for you when generating HTML (but not JS)";
          }
          function instantiateSync(file, info) {
            var module;
            var binary = getBinarySync(file);
            module = new WebAssembly.Module(binary);
            var instance = new WebAssembly.Instance(module, info);
            return [instance, module];
          }
          function createWasm() {
            var info = { "a": wasmImports };
            function receiveInstance(instance, module) {
              var exports = instance.exports;
              wasmExports = exports;
              wasmMemory = wasmExports["b"];
              updateMemoryViews();
              wasmTable = wasmExports["i"];
              addOnInit(wasmExports["c"]);
              removeRunDependency("wasm-instantiate");
              return exports;
            }
            addRunDependency("wasm-instantiate");
            if (Module["instantiateWasm"]) {
              try {
                return Module["instantiateWasm"](info, receiveInstance);
              } catch (e) {
                err("Module.instantiateWasm callback failed with error: " + e);
                readyPromiseReject(e);
              }
            }
            var result = instantiateSync(wasmBinaryFile, info);
            return receiveInstance(result[0]);
          }
          var callRuntimeCallbacks = (callbacks) => {
            while (callbacks.length > 0) {
              callbacks.shift()(Module);
            }
          };
          var abortOnCannotGrowMemory = (requestedSize) => {
            abort("OOM");
          };
          var _emscripten_resize_heap = (requestedSize) => {
            var oldSize = HEAPU8.length;
            requestedSize >>>= 0;
            abortOnCannotGrowMemory(requestedSize);
          };
          function getCFunc(ident) {
            var func = Module["_" + ident];
            return func;
          }
          var writeArrayToMemory = (array, buffer) => {
            HEAP8.set(array, buffer);
          };
          var lengthBytesUTF8 = (str) => {
            var len = 0;
            for (var i = 0; i < str.length; ++i) {
              var c = str.charCodeAt(i);
              if (c <= 127) {
                len++;
              } else if (c <= 2047) {
                len += 2;
              } else if (c >= 55296 && c <= 57343) {
                len += 4;
                ++i;
              } else {
                len += 3;
              }
            }
            return len;
          };
          var stringToUTF8Array = (str, heap, outIdx, maxBytesToWrite) => {
            if (!(maxBytesToWrite > 0)) return 0;
            var startIdx = outIdx;
            var endIdx = outIdx + maxBytesToWrite - 1;
            for (var i = 0; i < str.length; ++i) {
              var u = str.charCodeAt(i);
              if (u >= 55296 && u <= 57343) {
                var u1 = str.charCodeAt(++i);
                u = 65536 + ((u & 1023) << 10) | u1 & 1023;
              }
              if (u <= 127) {
                if (outIdx >= endIdx) break;
                heap[outIdx++] = u;
              } else if (u <= 2047) {
                if (outIdx + 1 >= endIdx) break;
                heap[outIdx++] = 192 | u >> 6;
                heap[outIdx++] = 128 | u & 63;
              } else if (u <= 65535) {
                if (outIdx + 2 >= endIdx) break;
                heap[outIdx++] = 224 | u >> 12;
                heap[outIdx++] = 128 | u >> 6 & 63;
                heap[outIdx++] = 128 | u & 63;
              } else {
                if (outIdx + 3 >= endIdx) break;
                heap[outIdx++] = 240 | u >> 18;
                heap[outIdx++] = 128 | u >> 12 & 63;
                heap[outIdx++] = 128 | u >> 6 & 63;
                heap[outIdx++] = 128 | u & 63;
              }
            }
            heap[outIdx] = 0;
            return outIdx - startIdx;
          };
          var stringToUTF8 = (str, outPtr, maxBytesToWrite) => stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
          var stringToUTF8OnStack = (str) => {
            var size = lengthBytesUTF8(str) + 1;
            var ret = stackAlloc(size);
            stringToUTF8(str, ret, size);
            return ret;
          };
          var UTF8Decoder = typeof TextDecoder != "undefined" ? new TextDecoder("utf8") : void 0;
          var UTF8ArrayToString = (heapOrArray, idx, maxBytesToRead) => {
            var endIdx = idx + maxBytesToRead;
            var endPtr = idx;
            while (heapOrArray[endPtr] && !(endPtr >= endIdx)) ++endPtr;
            if (endPtr - idx > 16 && heapOrArray.buffer && UTF8Decoder) {
              return UTF8Decoder.decode(heapOrArray.subarray(idx, endPtr));
            }
            var str = "";
            while (idx < endPtr) {
              var u0 = heapOrArray[idx++];
              if (!(u0 & 128)) {
                str += String.fromCharCode(u0);
                continue;
              }
              var u1 = heapOrArray[idx++] & 63;
              if ((u0 & 224) == 192) {
                str += String.fromCharCode((u0 & 31) << 6 | u1);
                continue;
              }
              var u2 = heapOrArray[idx++] & 63;
              if ((u0 & 240) == 224) {
                u0 = (u0 & 15) << 12 | u1 << 6 | u2;
              } else {
                u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | heapOrArray[idx++] & 63;
              }
              if (u0 < 65536) {
                str += String.fromCharCode(u0);
              } else {
                var ch = u0 - 65536;
                str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023);
              }
            }
            return str;
          };
          var UTF8ToString = (ptr, maxBytesToRead) => ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : "";
          var ccall = function(ident, returnType, argTypes, args, opts) {
            var toC = { "string": (str) => {
              var ret2 = 0;
              if (str !== null && str !== void 0 && str !== 0) {
                ret2 = stringToUTF8OnStack(str);
              }
              return ret2;
            }, "array": (arr) => {
              var ret2 = stackAlloc(arr.length);
              writeArrayToMemory(arr, ret2);
              return ret2;
            } };
            function convertReturnValue(ret2) {
              if (returnType === "string") {
                return UTF8ToString(ret2);
              }
              if (returnType === "boolean") return Boolean(ret2);
              return ret2;
            }
            var func = getCFunc(ident);
            var cArgs = [];
            var stack = 0;
            if (args) {
              for (var i = 0; i < args.length; i++) {
                var converter = toC[argTypes[i]];
                if (converter) {
                  if (stack === 0) stack = stackSave();
                  cArgs[i] = converter(args[i]);
                } else {
                  cArgs[i] = args[i];
                }
              }
            }
            var ret = func.apply(null, cArgs);
            function onDone(ret2) {
              if (stack !== 0) stackRestore(stack);
              return convertReturnValue(ret2);
            }
            ret = onDone(ret);
            return ret;
          };
          var cwrap = function(ident, returnType, argTypes, opts) {
            var numericArgs = !argTypes || argTypes.every((type) => type === "number" || type === "boolean");
            var numericRet = returnType !== "string";
            if (numericRet && numericArgs && !opts) {
              return getCFunc(ident);
            }
            return function() {
              return ccall(ident, returnType, argTypes, arguments, opts);
            };
          };
          var wasmImports = { a: _emscripten_resize_heap };
          var asm = createWasm();
          var ___wasm_call_ctors = asm["c"];
          var _kiss_fft_free = Module["_kiss_fft_free"] = asm["d"];
          var _free = Module["_free"] = asm["e"];
          var _kiss_fft_alloc = Module["_kiss_fft_alloc"] = asm["f"];
          var _malloc = Module["_malloc"] = asm["g"];
          var _kiss_fft = Module["_kiss_fft"] = asm["h"];
          var ___errno_location = asm["__errno_location"];
          var stackSave = asm["j"];
          var stackRestore = asm["k"];
          var stackAlloc = asm["l"];
          function intArrayFromBase64(s) {
            try {
              var decoded = atob(s);
              var bytes = new Uint8Array(decoded.length);
              for (var i = 0; i < decoded.length; ++i) {
                bytes[i] = decoded.charCodeAt(i);
              }
              return bytes;
            } catch (_) {
              throw new Error("Converting base64 string to bytes failed.");
            }
          }
          function tryParseAsDataURI(filename) {
            if (!isDataURI(filename)) {
              return;
            }
            return intArrayFromBase64(filename.slice(dataURIPrefix.length));
          }
          Module["ccall"] = ccall;
          Module["cwrap"] = cwrap;
          var calledRun;
          dependenciesFulfilled = function runCaller() {
            if (!calledRun) run();
            if (!calledRun) dependenciesFulfilled = runCaller;
          };
          function run() {
            if (runDependencies > 0) {
              return;
            }
            preRun();
            if (runDependencies > 0) {
              return;
            }
            function doRun() {
              if (calledRun) return;
              calledRun = true;
              Module["calledRun"] = true;
              if (ABORT) return;
              initRuntime();
              readyPromiseResolve(Module);
              if (Module["onRuntimeInitialized"]) Module["onRuntimeInitialized"]();
              postRun();
            }
            if (Module["setStatus"]) {
              Module["setStatus"]("Running...");
              setTimeout(function() {
                setTimeout(function() {
                  Module["setStatus"]("");
                }, 1);
                doRun();
              }, 1);
            } else {
              doRun();
            }
          }
          if (Module["preInit"]) {
            if (typeof Module["preInit"] == "function") Module["preInit"] = [Module["preInit"]];
            while (Module["preInit"].length > 0) {
              Module["preInit"].pop()();
            }
          }
          run();
          return moduleArg;
        };
      })();
      KissFFT_default2 = KissFFTModule2;
    }
  });

  // node_modules/webfft/lib/kissfftmodified/webfftWrapper.js
  var kissFFTModule2, kiss_fft_alloc2, kiss_fft2, kiss_fft_free2, KissFftModifiedWrapperWasm, webfftWrapper_default8;
  var init_webfftWrapper8 = __esm({
    "node_modules/webfft/lib/kissfftmodified/webfftWrapper.js"() {
      "use strict";
      init_KissFFT2();
      kissFFTModule2 = KissFFT_default2({});
      kiss_fft_alloc2 = kissFFTModule2.cwrap("kiss_fft_alloc", "number", [
        "number",
        "number",
        "number",
        "number"
      ]);
      kiss_fft2 = kissFFTModule2.cwrap("kiss_fft", "void", [
        "number",
        "number",
        "number"
      ]);
      kiss_fft_free2 = kissFFTModule2.cwrap("kiss_fft_free", "void", ["number"]);
      KissFftModifiedWrapperWasm = class {
        constructor(size) {
          this.size = size;
          this.fcfg = kiss_fft_alloc2(size, false);
          this.icfg = kiss_fft_alloc2(size, true);
          this.inptr = kissFFTModule2._malloc(size * 8 + size * 8);
          this.cin = new Float32Array(
            kissFFTModule2.HEAPU8.buffer,
            this.inptr,
            size * 2
          );
        }
        fft = function(inputArray) {
          const outptr = kissFFTModule2._malloc(this.size * 8);
          const cout = new Float32Array(
            kissFFTModule2.HEAPU8.buffer,
            outptr,
            this.size * 2
          );
          this.cin.set(inputArray);
          kiss_fft2(this.fcfg, this.inptr, outptr);
          let outputArray = new Float32Array(this.size * 2);
          outputArray.set(cout);
          kissFFTModule2._free(outptr);
          return outputArray;
        };
        dispose() {
          kiss_fft_free2(this.fcfg);
          kiss_fft_free2(this.icfg);
          kissFFTModule2._free(this.inptr);
        }
      };
      webfftWrapper_default8 = KissFftModifiedWrapperWasm;
    }
  });

  // node_modules/webfft/lib/indutnymodified/fft.js
  function IndutnyModifiedFftWrapperJavascript(size) {
    this.size = size;
    this._csize = size << 1;
    var table = new Array(this.size * 2);
    for (var i = 0; i < table.length; i += 2) {
      const angle = Math.PI * i / this.size;
      table[i] = Math.cos(angle);
      table[i + 1] = -Math.sin(angle);
    }
    this.table = table;
    var power = 0;
    for (var t = 1; this.size > t; t <<= 1) power++;
    this._width = power % 2 === 0 ? power - 1 : power;
    this._bitrev = new Array(1 << this._width);
    for (var j = 0; j < this._bitrev.length; j++) {
      this._bitrev[j] = 0;
      for (var shift = 0; shift < this._width; shift += 2) {
        var revShift = this._width - shift - 2;
        this._bitrev[j] |= (j >>> shift & 3) << revShift;
      }
    }
    this._data = null;
  }
  var fft_default3;
  var init_fft3 = __esm({
    "node_modules/webfft/lib/indutnymodified/fft.js"() {
      "use strict";
      IndutnyModifiedFftWrapperJavascript.prototype.fft = function fft(data) {
        this._data = data;
        this._out = new Float32Array(2 * this.size);
        var size = this._csize;
        var step = 1 << this._width;
        var len = size / step << 1;
        var outOff;
        var t;
        var bitrev = this._bitrev;
        if (len === 4) {
          for (outOff = 0, t = 0; outOff < size; outOff += len, t++) {
            const off = bitrev[t];
            this._singleTransform2(outOff, off, step);
          }
        } else {
          for (outOff = 0, t = 0; outOff < size; outOff += len, t++) {
            const off = bitrev[t];
            this._singleTransform4(outOff, off, step);
          }
        }
        for (step >>= 2; step >= 2; step >>= 2) {
          len = size / step << 1;
          var quarterLen = len >>> 2;
          for (outOff = 0; outOff < size; outOff += len) {
            var limit = outOff + quarterLen;
            for (var i = outOff, k = 0; i < limit; i += 2, k += step) {
              const A = i;
              const B = A + quarterLen;
              const C = B + quarterLen;
              const D = C + quarterLen;
              const Ar = this._out[A];
              const Ai = this._out[A + 1];
              const Br = this._out[B];
              const Bi = this._out[B + 1];
              const Cr = this._out[C];
              const Ci = this._out[C + 1];
              const Dr = this._out[D];
              const Di = this._out[D + 1];
              const MAr = Ar;
              const MAi = Ai;
              const tableBr = this.table[k];
              const tableBi = this.table[k + 1];
              const MBr = Br * tableBr - Bi * tableBi;
              const MBi = Br * tableBi + Bi * tableBr;
              const tableCr = this.table[2 * k];
              const tableCi = this.table[2 * k + 1];
              const MCr = Cr * tableCr - Ci * tableCi;
              const MCi = Cr * tableCi + Ci * tableCr;
              const tableDr = this.table[3 * k];
              const tableDi = this.table[3 * k + 1];
              const MDr = Dr * tableDr - Di * tableDi;
              const MDi = Dr * tableDi + Di * tableDr;
              const T0r = MAr + MCr;
              const T0i = MAi + MCi;
              const T1r = MAr - MCr;
              const T1i = MAi - MCi;
              const T2r = MBr + MDr;
              const T2i = MBi + MDi;
              const T3r = MBr - MDr;
              const T3i = MBi - MDi;
              this._out[A] = T0r + T2r;
              this._out[A + 1] = T0i + T2i;
              this._out[B] = T1r + T3i;
              this._out[B + 1] = T1i - T3r;
              this._out[C] = T0r - T2r;
              this._out[C + 1] = T0i - T2i;
              this._out[D] = T1r - T3i;
              this._out[D + 1] = T1i + T3r;
            }
          }
        }
        return this._out;
      };
      IndutnyModifiedFftWrapperJavascript.prototype._singleTransform2 = function _singleTransform22(outOff, off, step) {
        const evenR = this._data[off];
        const evenI = this._data[off + 1];
        const oddR = this._data[off + step];
        const oddI = this._data[off + step + 1];
        this._out[outOff] = evenR + oddR;
        this._out[outOff + 1] = evenI + oddI;
        this._out[outOff + 2] = evenR - oddR;
        this._out[outOff + 3] = evenI - oddI;
      };
      IndutnyModifiedFftWrapperJavascript.prototype._singleTransform4 = function _singleTransform42(outOff, off, step) {
        const step2 = step * 2;
        const step3 = step * 3;
        const Ar = this._data[off];
        const Ai = this._data[off + 1];
        const Br = this._data[off + step];
        const Bi = this._data[off + step + 1];
        const Cr = this._data[off + step2];
        const Ci = this._data[off + step2 + 1];
        const Dr = this._data[off + step3];
        const Di = this._data[off + step3 + 1];
        const T0r = Ar + Cr;
        const T0i = Ai + Ci;
        const T1r = Ar - Cr;
        const T1i = Ai - Ci;
        const T2r = Br + Dr;
        const T2i = Bi + Di;
        const T3r = Br - Dr;
        const T3i = Bi - Di;
        this._out[outOff] = T0r + T2r;
        this._out[outOff + 1] = T0i + T2i;
        this._out[outOff + 2] = T1r + T3i;
        this._out[outOff + 3] = T1i - T3r;
        this._out[outOff + 4] = T0r - T2r;
        this._out[outOff + 5] = T0i - T2i;
        this._out[outOff + 6] = T1r - T3i;
        this._out[outOff + 7] = T1i + T3r;
      };
      fft_default3 = IndutnyModifiedFftWrapperJavascript;
    }
  });

  // node_modules/webfft/lib/main.js
  var main_exports = {};
  __export(main_exports, {
    default: () => main_default
  });
  var validSizes, webfft, main_default;
  var init_main = __esm({
    "node_modules/webfft/lib/main.js"() {
      "use strict";
      init_webfftWrapper();
      init_webfftWrapper2();
      init_webfftWrapper3();
      init_webfftWrapper4();
      init_webfftWrapper5();
      init_webfftWrapper6();
      init_webfftWrapper7();
      init_checkCapabilities();
      init_webfftWrapper8();
      init_fft3();
      validSizes = [
        4,
        8,
        16,
        32,
        64,
        128,
        256,
        512,
        1024,
        2048,
        4096,
        8192,
        16384,
        32768,
        16384,
        32768,
        65536,
        131072
      ];
      webfft = class {
        constructor(size = 128, subLibrary = "indutnyJavascript", useProfile = true) {
          if (!validSizes.includes(size)) {
            throw new Error("Size must be a power of 2 between 4 and 131072");
          }
          this.size = size;
          this.outputArr = new Float32Array(2 * size);
          this.subLibrary = subLibrary;
          this.fftLibrary = void 0;
          const profile = this.getCurrentProfile();
          if (profile && useProfile) {
            this.setSubLibrary(profile.fastestSubLibrary);
          } else {
            this.setSubLibrary(subLibrary);
          }
        }
        availableSubLibraries() {
          return [
            "kissWasm",
            "indutnyModifiedJavascript",
            "indutnyJavascript",
            "crossWasm",
            "mljsJavascript",
            "nockertJavascript",
            "nayuki3Wasm",
            "nayukiJavascript",
            //"dntjJavascript", // need to figure out the precise scale factor before we can use this one, mainly due to unit tests
            "kissfftmodifiedWasm"
            // currently doesnt perform any better
            //"viljaWasm"
          ];
        }
        // A subset of the libraries known to be quickest, and removing ones that are too similar to others
        availableSubLibrariesQuick() {
          return ["kissWasm", "indutnyModifiedJavascript"];
        }
        getCurrentProfile() {
          if (typeof localStorage === "undefined") {
            return void 0;
          }
          if (!localStorage.getItem("webfftProfile")) {
            return void 0;
          }
          return JSON.parse(localStorage.getItem("webfftProfile"));
        }
        setSubLibrary(subLibrary) {
          switch (subLibrary) {
            case "nayukiJavascript":
              this.fftLibrary = new webfftWrapper_default4(this.size);
              break;
            case "nayuki3Wasm":
              this.fftLibrary = new webfftWrapper_default5(this.size);
              break;
            case "kissWasm":
              this.fftLibrary = new webfftWrapper_default(this.size);
              break;
            case "crossWasm":
              this.fftLibrary = new webfftWrapper_default3(this.size);
              if (this.size > 16384)
                this.fftLibrary = new webfftWrapper_default2(this.size);
              break;
            case "nockertJavascript":
              this.fftLibrary = new webfftWrapper_default6(this.size);
              break;
            //case "dntjJavascript":
            //  this.fftLibrary = new DntjWebFftWrapperJavascript(this.size);
            //  break;
            case "indutnyJavascript":
              this.fftLibrary = new webfftWrapper_default2(this.size);
              break;
            case "mljsJavascript":
              this.fftLibrary = new webfftWrapper_default7(this.size);
              break;
            case "kissfftmodifiedWasm":
              this.fftLibrary = new webfftWrapper_default8(this.size);
              break;
            //case "viljaWasm":
            //  this.fftLibrary = new ViljaFftWrapperWasm(this.size);
            case "indutnyModifiedJavascript":
              this.fftLibrary = new fft_default3(this.size);
              break;
            default:
              throw new Error("Invalid sublibrary");
          }
        }
        fft(inputArr) {
          if (inputArr.length !== 2 * this.size) {
            throw new Error("Input array length must be == 2 * size");
          }
          this.outputArr = this.fftLibrary.fft(inputArr);
          return this.outputArr;
        }
        // convinience function for people who want to use real-valued input.
        //   note that you still have to give it a size that is 2x your real-valued input length!!
        //   it doesn't actually speed it up by 2x
        //   output is complex but the lenght of inputArr because the negative freqs are removed
        fftr(inputArr) {
          var { outputArr, fftLibrary, size } = this;
          if (inputArr.length !== size) {
            throw new Error("Input array length must be == size");
          }
          const inputArrComplex = new Float32Array(2 * size);
          inputArrComplex.fill(0);
          for (let i = 0; i < size; i++) {
            inputArrComplex[2 * i] = inputArr[i];
          }
          outputArr = fftLibrary.fft(inputArrComplex);
          return outputArr.slice(size, size * 2);
        }
        // takes in an array of arrays each of length 2*size.  the outter array length must also be a power of two.  only supports complex
        fft2d(inputArray) {
          const innerLen = inputArray[0].length / 2;
          const outterLen = inputArray.length;
          if (innerLen !== this.size) {
            throw new Error("Inner array length must be == 2 * size");
          }
          if (!validSizes.includes(outterLen)) {
            throw new Error(
              "Outter array length must be a power of 2 between 4 and 131072"
            );
          }
          let intermediateArray = [];
          for (let i = 0; i < outterLen; i++) {
            this.outputArr = this.fft(inputArray[i]);
            intermediateArray.push(this.outputArr);
          }
          this.dispose();
          this.size = outterLen;
          this.setSubLibrary(this.subLibrary);
          let finalArray = [];
          for (let i = 0; i < innerLen; i++) {
            const newArray = new Float32Array(2 * outterLen);
            newArray.fill(0);
            for (let j = 0; j < outterLen; j++) {
              newArray[2 * j] = intermediateArray[j][2 * i];
              newArray[2 * j + 1] = intermediateArray[j][2 * i + 1];
            }
            let temparray = new Float32Array(2 * outterLen);
            temparray = this.fft(newArray);
            finalArray.push(temparray);
          }
          let outputArray = [];
          for (let i = 0; i < outterLen; i++) {
            let newArray = new Float32Array(2 * innerLen);
            for (let j = 0; j < innerLen; j++) {
              newArray[2 * j] = finalArray[j][2 * i];
              newArray[2 * j + 1] = finalArray[j][2 * i + 1];
            }
            outputArray.push(newArray);
          }
          this.dispose();
          this.size = innerLen;
          this.setSubLibrary(this.subLibrary);
          return outputArray;
        }
        profile(duration = 1, refresh = true, quick = false) {
          if (!refresh && this.getCurrentProfile()) {
            return this.getCurrentProfile();
          }
          const totalStart = performance.now();
          let subLibraries;
          if (quick) {
            subLibraries = this.availableSubLibrariesQuick();
          } else {
            subLibraries = this.availableSubLibraries();
          }
          let ffsPerSecond = [];
          const secondsPerRun = duration / subLibraries.length / 2;
          for (let i = 0; i < subLibraries.length; i++) {
            this.setSubLibrary(subLibraries[i]);
            const ci = new Float32Array(2 * this.size);
            for (let j = 0; j < this.size; j++) {
              ci[2 * j] = Math.random() - 0.5;
              ci[2 * j + 1] = Math.random() - 0.5;
            }
            let start = performance.now();
            while ((performance.now() - start) / 1e3 < secondsPerRun) {
              const co = this.fft(ci);
            }
            start = performance.now();
            let numFfts = 0;
            while ((performance.now() - start) / 1e3 < secondsPerRun) {
              const co = this.fft(ci);
              numFfts++;
            }
            ffsPerSecond.push(1e3 * numFfts / (performance.now() - start));
            this.dispose();
          }
          const totalElapsed = (performance.now() - totalStart) / 1e3;
          let argmax = ffsPerSecond.indexOf(Math.max(...ffsPerSecond));
          const profileObj = {
            fftsPerSecond: ffsPerSecond,
            subLibraries,
            totalElapsed,
            fastestSubLibrary: subLibraries[argmax]
          };
          console.log("Setting sublibrary to", profileObj.fastestSubLibrary);
          this.setSubLibrary(profileObj.fastestSubLibrary);
          if (typeof localStorage !== "undefined") {
            localStorage.setItem("webfftProfile", JSON.stringify(profileObj));
          }
          return profileObj;
        }
        async checkBrowserCapabilities() {
          return await checkCapabilities_default();
        }
        dispose() {
          if (this.fftLibrary && this.fftLibrary.dispose !== void 0) {
            this.fftLibrary.dispose();
          }
        }
      };
      main_default = webfft;
    }
  });

  // src/features/index.ts
  var features_exports = {};
  __export(features_exports, {
    getCrestFactor: () => getCrestFactor,
    getEnergy: () => getEnergy,
    getFFT: () => getFFT,
    getLUFS: () => getLUFS,
    getPeak: () => getPeakAmplitude,
    getPeakAmplitude: () => getPeakAmplitude,
    getPeaks: () => getPeaks,
    getRMS: () => getRMS,
    getSpectralFeatures: () => getSpectralFeatures,
    getSpectrum: () => getSpectrum,
    getStereoAnalysis: () => getStereoAnalysis,
    getTimeVaryingSpectralFeatures: () => getTimeVaryingSpectralFeatures,
    getTimeVaryingStereoAnalysis: () => getTimeVaryingStereoAnalysis,
    getVAD: () => getVAD,
    getWaveform: () => getWaveform,
    getZeroCrossing: () => getZeroCrossing
  });

  // src/types.ts
  var AudioInspectError = class extends Error {
    constructor(code, message, cause) {
      super(message);
      this.code = code;
      this.cause = cause;
    }
    name = "AudioInspectError";
  };

  // src/core/utils.ts
  function getChannelData(audio, channel) {
    if (channel === -1) {
      const averageData = new Float32Array(audio.length);
      for (let i = 0; i < audio.length; i++) {
        let sum = 0;
        for (let ch = 0; ch < audio.numberOfChannels; ch++) {
          const channelData2 = audio.channelData[ch];
          if (!channelData2) {
            throw new AudioInspectError("INVALID_INPUT", `Channel ${ch} data does not exist`);
          }
          if (i < channelData2.length) {
            const sample = channelData2[i];
            if (sample !== void 0) {
              sum += sample;
            }
          }
        }
        averageData[i] = sum / audio.numberOfChannels;
      }
      return averageData;
    }
    if (channel < 0 || channel >= audio.numberOfChannels) {
      throw new AudioInspectError(
        "INVALID_INPUT",
        `Invalid channel number: ${channel}. Valid range is 0-${audio.numberOfChannels - 1} or -1 (average)`
      );
    }
    const channelData = audio.channelData[channel];
    if (!channelData) {
      throw new AudioInspectError("INVALID_INPUT", `Channel ${channel} data does not exist`);
    }
    return channelData;
  }
  function safeArrayAccess(array, index, defaultValue) {
    if (index >= 0 && index < array.length) {
      return array[index] ?? defaultValue;
    }
    return defaultValue;
  }
  function isValidSample(value) {
    return typeof value === "number" && !isNaN(value) && isFinite(value);
  }
  function ensureValidSample(value, defaultValue = 0) {
    return isValidSample(value) ? value : defaultValue;
  }
  function amplitudeToDecibels(amplitude, reference = 1) {
    const MIN_AMPLITUDE_FOR_DB = 1e-10;
    const SILENCE_DB2 = -Infinity;
    if (amplitude <= 0 || reference <= 0) {
      return SILENCE_DB2;
    }
    const ratio = amplitude / reference;
    return ratio > MIN_AMPLITUDE_FOR_DB ? 20 * Math.log10(ratio) : SILENCE_DB2;
  }

  // src/features/time.ts
  function detectAllInitialPeaks(data, threshold, includeProminence = false) {
    const peaks = [];
    const length = data.length;
    if (length < 3) return peaks;
    for (let i = 1; i < length - 1; i++) {
      const current = Math.abs(ensureValidSample(data[i]));
      const prev = Math.abs(ensureValidSample(data[i - 1]));
      const next = Math.abs(ensureValidSample(data[i + 1]));
      if (current > prev && current > next && current > threshold) {
        const peak = {
          position: i,
          amplitude: current
        };
        if (includeProminence) {
          peak.prominence = calculateProminence(data, i, current);
        }
        peaks.push(peak);
      }
    }
    return peaks;
  }
  function calculateProminence(data, peakIndex, peakValue) {
    let leftMin = peakValue;
    for (let i = peakIndex - 1; i >= 0; i--) {
      const value = Math.abs(ensureValidSample(data[i]));
      if (value > peakValue) break;
      leftMin = Math.min(leftMin, value);
    }
    let rightMin = peakValue;
    for (let i = peakIndex + 1; i < data.length; i++) {
      const value = Math.abs(ensureValidSample(data[i]));
      if (value > peakValue) break;
      rightMin = Math.min(rightMin, value);
    }
    return peakValue - Math.max(leftMin, rightMin);
  }
  function getPeaks(audio, options = {}) {
    const {
      count = 100,
      threshold = 0.1,
      channel = 0,
      minDistance = Math.floor(audio.sampleRate / 100)
      // デフォルト10ms
    } = options;
    if (count <= 0) {
      throw new AudioInspectError("INVALID_INPUT", "\u30D4\u30FC\u30AF\u6570\u306F\u6B63\u306E\u6574\u6570\u3067\u3042\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059");
    }
    if (threshold < 0 || threshold > 1) {
      throw new AudioInspectError("INVALID_INPUT", "\u95BE\u5024\u306F0\u304B\u30891\u306E\u7BC4\u56F2\u3067\u3042\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059");
    }
    const channelData = getChannelData(audio, channel);
    if (channelData.length === 0) {
      return {
        peaks: [],
        maxAmplitude: 0,
        averageAmplitude: 0
      };
    }
    const allInitialPeaks = detectAllInitialPeaks(channelData, threshold);
    if (allInitialPeaks.length === 0) {
      return {
        peaks: [],
        maxAmplitude: 0,
        averageAmplitude: 0
      };
    }
    allInitialPeaks.sort((a, b) => b.amplitude - a.amplitude);
    const selectedPeaks = [];
    const occupiedRegions = [];
    for (const candidate of allInitialPeaks) {
      if (selectedPeaks.length >= count) break;
      const candidateStart = candidate.position - minDistance;
      const candidateEnd = candidate.position + minDistance;
      const hasOverlap = occupiedRegions.some(
        ([start, end]) => !(candidateEnd < start || candidateStart > end)
      );
      if (!hasOverlap) {
        selectedPeaks.push({
          position: candidate.position,
          time: candidate.position / audio.sampleRate,
          amplitude: candidate.amplitude
        });
        occupiedRegions.push([candidateStart, candidateEnd]);
      }
    }
    selectedPeaks.sort((a, b) => a.position - b.position);
    const maxAmplitude = allInitialPeaks.length > 0 ? allInitialPeaks[0]?.amplitude ?? 0 : 0;
    const averageAmplitude = allInitialPeaks.length > 0 ? allInitialPeaks.reduce((sum, p) => sum + p.amplitude, 0) / allInitialPeaks.length : 0;
    return {
      peaks: selectedPeaks,
      maxAmplitude,
      averageAmplitude
    };
  }
  var SILENCE_DB = -Infinity;
  function getRMS(audio, optionsOrChannel = {}) {
    const options = typeof optionsOrChannel === "number" ? { channel: optionsOrChannel, asDB: false, reference: 1 } : {
      channel: 0,
      asDB: false,
      reference: 1,
      ...optionsOrChannel
    };
    const channelData = getChannelData(audio, options.channel);
    if (channelData.length === 0) {
      return options.asDB ? SILENCE_DB : 0;
    }
    let sumOfSquares = 0;
    let validSampleCount = 0;
    for (let i = 0; i < channelData.length; i++) {
      const sample = channelData[i];
      if (isValidSample(sample)) {
        sumOfSquares += sample * sample;
        validSampleCount++;
      }
    }
    if (validSampleCount === 0) {
      return options.asDB ? SILENCE_DB : 0;
    }
    const rms = Math.sqrt(sumOfSquares / validSampleCount);
    return options.asDB ? amplitudeToDecibels(rms, options.reference) : rms;
  }
  function getPeakAmplitude(audio, options = {}) {
    const resolvedOptions = {
      channel: 0,
      asDB: false,
      reference: 1,
      ...options
    };
    const channelData = getChannelData(audio, resolvedOptions.channel);
    if (channelData.length === 0) {
      return resolvedOptions.asDB ? SILENCE_DB : 0;
    }
    let peak = 0;
    for (let i = 0; i < channelData.length; i++) {
      const sample = channelData[i];
      if (isValidSample(sample)) {
        peak = Math.max(peak, Math.abs(sample));
      }
    }
    return resolvedOptions.asDB ? amplitudeToDecibels(peak, resolvedOptions.reference) : peak;
  }
  function getZeroCrossing(audio, channel = 0) {
    const channelData = getChannelData(audio, channel);
    if (channelData.length < 2) {
      return 0;
    }
    let crossings = 0;
    for (let i = 1; i < channelData.length; i++) {
      const prev = ensureValidSample(channelData[i - 1]);
      const current = ensureValidSample(channelData[i]);
      if (prev >= 0 && current < 0 || prev < 0 && current >= 0) {
        crossings++;
      }
    }
    return crossings / (channelData.length - 1);
  }
  function getWaveform(audio, options = {}) {
    const { framesPerSecond = 60, channel = 0, method = "rms" } = options;
    const channelData = getChannelData(audio, channel);
    const desiredFrameCount = Math.ceil(audio.duration * framesPerSecond);
    const maxPossibleFrameCount = audio.length > 0 ? audio.length : desiredFrameCount > 0 ? 1 : 0;
    const frameCount = Math.min(desiredFrameCount, maxPossibleFrameCount);
    const samplesPerFrame = frameCount > 0 ? Math.max(1, Math.floor(audio.length / frameCount)) : 0;
    const waveform = [];
    let maxAmplitude = 0;
    let totalAmplitude = 0;
    for (let i = 0; i < frameCount; i++) {
      const startSample = i * samplesPerFrame;
      const endSample = Math.min(startSample + samplesPerFrame, channelData.length);
      if (endSample <= startSample) {
        const lastAmplitude = waveform.length > 0 ? safeArrayAccess(waveform, waveform.length - 1, { time: 0, amplitude: 0 }).amplitude : 0;
        waveform.push({
          time: (startSample + samplesPerFrame / 2) / audio.sampleRate,
          amplitude: lastAmplitude
        });
        continue;
      }
      const frameData = channelData.subarray(startSample, endSample);
      let amplitude;
      switch (method) {
        case "peak":
          amplitude = calculatePeakAmplitude(frameData);
          break;
        case "average":
          amplitude = calculateAverageAmplitude(frameData);
          break;
        case "rms":
        default:
          amplitude = calculateRMSAmplitude(frameData);
          break;
      }
      const time = (startSample + (endSample - startSample) / 2) / audio.sampleRate;
      waveform.push({ time, amplitude });
      maxAmplitude = Math.max(maxAmplitude, amplitude);
      totalAmplitude += amplitude;
    }
    const averageAmplitude = frameCount > 0 ? totalAmplitude / frameCount : 0;
    return {
      waveform,
      maxAmplitude,
      averageAmplitude,
      frameCount,
      samplesPerFrame
    };
  }
  function calculateRMSAmplitude(frameData) {
    if (frameData.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < frameData.length; i++) {
      const sample = ensureValidSample(frameData[i]);
      sum += sample * sample;
    }
    return Math.sqrt(sum / frameData.length);
  }
  function calculatePeakAmplitude(frameData) {
    let peak = 0;
    for (let i = 0; i < frameData.length; i++) {
      const sample = Math.abs(ensureValidSample(frameData[i]));
      peak = Math.max(peak, sample);
    }
    return peak;
  }
  function calculateAverageAmplitude(frameData) {
    if (frameData.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < frameData.length; i++) {
      sum += Math.abs(ensureValidSample(frameData[i]));
    }
    return sum / frameData.length;
  }

  // src/core/fft-provider.ts
  var WebFFTProvider = class {
    constructor(size, sampleRate2, enableProfiling = false) {
      this.size = size;
      this.sampleRate = sampleRate2;
      this.enableProfiling = enableProfiling;
    }
    fftInstance = null;
    get name() {
      return "WebFFT";
    }
    async initializeWebFFT() {
      try {
        const webfftModule = await Promise.resolve().then(() => (init_main(), main_exports));
        const WebFFTConstructor = webfftModule.default;
        this.fftInstance = new WebFFTConstructor(this.size);
        if (this.enableProfiling && this.fftInstance?.profile) {
          await this.fftInstance.profile();
        }
      } catch (error) {
        throw new AudioInspectError(
          "UNSUPPORTED_FORMAT",
          `WebFFT\u306E\u521D\u671F\u5316\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
    fft(input) {
      if (!this.fftInstance) {
        throw new AudioInspectError("UNSUPPORTED_FORMAT", "WebFFT\u304C\u521D\u671F\u5316\u3055\u308C\u3066\u3044\u307E\u305B\u3093");
      }
      if (input.length !== this.size) {
        throw new AudioInspectError(
          "INVALID_INPUT",
          `\u5165\u529B\u30B5\u30A4\u30BA\u304C\u4E0D\u6B63\u3067\u3059\u3002\u671F\u5F85\u5024: ${this.size}, \u5B9F\u969B: ${input.length}`
        );
      }
      const complexInput = new Float32Array(this.size * 2);
      for (let i = 0; i < this.size; i++) {
        complexInput[i * 2] = input[i] || 0;
        complexInput[i * 2 + 1] = 0;
      }
      const complexOutput = this.fftInstance.fft(complexInput);
      const magnitude = new Float32Array(this.size / 2 + 1);
      const phase = new Float32Array(this.size / 2 + 1);
      const frequencies = new Float32Array(this.size / 2 + 1);
      for (let i = 0; i < magnitude.length; i++) {
        const real = complexOutput[i * 2] || 0;
        const imag = complexOutput[i * 2 + 1] || 0;
        magnitude[i] = Math.sqrt(real * real + imag * imag);
        phase[i] = Math.atan2(imag, real);
        frequencies[i] = i * this.sampleRate / this.size;
      }
      return {
        complex: complexOutput,
        magnitude,
        phase,
        frequencies
      };
    }
    async profile() {
      if (!this.fftInstance || !this.fftInstance.profile) {
        throw new AudioInspectError("UNSUPPORTED_FORMAT", "WebFFT\u304C\u521D\u671F\u5316\u3055\u308C\u3066\u3044\u307E\u305B\u3093");
      }
      await this.fftInstance.profile();
    }
    dispose() {
      if (this.fftInstance && this.fftInstance.dispose) {
        this.fftInstance.dispose();
        this.fftInstance = null;
      }
    }
  };
  var NativeFFTProvider = class {
    constructor(size, sampleRate2) {
      this.size = size;
      this.sampleRate = sampleRate2;
      if (!this.isPowerOfTwo(size)) {
        throw new AudioInspectError("INVALID_INPUT", "FFT\u30B5\u30A4\u30BA\u306F2\u306E\u51AA\u3067\u3042\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059");
      }
      this.precomputeTables();
    }
    bitReversalTable;
    twiddleFactorsReal;
    twiddleFactorsImag;
    get name() {
      return "Native FFT (Cooley-Tukey)";
    }
    isPowerOfTwo(n) {
      return n > 0 && (n & n - 1) === 0;
    }
    precomputeTables() {
      this.bitReversalTable = new Uint32Array(this.size);
      const bits = Math.log2(this.size);
      for (let i = 0; i < this.size; i++) {
        let reversed = 0;
        for (let j = 0; j < bits; j++) {
          reversed = reversed << 1 | i >> j & 1;
        }
        this.bitReversalTable[i] = reversed;
      }
      const halfSize = this.size / 2;
      this.twiddleFactorsReal = new Float32Array(halfSize);
      this.twiddleFactorsImag = new Float32Array(halfSize);
      for (let i = 0; i < halfSize; i++) {
        const angle = -2 * Math.PI * i / this.size;
        this.twiddleFactorsReal[i] = Math.cos(angle);
        this.twiddleFactorsImag[i] = Math.sin(angle);
      }
    }
    fft(input) {
      if (input.length !== this.size) {
        throw new AudioInspectError(
          "INVALID_INPUT",
          `\u5165\u529B\u30B5\u30A4\u30BA\u304C\u4E0D\u6B63\u3067\u3059\u3002\u671F\u5F85\u5024: ${this.size}, \u5B9F\u969B: ${input.length}`
        );
      }
      const real = new Float32Array(this.size);
      const imag = new Float32Array(this.size);
      for (let i = 0; i < this.size; i++) {
        const reversedIndex = this.bitReversalTable[i];
        if (reversedIndex !== void 0) {
          real[reversedIndex] = input[i] || 0;
          imag[reversedIndex] = 0;
        }
      }
      for (let stage = 1; stage < this.size; stage *= 2) {
        const stageSize = stage * 2;
        const twiddleStep = this.size / stageSize;
        for (let k = 0; k < this.size; k += stageSize) {
          for (let j = 0; j < stage; j++) {
            const twiddleIndex = j * twiddleStep;
            const wr = this.twiddleFactorsReal[twiddleIndex] || 0;
            const wi = this.twiddleFactorsImag[twiddleIndex] || 0;
            const evenIndex = k + j;
            const oddIndex = k + j + stage;
            const evenReal = real[evenIndex] || 0;
            const evenImag = imag[evenIndex] || 0;
            const oddReal = real[oddIndex] || 0;
            const oddImag = imag[oddIndex] || 0;
            const tempReal = oddReal * wr - oddImag * wi;
            const tempImag = oddReal * wi + oddImag * wr;
            real[evenIndex] = evenReal + tempReal;
            imag[evenIndex] = evenImag + tempImag;
            real[oddIndex] = evenReal - tempReal;
            imag[oddIndex] = evenImag - tempImag;
          }
        }
      }
      const complex = new Float32Array(this.size * 2);
      const magnitude = new Float32Array(this.size / 2 + 1);
      const phase = new Float32Array(this.size / 2 + 1);
      const frequencies = new Float32Array(this.size / 2 + 1);
      for (let i = 0; i < this.size; i++) {
        complex[i * 2] = real[i] || 0;
        complex[i * 2 + 1] = imag[i] || 0;
        if (i <= this.size / 2) {
          const realPart = real[i] || 0;
          const imagPart = imag[i] || 0;
          magnitude[i] = Math.sqrt(realPart * realPart + imagPart * imagPart);
          phase[i] = Math.atan2(imagPart, realPart);
          frequencies[i] = i * this.sampleRate / this.size;
        }
      }
      return { complex, magnitude, phase, frequencies };
    }
    dispose() {
    }
  };
  var FFTProviderFactory = class {
    /**
     * 指定された設定でFFTプロバイダーを作成
     */
    static async createProvider(config) {
      switch (config.type) {
        case "webfft": {
          const provider = new WebFFTProvider(
            config.fftSize,
            config.sampleRate,
            config.enableProfiling
          );
          await provider.initializeWebFFT();
          return provider;
        }
        case "native":
          return new NativeFFTProvider(config.fftSize, config.sampleRate);
        case "custom":
          if (!config.customProvider) {
            throw new AudioInspectError("INVALID_INPUT", "\u30AB\u30B9\u30BF\u30E0\u30D7\u30ED\u30D0\u30A4\u30C0\u30FC\u304C\u6307\u5B9A\u3055\u308C\u3066\u3044\u307E\u305B\u3093");
          }
          return config.customProvider;
        default: {
          const exhaustiveCheck = config.type;
          throw new AudioInspectError(
            "UNSUPPORTED_FORMAT",
            `\u672A\u5BFE\u5FDC\u306EFFT\u30D7\u30ED\u30D0\u30A4\u30C0\u30FC: ${String(exhaustiveCheck)}`
          );
        }
      }
    }
    /**
     * 利用可能なプロバイダーをリスト
     */
    static getAvailableProviders() {
      return ["webfft", "native"];
    }
  };

  // src/features/frequency.ts
  function applyWindow(data, windowType) {
    const windowed = new Float32Array(data.length);
    const N = data.length;
    for (let i = 0; i < N; i++) {
      let windowValue = 1;
      switch (windowType) {
        case "hann":
          windowValue = 0.5 * (1 - Math.cos(2 * Math.PI * i / (N - 1)));
          break;
        case "hamming":
          windowValue = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (N - 1));
          break;
        case "blackman":
          windowValue = 0.42 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1)) + 0.08 * Math.cos(4 * Math.PI * i / (N - 1));
          break;
        case "none":
        default:
          windowValue = 1;
          break;
      }
      windowed[i] = (data[i] || 0) * windowValue;
    }
    return windowed;
  }
  function getChannelData2(audio, channel) {
    if (channel === -1) {
      const averageData = new Float32Array(audio.length);
      for (let i = 0; i < audio.length; i++) {
        let sum = 0;
        for (let ch = 0; ch < audio.numberOfChannels; ch++) {
          const channelData2 = audio.channelData[ch];
          if (channelData2 && i < channelData2.length) {
            sum += channelData2[i];
          }
        }
        averageData[i] = sum / audio.numberOfChannels;
      }
      return averageData;
    }
    if (channel < -1 || channel >= audio.numberOfChannels) {
      throw new AudioInspectError("INVALID_INPUT", `Invalid channel number: ${channel}`);
    }
    const channelData = audio.channelData[channel];
    if (!channelData) {
      throw new AudioInspectError("INVALID_INPUT", `Channel ${channel} data does not exist`);
    }
    return channelData;
  }
  async function getFFT(audio, options = {}) {
    const {
      fftSize = 2048,
      windowFunction = "hann",
      channel = 0,
      provider = "webfft",
      enableProfiling = false
    } = options;
    const channelData = getChannelData2(audio, channel);
    let inputData;
    if (channelData.length < fftSize) {
      inputData = new Float32Array(fftSize);
      inputData.set(channelData);
    } else {
      inputData = channelData.slice(0, fftSize);
    }
    const windowedData = applyWindow(inputData, windowFunction);
    const fftProvider = await FFTProviderFactory.createProvider({
      type: provider,
      fftSize,
      sampleRate: audio.sampleRate,
      enableProfiling
    });
    try {
      const result = fftProvider.fft(windowedData);
      return {
        ...result,
        fftSize,
        windowFunction,
        providerName: fftProvider.name
      };
    } finally {
      fftProvider.dispose();
    }
  }
  async function getSpectrum(audio, options = {}) {
    const {
      fftSize = 2048,
      minFrequency = 0,
      maxFrequency = audio.sampleRate / 2,
      decibels = true,
      timeFrames = 1,
      overlap = 0.5,
      ...fftOptions
    } = options;
    const channelData = getChannelData2(audio, options.channel || 0);
    if (timeFrames === 1) {
      const fftResult = await getFFT(audio, { ...fftOptions, fftSize });
      const filteredResult = filterFrequencyRange(fftResult, minFrequency, maxFrequency);
      const result = {
        frequencies: filteredResult.frequencies,
        magnitudes: filteredResult.magnitude
      };
      if (decibels) {
        result.decibels = magnitudeToDecibels(filteredResult.magnitude);
      }
      return result;
    } else {
      const spectrogram = await computeSpectrogram(
        channelData,
        audio.sampleRate,
        fftSize,
        timeFrames,
        overlap,
        { ...fftOptions, minFrequency, maxFrequency, decibels }
      );
      return {
        frequencies: spectrogram.frequencies,
        magnitudes: new Float32Array(),
        // スペクトログラムでは個別のmagnitudesは空
        spectrogram
      };
    }
  }
  function filterFrequencyRange(fftResult, minFreq, maxFreq) {
    const { frequencies, magnitude, phase, complex } = fftResult;
    const startIndex = frequencies.findIndex((f) => f >= minFreq);
    const endIndex = frequencies.findIndex((f) => f > maxFreq);
    const actualEndIndex = endIndex === -1 ? frequencies.length : endIndex;
    return {
      frequencies: frequencies.slice(startIndex, actualEndIndex),
      magnitude: magnitude.slice(startIndex, actualEndIndex),
      phase: phase.slice(startIndex, actualEndIndex),
      complex: complex.slice(startIndex * 2, actualEndIndex * 2)
    };
  }
  function magnitudeToDecibels(magnitude) {
    const decibels = new Float32Array(magnitude.length);
    for (let i = 0; i < magnitude.length; i++) {
      const mag = magnitude[i] || 0;
      decibels[i] = mag > 0 ? 20 * Math.log10(mag) : -Infinity;
    }
    return decibels;
  }
  async function computeSpectrogram(data, sampleRate2, fftSize, timeFrames, overlap, options) {
    const hopSize = Math.floor(fftSize * (1 - overlap));
    let numPossibleFrames;
    if (data.length === 0) {
      numPossibleFrames = 0;
    } else if (data.length < fftSize) {
      numPossibleFrames = 1;
    } else {
      numPossibleFrames = Math.floor((data.length - fftSize) / hopSize) + 1;
    }
    const actualFrames = Math.min(timeFrames, numPossibleFrames);
    const times = new Float32Array(actualFrames);
    const intensities = [];
    let frequencies = new Float32Array();
    let filteredFrequencies = new Float32Array();
    let frequencyStartIndex = 0;
    let frequencyEndIndex = 0;
    const fftProvider = await FFTProviderFactory.createProvider({
      type: options.provider || "webfft",
      fftSize,
      sampleRate: sampleRate2,
      enableProfiling: options.enableProfiling || false
    });
    try {
      for (let frame = 0; frame < actualFrames; frame++) {
        const startSample = frame * hopSize;
        const frameData = new Float32Array(fftSize);
        for (let i = 0; i < fftSize; i++) {
          frameData[i] = startSample + i < data.length ? data[startSample + i] || 0 : 0;
        }
        const windowedData = applyWindow(frameData, options.windowFunction || "hann");
        const fftResult = fftProvider.fft(windowedData);
        if (frame === 0) {
          frequencies = fftResult.frequencies;
          const minFreq = options.minFrequency || 0;
          const maxFreq = options.maxFrequency || sampleRate2 / 2;
          frequencyStartIndex = frequencies.findIndex((f) => f >= minFreq);
          if (frequencyStartIndex === -1) frequencyStartIndex = 0;
          const tempEndIndex = frequencies.findIndex((f) => f > maxFreq);
          frequencyEndIndex = tempEndIndex === -1 ? frequencies.length : tempEndIndex;
          filteredFrequencies = frequencies.slice(frequencyStartIndex, frequencyEndIndex);
        }
        const magnitude = fftResult.magnitude;
        const filteredMagnitude = magnitude.slice(frequencyStartIndex, frequencyEndIndex);
        const frameIntensity = options.decibels ? magnitudeToDecibels(filteredMagnitude) : filteredMagnitude;
        intensities.push(frameIntensity);
        times[frame] = (startSample + fftSize / 2) / sampleRate2;
      }
    } finally {
      fftProvider.dispose();
    }
    return {
      times,
      frequencies: filteredFrequencies,
      // フィルタリングされた周波数軸を返す
      intensities,
      timeFrames: actualFrames,
      frequencyBins: filteredFrequencies.length
    };
  }

  // src/features/spectral.ts
  function calculateSpectralCentroid(magnitude, frequencies, minFreq, maxFreq) {
    let weightedSum = 0;
    let magnitudeSum = 0;
    for (let i = 0; i < magnitude.length && i < frequencies.length; i++) {
      const freq = frequencies[i];
      const mag = magnitude[i];
      if (freq !== void 0 && mag !== void 0 && freq >= minFreq && freq <= maxFreq) {
        weightedSum += freq * mag;
        magnitudeSum += mag;
      }
    }
    return magnitudeSum > 1e-10 ? weightedSum / magnitudeSum : 0;
  }
  function calculateSpectralBandwidth(magnitude, frequencies, centroid, minFreq, maxFreq) {
    let weightedVarianceSum = 0;
    let magnitudeSum = 0;
    for (let i = 0; i < magnitude.length && i < frequencies.length; i++) {
      const freq = frequencies[i];
      const mag = magnitude[i];
      if (freq !== void 0 && mag !== void 0 && freq >= minFreq && freq <= maxFreq) {
        const deviation = freq - centroid;
        weightedVarianceSum += deviation * deviation * mag;
        magnitudeSum += mag;
      }
    }
    return magnitudeSum > 1e-10 ? Math.sqrt(weightedVarianceSum / magnitudeSum) : 0;
  }
  function calculateSpectralRolloff(magnitude, frequencies, threshold, minFreq, maxFreq) {
    let totalEnergy = 0;
    for (let i = 0; i < magnitude.length && i < frequencies.length; i++) {
      const freq = frequencies[i];
      const mag = magnitude[i];
      if (freq !== void 0 && mag !== void 0 && freq >= minFreq && freq <= maxFreq) {
        totalEnergy += mag * mag;
      }
    }
    const targetEnergy = totalEnergy * threshold;
    let cumulativeEnergy = 0;
    for (let i = 0; i < magnitude.length && i < frequencies.length; i++) {
      const freq = frequencies[i];
      const mag = magnitude[i];
      if (freq !== void 0 && mag !== void 0 && freq >= minFreq && freq <= maxFreq) {
        cumulativeEnergy += mag * mag;
        if (cumulativeEnergy >= targetEnergy) {
          return freq;
        }
      }
    }
    return maxFreq;
  }
  function calculateSpectralFlatness(magnitude, minIndex, maxIndex) {
    let geometricMean = 0;
    let arithmeticMean = 0;
    let count = 0;
    for (let i = minIndex; i <= maxIndex && i < magnitude.length; i++) {
      const mag = magnitude[i];
      if (mag !== void 0) {
        const safeMag = Math.max(mag, 1e-10);
        geometricMean += Math.log(safeMag);
        arithmeticMean += safeMag;
        count++;
      }
    }
    if (count === 0) return 0;
    geometricMean = Math.exp(geometricMean / count);
    arithmeticMean = arithmeticMean / count;
    return arithmeticMean > 1e-10 ? geometricMean / arithmeticMean : 0;
  }
  function calculateZeroCrossingRate(samples) {
    if (samples.length < 2) return 0;
    let crossings = 0;
    for (let i = 1; i < samples.length; i++) {
      const prev = ensureValidSample(samples[i - 1]);
      const curr = ensureValidSample(samples[i]);
      if (prev >= 0 && curr < 0 || prev < 0 && curr >= 0) {
        crossings++;
      }
    }
    return crossings / (samples.length - 1);
  }
  function calculateSpectralFlux(currentMagnitude, previousMagnitude) {
    if (!previousMagnitude) return 0;
    let flux = 0;
    const length = Math.min(currentMagnitude.length, previousMagnitude.length);
    for (let i = 0; i < length; i++) {
      const current = currentMagnitude[i];
      const previous = previousMagnitude[i];
      if (current !== void 0 && previous !== void 0) {
        const diff = current - previous;
        flux += diff * diff;
      }
    }
    return Math.sqrt(flux / length);
  }
  async function getSpectralFeatures(audio, options = {}) {
    const {
      fftSize = 2048,
      windowFunction = "hann",
      channel = 0,
      minFrequency = 0,
      maxFrequency = audio.sampleRate / 2,
      rolloffThreshold = 0.85
    } = options;
    if (channel >= audio.numberOfChannels) {
      throw new AudioInspectError("INVALID_INPUT", `\u7121\u52B9\u306A\u30C1\u30E3\u30F3\u30CD\u30EB\u756A\u53F7: ${channel}`);
    }
    const fftResult = await getFFT(audio, {
      fftSize,
      windowFunction,
      channel
    });
    const minIndex = Math.max(0, Math.floor(minFrequency * fftSize / audio.sampleRate));
    const maxIndex = Math.min(
      fftResult.frequencies.length - 1,
      Math.floor(maxFrequency * fftSize / audio.sampleRate)
    );
    const spectralCentroid = calculateSpectralCentroid(
      fftResult.magnitude,
      fftResult.frequencies,
      minFrequency,
      maxFrequency
    );
    const spectralBandwidth = calculateSpectralBandwidth(
      fftResult.magnitude,
      fftResult.frequencies,
      spectralCentroid,
      minFrequency,
      maxFrequency
    );
    const spectralRolloff = calculateSpectralRolloff(
      fftResult.magnitude,
      fftResult.frequencies,
      rolloffThreshold,
      minFrequency,
      maxFrequency
    );
    const spectralFlatness = calculateSpectralFlatness(fftResult.magnitude, minIndex, maxIndex);
    const samples = audio.channelData[channel];
    if (!samples) {
      throw new AudioInspectError("INVALID_INPUT", `\u30C1\u30E3\u30F3\u30CD\u30EB ${channel} \u306E\u30C7\u30FC\u30BF\u304C\u5B58\u5728\u3057\u307E\u305B\u3093`);
    }
    const zeroCrossingRate = calculateZeroCrossingRate(samples);
    return {
      spectralCentroid,
      spectralBandwidth,
      spectralRolloff,
      spectralFlatness,
      zeroCrossingRate,
      frequencyRange: {
        min: minFrequency,
        max: maxFrequency
      }
    };
  }
  async function getTimeVaryingSpectralFeatures(audio, options = {}) {
    const {
      frameSize = 2048,
      hopSize = frameSize / 2,
      fftSize = frameSize,
      windowFunction = "hann",
      channel = 0,
      minFrequency = 0,
      maxFrequency = audio.sampleRate / 2,
      rolloffThreshold = 0.85,
      numFrames
    } = options;
    if (channel >= audio.numberOfChannels) {
      throw new AudioInspectError("INVALID_INPUT", `\u7121\u52B9\u306A\u30C1\u30E3\u30F3\u30CD\u30EB\u756A\u53F7: ${channel}`);
    }
    const samples = audio.channelData[channel];
    if (!samples) {
      throw new AudioInspectError("INVALID_INPUT", `\u30C1\u30E3\u30F3\u30CD\u30EB ${channel} \u306E\u30C7\u30FC\u30BF\u304C\u5B58\u5728\u3057\u307E\u305B\u3093`);
    }
    const totalFrames = numFrames || Math.floor((samples.length - frameSize) / hopSize) + 1;
    if (totalFrames <= 0) {
      throw new AudioInspectError("INVALID_INPUT", "\u30D5\u30EC\u30FC\u30E0\u6570\u304C\u4E0D\u6B63\u3067\u3059");
    }
    const times = new Float32Array(totalFrames);
    const spectralCentroid = new Float32Array(totalFrames);
    const spectralBandwidth = new Float32Array(totalFrames);
    const spectralRolloff = new Float32Array(totalFrames);
    const spectralFlatness = new Float32Array(totalFrames);
    const spectralFlux = new Float32Array(totalFrames);
    const zeroCrossingRate = new Float32Array(totalFrames);
    let previousMagnitude;
    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
      const startSample = frameIndex * hopSize;
      const endSample = Math.min(startSample + frameSize, samples.length);
      times[frameIndex] = startSample / audio.sampleRate;
      const frameData = samples.subarray(startSample, endSample);
      const paddedFrame = new Float32Array(frameSize);
      paddedFrame.set(frameData);
      const frameAudio = {
        channelData: [paddedFrame],
        sampleRate: audio.sampleRate,
        numberOfChannels: 1,
        length: frameSize,
        duration: frameSize / audio.sampleRate
      };
      const features = await getSpectralFeatures(frameAudio, {
        fftSize,
        windowFunction,
        channel: 0,
        minFrequency,
        maxFrequency,
        rolloffThreshold
      });
      spectralCentroid[frameIndex] = features.spectralCentroid;
      spectralBandwidth[frameIndex] = features.spectralBandwidth;
      spectralRolloff[frameIndex] = features.spectralRolloff;
      spectralFlatness[frameIndex] = features.spectralFlatness;
      zeroCrossingRate[frameIndex] = features.zeroCrossingRate;
      const fftResult = await getFFT(frameAudio, { fftSize, windowFunction, channel: 0 });
      spectralFlux[frameIndex] = calculateSpectralFlux(fftResult.magnitude, previousMagnitude);
      previousMagnitude = new Float32Array(fftResult.magnitude);
    }
    return {
      times,
      spectralCentroid,
      spectralBandwidth,
      spectralRolloff,
      spectralFlatness,
      spectralFlux,
      zeroCrossingRate,
      frameInfo: {
        frameSize,
        hopSize,
        numFrames: totalFrames
      }
    };
  }

  // src/features/energy.ts
  function applyEnergyWindow(data, windowType, startIdx, length) {
    const windowed = new Float32Array(length);
    for (let i = 0; i < length && startIdx + i < data.length; i++) {
      let windowValue = 1;
      switch (windowType) {
        case "hann":
          windowValue = 0.5 * (1 - Math.cos(2 * Math.PI * i / (length - 1)));
          break;
        case "hamming":
          windowValue = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (length - 1));
          break;
        case "rectangular":
        default:
          windowValue = 1;
      }
      const sample = ensureValidSample(data[startIdx + i]);
      windowed[i] = sample * windowValue;
    }
    return windowed;
  }
  function getEnergy(audio, options = {}) {
    const {
      frameSize = Math.floor(audio.sampleRate * 0.025),
      // 25ms
      hopSize = Math.floor(audio.sampleRate * 0.01),
      // 10ms
      channel = 0,
      normalized = false,
      windowFunction = "rectangular"
    } = options;
    if (frameSize <= 0 || !Number.isInteger(frameSize)) {
      throw new AudioInspectError("INVALID_INPUT", "frameSize\u306F\u6B63\u306E\u6574\u6570\u3067\u3042\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059");
    }
    if (hopSize <= 0 || !Number.isInteger(hopSize)) {
      throw new AudioInspectError("INVALID_INPUT", "hopSize\u306F\u6B63\u306E\u6574\u6570\u3067\u3042\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059");
    }
    if (hopSize > frameSize) {
      console.warn(
        "[audio-inspect] hopSize\u304CframeSize\u3088\u308A\u5927\u304D\u3044\u305F\u3081\u3001\u30D5\u30EC\u30FC\u30E0\u9593\u306B\u30AE\u30E3\u30C3\u30D7\u304C\u751F\u3058\u307E\u3059"
      );
    }
    const channelData = getChannelData(audio, channel);
    const dataLength = channelData.length;
    if (dataLength === 0) {
      return {
        times: new Float32Array(0),
        energies: new Float32Array(0),
        totalEnergy: 0,
        statistics: { mean: 0, std: 0, max: 0, min: 0 }
      };
    }
    const frameCount = Math.max(0, Math.floor((dataLength - frameSize) / hopSize) + 1);
    if (frameCount === 0) {
      const energy = calculateFrameEnergy(channelData, 0, dataLength, windowFunction);
      return {
        times: new Float32Array([dataLength / 2 / audio.sampleRate]),
        energies: new Float32Array([energy]),
        totalEnergy: energy,
        statistics: { mean: energy, std: 0, max: energy, min: energy }
      };
    }
    const times = new Float32Array(frameCount);
    const energies = new Float32Array(frameCount);
    let totalEnergy = 0;
    let maxEnergy = -Infinity;
    let minEnergy = Infinity;
    for (let i = 0; i < frameCount; i++) {
      const start = i * hopSize;
      const windowedFrame = applyEnergyWindow(channelData, windowFunction, start, frameSize);
      let frameEnergy = 0;
      for (let j = 0; j < windowedFrame.length; j++) {
        const sample = windowedFrame[j];
        if (sample !== void 0) {
          frameEnergy += sample * sample;
        }
      }
      times[i] = (start + frameSize / 2) / audio.sampleRate;
      energies[i] = frameEnergy;
      totalEnergy += frameEnergy;
      maxEnergy = Math.max(maxEnergy, frameEnergy);
      minEnergy = Math.min(minEnergy, frameEnergy);
    }
    const meanEnergy = totalEnergy / frameCount;
    let varianceSum = 0;
    for (let i = 0; i < frameCount; i++) {
      const energy = energies[i];
      if (energy !== void 0) {
        const diff = energy - meanEnergy;
        varianceSum += diff * diff;
      }
    }
    const stdEnergy = Math.sqrt(varianceSum / frameCount);
    if (normalized && totalEnergy > 1e-10) {
      for (let i = 0; i < energies.length; i++) {
        const currentEnergy = energies[i];
        if (currentEnergy !== void 0) {
          energies[i] = currentEnergy / totalEnergy;
        }
      }
      return {
        times,
        energies,
        totalEnergy: 1,
        statistics: {
          mean: meanEnergy / totalEnergy,
          std: stdEnergy / totalEnergy,
          max: maxEnergy / totalEnergy,
          min: minEnergy / totalEnergy
        }
      };
    }
    return {
      times,
      energies,
      totalEnergy,
      statistics: {
        mean: meanEnergy,
        std: stdEnergy,
        max: maxEnergy,
        min: minEnergy
      }
    };
  }
  function calculateFrameEnergy(data, start, length, windowFunction) {
    const windowed = applyEnergyWindow(data, windowFunction, start, length);
    let energy = 0;
    for (const sample of windowed) {
      energy += sample * sample;
    }
    return energy;
  }

  // src/features/dynamics.ts
  function calculateFrameCrestFactor(frameData, method = "simple") {
    if (frameData.length === 0) {
      return { peak: 0, rms: 0, cfDb: -Infinity, cfLinear: 0 };
    }
    let processedData = frameData;
    if (method === "weighted") {
      processedData = frameData;
    }
    let peakVal = 0;
    let sumOfSquares = 0;
    let validSamples = 0;
    for (let i = 0; i < processedData.length; i++) {
      const sample = ensureValidSample(processedData[i]);
      const absSample = Math.abs(sample);
      peakVal = Math.max(peakVal, absSample);
      sumOfSquares += sample * sample;
      validSamples++;
    }
    if (validSamples === 0) {
      return { peak: 0, rms: 0, cfDb: -Infinity, cfLinear: 0 };
    }
    const rmsVal = Math.sqrt(sumOfSquares / validSamples);
    if (rmsVal < 1e-10) {
      return { peak: peakVal, rms: rmsVal, cfDb: Infinity, cfLinear: Infinity };
    }
    const cfLinear = peakVal / rmsVal;
    const cfDb = 20 * Math.log10(cfLinear);
    return { peak: peakVal, rms: rmsVal, cfDb, cfLinear };
  }
  function getCrestFactor(audio, options = {}) {
    const { channel = 0, windowSize, hopSize, method = "simple" } = options;
    const amplitudeOpts = { channel, asDB: false };
    const overallPeak = getPeakAmplitude(audio, amplitudeOpts);
    const overallRms = getRMS(audio, amplitudeOpts);
    const overallCfLinear = overallRms > 1e-10 ? overallPeak / overallRms : Infinity;
    const overallCfDb = overallRms > 1e-10 ? 20 * Math.log10(overallCfLinear) : Infinity;
    let timeVaryingResult;
    if (typeof windowSize === "number" && typeof hopSize === "number") {
      if (windowSize <= 0 || hopSize <= 0) {
        throw new AudioInspectError(
          "INVALID_INPUT",
          "windowSize\u3068hopSize\u306F\u6B63\u306E\u5024\u3067\u3042\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059"
        );
      }
      if (hopSize > windowSize) {
        console.warn(
          "[audio-inspect] hopSize\u304CwindowSize\u3088\u308A\u5927\u304D\u3044\u305F\u3081\u3001\u5206\u6790\u7A93\u9593\u306B\u30AE\u30E3\u30C3\u30D7\u304C\u751F\u3058\u307E\u3059"
        );
      }
      const windowSizeSamples = Math.floor(windowSize * audio.sampleRate);
      const hopSizeSamples = Math.floor(hopSize * audio.sampleRate);
      if (windowSizeSamples === 0 || hopSizeSamples === 0) {
        throw new AudioInspectError("INVALID_INPUT", "\u30B5\u30F3\u30D7\u30EB\u30EC\u30FC\u30C8\u306B\u5BFE\u3057\u3066\u7A93\u30B5\u30A4\u30BA\u304C\u5C0F\u3055\u3059\u304E\u307E\u3059");
      }
      const channelData = getChannelData(audio, channel);
      const dataLength = channelData.length;
      if (dataLength < windowSizeSamples) {
        const result = calculateFrameCrestFactor(channelData, method);
        timeVaryingResult = {
          times: new Float32Array([audio.duration / 2]),
          values: new Float32Array([result.cfDb]),
          valuesLinear: new Float32Array([result.cfLinear]),
          peaks: new Float32Array([result.peak]),
          rmsValues: new Float32Array([result.rms])
        };
      } else {
        const frameCount = Math.floor((dataLength - windowSizeSamples) / hopSizeSamples) + 1;
        const times = new Float32Array(frameCount);
        const values = new Float32Array(frameCount);
        const valuesLinear = new Float32Array(frameCount);
        const peaks = new Float32Array(frameCount);
        const rmsValues = new Float32Array(frameCount);
        for (let i = 0; i < frameCount; i++) {
          const start = i * hopSizeSamples;
          const end = Math.min(start + windowSizeSamples, dataLength);
          const frameData = channelData.subarray(start, end);
          const frameResult = calculateFrameCrestFactor(frameData, method);
          times[i] = (start + windowSizeSamples / 2) / audio.sampleRate;
          values[i] = frameResult.cfDb;
          valuesLinear[i] = frameResult.cfLinear;
          peaks[i] = frameResult.peak;
          rmsValues[i] = frameResult.rms;
        }
        timeVaryingResult = { times, values, valuesLinear, peaks, rmsValues };
      }
    }
    return {
      crestFactor: overallCfDb,
      crestFactorLinear: overallCfLinear,
      peak: overallPeak,
      rms: overallRms,
      timeVarying: timeVaryingResult
    };
  }

  // src/features/stereo.ts
  function estimateDelay(left, right, maxDelaySamples = 44) {
    const len = Math.min(left.length, right.length);
    let maxCorr = -Infinity;
    let bestDelay = 0;
    for (let delay = -maxDelaySamples; delay <= maxDelaySamples; delay++) {
      let correlation = 0;
      let count = 0;
      for (let i = 0; i < len; i++) {
        const leftIdx = i;
        const rightIdx = i + delay;
        if (rightIdx >= 0 && rightIdx < len) {
          const leftSample = ensureValidSample(left[leftIdx]);
          const rightSample = ensureValidSample(right[rightIdx]);
          correlation += leftSample * rightSample;
          count++;
        }
      }
      if (count > 0) {
        correlation /= count;
        if (correlation > maxCorr) {
          maxCorr = correlation;
          bestDelay = delay;
        }
      }
    }
    return bestDelay;
  }
  async function calculateCoherence(left, right, fftSize, sampleRate2) {
    const leftFFT = await getFFT(
      {
        channelData: [left],
        sampleRate: sampleRate2,
        numberOfChannels: 1,
        length: left.length,
        duration: left.length / sampleRate2
      },
      { fftSize }
    );
    const rightFFT = await getFFT(
      {
        channelData: [right],
        sampleRate: sampleRate2,
        numberOfChannels: 1,
        length: right.length,
        duration: right.length / sampleRate2
      },
      { fftSize }
    );
    const coherence = new Float32Array(leftFFT.magnitude.length);
    for (let i = 0; i < coherence.length; i++) {
      const leftMag = leftFFT.magnitude[i] || 0;
      const rightMag = rightFFT.magnitude[i] || 0;
      const leftPhase = leftFFT.phase[i] || 0;
      const rightPhase = rightFFT.phase[i] || 0;
      const crossReal = leftMag * rightMag * Math.cos(leftPhase - rightPhase);
      const crossImag = leftMag * rightMag * Math.sin(leftPhase - rightPhase);
      const crossMag = Math.sqrt(crossReal * crossReal + crossImag * crossImag);
      const denominator = leftMag * leftMag * rightMag * rightMag;
      coherence[i] = denominator > 1e-10 ? crossMag * crossMag / denominator : 0;
    }
    return coherence;
  }
  function calculateFrequencyWidth(leftMag, rightMag, leftPhase, rightPhase) {
    const width = new Float32Array(leftMag.length);
    for (let i = 0; i < width.length; i++) {
      const lMag = leftMag[i] || 0;
      const rMag = rightMag[i] || 0;
      const lPhase = leftPhase[i] || 0;
      const rPhase = rightPhase[i] || 0;
      const phaseDiff = lPhase - rPhase;
      const midMag = Math.abs(lMag + rMag) / 2;
      const sideMag = Math.abs(lMag - rMag) / 2;
      const phaseWidth = Math.abs(Math.sin(phaseDiff / 2));
      const magWidth = sideMag / (midMag + sideMag + 1e-10);
      width[i] = Math.max(magWidth, phaseWidth);
    }
    return width;
  }
  async function getStereoAnalysis(audio, options = {}) {
    if (audio.numberOfChannels < 2) {
      throw new AudioInspectError("INVALID_INPUT", "\u30B9\u30C6\u30EC\u30AA\u89E3\u6790\u306B\u306F2\u30C1\u30E3\u30F3\u30CD\u30EB\u4EE5\u4E0A\u306E\u97F3\u58F0\u304C\u5FC5\u8981\u3067\u3059");
    }
    const {
      frameSize = audio.length,
      calculatePhase = true,
      calculateITD = true,
      calculateILD = true
    } = options;
    const left = audio.channelData[0];
    const right = audio.channelData[1];
    if (!left || !right) {
      throw new AudioInspectError("INVALID_INPUT", "L/R\u30C1\u30E3\u30F3\u30CD\u30EB\u306E\u30C7\u30FC\u30BF\u304C\u5B58\u5728\u3057\u307E\u305B\u3093");
    }
    const len = Math.min(left.length, right.length);
    if (len === 0) {
      return {
        correlation: 0,
        width: 0,
        balance: 0,
        midSideRatio: 0
      };
    }
    let sumL = 0, sumR = 0, sumLR = 0, sumL2 = 0, sumR2 = 0;
    let energyL = 0, energyR = 0;
    for (let i = 0; i < len; i++) {
      const l = ensureValidSample(left[i]);
      const r = ensureValidSample(right[i]);
      sumL += l;
      sumR += r;
      sumLR += l * r;
      sumL2 += l * l;
      sumR2 += r * r;
      energyL += l * l;
      energyR += r * r;
    }
    const meanL = sumL / len;
    const meanR = sumR / len;
    const covariance = sumLR / len - meanL * meanR;
    const stdL = Math.sqrt(sumL2 / len - meanL * meanL);
    const stdR = Math.sqrt(sumR2 / len - meanR * meanR);
    const correlation = stdL > 1e-10 && stdR > 1e-10 ? covariance / (stdL * stdR) : 0;
    const mid = new Float32Array(len);
    const side = new Float32Array(len);
    let energyMid = 0, energySide = 0;
    for (let i = 0; i < len; i++) {
      const l = ensureValidSample(left[i]);
      const r = ensureValidSample(right[i]);
      mid[i] = (l + r) * 0.5;
      side[i] = (l - r) * 0.5;
      energyMid += (mid[i] ?? 0) * (mid[i] ?? 0);
      energySide += (side[i] ?? 0) * (side[i] ?? 0);
    }
    const width = energyMid + energySide > 1e-10 ? energySide / (energyMid + energySide) : 0;
    const balance = energyL + energyR > 1e-10 ? (energyR - energyL) / (energyL + energyR) : 0;
    const midSideRatio = energySide > 1e-10 ? 10 * Math.log10(energyMid / energySide) : Infinity;
    const result = {
      correlation,
      width,
      balance,
      midSideRatio
    };
    if (calculatePhase && frameSize < audio.length) {
      const fftSize = Math.pow(2, Math.ceil(Math.log2(frameSize)));
      result.coherence = await calculateCoherence(
        left.subarray(0, frameSize),
        right.subarray(0, frameSize),
        fftSize,
        audio.sampleRate
      );
      const leftFFT = await getFFT(
        {
          channelData: [left.subarray(0, frameSize)],
          sampleRate: audio.sampleRate,
          numberOfChannels: 1,
          length: frameSize,
          duration: frameSize / audio.sampleRate
        },
        { fftSize }
      );
      const rightFFT = await getFFT(
        {
          channelData: [right.subarray(0, frameSize)],
          sampleRate: audio.sampleRate,
          numberOfChannels: 1,
          length: frameSize,
          duration: frameSize / audio.sampleRate
        },
        { fftSize }
      );
      result.widthFrequency = calculateFrequencyWidth(
        leftFFT.magnitude,
        rightFFT.magnitude,
        leftFFT.phase,
        rightFFT.phase
      );
      let phaseDiffSum = 0;
      let weightSum = 0;
      for (let i = 1; i < leftFFT.phase.length; i++) {
        const leftMag = leftFFT.magnitude[i] || 0;
        const rightMag = rightFFT.magnitude[i] || 0;
        const leftPhase = leftFFT.phase[i] || 0;
        const rightPhase = rightFFT.phase[i] || 0;
        const weight = leftMag * rightMag;
        let phaseDiff = leftPhase - rightPhase;
        while (phaseDiff > Math.PI) phaseDiff -= 2 * Math.PI;
        while (phaseDiff < -Math.PI) phaseDiff += 2 * Math.PI;
        phaseDiffSum += phaseDiff * weight;
        weightSum += weight;
      }
      result.phaseDifference = weightSum > 1e-10 ? phaseDiffSum / weightSum * 180 / Math.PI : 0;
    }
    if (calculateITD) {
      const delaySamples = estimateDelay(left, right);
      result.itd = delaySamples / audio.sampleRate * 1e3;
    }
    if (calculateILD) {
      const rmsL = Math.sqrt(energyL / len);
      const rmsR = Math.sqrt(energyR / len);
      result.ild = rmsL > 1e-10 && rmsR > 1e-10 ? 20 * Math.log10(rmsR / rmsL) : 0;
    }
    result.goniometer = {
      x: side,
      // L-R
      y: mid
      // L+R
    };
    return result;
  }
  function getTimeVaryingStereoAnalysis(_audio, _options = {}) {
    return Promise.reject(
      new AudioInspectError(
        "UNSUPPORTED_FORMAT",
        "\u6642\u7CFB\u5217\u30B9\u30C6\u30EC\u30AA\u89E3\u6790\u306F\u5C06\u6765\u306E\u30D0\u30FC\u30B8\u30E7\u30F3\u3067\u5B9F\u88C5\u4E88\u5B9A\u3067\u3059"
      )
    );
  }

  // src/features/vad.ts
  function applyPreEmphasis(data, alpha = 0.97) {
    const filtered = new Float32Array(data.length);
    filtered[0] = data[0] || 0;
    for (let i = 1; i < data.length; i++) {
      const current = ensureValidSample(data[i]);
      const previous = ensureValidSample(data[i - 1]);
      filtered[i] = current - alpha * previous;
    }
    return filtered;
  }
  function calculateFrameEnergies(channelData, frameSizeSamples, hopSizeSamples, sampleRate2, useLogEnergy = false) {
    const dataLength = channelData.length;
    if (dataLength < frameSizeSamples) {
      return { energies: new Float32Array(0), times: new Float32Array(0) };
    }
    const frameCount = Math.floor((dataLength - frameSizeSamples) / hopSizeSamples) + 1;
    const energies = new Float32Array(frameCount);
    const times = new Float32Array(frameCount);
    for (let i = 0; i < frameCount; i++) {
      const start = i * hopSizeSamples;
      const end = Math.min(start + frameSizeSamples, dataLength);
      let energy = 0;
      let validSamples = 0;
      for (let j = start; j < end; j++) {
        const sample = ensureValidSample(channelData[j]);
        energy += sample * sample;
        validSamples++;
      }
      energy = validSamples > 0 ? energy / validSamples : 0;
      if (useLogEnergy) {
        energies[i] = energy > 1e-10 ? 10 * Math.log10(energy) : -100;
      } else {
        energies[i] = energy;
      }
      times[i] = (start + frameSizeSamples / 2) / sampleRate2;
    }
    return { energies, times };
  }
  function calculateFrameZCRs(channelData, frameSizeSamples, hopSizeSamples, normalize = true) {
    const dataLength = channelData.length;
    if (dataLength < frameSizeSamples) {
      return new Float32Array(0);
    }
    const frameCount = Math.floor((dataLength - frameSizeSamples) / hopSizeSamples) + 1;
    const zcrs = new Float32Array(frameCount);
    for (let i = 0; i < frameCount; i++) {
      const start = i * hopSizeSamples;
      const end = Math.min(start + frameSizeSamples, dataLength);
      let crossings = 0;
      let prevSign = Math.sign(ensureValidSample(channelData[start]));
      for (let j = start + 1; j < end; j++) {
        const sample = ensureValidSample(channelData[j]);
        const currentSign = Math.sign(sample);
        if (prevSign !== currentSign && prevSign !== 0 && currentSign !== 0) {
          crossings++;
        }
        prevSign = currentSign;
      }
      zcrs[i] = normalize ? crossings / Math.max(1, end - start - 1) : crossings;
    }
    return zcrs;
  }
  function calculateAdaptiveThreshold(values, alpha, noiseFactor, initialFrames = 10) {
    const thresholds = new Float32Array(values.length);
    let noiseLevel = 0;
    const noiseFrames = Math.min(initialFrames, values.length);
    for (let i = 0; i < noiseFrames; i++) {
      const value = values[i];
      if (value !== void 0) {
        noiseLevel += value;
      }
    }
    noiseLevel = noiseFrames > 0 ? noiseLevel / noiseFrames : 0;
    for (let i = 0; i < values.length; i++) {
      const value = values[i];
      if (value === void 0) {
        thresholds[i] = i > 0 ? thresholds[i - 1] ?? noiseLevel * noiseFactor : noiseLevel * noiseFactor;
        continue;
      }
      if (i === 0) {
        thresholds[i] = noiseLevel * noiseFactor;
      } else {
        const prevThreshold = thresholds[i - 1];
        if (prevThreshold !== void 0 && value < prevThreshold) {
          noiseLevel = alpha * noiseLevel + (1 - alpha) * value;
        }
        thresholds[i] = noiseLevel * noiseFactor;
      }
    }
    return thresholds;
  }
  function smoothDecisions(decisions, windowSize = 5) {
    const smoothed = new Float32Array(decisions.length);
    const halfWindow = Math.floor(windowSize / 2);
    for (let i = 0; i < decisions.length; i++) {
      const start = Math.max(0, i - halfWindow);
      const end = Math.min(decisions.length, i + halfWindow + 1);
      const windowValues = [];
      for (let j = start; j < end; j++) {
        const value = decisions[j];
        if (value !== void 0) {
          windowValues.push(value);
        }
      }
      windowValues.sort((a, b) => a - b);
      if (windowValues.length > 0) {
        const medianIdx = Math.floor(windowValues.length / 2);
        const medianValue = windowValues[medianIdx];
        smoothed[i] = medianValue ?? 0;
      } else {
        smoothed[i] = 0;
      }
    }
    return smoothed;
  }
  function createSegmentsFromContinuous(decisions, times, threshold = 0.5, minSpeechSec = 0.1, minSilenceSec = 0.3) {
    const segments = [];
    let currentSegment = null;
    for (let i = 0; i < decisions.length; i++) {
      const decision = decisions[i];
      const time = times[i];
      if (decision === void 0 || time === void 0) continue;
      const isSpeech = decision >= threshold;
      if (!currentSegment) {
        currentSegment = {
          start: time,
          end: time,
          type: isSpeech ? "speech" : "silence",
          confidence: Math.abs(decision - 0.5) * 2
        };
      } else if (isSpeech && currentSegment.type === "speech" || !isSpeech && currentSegment.type === "silence") {
        currentSegment.end = time;
        const conf = Math.abs(decision - 0.5) * 2;
        currentSegment.confidence = Math.max(currentSegment.confidence || 0, conf);
      } else {
        segments.push(currentSegment);
        currentSegment = {
          start: time,
          end: time,
          type: isSpeech ? "speech" : "silence",
          confidence: Math.abs(decision - 0.5) * 2
        };
      }
    }
    if (currentSegment) {
      segments.push(currentSegment);
    }
    return filterShortSegments(segments, minSpeechSec, minSilenceSec);
  }
  function filterShortSegments(segments, minSpeechSec, minSilenceSec) {
    if (segments.length === 0) return [];
    const filtered = [];
    let i = 0;
    while (i < segments.length) {
      const current = segments[i];
      if (!current) {
        i++;
        continue;
      }
      const duration = current.end - current.start;
      if (current.type === "speech" && duration >= minSpeechSec || current.type === "silence" && duration >= minSilenceSec) {
        filtered.push(current);
        i++;
      } else {
        if (filtered.length > 0 && i + 1 < segments.length) {
          const prev = filtered[filtered.length - 1];
          const next = segments[i + 1];
          if (prev && next && prev.type === next.type) {
            prev.end = next.end;
            i += 2;
            continue;
          }
        }
        if (filtered.length > 0) {
          const lastFiltered = filtered[filtered.length - 1];
          if (lastFiltered) {
            lastFiltered.end = current.end;
          }
        }
        i++;
      }
    }
    return filtered;
  }
  function getVAD(audio, options = {}) {
    const {
      channel = 0,
      frameSizeMs = 30,
      // 30msフレーム
      hopSizeMs = 10,
      // 10msホップ
      method = "combined",
      energyThreshold = 0.02,
      zcrThresholdLow = 0.05,
      zcrThresholdHigh = 0.15,
      adaptiveAlpha = 0.99,
      noiseFactor = 3,
      minSilenceDurationMs = 300,
      minSpeechDurationMs = 100,
      preEmphasis = true,
      smoothing = true
    } = options;
    let channelData = getChannelData(audio, channel);
    if (preEmphasis) {
      channelData = applyPreEmphasis(channelData);
    }
    const sr = audio.sampleRate;
    const frameSizeSamples = Math.floor(frameSizeMs / 1e3 * sr);
    const hopSizeSamples = Math.floor(hopSizeMs / 1e3 * sr);
    if (frameSizeSamples === 0 || hopSizeSamples === 0) {
      return { segments: [], speechRatio: 0 };
    }
    const { energies, times } = calculateFrameEnergies(
      channelData,
      frameSizeSamples,
      hopSizeSamples,
      sr,
      false
    );
    const zcrs = calculateFrameZCRs(channelData, frameSizeSamples, hopSizeSamples, true);
    if (energies.length === 0) {
      return { segments: [], speechRatio: 0 };
    }
    const decisions = new Float32Array(energies.length);
    switch (method) {
      case "energy": {
        for (let i = 0; i < energies.length; i++) {
          const energy = energies[i];
          decisions[i] = energy !== void 0 && energy > energyThreshold ? 1 : 0;
        }
        break;
      }
      case "zcr": {
        for (let i = 0; i < zcrs.length; i++) {
          const zcr = zcrs[i];
          decisions[i] = zcr !== void 0 && zcr > zcrThresholdLow && zcr < zcrThresholdHigh ? 1 : 0;
        }
        break;
      }
      case "combined": {
        for (let i = 0; i < energies.length; i++) {
          const energy = energies[i];
          const zcr = zcrs[i];
          const energyScore = energy !== void 0 && energy > energyThreshold ? 1 : 0;
          const zcrScore = zcr !== void 0 && zcr > zcrThresholdLow && zcr < zcrThresholdHigh ? 1 : 0;
          decisions[i] = (energyScore + zcrScore) / 2;
        }
        break;
      }
      case "adaptive": {
        const adaptiveThreshold = calculateAdaptiveThreshold(energies, adaptiveAlpha, noiseFactor);
        for (let i = 0; i < energies.length; i++) {
          const energy = energies[i];
          const zcr = zcrs[i];
          const threshold = adaptiveThreshold[i];
          const energyScore = energy !== void 0 && threshold !== void 0 && energy > threshold ? 1 : 0;
          const zcrScore = zcr !== void 0 && zcr > zcrThresholdLow && zcr < zcrThresholdHigh ? 0.5 : 0;
          decisions[i] = Math.min(1, energyScore + zcrScore);
        }
        break;
      }
    }
    const finalDecisions = smoothing ? smoothDecisions(decisions, 5) : decisions;
    const minSpeechSec = minSpeechDurationMs / 1e3;
    const minSilenceSec = minSilenceDurationMs / 1e3;
    const segments = createSegmentsFromContinuous(
      finalDecisions,
      times,
      0.5,
      minSpeechSec,
      minSilenceSec
    );
    let totalSpeechDuration = 0;
    for (const seg of segments) {
      if (seg.type === "speech") {
        totalSpeechDuration += seg.end - seg.start;
      }
    }
    const speechRatio = audio.duration > 0 ? Math.min(1, totalSpeechDuration / audio.duration) : 0;
    return {
      segments,
      speechRatio,
      features: {
        energies,
        zcrs,
        decisions: finalDecisions,
        times
      }
    };
  }

  // src/features/loudness.ts
  var ABSOLUTE_GATE_LUFS = -70;
  var RELATIVE_GATE_LU = 10;
  var BLOCK_SIZE_MS = 400;
  var BLOCK_OVERLAP = 0.75;
  var SHORT_TERM_WINDOW_MS = 3e3;
  var MOMENTARY_WINDOW_MS = 400;
  var K_WEIGHTING_STAGE1 = {
    // High-pass filter (Butterworth)
    b: [1.53512485958697, -2.69169618940638, 1.19839281085285],
    a: [1, -1.69065929318241, 0.73248077421585]
  };
  var K_WEIGHTING_STAGE2 = {
    // High-frequency shelf
    b: [1.53660026327012, -2.68908427791073, 1.16158667615261],
    a: [1, -1.68859431835989, 0.72909998803284]
  };
  function applyBiquad(input, b, a, state = { x1: 0, x2: 0, y1: 0, y2: 0 }) {
    const output = new Float32Array(input.length);
    let { x1, x2, y1, y2 } = state;
    for (let i = 0; i < input.length; i++) {
      const x0 = ensureValidSample(input[i]);
      const b0 = b[0] ?? 0;
      const b1 = b[1] ?? 0;
      const b2 = b[2] ?? 0;
      const a1 = a[1] ?? 0;
      const a2 = a[2] ?? 0;
      const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      output[i] = y0;
      x2 = x1;
      x1 = x0;
      y2 = y1;
      y1 = y0;
    }
    state.x1 = x1;
    state.x2 = x2;
    state.y1 = y1;
    state.y2 = y2;
    return output;
  }
  function applyKWeighting(channelData) {
    let filtered = applyBiquad(channelData, K_WEIGHTING_STAGE1.b, K_WEIGHTING_STAGE1.a);
    filtered = applyBiquad(filtered, K_WEIGHTING_STAGE2.b, K_WEIGHTING_STAGE2.a);
    return filtered;
  }
  function calculateBlockLoudness(channels) {
    let sumOfSquares = 0;
    const numChannels = channels.length;
    if (numChannels === 0) return -Infinity;
    for (let ch = 0; ch < numChannels; ch++) {
      const channelData = channels[ch];
      if (!channelData || channelData.length === 0) continue;
      let channelSum = 0;
      let validSamples = 0;
      for (let i = 0; i < channelData.length; i++) {
        const sample = ensureValidSample(channelData[i]);
        channelSum += sample * sample;
        validSamples++;
      }
      if (validSamples === 0) continue;
      const channelWeight = 1;
      sumOfSquares += channelWeight * (channelSum / validSamples);
    }
    return -0.691 + 10 * Math.log10(Math.max(1e-15, sumOfSquares));
  }
  function getLUFS(audio, options = {}) {
    const {
      channelMode = audio.numberOfChannels >= 2 ? "stereo" : "mono",
      gated = true,
      calculateShortTerm = false,
      calculateMomentary = false,
      calculateLoudnessRange = false,
      calculateTruePeak = false
    } = options;
    if (audio.numberOfChannels === 0) {
      throw new AudioInspectError("INVALID_INPUT", "\u51E6\u7406\u53EF\u80FD\u306A\u30C1\u30E3\u30F3\u30CD\u30EB\u304C\u3042\u308A\u307E\u305B\u3093");
    }
    const channelsToProcess = [];
    if (channelMode === "mono") {
      const channel0 = audio.channelData[0];
      if (channel0) {
        channelsToProcess.push(channel0);
      }
    } else {
      const channel0 = audio.channelData[0];
      const channel1 = audio.channelData[1];
      if (channel0) channelsToProcess.push(channel0);
      if (channel1) channelsToProcess.push(channel1);
    }
    if (channelsToProcess.length === 0) {
      throw new AudioInspectError("INVALID_INPUT", "\u51E6\u7406\u53EF\u80FD\u306A\u30C1\u30E3\u30F3\u30CD\u30EB\u304C\u3042\u308A\u307E\u305B\u3093");
    }
    const kWeightedChannels = channelsToProcess.map((ch) => applyKWeighting(ch));
    const sampleRate2 = audio.sampleRate;
    const blockSizeSamples = Math.floor(BLOCK_SIZE_MS / 1e3 * sampleRate2);
    const hopSizeSamples = Math.floor(blockSizeSamples * (1 - BLOCK_OVERLAP));
    const dataLength = kWeightedChannels[0]?.length ?? 0;
    if (dataLength === 0) {
      return { integrated: -Infinity };
    }
    const blockLoudnessValues = [];
    for (let pos = 0; pos + blockSizeSamples <= dataLength; pos += hopSizeSamples) {
      const blockChannels = kWeightedChannels.map((ch) => ch.subarray(pos, pos + blockSizeSamples));
      const loudness = calculateBlockLoudness(blockChannels);
      if (isFinite(loudness)) {
        blockLoudnessValues.push(loudness);
      }
    }
    let integratedLoudness = -Infinity;
    if (blockLoudnessValues.length > 0) {
      let finalLoudnessValues = [...blockLoudnessValues];
      if (gated) {
        finalLoudnessValues = finalLoudnessValues.filter((l) => l >= ABSOLUTE_GATE_LUFS);
        if (finalLoudnessValues.length > 0) {
          const sumPower = finalLoudnessValues.reduce((sum, lufs) => {
            return sum + Math.pow(10, (lufs + 0.691) / 10);
          }, 0);
          const meanLoudness = -0.691 + 10 * Math.log10(sumPower / finalLoudnessValues.length);
          const relativeThreshold = meanLoudness - RELATIVE_GATE_LU;
          finalLoudnessValues = finalLoudnessValues.filter((l) => l >= relativeThreshold);
        }
      }
      if (finalLoudnessValues.length > 0) {
        const sumPower = finalLoudnessValues.reduce((sum, lufs) => {
          return sum + Math.pow(10, (lufs + 0.691) / 10);
        }, 0);
        integratedLoudness = -0.691 + 10 * Math.log10(sumPower / finalLoudnessValues.length);
      }
    }
    const result = {
      integrated: integratedLoudness
    };
    if (calculateShortTerm) {
      const shortTermSamples = Math.floor(SHORT_TERM_WINDOW_MS / 1e3 * sampleRate2);
      const shortTermHop = hopSizeSamples;
      const shortTermValues = [];
      for (let pos = 0; pos + shortTermSamples <= dataLength; pos += shortTermHop) {
        const windowChannels = kWeightedChannels.map(
          (ch) => ch.subarray(pos, pos + shortTermSamples)
        );
        const loudness = calculateBlockLoudness(windowChannels);
        if (isFinite(loudness)) {
          shortTermValues.push(loudness);
        }
      }
      result.shortTerm = new Float32Array(shortTermValues);
    }
    if (calculateMomentary) {
      const momentarySamples = Math.floor(MOMENTARY_WINDOW_MS / 1e3 * sampleRate2);
      const momentaryHop = hopSizeSamples;
      const momentaryValues = [];
      for (let pos = 0; pos + momentarySamples <= dataLength; pos += momentaryHop) {
        const windowChannels = kWeightedChannels.map(
          (ch) => ch.subarray(pos, pos + momentarySamples)
        );
        const loudness = calculateBlockLoudness(windowChannels);
        if (isFinite(loudness)) {
          momentaryValues.push(loudness);
        }
      }
      result.momentary = new Float32Array(momentaryValues);
    }
    if (calculateLoudnessRange && result.shortTerm) {
      const validValues = Array.from(result.shortTerm).filter((v) => v > ABSOLUTE_GATE_LUFS && isFinite(v)).sort((a, b) => a - b);
      if (validValues.length > 0) {
        const percentile10Index = Math.floor(validValues.length * 0.1);
        const percentile95Index = Math.floor(validValues.length * 0.95);
        const percentile10 = validValues[percentile10Index] ?? -Infinity;
        const percentile95 = validValues[percentile95Index] ?? -Infinity;
        result.loudnessRange = percentile95 - percentile10;
        result.statistics = { percentile10, percentile95 };
      }
    }
    if (calculateTruePeak) {
      result.truePeak = channelsToProcess.map((ch) => {
        let peak = 0;
        for (const sample of ch) {
          const sampleValue = ensureValidSample(sample);
          peak = Math.max(peak, Math.abs(sampleValue));
        }
        return peak > 0 ? 20 * Math.log10(peak) : -Infinity;
      });
    }
    return result;
  }

  // src/core/AudioInspectProcessor.ts
  var isAudioWorkletGlobalScope = typeof AudioWorkletGlobalScope !== "undefined";
  var featureMap = {};
  try {
    featureMap = {
      // 時間領域の特徴量
      getRMS,
      getPeaks,
      getZeroCrossing,
      getWaveform,
      getPeak: getPeakAmplitude,
      getPeakAmplitude,
      // 周波数領域の特徴量
      getFFT,
      getSpectrum,
      // スペクトル特徴量
      getSpectralFeatures,
      getTimeVaryingSpectralFeatures,
      // エネルギー解析
      getEnergy,
      // ダイナミクス解析
      getCrestFactor,
      // ステレオ解析
      getStereoAnalysis,
      getTimeVaryingStereoAnalysis,
      // VAD（音声区間検出）
      getVAD,
      // LUFS（ラウドネス測定）
      getLUFS,
      // フォールバック（他の関数も含む）
      ...features_exports
    };
  } catch (error) {
    console.warn("[AudioInspectProcessor] \u4E00\u90E8\u306E\u6A5F\u80FD\u306E\u30A4\u30F3\u30DD\u30FC\u30C8\u306B\u5931\u6557\u3001\u57FA\u672C\u6A5F\u80FD\u306E\u307F\u4F7F\u7528:", error);
    featureMap = {
      getRMS: (audio) => {
        const channelData = audio.channelData[0];
        if (!channelData) return 0;
        let sumOfSquares = 0;
        for (let i = 0; i < channelData.length; i++) {
          const sample = channelData[i] || 0;
          sumOfSquares += sample * sample;
        }
        return Math.sqrt(sumOfSquares / channelData.length);
      },
      // 他の基本的な機能も同様に実装
      getPeak: (audio) => {
        const channelData = audio.channelData[0];
        if (!channelData) return 0;
        let max = 0;
        for (let i = 0; i < channelData.length; i++) {
          const abs = Math.abs(channelData[i] || 0);
          if (abs > max) max = abs;
        }
        return max;
      }
    };
  }
  var AudioInspectProcessor = class extends AudioWorkletProcessor {
    options = {
      featureName: "getRMS",
      bufferSize: 1024,
      hopSize: 512,
      inputChannelCount: 1
    };
    buffers = [];
    bufferWritePosition = 0;
    lastAnalysisPosition = 0;
    isAnalyzing = false;
    // 解析実行中フラグ（排他制御）
    constructor(options) {
      super();
      try {
        console.log("[AudioInspectProcessor] \u521D\u671F\u5316\u958B\u59CB", {
          isAudioWorklet: isAudioWorkletGlobalScope,
          options
        });
        this.options = {
          featureName: "getRMS",
          bufferSize: 1024,
          hopSize: 512,
          inputChannelCount: 1,
          ...options?.processorOptions || {}
        };
        console.log("[AudioInspectProcessor] \u8A2D\u5B9A\u521D\u671F\u5316\u5B8C\u4E86", this.options);
        this.buffers = new Array(this.options.inputChannelCount).fill(null).map(
          () => new Float32Array(this.options.bufferSize * 2 + 256)
        );
        console.log("[AudioInspectProcessor] \u30D0\u30C3\u30D5\u30A1\u521D\u671F\u5316\u5B8C\u4E86", {
          inputChannelCount: this.options.inputChannelCount,
          bufferSize: this.options.bufferSize,
          totalBufferSize: this.options.bufferSize * 2 + 256
        });
        this.port.onmessage = this.handleMessage.bind(this);
        console.log("[AudioInspectProcessor] \u521D\u671F\u5316\u5B8C\u4E86");
      } catch (error) {
        console.error("[AudioInspectProcessor] \u521D\u671F\u5316\u30A8\u30E9\u30FC:", error);
        this.port.postMessage({
          type: "error",
          message: "\u30D7\u30ED\u30BB\u30C3\u30B5\u30FC\u521D\u671F\u5316\u5931\u6557",
          detail: error
        });
      }
    }
    process(inputs, _outputs, _parameters) {
      console.log("AudioInspectProcessor: process\u95A2\u6570\u547C\u3073\u51FA\u3057", {
        inputsLength: inputs.length,
        firstInputLength: inputs[0]?.length || 0,
        firstChannelLength: inputs[0]?.[0]?.length || 0
      });
      const input = inputs[0];
      if (!input || input.length === 0) {
        console.log("AudioInspectProcessor: \u5165\u529B\u30C7\u30FC\u30BF\u306A\u3057\u3001\u30B9\u30AD\u30C3\u30D7");
        return true;
      }
      try {
        this.addToBuffer(input);
        this.checkAndPerformAnalysis();
      } catch (error) {
        console.error("AudioInspectProcessor: process\u95A2\u6570\u3067\u30A8\u30E9\u30FC:", error);
        this.sendError("Error occurred during processing", error);
      }
      return true;
    }
    addToBuffer(input) {
      const frameSize = input[0]?.length || 0;
      if (frameSize === 0) return;
      for (let channel = 0; channel < Math.min(input.length, this.options.inputChannelCount); channel++) {
        const channelData = input[channel];
        const buffer = this.buffers[channel];
        if (channelData && buffer) {
          for (let i = 0; i < frameSize; i++) {
            buffer[this.bufferWritePosition + i] = channelData[i] || 0;
          }
        }
      }
      this.bufferWritePosition += frameSize;
      const firstBuffer = this.buffers[0];
      if (firstBuffer && this.bufferWritePosition + frameSize > firstBuffer.length) {
        this.shiftBuffers();
      }
    }
    /**
     * Shift buffer data forward to secure space
     * Works as a sliding window
     */
    shiftBuffers() {
      const keepSize = this.options.bufferSize;
      const shiftAmount = this.bufferWritePosition - keepSize;
      if (shiftAmount <= 0) return;
      this.port.postMessage({
        type: "bufferOverflow",
        details: {
          bufferWritePosition: this.bufferWritePosition,
          bufferSize: this.options.bufferSize,
          timestamp: currentTime
        }
      });
      for (const buffer of this.buffers) {
        buffer.copyWithin(0, shiftAmount, this.bufferWritePosition);
      }
      this.bufferWritePosition = keepSize;
      this.lastAnalysisPosition = Math.max(0, this.lastAnalysisPosition - shiftAmount);
    }
    /**
     * 解析実行の判定（ホップサイズベース）
     */
    checkAndPerformAnalysis() {
      if (this.isAnalyzing) {
        return;
      }
      const newDataSize = this.bufferWritePosition - this.lastAnalysisPosition;
      console.log("AudioInspectProcessor: \u30D0\u30C3\u30D5\u30A1\u72B6\u6CC1\u30C1\u30A7\u30C3\u30AF", {
        newDataSize,
        hopSize: this.options.hopSize,
        bufferWritePosition: this.bufferWritePosition,
        bufferSize: this.options.bufferSize,
        lastAnalysisPosition: this.lastAnalysisPosition,
        shouldAnalyze: newDataSize >= this.options.hopSize && this.bufferWritePosition >= this.options.bufferSize
      });
      if (newDataSize >= this.options.hopSize && this.bufferWritePosition >= this.options.bufferSize) {
        console.log("AudioInspectProcessor: \u89E3\u6790\u5B9F\u884C\u6761\u4EF6\u3092\u6E80\u305F\u3057\u307E\u3057\u305F\u3001\u89E3\u6790\u958B\u59CB");
        const nextAnalysisPosition = this.lastAnalysisPosition + this.options.hopSize;
        this.lastAnalysisPosition = nextAnalysisPosition;
        this.performAnalysisAsync();
      }
    }
    /**
     * Execute analysis asynchronously (does not block audio thread)
     */
    performAnalysisAsync() {
      this.isAnalyzing = true;
      try {
        const analysisData = this.extractAnalysisData();
        const audioData = {
          sampleRate,
          channelData: analysisData,
          duration: this.options.bufferSize / sampleRate,
          numberOfChannels: analysisData.length,
          length: this.options.bufferSize
        };
        this.executeFeatureFunctionAsync(audioData);
      } catch (error) {
        this.isAnalyzing = false;
        this.sendError("Error occurred during analysis processing", error);
      }
    }
    /**
     * 解析データを現在のバッファから抽出
     */
    extractAnalysisData() {
      const startPos = this.bufferWritePosition - this.options.bufferSize;
      const channelData = [];
      for (let channel = 0; channel < this.options.inputChannelCount; channel++) {
        const data = new Float32Array(this.options.bufferSize);
        const sourceBuffer = this.buffers[channel];
        if (sourceBuffer) {
          for (let i = 0; i < this.options.bufferSize; i++) {
            data[i] = sourceBuffer[startPos + i] || 0;
          }
        }
        channelData.push(data);
      }
      return channelData;
    }
    /**
     * Execute analysis function asynchronously and handle results or errors
     */
    executeFeatureFunctionAsync(audioData) {
      console.log("AudioInspectProcessor: \u89E3\u6790\u95A2\u6570\u5B9F\u884C\u958B\u59CB", {
        featureName: this.options.featureName,
        audioDataLength: audioData.length,
        numberOfChannels: audioData.numberOfChannels
      });
      const featureFunction = featureMap[this.options.featureName];
      if (!featureFunction || typeof featureFunction !== "function") {
        console.error("AudioInspectProcessor: \u89E3\u6790\u95A2\u6570\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093:", this.options.featureName);
        this.isAnalyzing = false;
        this.sendError(`Unknown analysis function: ${this.options.featureName}`);
        return;
      }
      try {
        const resultOrPromise = featureFunction(audioData, this.options.featureOptions);
        const isPromiseLike = (value) => {
          return value !== null && typeof value === "object" && "then" in value && typeof value.then === "function";
        };
        if (isPromiseLike(resultOrPromise)) {
          console.log("AudioInspectProcessor: \u975E\u540C\u671F\u89E3\u6790\u95A2\u6570\u5B9F\u884C\u4E2D...");
          resultOrPromise.then((result) => {
            console.log("AudioInspectProcessor: \u975E\u540C\u671F\u89E3\u6790\u5B8C\u4E86\u3001\u7D50\u679C:", result);
            this.sendResult(result);
            this.isAnalyzing = false;
          }).catch((error) => {
            console.error("AudioInspectProcessor: \u975E\u540C\u671F\u89E3\u6790\u30A8\u30E9\u30FC:", error);
            this.sendError("Error occurred during analysis execution", error);
            this.isAnalyzing = false;
          });
        } else {
          console.log("AudioInspectProcessor: \u540C\u671F\u89E3\u6790\u5B8C\u4E86\u3001\u7D50\u679C:", resultOrPromise);
          this.sendResult(resultOrPromise);
          this.isAnalyzing = false;
        }
      } catch (error) {
        console.error("AudioInspectProcessor: \u89E3\u6790\u95A2\u6570\u5B9F\u884C\u30A8\u30E9\u30FC:", error);
        this.isAnalyzing = false;
        this.sendError("Error occurred during analysis execution", error);
      }
    }
    /**
     * Send analysis result to main thread
     */
    sendResult(data) {
      console.log("AudioInspectProcessor: \u89E3\u6790\u7D50\u679C\u3092\u9001\u4FE1:", {
        type: "analysisResult",
        data,
        timestamp: Date.now()
      });
      const message = {
        type: "analysisResult",
        data,
        timestamp: Date.now()
      };
      this.port.postMessage(message);
    }
    /**
     * Send error to main thread
     */
    sendError(message, detail) {
      console.log("AudioInspectProcessor: \u30A8\u30E9\u30FC\u3092\u9001\u4FE1:", {
        type: "error",
        message,
        detail
      });
      const errorMessage = {
        type: "error",
        message,
        detail
      };
      this.port.postMessage(errorMessage);
    }
    handleMessage(event) {
      const message = event.data;
      switch (message.type) {
        case "updateOptions":
          this.handleUpdateOptions(message);
          break;
        case "reset":
          this.handleReset();
          break;
        default:
          console.warn("Unknown message type:", message.type);
          void message;
      }
    }
    /**
     * オプション更新（部分更新をサポート）
     */
    handleUpdateOptions(message) {
      const newOptions = { ...this.options, ...message.payload };
      if (newOptions.bufferSize !== this.options.bufferSize || newOptions.inputChannelCount !== this.options.inputChannelCount) {
        this.options = newOptions;
        this.reinitializeBuffers();
      } else {
        this.options = newOptions;
      }
    }
    handleReset() {
      this.bufferWritePosition = 0;
      this.lastAnalysisPosition = 0;
      this.isAnalyzing = false;
      for (const buffer of this.buffers) {
        buffer.fill(0);
      }
    }
    reinitializeBuffers() {
      this.buffers = new Array(this.options.inputChannelCount).fill(null).map(
        () => new Float32Array(this.options.bufferSize * 2 + 256)
      );
      this.bufferWritePosition = 0;
      this.lastAnalysisPosition = 0;
      this.isAnalyzing = false;
    }
  };
  registerProcessor("audio-inspect-processor", AudioInspectProcessor);
})();
//# sourceMappingURL=AudioInspectProcessor.global.js.map