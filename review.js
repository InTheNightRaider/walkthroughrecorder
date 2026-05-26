// review.js v2.2

// ============================================================================
// STATE
// ============================================================================
const DEFAULT_PALETTE = {
  primary1: '#6366f1', primary2: '#1A1348', primary3: '#4f46e5',
  secondary1: '#FFFFFF', secondary2: '#818cf8', secondary3: '#374151'
};

const DEFAULT_INTRO = {
  enabled: true, title: '', subtitle: '', buttonText: 'Start Demo', customBackgroundImage: null
};

const DEFAULT_PERSISTENT_CTA = {
  enabled: false, emoji: '👉', text: 'Talk to Sales',
  alignment: 'bottom-right', bgColor: '#1A1348', textColor: '#FFFFFF',
  url: '', openInNewWindow: true
};

const DEFAULT_FINAL_CTA = {
  enabled: false, text: 'Get Started', url: '', secondaryText: '', secondaryUrl: ''
};

let STATE = {
  steps: [],
  currentIndex: 0,
  projectName: 'Untitled Walkthrough',
  projectId: null,
  analyticsEndpoint: '',
  deployments: [],
  intro: { ...DEFAULT_INTRO },
  cta: { ...DEFAULT_FINAL_CTA },
  persistentCta: { ...DEFAULT_PERSISTENT_CTA },
  activeTool: 'select',
  drawing: null,
  selectedAnnotationId: null,
  manipulation: null,
  viewportMode: 'desktop',
  presets: {},
  activePreset: null,
  showingIntro: false,
  undoStack: [],
  redoStack: []
};

const MAX_UNDO = 50;

const DEFAULT_STYLES = {
  arrow: { stroke: '#ef4444', strokeWidth: 3 },
  rect: { stroke: '#ef4444', strokeWidth: 3, fill: 'transparent', fillOpacity: 0.2, radius: 4 },
  text: { color: '#0f172a', fontSize: 16, fontWeight: '600', align: 'center', bgColor: '#ffffff', bgOpacity: 1, borderColor: '#ef4444', borderWidth: 0, padding: 8, radius: 6 },
  blur: { intensity: 8, opacity: 0.92 },
  spotlight: { opacity: 0.85, borderColor: '#FFFFFF', borderWidth: 2, radius: 4 }
};

// ============================================================================
// DOM REFS
// ============================================================================
const els = {
  projectName: document.getElementById('project-name'),
  stepSummary: document.getElementById('step-summary'),
  stepList: document.getElementById('step-list'),
  emptyState: document.getElementById('empty-state'),
  editorContent: document.getElementById('editor-content'),
  canvasWrap: document.getElementById('canvas-wrap'),
  canvas: document.getElementById('canvas'),
  canvasImage: document.getElementById('canvas-image'),
  hotspot: document.getElementById('hotspot'),
  tooltipPreview: document.getElementById('tooltip-preview'),
  tooltipDragHandle: document.getElementById('tooltip-drag-handle'),
  tooltipResizeHandle: document.getElementById('tooltip-resize-handle'),
  ttTitlePreview: document.getElementById('tt-title-preview'),
  ttBodyPreview: document.getElementById('tt-body-preview'),
  annotationHost: document.getElementById('annotation-host'),
  ttTitle: document.getElementById('tt-title'),
  ttBody: document.getElementById('tt-body'),
  stepPos: document.getElementById('step-pos'),
  prevStep: document.getElementById('prev-step'),
  nextStep: document.getElementById('next-step'),
  metaUrl: document.getElementById('meta-url'),
  metaTarget: document.getElementById('meta-target'),
  addStepBtn: document.getElementById('add-step-btn'),
  previewBtn: document.getElementById('preview-btn'),
  exportBtn: document.getElementById('export-btn'),
  introBtn: document.getElementById('intro-btn'),
  brandBtn: document.getElementById('brand-btn'),
  ctaBtn: document.getElementById('cta-btn'),
  deleteStepBtn: document.getElementById('delete-step-btn'),
  duplicateStepBtn: document.getElementById('duplicate-step-btn'),
  previewStepBtn: document.getElementById('preview-step-btn'),
  undoBtn: document.getElementById('undo-btn'),
  redoBtn: document.getElementById('redo-btn'),
  resetTooltipBtn: document.getElementById('reset-tooltip-btn'),
  viewportToggle: document.getElementById('viewport-toggle'),
  stepInspector: document.querySelectorAll('.step-inspector'),
  annInspector: document.getElementById('ann-inspector'),
  annTypeLabel: document.getElementById('ann-type-label'),
  annControls: document.getElementById('ann-controls'),
  annDelete: document.getElementById('ann-delete'),
  annDeselect: document.getElementById('ann-deselect'),
  // modals
  introModal: document.getElementById('intro-modal'),
  brandModal: document.getElementById('brand-modal'),
  ctaModal: document.getElementById('cta-modal'),
  exportModal: document.getElementById('export-modal'),
  cancelExport: document.getElementById('cancel-export'),
  confirmExport: document.getElementById('confirm-export'),
  expPreset: document.getElementById('exp-preset'),
  textEditor: document.getElementById('text-editor-popup'),
  textEditorInput: document.getElementById('text-editor-input'),
  textEditorCancel: document.getElementById('text-editor-cancel'),
  textEditorCommit: document.getElementById('text-editor-commit')
};

// ============================================================================
// UTILITIES
// ============================================================================
function uid(prefix) { return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }
function hexToRgba(hex, alpha) {
  const h = (hex || '#000000').replace('#', '');
  const r = parseInt(h.substring(0, 2), 16) || 0;
  const g = parseInt(h.substring(2, 4), 16) || 0;
  const b = parseInt(h.substring(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function pushUndo() {
  STATE.undoStack.push(deepClone(STATE.steps));
  if (STATE.undoStack.length > MAX_UNDO) STATE.undoStack.shift();
  STATE.redoStack = [];
  updateUndoButtons();
}
function undo() {
  if (STATE.undoStack.length === 0) return;
  STATE.redoStack.push(deepClone(STATE.steps));
  STATE.steps = STATE.undoStack.pop();
  STATE.currentIndex = clamp(STATE.currentIndex, 0, STATE.steps.length - 1);
  STATE.selectedAnnotationId = null;
  persist(false);
  render();
  updateUndoButtons();
}
function redo() {
  if (STATE.redoStack.length === 0) return;
  STATE.undoStack.push(deepClone(STATE.steps));
  STATE.steps = STATE.redoStack.pop();
  STATE.currentIndex = clamp(STATE.currentIndex, 0, STATE.steps.length - 1);
  STATE.selectedAnnotationId = null;
  persist(false);
  render();
  updateUndoButtons();
}
function updateUndoButtons() {
  els.undoBtn.disabled = STATE.undoStack.length === 0;
  els.redoBtn.disabled = STATE.redoStack.length === 0;
}

function setSaveState(state) {
  const pill = document.getElementById('autosave-pill');
  if (!pill) return;
  pill.className = 'autosave-pill ' + state;
  const labels = { saved: 'Saved', saving: 'Saving…', unsaved: 'Unsaved', error: 'Error saving' };
  pill.textContent = labels[state] || state;
}

// Get the active palette (from selected preset, or defaults)
function getActivePalette() {
  if (STATE.activePreset && STATE.presets[STATE.activePreset]) {
    return STATE.presets[STATE.activePreset].palette || DEFAULT_PALETTE;
  }
  return DEFAULT_PALETTE;
}
function getActivePreset() {
  if (STATE.activePreset && STATE.presets[STATE.activePreset]) return STATE.presets[STATE.activePreset];
  return null;
}

// ============================================================================
// BACKGROUND COMMUNICATION
// ============================================================================
function loadSteps() {
  chrome.runtime.sendMessage({ type: 'GET_STEPS' }, (res) => {
    if (!res) return;
    STATE.steps = (res.steps || []).map(migrateStep);
    STATE.projectName = res.projectName || 'Untitled Walkthrough';
    STATE.projectId = res.projectId || null;
    STATE.analyticsEndpoint = res.analyticsEndpoint || '';
    STATE.deployments = res.deployments || [];
    STATE.intro = res.intro || { ...DEFAULT_INTRO };
    STATE.cta = res.cta || { ...DEFAULT_FINAL_CTA };
    STATE.persistentCta = res.persistentCta || { ...DEFAULT_PERSISTENT_CTA };
    STATE.activePreset = res.activePreset || null;
    els.projectName.value = STATE.projectName;
    setSaveState('saved');
    if (STATE.steps.length === 0) {
      els.emptyState.style.display = 'flex';
      els.editorContent.style.display = 'none';
    } else {
      els.emptyState.style.display = 'none';
      els.editorContent.style.display = 'grid';
      STATE.currentIndex = clamp(STATE.currentIndex, 0, STATE.steps.length - 1);
      render();
    }
    updateSummary();
    loadPresets();
    renderProjectMenu();
  });
}

function loadPresets() {
  chrome.runtime.sendMessage({ type: 'GET_PRESETS' }, (res) => {
    STATE.presets = (res && res.presets) || {};
    refreshPresetUI();
    applyActivePaletteToEditor();
  });
}

// ============================================================================
// PROJECT MENU
// ============================================================================
function renderProjectMenu() {
  const btn = document.getElementById('project-menu-btn');
  if (!btn) return;
  btn.onclick = () => {
    const dd = document.getElementById('project-dropdown');
    if (dd.style.display === 'none') openProjectMenu();
    else closeProjectMenu();
  };
  document.addEventListener('click', (e) => {
    const dd = document.getElementById('project-dropdown');
    if (!dd || dd.style.display === 'none') return;
    if (!e.target.closest('#project-dropdown') && !e.target.closest('#project-menu-btn')) {
      closeProjectMenu();
    }
  });
}

function openProjectMenu() {
  const dd = document.getElementById('project-dropdown');
  if (!dd) return;
  chrome.runtime.sendMessage({ type: 'LIST_PROJECTS' }, (res) => {
    const projects = (res && res.projects) || [];
    const activeId = STATE.projectId;
    dd.innerHTML = '';

    if (projects.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding:12px 14px;font-size:12px;color:var(--text-3);';
      empty.textContent = 'No saved projects yet.';
      dd.appendChild(empty);
    } else {
      projects.forEach(proj => {
        const item = document.createElement('div');
        item.className = 'proj-drop-item' + (proj.id === activeId ? ' active' : '');
        const when = proj.updatedAt ? relativeTime(proj.updatedAt) : '';
        item.innerHTML = `
          ${proj.id === activeId ? '<div class="proj-drop-active-dot"></div>' : '<div style="width:6px"></div>'}
          <div class="proj-drop-info">
            <div class="proj-drop-name">${escapeHtml(proj.name)}</div>
            <div class="proj-drop-meta">${proj.stepCount} step${proj.stepCount !== 1 ? 's' : ''}${when ? ' · ' + when : ''}</div>
          </div>
          ${proj.id !== activeId ? `<button class="proj-drop-delete" data-id="${proj.id}" title="Delete project">×</button>` : ''}
        `;
        if (proj.id !== activeId) {
          item.addEventListener('click', (e) => {
            if (e.target.classList.contains('proj-drop-delete')) return;
            chrome.runtime.sendMessage({ type: 'LOAD_PROJECT', projectId: proj.id }, () => {
              closeProjectMenu();
              STATE.currentIndex = 0;
              STATE.selectedAnnotationId = null;
              STATE.showingIntro = false;
              STATE.undoStack = [];
              STATE.redoStack = [];
              loadSteps();
            });
          });
          const delBtn = item.querySelector('.proj-drop-delete');
          if (delBtn) {
            delBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              if (!confirm(`Delete "${proj.name}"? This cannot be undone.`)) return;
              chrome.runtime.sendMessage({ type: 'DELETE_PROJECT', projectId: proj.id }, () => openProjectMenu());
            });
          }
        }
        dd.appendChild(item);
      });
    }

    const divider = document.createElement('div');
    divider.className = 'proj-drop-divider';
    dd.appendChild(divider);

    const newItem = document.createElement('div');
    newItem.className = 'proj-drop-new';
    newItem.textContent = '+ New empty project';
    newItem.addEventListener('click', () => {
      const name = prompt('Project name:', 'Untitled Walkthrough');
      if (!name) return;
      chrome.runtime.sendMessage({ type: 'NEW_PROJECT', name: name.trim() || 'Untitled Walkthrough' }, (res) => {
        if (!res?.ok) return;
        closeProjectMenu();
        STATE.currentIndex = 0;
        STATE.selectedAnnotationId = null;
        STATE.showingIntro = false;
        STATE.undoStack = [];
        STATE.redoStack = [];
        loadSteps();
      });
    });
    dd.appendChild(newItem);

    dd.style.display = 'block';
  });
}

function closeProjectMenu() {
  const dd = document.getElementById('project-dropdown');
  if (dd) dd.style.display = 'none';
}

function relativeTime(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ============================================================================
// DEPLOYMENTS MODAL
// ============================================================================
function renderDeployments() {
  const list = document.getElementById('deployments-list');
  if (!list) return;
  const deps = STATE.deployments || [];
  if (deps.length === 0) {
    list.innerHTML = '<div class="dep-empty">No deployments recorded yet. Deploy your ZIP to the guide dashboard and paste the URL here.</div>';
    return;
  }
  list.innerHTML = '';
  deps.forEach(dep => {
    const item = document.createElement('div');
    item.className = 'dep-item';
    const when = dep.at ? new Date(dep.at).toLocaleDateString() : '';
    item.innerHTML = `
      <div class="dep-item-info">
        <a class="dep-item-url" href="${escapeHtml(dep.url)}" target="_blank" rel="noopener">${escapeHtml(dep.url)}</a>
        <div class="dep-item-meta">${when}${dep.note ? ' · ' + escapeHtml(dep.note) : ''}</div>
      </div>
      <button class="dep-item-delete" data-id="${dep.id}" title="Remove">×</button>
    `;
    item.querySelector('.dep-item-delete').addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'DELETE_DEPLOYMENT', deploymentId: dep.id }, () => {
        STATE.deployments = STATE.deployments.filter(d => d.id !== dep.id);
        renderDeployments();
      });
    });
    list.appendChild(item);
  });
}

document.getElementById('deploys-btn')?.addEventListener('click', () => {
  renderDeployments();
  document.getElementById('dep-url').value = '';
  document.getElementById('dep-note').value = '';
  document.getElementById('deployments-modal').style.display = 'flex';
});

document.getElementById('dep-close')?.addEventListener('click', () => {
  document.getElementById('deployments-modal').style.display = 'none';
});

document.getElementById('dep-add')?.addEventListener('click', () => {
  const url = document.getElementById('dep-url').value.trim();
  if (!url) { alert('URL is required.'); return; }
  const note = document.getElementById('dep-note').value.trim();
  chrome.runtime.sendMessage({ type: 'ADD_DEPLOYMENT', url, note }, (res) => {
    if (res?.deployment) {
      STATE.deployments.unshift(res.deployment);
      document.getElementById('dep-url').value = '';
      document.getElementById('dep-note').value = '';
      renderDeployments();
    }
  });
});

function persist(addUndo = true) {
  if (addUndo) pushUndo();
  setSaveState('saving');
  chrome.runtime.sendMessage({
    type: 'UPDATE_STEPS',
    projectId: STATE.projectId,
    steps: STATE.steps,
    projectName: STATE.projectName,
    intro: STATE.intro,
    cta: STATE.cta,
    persistentCta: STATE.persistentCta,
    activePreset: STATE.activePreset,
    analyticsEndpoint: STATE.analyticsEndpoint
  }, (res) => {
    setSaveState(res?.ok ? 'saved' : 'error');
  });
}

function migrateStep(step) {
  if (!step.annotations) step.annotations = [];
  step.annotations = step.annotations.map(ann => {
    if (ann.x !== undefined && ann.w !== undefined) return ann;
    if (!ann.id) ann.id = uid('ann');
    if (ann.x1 !== undefined) {
      const x1 = ann.x1, y1 = ann.y1, x2 = ann.x2 ?? ann.x1, y2 = ann.y2 ?? ann.y1;
      if (ann.type === 'arrow') {
        return { id: ann.id, type: 'arrow', x1, y1, x2, y2, style: { ...DEFAULT_STYLES.arrow } };
      }
      const x = Math.min(x1, x2);
      const y = Math.min(y1, y2);
      const w = Math.abs(x2 - x1) || 5;
      const h = Math.abs(y2 - y1) || 5;
      if (ann.type === 'text') {
        return { id: ann.id, type: 'text', x, y, w: Math.max(w, 10), h: Math.max(h, 4), text: ann.text || '', style: { ...DEFAULT_STYLES.text } };
      }
      if (ann.type === 'blur') return { id: ann.id, type: 'blur', x, y, w, h, style: { ...DEFAULT_STYLES.blur } };
      return { id: ann.id, type: 'rect', x, y, w, h, style: { ...DEFAULT_STYLES.rect } };
    }
    return ann;
  });
  return step;
}

function updateSummary() {
  const n = STATE.steps.length;
  els.stepSummary.textContent = `${n} step${n === 1 ? '' : 's'}`;
}

// Apply active brand palette colors to the editor preview elements (CSS variables)
function applyActivePaletteToEditor() {
  const palette = getActivePalette();
  const root = document.documentElement;
  root.style.setProperty('--accent', palette.primary1);
  root.style.setProperty('--accent-2', palette.secondary2);
  // Update tooltip preview style
  const preset = getActivePreset();
  const tooltipStyle = preset?.tooltipStyle || 'colored';
  const tt = els.tooltipPreview;
  if (tooltipStyle === 'colored') {
    tt.style.background = palette.primary1;
    tt.style.color = palette.secondary1;
    els.ttBodyPreview.style.color = `${palette.secondary1}E6`;
  } else if (tooltipStyle === 'dark') {
    tt.style.background = '#0f172a';
    tt.style.color = '#fff';
    els.ttBodyPreview.style.color = 'rgba(255,255,255,0.85)';
  } else {
    tt.style.background = '#fff';
    tt.style.color = '#0f172a';
    els.ttBodyPreview.style.color = '#475569';
  }
}

// ============================================================================
// RENDER
// ============================================================================
function render() {
  renderSidebar();
  renderCanvas();
  renderInspector();
  renderViewport();
  renderPersistentCtaPreview();
}

function renderViewport() {
  els.canvasWrap.classList.toggle('mobile-preview', STATE.viewportMode === 'mobile');
  document.querySelectorAll('.vp-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.vp === STATE.viewportMode);
  });
}

function renderSidebar() {
  els.stepList.innerHTML = '';

  // Intro slide thumbnail (Step 0) if enabled
  if (STATE.intro.enabled) {
    const introThumb = document.createElement('div');
    introThumb.className = 'step-thumb intro-thumb' + (STATE.showingIntro ? ' active' : '');
    introThumb.innerHTML = `
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600;font-size:11px;text-align:center;padding:8px;">
        ${escapeHtml(STATE.intro.title || STATE.projectName)}
      </div>
      <div class="step-thumb-num">▶</div>
    `;
    introThumb.addEventListener('click', () => {
      STATE.showingIntro = true;
      STATE.selectedAnnotationId = null;
      render();
    });
    els.stepList.appendChild(introThumb);
  }

  STATE.steps.forEach((step, i) => {
    // Insert button before each step
    const insertBtn = document.createElement('button');
    insertBtn.className = 'insert-step-btn';
    insertBtn.textContent = '+';
    insertBtn.title = 'Insert a step here';
    insertBtn.addEventListener('click', () => insertStepAt(i));
    els.stepList.appendChild(insertBtn);

    const thumb = document.createElement('div');
    thumb.className = 'step-thumb' + (!STATE.showingIntro && i === STATE.currentIndex ? ' active' : '');
    thumb.draggable = true;
    thumb.dataset.index = i;
    thumb.innerHTML = `
      <img src="${step.imageDataUrl}" alt="step ${i+1}" />
      <div class="step-thumb-num">${i + 1}</div>
      <div class="step-thumb-actions">
        <button data-action="duplicate" title="Duplicate">⎘</button>
        <button data-action="delete" class="del" title="Delete">×</button>
      </div>
    `;
    thumb.addEventListener('click', (e) => {
      if (e.target.closest('[data-action]')) return;
      STATE.currentIndex = i;
      STATE.showingIntro = false;
      STATE.selectedAnnotationId = null;
      render();
    });
    thumb.querySelector('[data-action="duplicate"]').addEventListener('click', (e) => {
      e.stopPropagation();
      duplicateStep(i);
    });
    thumb.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Delete step ${i + 1}?`)) deleteStep(i);
    });
    thumb.addEventListener('dragstart', (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(i));
      thumb.style.opacity = '0.5';
    });
    thumb.addEventListener('dragend', () => {
      thumb.style.opacity = '1';
      els.stepList.querySelectorAll('.step-thumb').forEach(t => t.classList.remove('drop-before', 'drop-after'));
    });
    thumb.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      els.stepList.querySelectorAll('.step-thumb').forEach(t => t.classList.remove('drop-before', 'drop-after'));
      const rect = thumb.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      thumb.classList.add(e.clientY < midY ? 'drop-before' : 'drop-after');
    });
    thumb.addEventListener('dragleave', () => {
      thumb.classList.remove('drop-before', 'drop-after');
    });
    thumb.addEventListener('drop', (e) => {
      e.preventDefault();
      thumb.classList.remove('drop-before', 'drop-after');
      const fromIdx = Number(e.dataTransfer.getData('text/plain'));
      const toIdx = Number(thumb.dataset.index);
      if (fromIdx === toIdx) return;
      // Determine insert position based on drop half
      const rect = thumb.getBoundingClientRect();
      const insertAfter = e.clientY >= rect.top + rect.height / 2;
      let insertAt = insertAfter ? toIdx + 1 : toIdx;
      pushUndo();
      const moved = STATE.steps.splice(fromIdx, 1)[0];
      if (insertAt > fromIdx) insertAt--;
      STATE.steps.splice(insertAt, 0, moved);
      STATE.currentIndex = insertAt;
      persist(false);
      render();
    });
    els.stepList.appendChild(thumb);
  });

  // Trailing insert button at end
  if (STATE.steps.length > 0) {
    const trailingBtn = document.createElement('button');
    trailingBtn.className = 'insert-step-btn';
    trailingBtn.textContent = '+';
    trailingBtn.title = 'Add a step at the end';
    trailingBtn.addEventListener('click', () => insertStepAt(STATE.steps.length));
    els.stepList.appendChild(trailingBtn);
  }
}

function insertStepAt(index) {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/*';
  inp.addEventListener('change', () => {
    const file = inp.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      pushUndo();
      const step = {
        id: uid('step'),
        imageDataUrl: reader.result,
        clickX: 50, clickY: 50,
        targetText: '', targetSelector: '',
        pageUrl: '(uploaded)', pageTitle: '',
        timestamp: Date.now(),
        tooltipTitle: '', tooltipBody: '',
        tooltipPosition: 'bottom',
        annotations: []
      };
      STATE.steps.splice(index, 0, step);
      STATE.currentIndex = index;
      STATE.showingIntro = false;
      els.emptyState.style.display = 'none';
      els.editorContent.style.display = 'grid';
      persist(false);
      render();
      updateSummary();
    };
    reader.readAsDataURL(file);
  });
  inp.click();
}

function renderCanvas() {
  if (STATE.steps.length === 0) return;

  // Hide annotation tools / tooltip on intro slide
  if (STATE.showingIntro) {
    renderIntroPreview();
    return;
  }
  // Otherwise hide intro overlay
  removeIntroOverlay();

  const step = STATE.steps[STATE.currentIndex];
  els.canvasImage.src = step.imageDataUrl;
  els.canvas.classList.remove('intro-slide');
  els.hotspot.style.display = '';
  els.tooltipPreview.style.display = '';

  if (els.canvasImage.complete) {
    positionOverlay(step);
    renderAnnotations(step);
    renderZoomViewport(step);
  } else {
    els.canvasImage.onload = () => {
      positionOverlay(step);
      renderAnnotations(step);
      renderZoomViewport(step);
    };
  }
}

// Render the zoom viewport indicator on the current step (or hide if none)
function renderZoomViewport(step) {
  // Remove existing zoom viewport
  const existing = document.getElementById('__zoom_viewport');
  if (existing) existing.remove();
  if (!step.zoom) return;

  const z = step.zoom;
  const el = document.createElement('div');
  el.id = '__zoom_viewport';
  el.className = 'zoom-viewport';
  el.style.left = z.x + '%';
  el.style.top = z.y + '%';
  el.style.width = z.w + '%';
  el.style.height = z.h + '%';
  el.innerHTML = `
    <span class="zoom-viewport-label">Zoom</span>
    <button class="zoom-viewport-clear" title="Remove zoom">✕ Clear</button>
  `;
  el.querySelector('.zoom-viewport-clear').addEventListener('click', (e) => {
    e.stopPropagation();
    pushUndo();
    delete step.zoom;
    persist(false);
    renderZoomViewport(step);
  });
  // Drag to reposition the zoom viewport
  el.addEventListener('mousedown', (e) => {
    if (e.target.closest('.zoom-viewport-clear')) return;
    if (STATE.activeTool !== 'select') return;
    e.preventDefault();
    e.stopPropagation();
    const startPct = pctFromMouseEvent(e);
    STATE.manipulation = {
      type: 'move-zoom',
      startX: startPct.x,
      startY: startPct.y,
      startZoom: { ...step.zoom }
    };
  });
  els.canvas.appendChild(el);
}

function renderIntroPreview() {
  if (STATE.steps.length === 0) return;
  const firstStep = STATE.steps[0];
  els.canvasImage.src = STATE.intro.customBackgroundImage || firstStep.imageDataUrl;
  els.canvas.classList.add('intro-slide');
  els.hotspot.style.display = 'none';
  els.tooltipPreview.style.display = 'none';
  els.annotationHost.innerHTML = '';

  removeIntroOverlay();
  const palette = getActivePalette();
  const overlay = document.createElement('div');
  overlay.className = 'intro-slide-overlay';
  overlay.id = '__intro_overlay';
  overlay.innerHTML = `
    <div class="intro-slide-title">${escapeHtml(STATE.intro.title || STATE.projectName)}</div>
    ${STATE.intro.subtitle ? `<div class="intro-slide-subtitle">${escapeHtml(STATE.intro.subtitle)}</div>` : ''}
    <button class="intro-slide-button" style="background:${palette.primary3};color:${palette.secondary1};box-shadow:0 8px 24px ${hexToRgba(palette.primary3, 0.4)}">${escapeHtml(STATE.intro.buttonText || 'Start Demo')}</button>
  `;
  els.canvas.appendChild(overlay);
}

function removeIntroOverlay() {
  const overlay = document.getElementById('__intro_overlay');
  if (overlay) overlay.remove();
}

function positionOverlay(step) {
  els.hotspot.style.left = step.clickX + '%';
  els.hotspot.style.top = step.clickY + '%';
  positionTooltip(step);
}

function positionTooltip(step) {
  const tt = els.tooltipPreview;
  tt.style.left = ''; tt.style.right = ''; tt.style.top = ''; tt.style.bottom = '';
  tt.style.transform = '';

  // Apply stored tooltip width if set
  if (step.tooltipWidth) {
    tt.style.width = step.tooltipWidth + 'px';
  } else {
    tt.style.width = '280px';
  }

  const tp = step.tooltipPosition;
  if (tp && typeof tp === 'object' && tp.x !== undefined) {
    tt.style.left = tp.x + '%';
    tt.style.top = tp.y + '%';
    return;
  }
  const offset = 24;
  switch (tp || 'bottom') {
    case 'top':
      tt.style.left = step.clickX + '%';
      tt.style.top = `calc(${step.clickY}% - ${offset}px)`;
      tt.style.transform = 'translate(-50%, -100%)';
      break;
    case 'bottom':
      tt.style.left = step.clickX + '%';
      tt.style.top = `calc(${step.clickY}% + ${offset}px)`;
      tt.style.transform = 'translateX(-50%)';
      break;
    case 'left':
      tt.style.left = `calc(${step.clickX}% - ${offset}px)`;
      tt.style.top = step.clickY + '%';
      tt.style.transform = 'translate(-100%, -50%)';
      break;
    case 'right':
      tt.style.left = `calc(${step.clickX}% + ${offset}px)`;
      tt.style.top = step.clickY + '%';
      tt.style.transform = 'translateY(-50%)';
      break;
  }
  els.ttTitlePreview.textContent = step.tooltipTitle || 'Add a title';
  els.ttBodyPreview.textContent = step.tooltipBody || 'Add a description';
}

function renderInspector() {
  if (STATE.steps.length === 0 || STATE.showingIntro) return;
  const step = STATE.steps[STATE.currentIndex];

  els.stepPos.textContent = `${STATE.currentIndex + 1} / ${STATE.steps.length}`;
  els.ttTitle.value = step.tooltipTitle || '';
  els.ttBody.value = step.tooltipBody || '';
  els.metaUrl.textContent = step.pageUrl || '—';
  els.metaTarget.textContent = step.targetText ? `"${step.targetText}"` : (step.targetSelector || '—');

  document.querySelectorAll('.seg-btn[data-pos]').forEach(btn => {
    const tp = step.tooltipPosition;
    btn.classList.toggle('active', typeof tp === 'string' && btn.dataset.pos === tp);
  });

  els.ttTitlePreview.textContent = step.tooltipTitle || 'Add a title';
  els.ttBodyPreview.textContent = step.tooltipBody || 'Add a description';

  if (STATE.selectedAnnotationId) {
    const ann = step.annotations.find(a => a.id === STATE.selectedAnnotationId);
    if (ann) {
      els.annInspector.style.display = 'block';
      els.stepInspector.forEach(el => el.style.display = 'none');
      renderAnnotationInspector(ann);
      return;
    } else {
      STATE.selectedAnnotationId = null;
    }
  }
  els.annInspector.style.display = 'none';
  els.stepInspector.forEach(el => el.style.display = '');
}

// Render persistent CTA preview overlay in editor
function renderPersistentCtaPreview() {
  let cta = document.getElementById('__pcta_preview');
  if (cta) cta.remove();
  if (!STATE.persistentCta.enabled || STATE.showingIntro) return;
  cta = document.createElement('div');
  cta.id = '__pcta_preview';
  cta.className = 'persistent-cta ' + STATE.persistentCta.alignment;
  cta.style.background = STATE.persistentCta.bgColor;
  cta.style.color = STATE.persistentCta.textColor;
  cta.innerHTML = `${STATE.persistentCta.emoji ? `<span>${escapeHtml(STATE.persistentCta.emoji)}</span>` : ''}<span>${escapeHtml(STATE.persistentCta.text)}</span>`;
  els.canvas.appendChild(cta);
}

// ============================================================================
// ANNOTATIONS RENDERING
// ============================================================================
function renderAnnotations(step) {
  els.annotationHost.innerHTML = '';
  (step.annotations || []).forEach(ann => {
    const el = createAnnotationElement(ann);
    if (el) els.annotationHost.appendChild(el);
  });
  if (STATE.selectedAnnotationId) {
    const ann = step.annotations.find(a => a.id === STATE.selectedAnnotationId);
    if (ann) {
      const annEl = els.annotationHost.querySelector(`[data-ann-id="${ann.id}"]`);
      if (annEl) {
        annEl.classList.add('ann-selected');
        addResizeHandles(ann, annEl);
      }
    }
  }
}

function createAnnotationElement(ann) {
  const el = document.createElement('div');
  el.dataset.annId = ann.id;
  el.dataset.annType = ann.type;

  if (ann.type === 'arrow') {
    el.className = 'ann-arrow';
    const minX = Math.min(ann.x1, ann.x2);
    const maxX = Math.max(ann.x1, ann.x2);
    const minY = Math.min(ann.y1, ann.y2);
    const maxY = Math.max(ann.y1, ann.y2);
    const padPct = 1.5;
    const left = minX - padPct;
    const top = minY - padPct;
    const w = (maxX - minX) + padPct * 2;
    const h = (maxY - minY) + padPct * 2;
    el.style.left = left + '%';
    el.style.top = top + '%';
    el.style.width = w + '%';
    el.style.height = h + '%';
    const svgX1 = ((ann.x1 - left) / w) * 100;
    const svgY1 = ((ann.y1 - top) / h) * 100;
    const svgX2 = ((ann.x2 - left) / w) * 100;
    const svgY2 = ((ann.y2 - top) / h) * 100;
    const stroke = ann.style?.stroke || '#ef4444';
    const sw = ann.style?.strokeWidth || 3;
    el.innerHTML = `
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <marker id="arr-${ann.id}" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
            <polygon points="0 0, 6 3, 0 6" fill="${stroke}" />
          </marker>
        </defs>
        <line x1="${svgX1}" y1="${svgY1}" x2="${svgX2}" y2="${svgY2}"
              stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"
              vector-effect="non-scaling-stroke" marker-end="url(#arr-${ann.id})" />
      </svg>
    `;
  } else if (ann.type === 'rect') {
    el.className = 'ann-rect';
    el.style.left = ann.x + '%'; el.style.top = ann.y + '%';
    el.style.width = ann.w + '%'; el.style.height = ann.h + '%';
    const s = ann.style || DEFAULT_STYLES.rect;
    el.style.border = `${s.strokeWidth}px solid ${s.stroke}`;
    el.style.borderRadius = (s.radius || 0) + 'px';
    if (s.fill && s.fill !== 'transparent') {
      el.style.background = hexToRgba(s.fill, s.fillOpacity ?? 0.2);
    } else {
      el.style.background = 'transparent';
    }
  } else if (ann.type === 'text') {
    el.className = 'ann-text';
    el.style.left = ann.x + '%'; el.style.top = ann.y + '%';
    el.style.width = ann.w + '%'; el.style.height = ann.h + '%';
    const s = ann.style || DEFAULT_STYLES.text;
    el.style.color = s.color;
    el.style.fontSize = s.fontSize + 'px';
    el.style.fontWeight = s.fontWeight;
    el.style.textAlign = s.align;
    el.style.padding = (s.padding || 0) + 'px';
    el.style.borderRadius = (s.radius || 0) + 'px';
    el.style.background = (s.bgColor && s.bgOpacity > 0) ? hexToRgba(s.bgColor, s.bgOpacity) : 'transparent';
    if (s.borderWidth > 0) el.style.border = `${s.borderWidth}px solid ${s.borderColor}`;
    else el.style.border = 'none';
    const inner = document.createElement('div');
    inner.className = 'ann-text-inner';
    inner.textContent = ann.text || '';
    el.appendChild(inner);
  } else if (ann.type === 'blur') {
    el.className = 'ann-blur';
    el.style.left = ann.x + '%'; el.style.top = ann.y + '%';
    el.style.width = ann.w + '%'; el.style.height = ann.h + '%';
    const s = ann.style || DEFAULT_STYLES.blur;
    el.style.background = `rgba(15, 23, 42, ${s.opacity ?? 0.92})`;
  } else if (ann.type === 'spotlight') {
    el.className = 'ann-spotlight';
    el.style.left = ann.x + '%'; el.style.top = ann.y + '%';
    el.style.width = ann.w + '%'; el.style.height = ann.h + '%';
    const s = ann.style || DEFAULT_STYLES.spotlight;
    el.style.borderColor = s.borderColor || '#FFFFFF';
    el.style.borderWidth = (s.borderWidth || 2) + 'px';
    el.style.borderStyle = 'solid';
    el.style.borderRadius = (s.radius || 4) + 'px';
    el.style.boxShadow = `0 0 0 9999px rgba(15, 23, 42, ${s.opacity ?? 0.85})`;
  }
  el.addEventListener('mousedown', (e) => onAnnotationMouseDown(e, ann));
  return el;
}

function addResizeHandles(ann, annEl) {
  annEl.querySelectorAll('.resize-handle').forEach(h => h.remove());
  if (ann.type === 'arrow') {
    ['endpoint1', 'endpoint2'].forEach((handleId) => {
      const handle = document.createElement('div');
      handle.className = 'resize-handle endpoint';
      handle.dataset.handle = handleId;
      const isEnd1 = handleId === 'endpoint1';
      const minX = Math.min(ann.x1, ann.x2);
      const maxX = Math.max(ann.x1, ann.x2);
      const minY = Math.min(ann.y1, ann.y2);
      const maxY = Math.max(ann.y1, ann.y2);
      const padPct = 1.5;
      const left = minX - padPct;
      const top = minY - padPct;
      const w = (maxX - minX) + padPct * 2;
      const h = (maxY - minY) + padPct * 2;
      const xPct = ((isEnd1 ? ann.x1 : ann.x2) - left) / w * 100;
      const yPct = ((isEnd1 ? ann.y1 : ann.y2) - top) / h * 100;
      handle.style.left = `calc(${xPct}% - 6px)`;
      handle.style.top = `calc(${yPct}% - 6px)`;
      handle.style.position = 'absolute';
      handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        STATE.manipulation = { type: 'arrow-endpoint', annId: ann.id, endpoint: handleId };
      });
      annEl.appendChild(handle);
    });
  } else {
    ['nw','n','ne','e','se','s','sw','w'].forEach(dir => {
      const handle = document.createElement('div');
      handle.className = 'resize-handle ' + dir;
      handle.dataset.handle = dir;
      handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const canvasRect = els.canvasImage.getBoundingClientRect();
        STATE.manipulation = {
          type: 'resize',
          annId: ann.id,
          handle: dir,
          startX: e.clientX,
          startY: e.clientY,
          startAnn: { ...ann },
          canvasRect
        };
      });
      annEl.appendChild(handle);
    });
  }
}

// ============================================================================
// ANNOTATION INSPECTOR
// ============================================================================
function renderAnnotationInspector(ann) {
  els.annTypeLabel.textContent = ann.type.charAt(0).toUpperCase() + ann.type.slice(1);
  els.annControls.innerHTML = '';

  const buildRow = (label, controlHtml) => `
    <div class="ann-control-row">
      <label class="lbl">${label}</label>
      ${controlHtml}
    </div>
  `;

  const s = ann.style || {};
  let html = '';

  if (ann.type === 'arrow') {
    html += buildRow('Color', `<input type="color" data-prop="stroke" value="${s.stroke || '#ef4444'}" />`);
    html += buildRow('Thickness', `<input type="range" data-prop="strokeWidth" min="1" max="12" value="${s.strokeWidth || 3}" />`);
  } else if (ann.type === 'rect') {
    html += buildRow('Border', `<input type="color" data-prop="stroke" value="${s.stroke || '#ef4444'}" />`);
    html += buildRow('Border width', `<input type="range" data-prop="strokeWidth" min="0" max="12" value="${s.strokeWidth || 3}" />`);
    html += buildRow('Fill', `<input type="color" data-prop="fill" value="${s.fill && s.fill !== 'transparent' ? s.fill : '#ef4444'}" />`);
    html += buildRow('Fill opacity', `<input type="range" data-prop="fillOpacity" min="0" max="1" step="0.05" value="${s.fillOpacity ?? 0.2}" />`);
    html += buildRow('Corner radius', `<input type="range" data-prop="radius" min="0" max="40" value="${s.radius || 4}" />`);
  } else if (ann.type === 'text') {
    html += `<div class="ann-control-row" style="grid-template-columns: 1fr;">
      <textarea data-prop="text" class="inp" rows="2" placeholder="Text...">${escapeHtml(ann.text || '')}</textarea>
    </div>`;
    html += buildRow('Text color', `<input type="color" data-prop="color" value="${s.color || '#0f172a'}" />`);
    html += buildRow('Font size', `<input type="range" data-prop="fontSize" min="8" max="72" value="${s.fontSize || 16}" />`);
    html += buildRow('Weight', `
      <select data-prop="fontWeight" class="inp">
        <option value="400" ${s.fontWeight === '400' ? 'selected' : ''}>Regular</option>
        <option value="500" ${s.fontWeight === '500' ? 'selected' : ''}>Medium</option>
        <option value="600" ${s.fontWeight === '600' || !s.fontWeight ? 'selected' : ''}>Semibold</option>
        <option value="700" ${s.fontWeight === '700' ? 'selected' : ''}>Bold</option>
      </select>
    `);
    html += buildRow('Alignment', `
      <div class="seg">
        <button class="seg-btn ${s.align === 'left' ? 'active' : ''}" data-align="left">Left</button>
        <button class="seg-btn ${s.align === 'center' || !s.align ? 'active' : ''}" data-align="center">Center</button>
        <button class="seg-btn ${s.align === 'right' ? 'active' : ''}" data-align="right">Right</button>
      </div>
    `);
    html += buildRow('Background', `<input type="color" data-prop="bgColor" value="${s.bgColor || '#ffffff'}" />`);
    html += buildRow('BG opacity', `<input type="range" data-prop="bgOpacity" min="0" max="1" step="0.05" value="${s.bgOpacity ?? 1}" />`);
    html += buildRow('Border color', `<input type="color" data-prop="borderColor" value="${s.borderColor || '#ef4444'}" />`);
    html += buildRow('Border width', `<input type="range" data-prop="borderWidth" min="0" max="8" value="${s.borderWidth || 0}" />`);
    html += buildRow('Padding', `<input type="range" data-prop="padding" min="0" max="40" value="${s.padding || 8}" />`);
    html += buildRow('Corner radius', `<input type="range" data-prop="radius" min="0" max="40" value="${s.radius || 6}" />`);
  } else if (ann.type === 'blur') {
    html += buildRow('Opacity', `<input type="range" data-prop="opacity" min="0.3" max="1" step="0.02" value="${s.opacity ?? 0.92}" />`);
    html += `<div class="ann-control-row" style="grid-template-columns: 1fr;">
      <p class="hint">Blur covers the box area. To do the opposite (focus on a region by blurring everything else), use the Spotlight tool ◉ instead.</p>
    </div>`;
  } else if (ann.type === 'spotlight') {
    html += buildRow('Outside opacity', `<input type="range" data-prop="opacity" min="0.3" max="1" step="0.02" value="${s.opacity ?? 0.85}" />`);
    html += buildRow('Border color', `<input type="color" data-prop="borderColor" value="${s.borderColor || '#FFFFFF'}" />`);
    html += buildRow('Border width', `<input type="range" data-prop="borderWidth" min="0" max="6" value="${s.borderWidth || 2}" />`);
    html += buildRow('Corner radius', `<input type="range" data-prop="radius" min="0" max="40" value="${s.radius || 4}" />`);
    html += `<div class="ann-control-row" style="grid-template-columns: 1fr;">
      <p class="hint">Everything outside the box is blurred — focuses attention on the area inside.</p>
    </div>`;
  }

  els.annControls.innerHTML = html;

  els.annControls.querySelectorAll('[data-prop]').forEach(input => {
    const prop = input.dataset.prop;
    input.addEventListener('input', () => {
      let val = input.value;
      if (input.type === 'range' || input.type === 'number') val = parseFloat(val);
      if (prop === 'text') {
        ann.text = val;
      } else {
        if (!ann.style) ann.style = {};
        ann.style[prop] = val;
      }
      persist();
      renderAnnotations(STATE.steps[STATE.currentIndex]);
    });
  });
  els.annControls.querySelectorAll('[data-align]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (!ann.style) ann.style = {};
      ann.style.align = btn.dataset.align;
      persist();
      renderInspector();
      renderAnnotations(STATE.steps[STATE.currentIndex]);
    });
  });
}

// ============================================================================
// MOUSE INTERACTIONS
// ============================================================================
function pctFromMouseEvent(e) {
  const rect = els.canvasImage.getBoundingClientRect();
  return {
    x: clamp(((e.clientX - rect.left) / rect.width) * 100, 0, 100),
    y: clamp(((e.clientY - rect.top) / rect.height) * 100, 0, 100),
    rect
  };
}

function onAnnotationMouseDown(e, ann) {
  if (STATE.activeTool !== 'select') return;
  if (e.target.classList.contains('resize-handle')) return;
  e.preventDefault();
  e.stopPropagation();
  STATE.selectedAnnotationId = ann.id;
  const startPct = pctFromMouseEvent(e);
  STATE.manipulation = {
    type: 'move',
    annId: ann.id,
    startX: startPct.x,
    startY: startPct.y,
    startAnn: deepClone(ann),
    moved: false
  };
  renderInspector();
  renderAnnotations(STATE.steps[STATE.currentIndex]);
}

els.hotspot.addEventListener('mousedown', (e) => {
  e.preventDefault();
  e.stopPropagation();
  STATE.manipulation = { type: 'drag-hotspot' };
});

els.tooltipDragHandle.addEventListener('mousedown', (e) => {
  e.preventDefault();
  e.stopPropagation();
  STATE.manipulation = { type: 'drag-tooltip' };
});

els.tooltipResizeHandle.addEventListener('mousedown', (e) => {
  e.preventDefault();
  e.stopPropagation();
  const startWidth = els.tooltipPreview.getBoundingClientRect().width;
  STATE.manipulation = {
    type: 'resize-tooltip',
    startMouseX: e.clientX,
    startWidth
  };
});

els.canvas.addEventListener('mousedown', (e) => {
  if (STATE.showingIntro) return;
  if (STATE.activeTool === 'select') {
    if (e.target === els.canvas || e.target === els.canvasImage || e.target === els.annotationHost) {
      STATE.selectedAnnotationId = null;
      renderInspector();
      renderAnnotations(STATE.steps[STATE.currentIndex]);
    }
    return;
  }
  if (e.target.closest('.hotspot') || e.target.closest('.tooltip-preview')) return;
  if (e.target.closest('.zoom-viewport')) return; // let zoom-viewport handle its own drag

  const startPct = pctFromMouseEvent(e);

  if (STATE.activeTool === 'text') {
    openTextEditor(e.clientX, e.clientY, startPct);
    return;
  }

  if (STATE.activeTool === 'zoom') {
    // Drawing a zoom region (per-step property, not an annotation)
    STATE.drawing = {
      tool: 'zoom',
      startX: startPct.x,
      startY: startPct.y,
      currentX: startPct.x,
      currentY: startPct.y
    };
    return;
  }

  STATE.drawing = {
    tool: STATE.activeTool,
    startX: startPct.x,
    startY: startPct.y,
    currentX: startPct.x,
    currentY: startPct.y
  };
});

document.addEventListener('mousemove', (e) => {
  if (STATE.manipulation) {
    const m = STATE.manipulation;
    const pct = pctFromMouseEvent(e);
    const step = STATE.steps[STATE.currentIndex];
    if (!step) return;

    if (m.type === 'drag-hotspot') {
      step.clickX = pct.x; step.clickY = pct.y;
      positionOverlay(step);
    } else if (m.type === 'drag-tooltip') {
      step.tooltipPosition = { x: pct.x, y: pct.y };
      positionOverlay(step);
    } else if (m.type === 'resize-tooltip') {
      const dx = e.clientX - m.startMouseX;
      const newWidth = clamp(m.startWidth + dx, 120, 600);
      step.tooltipWidth = Math.round(newWidth);
      els.tooltipPreview.style.width = newWidth + 'px';
    } else if (m.type === 'move-zoom') {
      if (!step.zoom) return;
      const dx = pct.x - m.startX;
      const dy = pct.y - m.startY;
      const sz = m.startZoom;
      step.zoom.x = clamp(sz.x + dx, 0, 100 - sz.w);
      step.zoom.y = clamp(sz.y + dy, 0, 100 - sz.h);
      step.zoom.w = sz.w;
      step.zoom.h = sz.h;
      renderZoomViewport(step);
    } else if (m.type === 'move') {
      const ann = step.annotations.find(a => a.id === m.annId);
      if (!ann) return;
      const dx = pct.x - m.startX;
      const dy = pct.y - m.startY;
      if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) m.moved = true;
      if (ann.type === 'arrow') {
        ann.x1 = m.startAnn.x1 + dx; ann.y1 = m.startAnn.y1 + dy;
        ann.x2 = m.startAnn.x2 + dx; ann.y2 = m.startAnn.y2 + dy;
      } else {
        ann.x = clamp(m.startAnn.x + dx, 0, 100 - ann.w);
        ann.y = clamp(m.startAnn.y + dy, 0, 100 - ann.h);
      }
      renderAnnotations(step);
    } else if (m.type === 'resize') {
      const ann = step.annotations.find(a => a.id === m.annId);
      if (!ann) return;
      const dx = pct.x - ((m.startX - m.canvasRect.left) / m.canvasRect.width) * 100;
      const dy = pct.y - ((m.startY - m.canvasRect.top) / m.canvasRect.height) * 100;
      const sa = m.startAnn;
      let nx = sa.x, ny = sa.y, nw = sa.w, nh = sa.h;
      if (m.handle.includes('w')) { nx = sa.x + dx; nw = sa.w - dx; }
      if (m.handle.includes('e')) { nw = sa.w + dx; }
      if (m.handle.includes('n')) { ny = sa.y + dy; nh = sa.h - dy; }
      if (m.handle.includes('s')) { nh = sa.h + dy; }
      if (nw < 2) nw = 2;
      if (nh < 2) nh = 2;
      ann.x = clamp(nx, 0, 100); ann.y = clamp(ny, 0, 100);
      ann.w = clamp(nw, 2, 100 - ann.x);
      ann.h = clamp(nh, 2, 100 - ann.y);
      renderAnnotations(step);
    } else if (m.type === 'arrow-endpoint') {
      const ann = step.annotations.find(a => a.id === m.annId);
      if (!ann) return;
      if (m.endpoint === 'endpoint1') { ann.x1 = pct.x; ann.y1 = pct.y; }
      else { ann.x2 = pct.x; ann.y2 = pct.y; }
      renderAnnotations(step);
    }
    return;
  }

  if (STATE.drawing) {
    const pct = pctFromMouseEvent(e);
    STATE.drawing.currentX = pct.x;
    STATE.drawing.currentY = pct.y;
    renderDrawingPreview();
  }
});

function renderDrawingPreview() {
  const step = STATE.steps[STATE.currentIndex];
  const d = STATE.drawing;
  if (!d || !step) return;

  // Zoom is a step property, not an annotation - render preview separately
  if (d.tool === 'zoom') {
    const x = Math.min(d.startX, d.currentX);
    const y = Math.min(d.startY, d.currentY);
    const w = Math.abs(d.currentX - d.startX);
    const h = Math.abs(d.currentY - d.startY);
    // Render a temporary preview using the same DOM container
    let preview = document.getElementById('__zoom_drawing_preview');
    if (!preview) {
      preview = document.createElement('div');
      preview.id = '__zoom_drawing_preview';
      preview.className = 'zoom-viewport';
      els.canvas.appendChild(preview);
    }
    preview.style.left = x + '%';
    preview.style.top = y + '%';
    preview.style.width = w + '%';
    preview.style.height = h + '%';
    return;
  }

  let preview;
  const baseStyles = {
    arrow: DEFAULT_STYLES.arrow,
    rect: DEFAULT_STYLES.rect,
    blur: DEFAULT_STYLES.blur,
    spotlight: DEFAULT_STYLES.spotlight
  };
  if (d.tool === 'arrow') {
    preview = { id: '__preview', type: 'arrow', x1: d.startX, y1: d.startY, x2: d.currentX, y2: d.currentY, style: { ...baseStyles.arrow } };
  } else {
    const x = Math.min(d.startX, d.currentX);
    const y = Math.min(d.startY, d.currentY);
    const w = Math.abs(d.currentX - d.startX);
    const h = Math.abs(d.currentY - d.startY);
    preview = { id: '__preview', type: d.tool, x, y, w, h, style: { ...baseStyles[d.tool] } };
  }
  els.annotationHost.innerHTML = '';
  (step.annotations || []).forEach(a => {
    const el = createAnnotationElement(a);
    if (el) els.annotationHost.appendChild(el);
  });
  if (preview) {
    const el = createAnnotationElement(preview);
    if (el) els.annotationHost.appendChild(el);
  }
}

document.addEventListener('mouseup', (e) => {
  if (STATE.manipulation) {
    const m = STATE.manipulation;
    if (m.type === 'drag-hotspot' || m.type === 'drag-tooltip' || m.type === 'resize-tooltip' ||
        m.type === 'move-zoom' ||
        m.type === 'move' || m.type === 'resize' || m.type === 'arrow-endpoint') {
      persist();
    }
    STATE.manipulation = null;
    return;
  }

  if (STATE.drawing) {
    const d = STATE.drawing;
    const step = STATE.steps[STATE.currentIndex];

    // Zoom region commit - per-step property
    if (d.tool === 'zoom') {
      const x = Math.min(d.startX, d.currentX);
      const y = Math.min(d.startY, d.currentY);
      const w = Math.abs(d.currentX - d.startX);
      const h = Math.abs(d.currentY - d.startY);
      // Cleanup preview element
      const preview = document.getElementById('__zoom_drawing_preview');
      if (preview) preview.remove();
      STATE.drawing = null;
      if (w < 5 || h < 5) {
        renderZoomViewport(step);
        return;
      }
      pushUndo();
      step.zoom = { x, y, w, h };
      setTool('select');
      persist(false);
      renderZoomViewport(step);
      return;
    }

    let newAnn;
    if (d.tool === 'arrow') {
      const dx = d.currentX - d.startX;
      const dy = d.currentY - d.startY;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
        STATE.drawing = null;
        renderAnnotations(step);
        return;
      }
      newAnn = { id: uid('ann'), type: 'arrow', x1: d.startX, y1: d.startY, x2: d.currentX, y2: d.currentY, style: { ...DEFAULT_STYLES.arrow } };
    } else {
      const x = Math.min(d.startX, d.currentX);
      const y = Math.min(d.startY, d.currentY);
      const w = Math.abs(d.currentX - d.startX);
      const h = Math.abs(d.currentY - d.startY);
      if (w < 1 && h < 1) { STATE.drawing = null; renderAnnotations(step); return; }
      const baseStyle = DEFAULT_STYLES[d.tool] || {};
      newAnn = { id: uid('ann'), type: d.tool, x, y, w: Math.max(w, 2), h: Math.max(h, 2), style: { ...baseStyle } };
    }
    STATE.drawing = null;
    if (newAnn) {
      pushUndo();
      step.annotations.push(newAnn);
      STATE.selectedAnnotationId = newAnn.id;
      setTool('select');
      persist(false);
      renderInspector();
      renderAnnotations(step);
    } else {
      renderAnnotations(step);
    }
  }
});

// Text editor popup
let pendingTextPos = null;
function openTextEditor(clientX, clientY, pct) {
  pendingTextPos = { ...pct };
  els.textEditor.style.display = 'block';
  els.textEditor.style.left = clientX + 'px';
  els.textEditor.style.top = clientY + 'px';
  els.textEditorInput.value = '';
  setTimeout(() => els.textEditorInput.focus(), 50);
}
function closeTextEditor() {
  els.textEditor.style.display = 'none';
  pendingTextPos = null;
}
function commitTextEditor() {
  const text = els.textEditorInput.value.trim();
  if (!text || !pendingTextPos) {
    closeTextEditor();
    return;
  }
  const step = STATE.steps[STATE.currentIndex];
  pushUndo();
  const newAnn = {
    id: uid('ann'), type: 'text',
    x: pendingTextPos.x, y: pendingTextPos.y,
    w: 20, h: 6, text,
    style: { ...DEFAULT_STYLES.text }
  };
  step.annotations.push(newAnn);
  STATE.selectedAnnotationId = newAnn.id;
  closeTextEditor();
  setTool('select');
  persist(false);
  renderInspector();
  renderAnnotations(step);
}
els.textEditorCommit.addEventListener('click', commitTextEditor);
els.textEditorCancel.addEventListener('click', closeTextEditor);
els.textEditorInput.addEventListener('keydown', (e) => {
  // Enter alone = commit. Shift+Enter = newline (default behavior, don't prevent).
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    commitTextEditor();
  }
  if (e.key === 'Escape') closeTextEditor();
});

function setTool(name) {
  STATE.activeTool = name;
  document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === name));
  els.canvas.style.cursor = name === 'select' ? 'default' : 'crosshair';
}

document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
  btn.addEventListener('click', () => setTool(btn.dataset.tool));
});

// Step ops
function deleteStep(idx) {
  pushUndo();
  STATE.steps.splice(idx, 1);
  if (STATE.currentIndex >= STATE.steps.length) STATE.currentIndex = STATE.steps.length - 1;
  if (STATE.currentIndex < 0) STATE.currentIndex = 0;
  STATE.selectedAnnotationId = null;
  persist(false);
  if (STATE.steps.length === 0) {
    els.emptyState.style.display = 'flex';
    els.editorContent.style.display = 'none';
  }
  render();
  updateSummary();
}
function duplicateStep(idx) {
  pushUndo();
  const original = STATE.steps[idx];
  const copy = deepClone(original);
  copy.id = uid('step');
  copy.annotations = (copy.annotations || []).map(a => ({ ...a, id: uid('ann') }));
  STATE.steps.splice(idx + 1, 0, copy);
  STATE.currentIndex = idx + 1;
  STATE.selectedAnnotationId = null;
  persist(false);
  render();
  updateSummary();
}

// Inputs
let titleDebounce, bodyDebounce, projectDebounce;
els.ttTitle.addEventListener('input', () => {
  STATE.steps[STATE.currentIndex].tooltipTitle = els.ttTitle.value;
  els.ttTitlePreview.textContent = els.ttTitle.value || 'Add a title';
  clearTimeout(titleDebounce);
  titleDebounce = setTimeout(() => persist(), 300);
});
els.ttBody.addEventListener('input', () => {
  STATE.steps[STATE.currentIndex].tooltipBody = els.ttBody.value;
  els.ttBodyPreview.textContent = els.ttBody.value || 'Add a description';
  clearTimeout(bodyDebounce);
  bodyDebounce = setTimeout(() => persist(), 300);
});
els.projectName.addEventListener('input', () => {
  STATE.projectName = els.projectName.value || 'Untitled Walkthrough';
  clearTimeout(projectDebounce);
  projectDebounce = setTimeout(() => persist(), 300);
});

document.querySelectorAll('.seg-btn[data-pos]').forEach(btn => {
  btn.addEventListener('click', () => {
    pushUndo();
    STATE.steps[STATE.currentIndex].tooltipPosition = btn.dataset.pos;
    document.querySelectorAll('.seg-btn[data-pos]').forEach(b => b.classList.toggle('active', b === btn));
    positionTooltip(STATE.steps[STATE.currentIndex]);
    persist(false);
  });
});

els.resetTooltipBtn.addEventListener('click', () => {
  pushUndo();
  STATE.steps[STATE.currentIndex].tooltipPosition = 'bottom';
  persist(false);
  render();
});

els.prevStep.addEventListener('click', () => {
  if (STATE.currentIndex > 0) { STATE.currentIndex--; STATE.selectedAnnotationId = null; STATE.showingIntro = false; render(); }
});
els.nextStep.addEventListener('click', () => {
  if (STATE.currentIndex < STATE.steps.length - 1) { STATE.currentIndex++; STATE.selectedAnnotationId = null; STATE.showingIntro = false; render(); }
});
els.deleteStepBtn.addEventListener('click', () => {
  if (!confirm('Delete this step?')) return;
  deleteStep(STATE.currentIndex);
});
els.duplicateStepBtn.addEventListener('click', () => duplicateStep(STATE.currentIndex));
els.previewStepBtn.addEventListener('click', async () => { await openPreview(STATE.currentIndex); });

els.undoBtn.addEventListener('click', undo);
els.redoBtn.addEventListener('click', redo);

els.annDelete.addEventListener('click', () => {
  if (!STATE.selectedAnnotationId) return;
  pushUndo();
  const step = STATE.steps[STATE.currentIndex];
  step.annotations = step.annotations.filter(a => a.id !== STATE.selectedAnnotationId);
  STATE.selectedAnnotationId = null;
  persist(false);
  renderInspector();
  renderAnnotations(step);
});
els.annDeselect.addEventListener('click', () => {
  STATE.selectedAnnotationId = null;
  renderInspector();
  renderAnnotations(STATE.steps[STATE.currentIndex]);
});

document.querySelectorAll('.vp-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    STATE.viewportMode = btn.dataset.vp;
    renderViewport();
  });
});

els.addStepBtn.addEventListener('click', () => insertStepAt(STATE.steps.length));

document.addEventListener('keydown', (e) => {
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
  else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
  else if (e.key === 'Delete' || e.key === 'Backspace') {
    if (STATE.selectedAnnotationId) { e.preventDefault(); els.annDelete.click(); }
  }
  else if (e.key === 'Escape') {
    STATE.selectedAnnotationId = null;
    renderInspector();
    renderAnnotations(STATE.steps[STATE.currentIndex]);
  }
  else if (e.key === 'v' || e.key === 'V') setTool('select');
  else if (e.key === 'a' || e.key === 'A') setTool('arrow');
  else if (e.key === 'r' || e.key === 'R') setTool('rect');
  else if (e.key === 't' || e.key === 'T') setTool('text');
  else if (e.key === 'b' || e.key === 'B') setTool('blur');
  else if (e.key === 's' || e.key === 'S') setTool('spotlight');
  else if (e.key === 'z' || e.key === 'Z') {
    if (!(e.ctrlKey || e.metaKey)) setTool('zoom');
  }
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd + Arrow = step navigation
      if (e.key === 'ArrowLeft' && STATE.currentIndex > 0) {
        e.preventDefault();
        STATE.currentIndex--; STATE.selectedAnnotationId = null; STATE.showingIntro = false; render();
      } else if (e.key === 'ArrowRight' && STATE.currentIndex < STATE.steps.length - 1) {
        e.preventDefault();
        STATE.currentIndex++; STATE.selectedAnnotationId = null; STATE.showingIntro = false; render();
      }
    } else {
      // Plain/Shift Arrow = nudge hotspot or selected annotation
      e.preventDefault();
      const step = 0.5;
      const bigStep = 5;
      const delta = e.shiftKey ? bigStep : step;
      const dx = e.key === 'ArrowLeft' ? -delta : e.key === 'ArrowRight' ? delta : 0;
      const dy = e.key === 'ArrowUp' ? -delta : e.key === 'ArrowDown' ? delta : 0;
      nudgeHotspotOrAnnotation(dx, dy);
    }
  }
});

let _nudgeTimer = null;
function nudgeHotspotOrAnnotation(dx, dy) {
  if (STATE.showingIntro || STATE.steps.length === 0) return;
  const step = STATE.steps[STATE.currentIndex];
  if (!step) return;

  if (STATE.selectedAnnotationId) {
    const ann = step.annotations.find(a => a.id === STATE.selectedAnnotationId);
    if (ann) {
      if (ann.type === 'arrow') {
        ann.x1 = clamp(ann.x1 + dx, 0, 100); ann.y1 = clamp(ann.y1 + dy, 0, 100);
        ann.x2 = clamp(ann.x2 + dx, 0, 100); ann.y2 = clamp(ann.y2 + dy, 0, 100);
      } else {
        ann.x = clamp(ann.x + dx, 0, 100 - ann.w);
        ann.y = clamp(ann.y + dy, 0, 100 - ann.h);
      }
      renderAnnotations(step);
    }
  } else {
    step.clickX = clamp(step.clickX + dx, 0, 100);
    step.clickY = clamp(step.clickY + dy, 0, 100);
    positionOverlay(step);
  }

  // Debounce persist so rapid key repeats don't flood storage
  setSaveState('unsaved');
  clearTimeout(_nudgeTimer);
  _nudgeTimer = setTimeout(() => persist(), 400);
}

// ============================================================================
// INTRO SLIDE MODAL
// ============================================================================
els.introBtn.addEventListener('click', () => {
  document.getElementById('intro-enabled').checked = STATE.intro.enabled;
  document.getElementById('intro-title').value = STATE.intro.title || '';
  document.getElementById('intro-subtitle').value = STATE.intro.subtitle || '';
  document.getElementById('intro-button-text').value = STATE.intro.buttonText || 'Start Demo';
  els.introModal.style.display = 'flex';
});
document.getElementById('intro-cancel').addEventListener('click', () => {
  els.introModal.style.display = 'none';
});
document.getElementById('intro-save').addEventListener('click', () => {
  STATE.intro = {
    enabled: document.getElementById('intro-enabled').checked,
    title: document.getElementById('intro-title').value.trim(),
    subtitle: document.getElementById('intro-subtitle').value.trim(),
    buttonText: document.getElementById('intro-button-text').value.trim() || 'Start Demo',
    customBackgroundImage: STATE.intro.customBackgroundImage || null
  };
  persist();
  els.introModal.style.display = 'none';
  render();
});

// ============================================================================
// BRAND PRESETS MODAL (v2.2 - palette-based)
// ============================================================================
els.brandBtn.addEventListener('click', () => {
  loadPresets();
  resetBrandForm();
  els.brandModal.style.display = 'flex';
});
document.getElementById('brand-close').addEventListener('click', () => {
  els.brandModal.style.display = 'none';
});

document.getElementById('preset-clear-form').addEventListener('click', resetBrandForm);

function resetBrandForm() {
  document.getElementById('preset-name').value = '';
  document.getElementById('preset-theme').value = 'light';
  document.getElementById('preset-editor-heading').textContent = 'Create new preset';
  for (const key of Object.keys(DEFAULT_PALETTE)) {
    const colorInp = document.querySelector(`[data-palette="${key}"]`);
    const hexInp = document.querySelector(`[data-hex="${key}"]`);
    if (colorInp) colorInp.value = DEFAULT_PALETTE[key];
    if (hexInp) hexInp.value = DEFAULT_PALETTE[key];
  }
  document.querySelectorAll('#tooltip-style-seg .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.ttStyle === 'colored'));
}

// Sync color input <-> hex input
document.querySelectorAll('[data-palette]').forEach(input => {
  input.addEventListener('input', () => {
    const key = input.dataset.palette;
    const hex = document.querySelector(`[data-hex="${key}"]`);
    if (hex) hex.value = input.value.toUpperCase();
  });
});
document.querySelectorAll('[data-hex]').forEach(input => {
  input.addEventListener('input', () => {
    const v = input.value.trim();
    if (/^#[0-9A-Fa-f]{6}$/.test(v)) {
      const key = input.dataset.hex;
      const color = document.querySelector(`[data-palette="${key}"]`);
      if (color) color.value = v;
    }
  });
});

// Tooltip style segmented buttons
document.querySelectorAll('#tooltip-style-seg .seg-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#tooltip-style-seg .seg-btn').forEach(b => b.classList.toggle('active', b === btn));
  });
});

document.getElementById('preset-save').addEventListener('click', () => {
  const name = document.getElementById('preset-name').value.trim();
  if (!name) { alert('Preset name required'); return; }
  const palette = {};
  for (const key of Object.keys(DEFAULT_PALETTE)) {
    const inp = document.querySelector(`[data-palette="${key}"]`);
    palette[key] = inp ? inp.value : DEFAULT_PALETTE[key];
  }
  const tooltipStyle = document.querySelector('#tooltip-style-seg .seg-btn.active')?.dataset.ttStyle || 'colored';
  const preset = {
    bgMode: document.getElementById('preset-theme').value,
    palette,
    tooltipStyle
  };
  chrome.runtime.sendMessage({ type: 'SAVE_PRESET', name, preset }, () => {
    loadPresets();
    resetBrandForm();
  });
});

function refreshPresetUI() {
  const list = document.getElementById('preset-list');
  const names = Object.keys(STATE.presets);
  if (names.length === 0) {
    list.innerHTML = `<div class="preset-empty">No presets yet. Create one below.</div>`;
  } else {
    list.innerHTML = '';
    names.forEach(name => {
      const p = STATE.presets[name];
      const palette = p.palette || DEFAULT_PALETTE;
      const item = document.createElement('div');
      item.className = 'preset-item' + (STATE.activePreset === name ? ' active' : '');
      item.innerHTML = `
        <div class="preset-palette-row">
          <div class="preset-palette-dot" style="background:${palette.primary1}" title="Primary 1"></div>
          <div class="preset-palette-dot" style="background:${palette.primary2}" title="Primary 2"></div>
          <div class="preset-palette-dot" style="background:${palette.primary3}" title="Primary 3"></div>
        </div>
        <div class="preset-info">
          <div class="preset-name">${escapeHtml(name)}</div>
          <div class="preset-meta">${p.bgMode || 'light'} theme · ${p.tooltipStyle || 'colored'} tooltip</div>
        </div>
        <div class="preset-actions">
          <button class="btn-tiny" data-action="edit">Edit</button>
          <button class="btn-tiny" data-action="apply">${STATE.activePreset === name ? 'Active' : 'Apply'}</button>
          <button class="btn-tiny" data-action="delete">×</button>
        </div>
      `;
      item.querySelector('[data-action="apply"]').addEventListener('click', () => {
        STATE.activePreset = name;
        persist();
        refreshPresetUI();
        applyActivePaletteToEditor();
        render();
      });
      item.querySelector('[data-action="edit"]').addEventListener('click', () => {
        document.getElementById('preset-name').value = name;
        document.getElementById('preset-theme').value = p.bgMode || 'light';
        document.getElementById('preset-editor-heading').textContent = `Edit "${name}"`;
        for (const key of Object.keys(DEFAULT_PALETTE)) {
          const v = palette[key] || DEFAULT_PALETTE[key];
          const colorInp = document.querySelector(`[data-palette="${key}"]`);
          const hexInp = document.querySelector(`[data-hex="${key}"]`);
          if (colorInp) colorInp.value = v;
          if (hexInp) hexInp.value = v;
        }
        const ts = p.tooltipStyle || 'colored';
        document.querySelectorAll('#tooltip-style-seg .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.ttStyle === ts));
      });
      item.querySelector('[data-action="delete"]').addEventListener('click', () => {
        if (!confirm(`Delete preset "${name}"?`)) return;
        chrome.runtime.sendMessage({ type: 'DELETE_PRESET', name }, () => {
          if (STATE.activePreset === name) STATE.activePreset = null;
          loadPresets();
        });
      });
      list.appendChild(item);
    });
  }

  els.expPreset.innerHTML = '<option value="">-- None (use defaults) --</option>';
  names.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    if (STATE.activePreset === name) opt.selected = true;
    els.expPreset.appendChild(opt);
  });
}

// ============================================================================
// PERSISTENT CTA MODAL
// ============================================================================
els.ctaBtn.addEventListener('click', () => {
  document.getElementById('pcta-enabled').checked = STATE.persistentCta.enabled;
  document.getElementById('pcta-emoji').value = STATE.persistentCta.emoji || '';
  document.getElementById('pcta-text').value = STATE.persistentCta.text || '';
  document.getElementById('pcta-url').value = STATE.persistentCta.url || '';
  document.getElementById('pcta-bg').value = STATE.persistentCta.bgColor || '#1A1348';
  document.getElementById('pcta-text-color').value = STATE.persistentCta.textColor || '#FFFFFF';
  document.getElementById('pcta-new-window').checked = STATE.persistentCta.openInNewWindow !== false;
  document.querySelectorAll('[data-pcta-pos]').forEach(b => b.classList.toggle('active', b.dataset.pctaPos === STATE.persistentCta.alignment));

  // Auto-fill from active preset if available
  const preset = getActivePreset();
  if (preset) {
    if (!STATE.persistentCta.bgColor || STATE.persistentCta.bgColor === '#1A1348') {
      document.getElementById('pcta-bg').value = preset.palette.primary2;
    }
    if (!STATE.persistentCta.textColor || STATE.persistentCta.textColor === '#FFFFFF') {
      document.getElementById('pcta-text-color').value = preset.palette.secondary1;
    }
  }

  els.ctaModal.style.display = 'flex';
});

document.querySelectorAll('[data-pcta-pos]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-pcta-pos]').forEach(b => b.classList.toggle('active', b === btn));
  });
});

document.getElementById('pcta-cancel').addEventListener('click', () => { els.ctaModal.style.display = 'none'; });
document.getElementById('pcta-save').addEventListener('click', () => {
  const alignment = document.querySelector('[data-pcta-pos].active')?.dataset.pctaPos || 'bottom-right';
  STATE.persistentCta = {
    enabled: document.getElementById('pcta-enabled').checked,
    emoji: document.getElementById('pcta-emoji').value,
    text: document.getElementById('pcta-text').value.trim() || 'Talk to Sales',
    alignment,
    bgColor: document.getElementById('pcta-bg').value,
    textColor: document.getElementById('pcta-text-color').value,
    url: document.getElementById('pcta-url').value.trim(),
    openInNewWindow: document.getElementById('pcta-new-window').checked
  };
  persist();
  els.ctaModal.style.display = 'none';
  render();
});

// ============================================================================
// PREVIEW
// ============================================================================
els.previewBtn.addEventListener('click', () => openPreview(STATE.intro.enabled ? -1 : 0));

async function openPreview(startIndex) {
  // Open the window SYNCHRONOUSLY (within user-gesture context) before any await
  // to avoid Chrome popup blocker. We'll write HTML into it after building.
  const win = window.open('about:blank', '_blank');
  if (!win) {
    alert('Preview blocked by popup blocker. Please allow popups for this site, then try again.');
    return;
  }
  // Show a loading state
  win.document.write('<html><body style="background:#0a0e1a;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">Building preview...</body></html>');

  const html = await buildPlayerHTML({ startIndex });
  // Replace document with the actual player HTML
  win.document.open();
  win.document.write(html);
  win.document.close();
}

// ============================================================================
// EXPORT
// ============================================================================
els.exportBtn.addEventListener('click', () => {
  refreshPresetUI();
  els.exportModal.style.display = 'flex';
});
els.cancelExport.addEventListener('click', () => { els.exportModal.style.display = 'none'; });

els.expPreset.addEventListener('change', () => {
  STATE.activePreset = els.expPreset.value || null;
  persist();
  applyActivePaletteToEditor();
  render();
});

els.confirmExport.addEventListener('click', async () => {
  els.exportModal.style.display = 'none';
  await exportZip();
});

async function buildPlayerHTML(opts = {}) {
  const stepsForPlayer = STATE.steps.map(s => ({
    image: s.imageDataUrl,
    clickX: s.clickX, clickY: s.clickY,
    title: s.tooltipTitle || '',
    body: s.tooltipBody || '',
    position: s.tooltipPosition || 'bottom',
    tooltipWidth: s.tooltipWidth || null,
    zoom: s.zoom || null,
    annotations: s.annotations || []
  }));
  return playerTemplate({
    title: STATE.projectName,
    intro: STATE.intro,
    persistentCta: STATE.persistentCta,
    finalCta: STATE.cta,
    palette: getActivePalette(),
    bgMode: getActivePreset()?.bgMode || 'light',
    tooltipStyle: getActivePreset()?.tooltipStyle || 'colored',
    startIndex: opts.startIndex ?? (STATE.intro.enabled ? -1 : 0),
    steps: stepsForPlayer,
    projectId: STATE.projectId || '',
    analyticsEndpoint: STATE.analyticsEndpoint || ''
  });
}

async function exportZip() {
  const zip = new JSZip();
  const projectFolder = STATE.projectName.replace(/[^a-z0-9-_]/gi, '-').toLowerCase() || 'walkthrough';
  const exportSteps = await Promise.all(STATE.steps.map(async (s, i) => {
    const filename = `step-${String(i + 1).padStart(3, '0')}.png`;
    const blob = await dataUrlToBlob(s.imageDataUrl);
    zip.file(`assets/${filename}`, blob);
    return {
      image: `assets/${filename}`,
      clickX: s.clickX, clickY: s.clickY,
      title: s.tooltipTitle || '',
      body: s.tooltipBody || '',
      position: s.tooltipPosition || 'bottom',
      tooltipWidth: s.tooltipWidth || null,
      zoom: s.zoom || null,
      annotations: s.annotations || []
    };
  }));

  // If intro has custom bg image, write it
  let introBgPath = null;
  if (STATE.intro.customBackgroundImage) {
    const blob = await dataUrlToBlob(STATE.intro.customBackgroundImage);
    introBgPath = 'assets/intro-bg.png';
    zip.file(introBgPath, blob);
  }

  const html = playerTemplate({
    title: STATE.projectName,
    intro: { ...STATE.intro, customBackgroundImage: introBgPath },
    persistentCta: STATE.persistentCta,
    finalCta: STATE.cta,
    palette: getActivePalette(),
    bgMode: getActivePreset()?.bgMode || 'light',
    tooltipStyle: getActivePreset()?.tooltipStyle || 'colored',
    steps: exportSteps,
    useStepImageForIntro: exportSteps[0]?.image,
    projectId: STATE.projectId || '',
    analyticsEndpoint: STATE.analyticsEndpoint || ''
  });
  zip.file('index.html', html);

  // Manifest — consumed by the guide dashboard
  const manifest = {
    version: '2.4',
    projectId: STATE.projectId || '',
    title: STATE.projectName,
    stepCount: exportSteps.length,
    hasIntro: !!(STATE.intro && STATE.intro.enabled),
    hasPersistentCta: !!(STATE.persistentCta && STATE.persistentCta.enabled),
    analyticsEndpoint: STATE.analyticsEndpoint || '',
    exportedAt: new Date().toISOString()
  };
  zip.file('walkthrough.json', JSON.stringify(manifest, null, 2));

  zip.file('netlify.toml', `[build]
  publish = "."

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "ALLOWALL"
    Content-Security-Policy = "frame-ancestors *"
`);
  zip.file('README.md', `# ${STATE.projectName}\n\nDeploy: drag this ZIP onto the guide dashboard.\n`);

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${projectFolder}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return await res.blob();
}

// ============================================================================
// PLAYER TEMPLATE (the exported HTML)
// ============================================================================
function playerTemplate(opts) {
  const { title, intro, persistentCta, finalCta, palette, bgMode, tooltipStyle, startIndex, steps, useStepImageForIntro, projectId, analyticsEndpoint } = opts;
  const isDark = bgMode === 'dark';

  // Tooltip style maps
  let ttBg, ttColor, ttBodyColor;
  if (tooltipStyle === 'colored') {
    ttBg = palette.primary1;
    ttColor = palette.secondary1;
    ttBodyColor = `${palette.secondary1}E6`;
  } else if (tooltipStyle === 'dark') {
    ttBg = '#0f172a'; ttColor = '#fff'; ttBodyColor = 'rgba(255,255,255,0.85)';
  } else {
    ttBg = '#fff'; ttColor = '#0f172a'; ttBodyColor = '#475569';
  }

  // Persistent CTA HTML
  let persistentCtaHtml = '';
  if (persistentCta && persistentCta.enabled && persistentCta.url) {
    const target = persistentCta.openInNewWindow ? 'target="_blank" rel="noopener"' : '';
    persistentCtaHtml = `<a class="persistent-cta ${persistentCta.alignment}" href="${escapeHtml(persistentCta.url)}" ${target} style="background:${persistentCta.bgColor};color:${persistentCta.textColor};">${persistentCta.emoji ? `<span>${escapeHtml(persistentCta.emoji)}</span>` : ''}<span>${escapeHtml(persistentCta.text)}</span></a>`;
  }

  // Final-screen CTA HTML
  const finalCtaHtml = (finalCta && finalCta.enabled && finalCta.url) ? `
    <a class="cta-btn primary" href="${escapeHtml(finalCta.url)}" target="_blank" rel="noopener" style="background:${palette.primary3};color:${palette.secondary1};">${escapeHtml(finalCta.text || 'Get Started')}</a>
    ${finalCta.secondaryUrl ? `<a class="cta-btn secondary" href="${escapeHtml(finalCta.secondaryUrl)}" target="_blank" rel="noopener">${escapeHtml(finalCta.secondaryText || 'Learn More')}</a>` : ''}
  ` : `<button class="cta-btn primary" onclick="restart()" style="background:${palette.primary3};color:${palette.secondary1};">Restart</button>`;

  // Intro slide HTML
  let introHtml = '';
  if (intro && intro.enabled) {
    const introBg = intro.customBackgroundImage || useStepImageForIntro || (steps[0] && steps[0].image) || '';
    introHtml = `
      <div class="intro-slide" id="intro-slide" style="background-image:url('${introBg}');">
        <div class="intro-overlay">
          <h1 class="intro-title">${escapeHtml(intro.title || title)}</h1>
          ${intro.subtitle ? `<p class="intro-subtitle">${escapeHtml(intro.subtitle)}</p>` : ''}
          <button class="intro-button" onclick="startDemo()" style="background:${palette.primary3};color:${palette.secondary1};">${escapeHtml(intro.buttonText || 'Start Demo')}</button>
        </div>
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  :root {
    --primary1: ${palette.primary1};
    --primary2: ${palette.primary2};
    --primary3: ${palette.primary3};
    --secondary1: ${palette.secondary1};
    --secondary2: ${palette.secondary2};
    --secondary3: ${palette.secondary3};
    --bg: ${isDark ? '#0a0e1a' : '#f8fafc'};
    --panel: ${isDark ? '#111827' : '#ffffff'};
    --text: ${isDark ? '#f9fafb' : '#0f172a'};
    --text-2: ${isDark ? '#9ca3af' : '#64748b'};
    --border: ${isDark ? '#1f2937' : '#e2e8f0'};
    --tt-bg: ${ttBg};
    --tt-color: ${ttColor};
    --tt-body-color: ${ttBodyColor};
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; min-height: 100vh; display: flex; flex-direction: column; overflow: hidden; }
  .progress { height: 3px; background: var(--border); }
  .progress-bar { height: 100%; background: var(--primary1); width: 0%; transition: width 0.4s ease; }
  .stage { flex: 1; display: flex; align-items: center; justify-content: center; padding: 20px; overflow: hidden; position: relative; }
  .frame { position: relative; max-width: 100%; max-height: 100%; border-radius: 10px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,${isDark ? '0.5' : '0.15'}); background: ${isDark ? '#000' : '#fff'}; }
  .zoom-content { position: relative; transition: transform 0.5s ease, transform-origin 0.5s ease; transform-origin: 50% 50%; }
  .frame img { display: block; max-width: 100%; max-height: calc(100vh - 100px); width: auto; height: auto; }
  .ann-host { position: absolute; inset: 0; pointer-events: none; }
  .ann-rect, .ann-text, .ann-blur, .ann-arrow, .ann-spotlight { position: absolute; }
  .ann-arrow { pointer-events: none; }
  .ann-arrow svg { width: 100%; height: 100%; overflow: visible; }
  .ann-blur { background: rgba(15, 23, 42, 0.92); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
  .ann-spotlight { background: transparent; pointer-events: auto; }
  .ann-text { display: flex; align-items: center; word-wrap: break-word; white-space: pre-wrap; }
  .ann-text-inner { width: 100%; }
  .hotspot { position: absolute; width: 32px; height: 32px; transform: translate(-50%, -50%); cursor: pointer; z-index: 10; }
  .hotspot::before { content: ''; position: absolute; inset: 0; border-radius: 50%; background: var(--primary1); opacity: 0.3; animation: pulse 1.6s ease-out infinite; }
  .hotspot::after { content: ''; position: absolute; inset: 9px; background: var(--primary1); border: 2px solid #fff; border-radius: 50%; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
  @keyframes pulse { 0% { transform: scale(0.7); opacity: 0.4; } 100% { transform: scale(2.2); opacity: 0; } }
  .tooltip { position: absolute; background: var(--tt-bg); color: var(--tt-color); padding: 14px 18px; border-radius: 12px; box-shadow: 0 12px 32px rgba(0,0,0,0.3); width: 280px; max-width: 600px; z-index: 9; animation: ttIn 0.3s ease-out; }
  @keyframes ttIn { from { opacity: 0; } to { opacity: 1; } }
  .tooltip-title { font-weight: 700; font-size: 15px; margin-bottom: 4px; line-height: 1.3; color: var(--tt-color); }
  .tooltip-body { font-size: 13px; color: var(--tt-body-color); line-height: 1.5; white-space: pre-wrap; }
  .controls { display: flex; align-items: center; justify-content: space-between; padding: 14px 24px; background: var(--panel); border-top: 1px solid var(--border); }
  .step-counter { font-size: 12px; color: var(--text-2); font-weight: 500; }
  .ctrl-btns { display: flex; gap: 8px; }
  .ctrl-btn { padding: 8px 16px; background: transparent; color: var(--text); border: 1px solid var(--border); border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; font-family: inherit; transition: all 0.15s; }
  .ctrl-btn:hover { background: var(--border); }
  .ctrl-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .ctrl-btn.primary { background: var(--primary1); color: #fff; border-color: var(--primary1); }
  .ctrl-btn.primary:hover { filter: brightness(1.1); }
  .complete-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.85); color: #fff; display: none; align-items: center; justify-content: center; flex-direction: column; z-index: 100; text-align: center; padding: 40px; }
  .complete-overlay.visible { display: flex; }
  .complete-overlay h2 { font-size: 28px; margin-bottom: 12px; }
  .complete-overlay p { font-size: 15px; opacity: 0.8; margin-bottom: 24px; max-width: 420px; }
  .cta-row { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
  .cta-btn { padding: 12px 24px; font-size: 14px; font-weight: 600; border-radius: 8px; cursor: pointer; border: none; text-decoration: none; display: inline-block; font-family: inherit; transition: all 0.15s; }
  .cta-btn:hover { filter: brightness(1.1); }
  .cta-btn.secondary { background: transparent !important; color: #fff !important; border: 1px solid rgba(255,255,255,0.3); }
  .cta-btn.secondary:hover { background: rgba(255,255,255,0.1) !important; }
  .persistent-cta { position: absolute; z-index: 20; display: inline-flex; align-items: center; gap: 6px; padding: 10px 16px; border-radius: 999px; font-weight: 600; font-size: 13px; cursor: pointer; text-decoration: none; font-family: inherit; box-shadow: 0 8px 24px rgba(0,0,0,0.3); transition: transform 0.1s, filter 0.15s; border: none; }
  .persistent-cta:hover { filter: brightness(1.1); transform: translateY(-1px); }
  .persistent-cta.bottom-right { bottom: 80px; right: 20px; }
  .persistent-cta.bottom-left { bottom: 80px; left: 20px; }
  .persistent-cta.top-right { top: 20px; right: 20px; }
  .persistent-cta.top-left { top: 20px; left: 20px; }

  /* Intro slide */
  .intro-slide { position: absolute; inset: 0; background-size: cover; background-position: center; z-index: 50; display: flex; align-items: center; justify-content: center; }
  .intro-slide.hidden { display: none; }
  .intro-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.65); backdrop-filter: blur(4px); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px; text-align: center; }
  .intro-title { font-size: 44px; font-weight: 700; color: #fff; margin-bottom: 16px; max-width: 80%; line-height: 1.15; }
  .intro-subtitle { font-size: 17px; color: rgba(255,255,255,0.9); margin-bottom: 36px; max-width: 60%; line-height: 1.5; }
  .intro-button { padding: 16px 36px; border: none; border-radius: 10px; font-weight: 600; font-size: 16px; cursor: pointer; font-family: inherit; box-shadow: 0 12px 32px rgba(0,0,0,0.4); transition: all 0.15s; }
  .intro-button:hover { filter: brightness(1.1); transform: translateY(-1px); }

  @media (max-width: 768px) {
    .stage { padding: 10px; }
    .tooltip { max-width: 240px; padding: 10px 12px; }
    .tooltip-title { font-size: 13px; }
    .tooltip-body { font-size: 12px; }
    .controls { padding: 10px 14px; }
    .ctrl-btn { padding: 6px 12px; font-size: 12px; }
    .intro-title { font-size: 28px; }
    .intro-subtitle { font-size: 14px; max-width: 80%; }
    .persistent-cta { padding: 8px 12px; font-size: 12px; }
    .persistent-cta.bottom-right, .persistent-cta.bottom-left { bottom: 70px; }
  }
</style>
</head>
<body>
  <div class="progress"><div class="progress-bar" id="progress-bar"></div></div>
  <div class="stage" id="stage">
    <div class="frame" id="frame">
      <div class="zoom-content" id="zoom-content">
        <img id="step-image" alt="" />
        <div class="ann-host" id="ann-host"></div>
        <div class="hotspot" id="hotspot"></div>
        <div class="tooltip" id="tooltip">
          <div class="tooltip-title" id="tt-title"></div>
          <div class="tooltip-body" id="tt-body"></div>
        </div>
      </div>
      ${persistentCtaHtml}
    </div>
    ${introHtml}
    <div class="complete-overlay" id="complete-overlay">
      <h2>Walkthrough complete</h2>
      <p>Thanks for taking the tour.</p>
      <div class="cta-row">${finalCtaHtml}</div>
    </div>
  </div>
  <div class="controls">
    <span class="step-counter" id="counter">1 / 1</span>
    <div class="ctrl-btns">
      <button class="ctrl-btn" id="prev-btn">Back</button>
      <button class="ctrl-btn primary" id="next-btn">Next →</button>
    </div>
  </div>

<script>
const STEPS = ${JSON.stringify(steps)};
const HAS_INTRO = ${intro && intro.enabled ? 'true' : 'false'};
let idx = ${typeof startIndex === 'number' ? startIndex : (intro && intro.enabled ? -1 : 0)};

const img = document.getElementById('step-image');
const hotspot = document.getElementById('hotspot');
const tooltip = document.getElementById('tooltip');
const ttTitle = document.getElementById('tt-title');
const ttBody = document.getElementById('tt-body');
const counter = document.getElementById('counter');
const progressBar = document.getElementById('progress-bar');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const completeOverlay = document.getElementById('complete-overlay');
const annHost = document.getElementById('ann-host');
const introSlide = document.getElementById('intro-slide');
const zoomContent = document.getElementById('zoom-content');

// Compute effective zoom for each step (inherit from previous if not explicitly cleared)
function computeEffectiveZooms() {
  const result = [];
  let active = null;
  for (const s of STEPS) {
    if (s.zoom === null) {
      // Explicit clear
      active = null;
    } else if (s.zoom) {
      active = s.zoom;
    }
    result.push(active);
  }
  return result;
}
const EFFECTIVE_ZOOMS = computeEffectiveZooms();

function applyZoomForStep(stepIdx) {
  const z = EFFECTIVE_ZOOMS[stepIdx];
  if (!z || !zoomContent) {
    if (zoomContent) {
      zoomContent.style.transform = 'scale(1)';
      zoomContent.style.transformOrigin = '50% 50%';
    }
    return;
  }
  // Calculate scale to fit the zoom region into the frame
  // z is { x, y, w, h } in percent of the original image
  const scaleX = 100 / z.w;
  const scaleY = 100 / z.h;
  const scale = Math.min(scaleX, scaleY);
  // Origin: center of the zoom region
  const ox = z.x + z.w / 2;
  const oy = z.y + z.h / 2;
  zoomContent.style.transformOrigin = ox + '% ' + oy + '%';
  zoomContent.style.transform = 'scale(' + scale + ')';
}

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
}

function startDemo() {
  if (introSlide) introSlide.classList.add('hidden');
  idx = 0;
  render();
}

function render() {
  if (idx === -1) {
    // Show intro slide; nothing else to render
    if (introSlide) introSlide.classList.remove('hidden');
    progressBar.style.width = '0%';
    counter.textContent = 'Intro';
    prevBtn.style.opacity = '0.4'; prevBtn.disabled = true;
    nextBtn.textContent = 'Start →';
    return;
  }
  if (introSlide) introSlide.classList.add('hidden');

  if (idx >= STEPS.length) {
    completeOverlay.classList.add('visible');
    notifyParent('complete');
    track('complete', { total: STEPS.length });
    return;
  }
  completeOverlay.classList.remove('visible');
  const s = STEPS[idx];
  img.src = s.image;
  ttTitle.textContent = s.title || '';
  ttBody.textContent = s.body || '';
  counter.textContent = (idx + 1) + ' / ' + STEPS.length;
  progressBar.style.width = ((idx + 1) / STEPS.length * 100) + '%';
  hotspot.style.left = s.clickX + '%';
  hotspot.style.top = s.clickY + '%';
  positionTooltip(s);
  renderAnnotations(s);
  applyZoomForStep(idx);
  prevBtn.disabled = idx === 0;
  prevBtn.style.opacity = idx === 0 ? '0.4' : '1';
  nextBtn.textContent = (idx === STEPS.length - 1) ? 'Finish' : 'Next →';
  notifyParent('step', { index: idx, total: STEPS.length });
  track('step', { index: idx, total: STEPS.length });
}

function positionTooltip(s) {
  tooltip.style.left = ''; tooltip.style.top = ''; tooltip.style.right = ''; tooltip.style.bottom = '';
  tooltip.style.transform = '';
  // Apply stored tooltip width or default
  tooltip.style.width = s.tooltipWidth ? (s.tooltipWidth + 'px') : '280px';
  tooltip.style.maxWidth = '600px';
  const tp = s.position;
  if (tp && typeof tp === 'object' && tp.x !== undefined) {
    tooltip.style.left = tp.x + '%';
    tooltip.style.top = tp.y + '%';
    return;
  }
  const offset = 28;
  switch (tp || 'bottom') {
    case 'top': tooltip.style.left = s.clickX + '%'; tooltip.style.top = 'calc(' + s.clickY + '% - ' + offset + 'px)'; tooltip.style.transform = 'translate(-50%, -100%)'; break;
    case 'bottom': tooltip.style.left = s.clickX + '%'; tooltip.style.top = 'calc(' + s.clickY + '% + ' + offset + 'px)'; tooltip.style.transform = 'translateX(-50%)'; break;
    case 'left': tooltip.style.left = 'calc(' + s.clickX + '% - ' + offset + 'px)'; tooltip.style.top = s.clickY + '%'; tooltip.style.transform = 'translate(-100%, -50%)'; break;
    case 'right': tooltip.style.left = 'calc(' + s.clickX + '% + ' + offset + 'px)'; tooltip.style.top = s.clickY + '%'; tooltip.style.transform = 'translateY(-50%)'; break;
  }
}

function renderAnnotations(s) {
  annHost.innerHTML = '';
  (s.annotations || []).forEach(ann => {
    const el = document.createElement('div');
    if (ann.type === 'arrow') {
      el.className = 'ann-arrow';
      const minX = Math.min(ann.x1, ann.x2);
      const maxX = Math.max(ann.x1, ann.x2);
      const minY = Math.min(ann.y1, ann.y2);
      const maxY = Math.max(ann.y1, ann.y2);
      const padPct = 1.5;
      const left = minX - padPct;
      const top = minY - padPct;
      const w = (maxX - minX) + padPct * 2;
      const h = (maxY - minY) + padPct * 2;
      el.style.left = left + '%'; el.style.top = top + '%';
      el.style.width = w + '%'; el.style.height = h + '%';
      const svgX1 = ((ann.x1 - left) / w) * 100;
      const svgY1 = ((ann.y1 - top) / h) * 100;
      const svgX2 = ((ann.x2 - left) / w) * 100;
      const svgY2 = ((ann.y2 - top) / h) * 100;
      const stroke = (ann.style && ann.style.stroke) || '#ef4444';
      const sw = (ann.style && ann.style.strokeWidth) || 3;
      el.innerHTML = '<svg viewBox="0 0 100 100" preserveAspectRatio="none"><defs><marker id="arr-' + ann.id + '" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth"><polygon points="0 0, 6 3, 0 6" fill="' + stroke + '" /></marker></defs><line x1="' + svgX1 + '" y1="' + svgY1 + '" x2="' + svgX2 + '" y2="' + svgY2 + '" stroke="' + stroke + '" stroke-width="' + sw + '" stroke-linecap="round" vector-effect="non-scaling-stroke" marker-end="url(#arr-' + ann.id + ')" /></svg>';
    } else if (ann.type === 'rect') {
      el.className = 'ann-rect';
      el.style.left = ann.x + '%'; el.style.top = ann.y + '%';
      el.style.width = ann.w + '%'; el.style.height = ann.h + '%';
      const st = ann.style || {};
      el.style.border = (st.strokeWidth || 3) + 'px solid ' + (st.stroke || '#ef4444');
      el.style.borderRadius = (st.radius || 0) + 'px';
      if (st.fill && st.fill !== 'transparent') el.style.background = hexToRgba(st.fill, st.fillOpacity != null ? st.fillOpacity : 0.2);
    } else if (ann.type === 'text') {
      el.className = 'ann-text';
      el.style.left = ann.x + '%'; el.style.top = ann.y + '%';
      el.style.width = ann.w + '%'; el.style.height = ann.h + '%';
      const st = ann.style || {};
      el.style.color = st.color || '#0f172a';
      el.style.fontSize = (st.fontSize || 16) + 'px';
      el.style.fontWeight = st.fontWeight || '600';
      el.style.textAlign = st.align || 'center';
      el.style.padding = (st.padding || 8) + 'px';
      el.style.borderRadius = (st.radius || 6) + 'px';
      if (st.bgColor && (st.bgOpacity == null || st.bgOpacity > 0)) el.style.background = hexToRgba(st.bgColor, st.bgOpacity != null ? st.bgOpacity : 1);
      if (st.borderWidth > 0) el.style.border = st.borderWidth + 'px solid ' + (st.borderColor || '#ef4444');
      const inner = document.createElement('div');
      inner.className = 'ann-text-inner';
      inner.textContent = ann.text || '';
      el.appendChild(inner);
    } else if (ann.type === 'blur') {
      el.className = 'ann-blur';
      el.style.left = ann.x + '%'; el.style.top = ann.y + '%';
      el.style.width = ann.w + '%'; el.style.height = ann.h + '%';
      const st = ann.style || {};
      el.style.background = 'rgba(15, 23, 42, ' + (st.opacity != null ? st.opacity : 0.92) + ')';
    } else if (ann.type === 'spotlight') {
      el.className = 'ann-spotlight';
      el.style.left = ann.x + '%'; el.style.top = ann.y + '%';
      el.style.width = ann.w + '%'; el.style.height = ann.h + '%';
      const st = ann.style || {};
      el.style.borderColor = st.borderColor || '#FFFFFF';
      el.style.borderWidth = (st.borderWidth || 2) + 'px';
      el.style.borderStyle = 'solid';
      el.style.borderRadius = (st.radius || 4) + 'px';
      el.style.boxShadow = '0 0 0 9999px rgba(15, 23, 42, ' + (st.opacity != null ? st.opacity : 0.85) + ')';
    }
    annHost.appendChild(el);
  });
}

function next() {
  if (idx === -1) { idx = 0; }
  else { idx++; }
  render();
}
function prev() {
  if (idx > 0) { idx--; render(); }
  else if (idx === 0 && HAS_INTRO) { idx = -1; render(); }
}
function restart() { idx = HAS_INTRO ? -1 : 0; render(); }

const PROJECT_ID = ${JSON.stringify(projectId || '')};
const ANALYTICS_ENDPOINT = ${JSON.stringify(analyticsEndpoint || '')};

function track(event, data) {
  if (!ANALYTICS_ENDPOINT) return;
  try {
    navigator.sendBeacon(ANALYTICS_ENDPOINT, JSON.stringify(
      Object.assign({ event, projectId: PROJECT_ID, ts: Date.now() }, data)
    ));
  } catch (e) {}
}

function notifyParent(type, data) {
  try {
    if (window.parent !== window) {
      window.parent.postMessage(Object.assign({ source: 'walkthrough', type: type }, data), '*');
    }
  } catch (e) {}
}

prevBtn.addEventListener('click', prev);
nextBtn.addEventListener('click', next);
hotspot.addEventListener('click', next);
document.addEventListener('keydown', function(e) {
  if (e.key === 'ArrowRight' || e.key === 'Enter') next();
  if (e.key === 'ArrowLeft') prev();
  if (e.key === 'Escape') restart();
});

render();
</script>
</body>
</html>`;
}

// ============================================================================
// INIT
// ============================================================================
loadSteps();
updateUndoButtons();
