// popup.js v2.4

const idleView = document.getElementById('idle-view');
const recordingView = document.getElementById('recording-view');
const projectInput = document.getElementById('project-name');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const openReviewBtn = document.getElementById('open-review-btn');
const stepCountEl = document.getElementById('step-count');
const recentSection = document.getElementById('recent-section');
const projectListEl = document.getElementById('project-list');

function refreshState() {
  chrome.runtime.sendMessage({ type: 'GET_STATE' }, (res) => {
    if (chrome.runtime.lastError || !res) return;
    if (res.recording) {
      idleView.style.display = 'none';
      recordingView.style.display = 'block';
      stepCountEl.textContent = res.stepCount;
    } else {
      idleView.style.display = 'block';
      recordingView.style.display = 'none';
      loadRecentProjects(res.projectId);
    }
  });
}

function loadRecentProjects(activeProjectId) {
  chrome.runtime.sendMessage({ type: 'LIST_PROJECTS' }, (res) => {
    if (chrome.runtime.lastError || !res) return;
    const projects = res.projects || [];

    if (projects.length === 0) {
      recentSection.style.display = 'none';
      openReviewBtn.style.display = 'none';
      return;
    }

    openReviewBtn.style.display = 'block';
    recentSection.style.display = 'block';

    const top5 = projects.slice(0, 5);
    projectListEl.innerHTML = '';
    top5.forEach(proj => {
      const item = document.createElement('div');
      item.className = 'project-item' + (proj.id === activeProjectId ? ' active' : '');
      const when = proj.updatedAt ? timeAgo(proj.updatedAt) : '';
      item.innerHTML = `
        <div class="project-info">
          <div class="project-name-text">${escHtml(proj.name)}</div>
          <div class="project-meta">${proj.stepCount} step${proj.stepCount !== 1 ? 's' : ''}${when ? ' · ' + when : ''}</div>
        </div>
        <button class="project-open" data-id="${proj.id}">Edit →</button>
      `;
      item.querySelector('.project-open').addEventListener('click', (e) => {
        e.stopPropagation();
        chrome.runtime.sendMessage({ type: 'LOAD_PROJECT', projectId: proj.id }, () => {
          chrome.runtime.sendMessage({ type: 'OPEN_REVIEW' }, () => window.close());
        });
      });
      // Clicking the whole row also loads the project
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('project-open')) return;
        chrome.runtime.sendMessage({ type: 'LOAD_PROJECT', projectId: proj.id }, () => {
          chrome.runtime.sendMessage({ type: 'OPEN_REVIEW' }, () => window.close());
        });
      });
      projectListEl.appendChild(item);
    });
  });
}

function escHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

startBtn.addEventListener('click', () => {
  const projectName = projectInput.value.trim() || 'Untitled Walkthrough';
  chrome.runtime.sendMessage({ type: 'START_RECORDING', projectName }, () => {
    window.close();
  });
});

stopBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'STOP_RECORDING' }, () => {
    window.close();
  });
});

openReviewBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'OPEN_REVIEW' }, () => {
    window.close();
  });
});

// Use storage.onChanged to stay in sync without polling
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.projects || changes.activeProjectId)) {
    chrome.runtime.sendMessage({ type: 'GET_STATE' }, (res) => {
      if (chrome.runtime.lastError || !res) return;
      if (res.recording) {
        stepCountEl.textContent = res.stepCount;
      } else {
        loadRecentProjects(res.projectId);
      }
    });
  }
});

// Initial load
refreshState();
