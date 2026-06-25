// Map both variants so the library can fallback seamlessly
ort.env.wasm.wasmPaths = {
  'ort-wasm-simd-threaded.wasm': chrome.runtime.getURL('ort-wasm-simd-threaded.wasm'),
  'ort-wasm-simd-threaded.jsep.wasm': chrome.runtime.getURL('ort-wasm-simd-threaded.jsep.wasm'),
  'ort-wasm-simd.wasm': chrome.runtime.getURL('ort-wasm-simd.wasm'),
};

let session = null;

// Initialize the ONNX inference session
async function loadModel() {
  try {
    const statusText = document.getElementById('status-text');
    
    // Explicitly fallback to CPU execution provider if WebGL/WebGPU drops out
    session = await ort.InferenceSession.create('./model.onnx', {
      executionProviders: ['wasm']
    });
    
    statusText.innerText = "Analyzing URL...";
    analyzeCurrentTab();
  } catch (error) {
    console.error("Failed to load ONNX model:", error);
    document.getElementById('status-text').innerText = "Model loading error.";
  }
}

// Extract current active window URL and evaluate it
async function analyzeCurrentTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    if (!tabs[0] || !tabs[0].url) {
      document.getElementById('current-url').innerText = "Unable to read URL.";
      return;
    }

    const currentUrl = tabs[0].url;
    document.getElementById('current-url').innerText = currentUrl;

    // Skip scanning internal browser pages
    if (currentUrl.startsWith('chrome://') || currentUrl.startsWith('about:')) {
      updateUI('Safe (System Page)', 0);
      return;
    }

    try {
      // Shape the data matching the model structure: 1D array containing the string
      const tensor = new ort.Tensor('string', [currentUrl], [1]);
      
      // Feed tensor input array mapped to the session keys
      const results = await session.run({ inputs: tensor });
      
      // Extract output probability mapping array properties
      const probabilities = results['probabilities'].data;
      
      // The model returns [prob_safe, prob_phishing]. 
      // Index 1 corresponds to the malicious likelihood index.
      const phishingProbability = probabilities[1]; 
      const percentage = (phishingProbability * 100).toFixed(2);

      if (phishingProbability > 0.5) {
        updateUI('Phishing Detected!', percentage, 'phishing');
      } else {
        updateUI('Looks Safe', percentage, 'safe');
      }

    } catch (err) {
      console.error("Inference Error:", err);
      document.getElementById('status-text').innerText = "Analysis failed.";
    }
  });
}

function updateUI(statusMsg, percentage, statusClass = 'loading') {
  const resultDiv = document.getElementById('result');
  resultDiv.className = `result-container ${statusClass}`;
  document.getElementById('status-text').innerText = statusMsg;
  document.getElementById('score').innerText = `${percentage}%`;
}

// Kickstart process on DOM ready layout bindings
document.addEventListener('DOMContentLoaded', loadModel);