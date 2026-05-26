// content.js v2.4
// Runs in EVERY frame (top + iframes thanks to all_frames: true in manifest).
// Click coords are converted to TOP-LEVEL viewport coords before being sent to background,
// so the editor's hotspot matches where the user actually clicked.

let isRecording = false;
let recordingIndicator = null;
const isTopFrame = (window === window.top);

if (isTopFrame) {
  chrome.runtime.sendMessage({ type: 'GET_STATE' }, (res) => {
    if (chrome.runtime.lastError) return;
    if (res?.recording) {
      isRecording = true;
      showIndicator();
    }
  });
} else {
  // Subframes ask the top frame what the recording state is
  try { window.parent.postMessage({ __wr: true, kind: 'subframe_check' }, '*'); } catch (e) {}
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'RECORDING_STARTED') {
    isRecording = true;
    if (isTopFrame) {
      showIndicator();
      broadcastToChildren({ kind: 'subframe_state', recording: true });
    }
  } else if (msg.type === 'RECORDING_STOPPED') {
    isRecording = false;
    if (isTopFrame) {
      hideIndicator();
      broadcastToChildren({ kind: 'subframe_state', recording: false });
    }
  }
});

window.addEventListener('message', (e) => {
  const data = e.data;
  if (!data || !data.__wr) return;

  if (isTopFrame && data.kind === 'subframe_check') {
    try { e.source.postMessage({ __wr: true, kind: 'subframe_state', recording: isRecording }, '*'); } catch (err) {}
    return;
  }

  if (!isTopFrame && data.kind === 'subframe_state') {
    isRecording = !!data.recording;
    return;
  }

  if (isTopFrame && data.kind === 'subframe_click') {
    handleSubframeClick(e, data);
    return;
  }
});

function broadcastToChildren(message) {
  const iframes = document.querySelectorAll('iframe, frame');
  iframes.forEach(iframe => {
    try {
      iframe.contentWindow.postMessage({ __wr: true, ...message }, '*');
    } catch (err) {}
  });
}

function showIndicator() {
  if (recordingIndicator) return;
  recordingIndicator = document.createElement('div');
  recordingIndicator.id = '__wr_indicator';
  recordingIndicator.innerHTML = `
    <div class="__wr_dot"></div>
    <span class="__wr_label">Recording walkthrough</span>
    <button class="__wr_stop" type="button">Stop</button>
  `;
  document.documentElement.appendChild(recordingIndicator);
  recordingIndicator.querySelector('.__wr_stop').addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    chrome.runtime.sendMessage({ type: 'STOP_RECORDING' });
  });
}

function hideIndicator() {
  if (recordingIndicator) {
    recordingIndicator.remove();
    recordingIndicator = null;
  }
}

function buildSelector(el) {
  if (!el || el === document) return '';
  if (el.id) return `#${el.id}`;
  let path = [];
  let current = el;
  let depth = 0;
  while (current && current.nodeType === 1 && depth < 5) {
    let part = current.tagName.toLowerCase();
    if (current.className && typeof current.className === 'string') {
      const cls = current.className.trim().split(/\s+/).slice(0, 2).join('.');
      if (cls) part += `.${cls}`;
    }
    path.unshift(part);
    current = current.parentElement;
    depth++;
  }
  return path.join(' > ');
}

document.addEventListener('click', (e) => {
  if (!isRecording) return;
  if (e.target.closest && e.target.closest('#__wr_indicator')) return;

  const targetEl = e.target;
  const targetText = (targetEl.innerText || targetEl.textContent || targetEl.value || targetEl.alt || '').trim().slice(0, 100);
  const targetSelector = buildSelector(targetEl);

  if (isTopFrame) {
    forwardClickToBackground({
      clientX: e.clientX,
      clientY: e.clientY,
      viewportW: window.innerWidth,
      viewportH: window.innerHeight,
      targetText, targetSelector
    });
  } else {
    try {
      window.parent.postMessage({
        __wr: true,
        kind: 'subframe_click',
        clientX: e.clientX,
        clientY: e.clientY,
        targetText, targetSelector
      }, '*');
    } catch (err) {}
  }
}, true);

function findIframeRectFor(win) {
  const iframes = document.querySelectorAll('iframe, frame');
  for (const iframe of iframes) {
    try {
      if (iframe.contentWindow === win) return iframe.getBoundingClientRect();
    } catch (e) {}
  }
  return null;
}

function handleSubframeClick(e, data) {
  const iframeRect = findIframeRectFor(e.source);
  let clientX, clientY;
  if (iframeRect) {
    clientX = iframeRect.left + data.clientX;
    clientY = iframeRect.top + data.clientY;
  } else {
    clientX = data.clientX;
    clientY = data.clientY;
  }
  forwardClickToBackground({
    clientX, clientY,
    viewportW: window.innerWidth,
    viewportH: window.innerHeight,
    targetText: data.targetText,
    targetSelector: data.targetSelector
  });
}

function forwardClickToBackground(payload) {
  // Hide indicator immediately and force the compositor to see the change
  // before we request the screenshot. We do NOT wait rAFs because SPA pages
  // react to clicks within a single frame (routing, modals, scroll) — any
  // delay shifts the screenshot to a different page state while the click
  // coordinates still reference the pre-click layout.
  if (recordingIndicator) {
    recordingIndicator.style.visibility = 'hidden';
    void recordingIndicator.offsetHeight; // force reflow
  }
  chrome.runtime.sendMessage({ type: 'CAPTURE_CLICK', ...payload }, (res) => {
    if (recordingIndicator) recordingIndicator.style.visibility = '';
    if (res?.ok) flashCapture();
  });
}

function flashCapture() {
  const flash = document.createElement('div');
  flash.id = '__wr_flash';
  document.documentElement.appendChild(flash);
  setTimeout(() => flash.remove(), 400);
}
