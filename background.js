const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';

// Check if offscreen document is already created
async function hasOffscreenDocument() {
  if (chrome.offscreen.hasDocument) {
    return await chrome.offscreen.hasDocument();
  }
  // Fallback for older Chrome versions
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });
  return contexts.length > 0;
}

// Create the offscreen document if it doesn't exist
async function setupOffscreenDocument() {
  if (await hasOffscreenDocument()) return;

  await chrome.offscreen.createDocument({
    url: OFFSCREEN_DOCUMENT_PATH,
    reasons: ['DOM_PARSER'],
    justification: 'Run ONNX phishing detection model'
  });
}

// Perform phishing analysis by querying the offscreen document
async function analyzeUrl(url) {
  if (!url) return 0;
  
  // Skip scanning if the URL is not a standard web page (HTTP/HTTPS)
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return 0;
  }

  try {
    await setupOffscreenDocument();
    
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        target: 'offscreen',
        action: 'analyzeUrl',
        url: url
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("Communication with offscreen failed:", chrome.runtime.lastError);
          resolve(0);
        } else {
          resolve(response ? response.score : 0);
        }
      });
    });
  } catch (error) {
    console.error("Error setting up offscreen or sending message:", error);
    return 0;
  }
}

// Listen for tab navigation updates
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const url = tab.url;
    console.log("Analyzing navigation URL:", url);

    try {
      const score = await analyzeUrl(url);
      const percentage = (score * 100).toFixed(2);
      console.log(`URL: ${url} -> Phishing Score: ${percentage}%`);

      if (score > 0.75) {
        console.warn(`Phishing detected (>75%): ${percentage}%. Injecting warning page overlay...`);
        
        // 1. Pass the score to the tab context
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: (scorePercent) => {
            window.__phishingScore = scorePercent;
          },
          args: [percentage]
        });

        // 2. Inject the CSS styling
        await chrome.scripting.insertCSS({
          target: { tabId: tabId },
          files: ['warning.css']
        });

        // 3. Inject the warning overlay creator script
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['warning.js']
        });
      }
    } catch (error) {
      console.error("Error during tab navigation analysis and injection:", error);
    }
  }
});

// Listen for messages from injected warning pages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'goBack' && sender.tab) {
    chrome.tabs.goBack(sender.tab.id).catch(() => {
      // If no history, redirect to the new tab page
      chrome.tabs.update(sender.tab.id, { url: 'chrome://newtab/' });
    });
  }
});