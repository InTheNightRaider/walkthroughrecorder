// background.js v2.4

const DEFAULT_PALETTE = {
  primary1: '#6366f1',
  primary2: '#1A1348',
  primary3: '#4f46e5',
  secondary1: '#FFFFFF',
  secondary2: '#818cf8',
  secondary3: '#374151'
};

const DEFAULT_PERSISTENT_CTA = {
  enabled: false, emoji: '👉', text: 'Talk to Sales',
  alignment: 'bottom-right', bgColor: '#1A1348', textColor: '#FFFFFF',
  url: '', openInNewWindow: true
};

const DEFAULT_FINAL_CTA = {
  enabled: false, text: 'Get Started', url: '', secondaryText: '', secondaryUrl: ''
};

const DEFAULT_INTRO = {
  enabled: true, title: '', subtitle: '', buttonText: 'Start Demo', customBackgroundImage: null
};

// ============================================================================
// STATE — v2.4 multi-project shape
// ============================================================================
let PROJECTS = {};         // { [projectId]: Project }
let ACTIVE_PROJECT_ID = null;
let BRAND_PRESETS = {};
let IS_RECORDING = false;
let RECORDING_PROJECT_ID = null;  // project ID being actively recorded

// Load from storage on startup
chrome.storage.local.get(['projects', 'activeProjectId', 'recordingState', 'brandPresets'], (data) => {
  if (data.brandPresets) {
    BRAND_PRESETS = migratePresets(data.brandPresets);
  }

  if (data.projects) {
    // v2.4 format — already migrated
    PROJECTS = data.projects;
    ACTIVE_PROJECT_ID = data.activeProjectId || null;
    // Validate activeProjectId still exists
    if (ACTIVE_PROJECT_ID && !PROJECTS[ACTIVE_PROJECT_ID]) {
      ACTIVE_PROJECT_ID = null;
    }
    // Pick most-recently-updated project if none active
    if (!ACTIVE_PROJECT_ID) {
      const ids = Object.keys(PROJECTS);
      if (ids.length > 0) {
        ACTIVE_PROJECT_ID = ids.reduce((best, id) =>
          (PROJECTS[id].updatedAt || 0) > (PROJECTS[best].updatedAt || 0) ? id : best
        );
      }
    }
  } else if (data.recordingState) {
    // Migrate v2.3 flat recordingState → single project
    const old = data.recordingState;
    const proj = makeProject({
      name: old.projectName || 'Untitled Walkthrough',
      steps: old.steps || [],
      intro: old.intro || { ...DEFAULT_INTRO },
      cta: old.cta || { ...DEFAULT_FINAL_CTA },
      persistentCta: old.persistentCta || { ...DEFAULT_PERSISTENT_CTA },
      activePreset: old.activePreset || null
    });
    PROJECTS = { [proj.id]: proj };
    ACTIVE_PROJECT_ID = proj.id;
    chrome.storage.local.set({ projects: PROJECTS, activeProjectId: ACTIVE_PROJECT_ID });
    chrome.storage.local.remove('recordingState');
  }
});

function migratePresets(presets) {
  const migrated = {};
  for (const [name, p] of Object.entries(presets)) {
    if (p.palette) {
      migrated[name] = p;
    } else {
      const primary = p.primaryColor || '#6366f1';
      migrated[name] = {
        bgMode: p.bgMode || 'light',
        palette: { ...DEFAULT_PALETTE, primary1: primary, primary3: primary },
        tooltipStyle: 'colored'
      };
    }
  }
  return migrated;
}

function makeProject(partial) {
  const now = Date.now();
  return {
    id: `proj_${now}_${Math.random().toString(36).slice(2, 8)}`,
    name: partial.name || 'Untitled Walkthrough',
    steps: partial.steps || [],
    intro: partial.intro || { ...DEFAULT_INTRO },
    cta: partial.cta || { ...DEFAULT_FINAL_CTA },
    persistentCta: partial.persistentCta || { ...DEFAULT_PERSISTENT_CTA },
    activePreset: partial.activePreset || null,
    analyticsEndpoint: partial.analyticsEndpoint || '',
    deployments: partial.deployments || [],
    createdAt: partial.createdAt || now,
    updatedAt: now
  };
}

function getActiveProject() {
  if (ACTIVE_PROJECT_ID && PROJECTS[ACTIVE_PROJECT_ID]) return PROJECTS[ACTIVE_PROJECT_ID];
  return null;
}

function persistProjects() {
  chrome.storage.local.set({ projects: PROJECTS, activeProjectId: ACTIVE_PROJECT_ID });
}

function persistPresets() {
  chrome.storage.local.set({ brandPresets: BRAND_PRESETS });
}

function makeStep(partial) {
  return {
    id: `step_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    imageDataUrl: partial.imageDataUrl,
    clickX: partial.clickX ?? 50,
    clickY: partial.clickY ?? 50,
    targetText: partial.targetText || '',
    targetSelector: partial.targetSelector || '',
    pageUrl: partial.pageUrl || '',
    pageTitle: partial.pageTitle || '',
    timestamp: Date.now(),
    tooltipTitle: '',
    tooltipBody: '',
    tooltipPosition: 'bottom',
    tooltipWidth: null,
    zoom: null,
    leadCapture: null,
    annotations: []
  };
}

// ============================================================================
// MESSAGE HANDLER
// ============================================================================
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      switch (msg.type) {

        case 'GET_STATE': {
          const proj = getActiveProject();
          sendResponse({
            recording: IS_RECORDING,
            stepCount: proj ? proj.steps.length : 0,
            projectName: proj ? proj.name : 'Untitled Walkthrough',
            projectId: ACTIVE_PROJECT_ID
          });
          break;
        }

        case 'START_RECORDING': {
          // Always create a new project — never clobber an existing one
          const proj = makeProject({ name: msg.projectName || 'Untitled Walkthrough' });
          PROJECTS[proj.id] = proj;
          ACTIVE_PROJECT_ID = proj.id;
          RECORDING_PROJECT_ID = proj.id;
          IS_RECORDING = true;
          persistProjects();
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          proj.startTabId = activeTab?.id;
          proj.startUrl = activeTab?.url;
          // Broadcast to ALL open tabs so any already-loaded content script wakes up immediately
          const allTabs = await chrome.tabs.query({});
          for (const t of allTabs) {
            try { await chrome.tabs.sendMessage(t.id, { type: 'RECORDING_STARTED' }); } catch (e) {}
          }
          sendResponse({ ok: true, projectId: proj.id });
          break;
        }

        case 'STOP_RECORDING': {
          IS_RECORDING = false;
          RECORDING_PROJECT_ID = null;
          const proj = getActiveProject();
          if (proj) {
            proj.updatedAt = Date.now();
            persistProjects();
          }
          const allTabs = await chrome.tabs.query({});
          for (const t of allTabs) {
            try { await chrome.tabs.sendMessage(t.id, { type: 'RECORDING_STOPPED' }); } catch (e) {}
          }
          if (proj && proj.steps.length > 0) {
            await chrome.tabs.create({ url: chrome.runtime.getURL('review.html') });
          }
          sendResponse({ ok: true, stepCount: proj ? proj.steps.length : 0 });
          break;
        }

        case 'CAPTURE_CLICK': {
          if (!IS_RECORDING) { sendResponse({ ok: false, reason: 'not recording' }); return; }
          const proj = RECORDING_PROJECT_ID ? PROJECTS[RECORDING_PROJECT_ID] : getActiveProject();
          if (!proj) { sendResponse({ ok: false, reason: 'no active project' }); return; }
          try {
            const tab = sender.tab;
            // captureTab captures the specific tab regardless of which tab is active.
            // captureVisibleTab captures whatever is currently active — if focus shifted
            // during the async gap (e.g. a notification, alt-tab), it would capture
            // the wrong tab and the hotspot would land in the wrong place.
            const captureTabFn = chrome.tabs.captureTab;
            const dataUrl = captureTabFn
              ? await chrome.tabs.captureTab(tab.id, { format: 'png' })
              : await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
            const { clientX, clientY, viewportW, viewportH } = msg;
            const clickX = viewportW > 0 ? Math.max(0, Math.min(100, (clientX / viewportW) * 100)) : 50;
            const clickY = viewportH > 0 ? Math.max(0, Math.min(100, (clientY / viewportH) * 100)) : 50;
            const step = makeStep({
              imageDataUrl: dataUrl, clickX, clickY,
              targetText: msg.targetText || '',
              targetSelector: msg.targetSelector || '',
              pageUrl: tab.url, pageTitle: tab.title
            });
            proj.steps.push(step);
            proj.updatedAt = Date.now();
            persistProjects();
            sendResponse({ ok: true, stepNumber: proj.steps.length });
          } catch (err) {
            console.error('Capture failed:', err);
            sendResponse({ ok: false, reason: err.message });
          }
          break;
        }

        case 'GET_STEPS': {
          const proj = getActiveProject();
          if (!proj) { sendResponse({ steps: [], projectName: 'Untitled Walkthrough', projectId: null }); return; }
          sendResponse({
            steps: proj.steps,
            projectName: proj.name,
            projectId: proj.id,
            intro: proj.intro,
            cta: proj.cta,
            persistentCta: proj.persistentCta,
            activePreset: proj.activePreset,
            analyticsEndpoint: proj.analyticsEndpoint || '',
            deployments: proj.deployments || []
          });
          break;
        }

        case 'UPDATE_STEPS': {
          const targetId = msg.projectId || ACTIVE_PROJECT_ID;
          const proj = targetId ? PROJECTS[targetId] : null;
          if (!proj) { sendResponse({ ok: false }); return; }
          if (msg.steps !== undefined) proj.steps = msg.steps;
          if (msg.projectName !== undefined) proj.name = msg.projectName;
          if (msg.intro) proj.intro = msg.intro;
          if (msg.cta) proj.cta = msg.cta;
          if (msg.persistentCta) proj.persistentCta = msg.persistentCta;
          if (msg.activePreset !== undefined) proj.activePreset = msg.activePreset;
          if (msg.analyticsEndpoint !== undefined) proj.analyticsEndpoint = msg.analyticsEndpoint;
          proj.updatedAt = Date.now();
          persistProjects();
          sendResponse({ ok: true });
          break;
        }

        case 'LIST_PROJECTS': {
          const list = Object.values(PROJECTS)
            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
            .map(p => ({
              id: p.id,
              name: p.name,
              stepCount: p.steps.length,
              updatedAt: p.updatedAt,
              createdAt: p.createdAt
            }));
          sendResponse({ projects: list, activeProjectId: ACTIVE_PROJECT_ID });
          break;
        }

        case 'LOAD_PROJECT': {
          if (!PROJECTS[msg.projectId]) { sendResponse({ ok: false }); return; }
          ACTIVE_PROJECT_ID = msg.projectId;
          persistProjects();
          sendResponse({ ok: true });
          break;
        }

        case 'NEW_PROJECT': {
          const proj = makeProject({ name: msg.name || 'Untitled Walkthrough' });
          PROJECTS[proj.id] = proj;
          ACTIVE_PROJECT_ID = proj.id;
          persistProjects();
          sendResponse({ ok: true, projectId: proj.id });
          break;
        }

        case 'DELETE_PROJECT': {
          if (!PROJECTS[msg.projectId]) { sendResponse({ ok: false }); return; }
          delete PROJECTS[msg.projectId];
          if (ACTIVE_PROJECT_ID === msg.projectId) {
            const remaining = Object.values(PROJECTS).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
            ACTIVE_PROJECT_ID = remaining.length > 0 ? remaining[0].id : null;
          }
          persistProjects();
          sendResponse({ ok: true });
          break;
        }

        case 'ADD_DEPLOYMENT': {
          const proj = getActiveProject();
          if (!proj) { sendResponse({ ok: false }); return; }
          const dep = {
            id: `dep_${Date.now()}`,
            url: msg.url || '',
            note: msg.note || '',
            at: Date.now()
          };
          if (!proj.deployments) proj.deployments = [];
          proj.deployments.unshift(dep);
          proj.updatedAt = Date.now();
          persistProjects();
          sendResponse({ ok: true, deployment: dep });
          break;
        }

        case 'DELETE_DEPLOYMENT': {
          const proj = getActiveProject();
          if (!proj) { sendResponse({ ok: false }); return; }
          proj.deployments = (proj.deployments || []).filter(d => d.id !== msg.deploymentId);
          proj.updatedAt = Date.now();
          persistProjects();
          sendResponse({ ok: true });
          break;
        }

        case 'CLEAR_PROJECT': {
          const proj = getActiveProject();
          if (proj) {
            proj.steps = [];
            proj.intro = { ...DEFAULT_INTRO };
            proj.cta = { ...DEFAULT_FINAL_CTA };
            proj.persistentCta = { ...DEFAULT_PERSISTENT_CTA };
            proj.activePreset = null;
            proj.updatedAt = Date.now();
            persistProjects();
          }
          sendResponse({ ok: true });
          break;
        }

        case 'OPEN_REVIEW': {
          await chrome.tabs.create({ url: chrome.runtime.getURL('review.html') });
          sendResponse({ ok: true });
          break;
        }

        case 'GET_PRESETS':
          sendResponse({ presets: BRAND_PRESETS });
          break;

        case 'SAVE_PRESET':
          BRAND_PRESETS[msg.name] = msg.preset;
          persistPresets();
          sendResponse({ ok: true });
          break;

        case 'DELETE_PRESET':
          delete BRAND_PRESETS[msg.name];
          persistPresets();
          sendResponse({ ok: true });
          break;
      }
    } catch (err) {
      console.error('Message handler error:', err);
      sendResponse({ ok: false, error: err.message });
    }
  })();
  return true;
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (IS_RECORDING && changeInfo.status === 'complete') {
    try { await chrome.tabs.sendMessage(tabId, { type: 'RECORDING_STARTED' }); } catch (e) {}
  }
});
