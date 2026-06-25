// Configure WASM paths for ONNX Runtime Web
ort.env.wasm.wasmPaths = {
  'ort-wasm-simd-threaded.wasm': chrome.runtime.getURL('ort-wasm-simd-threaded.wasm'),
  'ort-wasm-simd-threaded.jsep.wasm': chrome.runtime.getURL('ort-wasm-simd-threaded.jsep.wasm'),
  'ort-wasm-simd.wasm': chrome.runtime.getURL('ort-wasm-simd.wasm'),
};

let session = null;

// Initialize the ONNX inference session in the offscreen document
async function loadModel() {
  if (session) return session;
  try {
    session = await ort.InferenceSession.create(chrome.runtime.getURL('model.onnx'), {
      executionProviders: ['wasm']
    });
    console.log("ONNX model loaded successfully in offscreen document.");
    return session;
  } catch (error) {
    console.error("Failed to load ONNX model in offscreen document:", error);
    return null;
  }
}

// Pre-load the model
loadModel();

// Listen for analysis requests from the background service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target === 'offscreen' && message.action === 'analyzeUrl') {
    runInference(message.url).then(score => {
      sendResponse({ score: score });
    });
    return true; // Keep message channel open for asynchronous response
  }
});

// Run URL inference
async function runInference(url) {
  const modelSession = await loadModel();
  if (!modelSession) {
    console.warn("Model session not ready for analysis.");
    return 0;
  }

  try {
    const tensor = new ort.Tensor('string', [url], [1]);
    const results = await modelSession.run({ inputs: tensor });
    const probabilities = results['probabilities'].data;
    
    // Index 1 is the phishing probability
    return probabilities[1]; 
  } catch (err) {
    console.error("Inference Error in offscreen document:", err);
    return 0;
  }
}
