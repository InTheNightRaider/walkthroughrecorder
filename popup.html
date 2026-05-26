<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Walkthrough Recorder</title>
<style>
  * { box-sizing: border-box; }
  body {
    width: 320px;
    margin: 0;
    padding: 18px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #0f172a;
    color: #f8fafc;
  }
  h1 { font-size: 15px; font-weight: 600; margin: 0 0 4px 0; letter-spacing: -0.01em; }
  .subtitle { font-size: 12px; color: #94a3b8; margin: 0 0 16px 0; }
  .field { margin-bottom: 12px; }
  label {
    display: block; font-size: 11px; font-weight: 500; color: #cbd5e1;
    margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.04em;
  }
  input[type="text"] {
    width: 100%; padding: 8px 10px; background: #1e293b;
    border: 1px solid #334155; border-radius: 6px; color: #f8fafc;
    font-size: 13px; font-family: inherit;
  }
  input[type="text"]:focus { outline: none; border-color: #6366f1; }
  button {
    width: 100%; padding: 10px 14px; border: none; border-radius: 6px;
    font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit;
    transition: background 0.15s;
  }
  button.primary { background: #6366f1; color: #fff; }
  button.primary:hover { background: #4f46e5; }
  button.danger { background: #ef4444; color: #fff; }
  button.danger:hover { background: #dc2626; }
  button.secondary { background: #1e293b; color: #f8fafc; border: 1px solid #334155; }
  button.secondary:hover { background: #334155; }
  button + button { margin-top: 8px; }
  .status {
    margin-top: 14px; padding: 10px 12px; background: #1e293b;
    border-radius: 6px; font-size: 12px; color: #cbd5e1; border: 1px solid #334155;
  }
  .status.recording {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.3);
    color: #fca5a5;
  }
  .status .count { color: #f8fafc; font-weight: 600; }

  /* Recent projects */
  .recent-header {
    font-size: 11px; font-weight: 500; color: #64748b;
    text-transform: uppercase; letter-spacing: 0.04em;
    margin: 16px 0 8px 0; padding-top: 12px;
    border-top: 1px solid #1e293b;
  }
  .project-item {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 10px; background: #1e293b; border: 1px solid #334155;
    border-radius: 6px; margin-bottom: 6px; cursor: pointer;
    transition: border-color 0.15s;
  }
  .project-item:hover { border-color: #6366f1; }
  .project-item.active { border-color: #6366f1; background: rgba(99, 102, 241, 0.08); }
  .project-info { flex: 1; min-width: 0; }
  .project-name-text {
    font-size: 13px; font-weight: 500; white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis; color: #f8fafc;
  }
  .project-meta { font-size: 11px; color: #64748b; margin-top: 2px; }
  .project-open {
    font-size: 11px; color: #6366f1; background: none; border: none;
    width: auto; padding: 4px 8px; cursor: pointer; font-family: inherit;
    font-weight: 600; white-space: nowrap;
  }
  .project-open:hover { color: #818cf8; }

  .footer {
    margin-top: 14px; padding-top: 12px;
    border-top: 1px solid #1e293b;
    font-size: 11px; color: #64748b; text-align: center;
  }
</style>
</head>
<body>
  <h1>Walkthrough Recorder</h1>
  <p class="subtitle">Capture clicks. Export an HTML demo.</p>

  <div id="idle-view">
    <div class="field">
      <label for="project-name">Project name</label>
      <input type="text" id="project-name" placeholder="e.g. Pantry Demo" />
    </div>
    <button class="primary" id="start-btn">Start Recording</button>
    <button class="secondary" id="open-review-btn" style="display:none;">Open Editor</button>

    <div id="recent-section" style="display:none;">
      <div class="recent-header">Recent projects</div>
      <div id="project-list"></div>
    </div>
  </div>

  <div id="recording-view" style="display:none;">
    <div class="status recording">
      Recording: <span class="count" id="step-count">0</span> step(s) captured
    </div>
    <button class="danger" id="stop-btn" style="margin-top:12px;">Stop & Review</button>
  </div>

  <div class="footer">Click anywhere on the page to capture a step</div>

  <script src="popup.js"></script>
</body>
</html>
