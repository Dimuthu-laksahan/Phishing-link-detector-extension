(function() {
  // Prevent duplicate warning overlays on the same page
  if (document.getElementById('phishing-warning-host')) {
    return;
  }

  // Create the shadow host element
  const host = document.createElement('div');
  host.id = 'phishing-warning-host';
  
  // Attach shadow root to isolate extension styles from the host page
  const shadow = host.attachShadow({ mode: 'open' });

  // Load the warning.css file into the Shadow DOM
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = chrome.runtime.getURL('warning.css');
  shadow.appendChild(link);

  // Background overlay covering the entire viewport
  const overlay = document.createElement('div');
  overlay.className = 'phishing-warning-overlay';

  // Centered glassmorphic card
  const card = document.createElement('div');
  card.className = 'warning-card';

  // Glowing Warning Shield Icon
  const iconContainer = document.createElement('div');
  iconContainer.className = 'icon-container';
  iconContainer.innerHTML = `
    <svg class="warning-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
  `;
  card.appendChild(iconContainer);

  // Title text
  const title = document.createElement('h1');
  title.className = 'warning-title';
  title.innerText = 'Security Alert: Phishing Detected';
  card.appendChild(title);

  // Escape HTML helper to prevent XSS from the URL content
  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Description text explaining the danger
  const description = document.createElement('p');
  description.className = 'warning-description';
  const safeUrl = escapeHtml(window.location.href);
  description.innerHTML = `Our detection model has flagged <strong>${safeUrl}</strong> as a potential phishing site. Phishing pages are designed to trick you into revealing personal credentials, credit cards, or passwords.`;
  card.appendChild(description);

  // Retrieve score set by background script
  const scorePercent = window.__phishingScore || '75.00';

  // Accuracy / probability badge
  const scoreBadge = document.createElement('div');
  scoreBadge.className = 'score-badge';
  scoreBadge.innerText = `Phishing Probability: ${scorePercent}%`;
  card.appendChild(scoreBadge);

  // Action button container
  const actions = document.createElement('div');
  actions.className = 'actions-container';

  // Go Back to Safety Button (Recommended action)
  const btnSafety = document.createElement('button');
  btnSafety.className = 'btn-safety';
  btnSafety.innerText = 'Go Back to Safety';
  btnSafety.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'goBack' });
  });
  actions.appendChild(btnSafety);

  // Proceed anyway button (Low-contrast option)
  const btnBypass = document.createElement('button');
  btnBypass.className = 'btn-bypass';
  btnBypass.innerText = 'Proceed anyway (unsafe)';
  btnBypass.addEventListener('click', () => {
    host.remove();
  });
  actions.appendChild(btnBypass);

  card.appendChild(actions);
  overlay.appendChild(card);
  shadow.appendChild(overlay);

  // Append overlay to the webpage's DOM
  if (document.body) {
    document.body.appendChild(host);
  } else {
    document.documentElement.appendChild(host);
  }
})();
