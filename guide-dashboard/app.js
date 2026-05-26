// guide-dashboard/app.js

const uploadZone   = document.getElementById('upload-zone');
const fileInput    = document.getElementById('file-input');
const uploadForm   = document.getElementById('upload-form');
const fileBadge    = document.getElementById('file-badge');
const titleInput   = document.getElementById('guide-title');
const slugInput    = document.getElementById('guide-slug');
const descInput    = document.getElementById('guide-desc');
const submitBtn    = document.getElementById('submit-upload');
const cancelBtn    = document.getElementById('cancel-upload');
const progressWrap = document.getElementById('upload-progress');
const progressFill = document.getElementById('progress-fill');
const progressLbl  = document.getElementById('progress-label');
const guideGrid    = document.getElementById('guide-grid');
const embedPopup   = document.getElementById('embed-popup');
const embedCodeEl  = document.getElementById('embed-code-text');
const embedClose   = document.getElementById('embed-close');
const embedCopy    = document.getElementById('embed-copy');
const refreshBtn   = document.getElementById('refresh-btn');
const toast        = document.getElementById('toast');

let selectedFile = null;

// ─── Toast ────────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, type = 'success') {
  toast.textContent = msg;
  toast.className = `visible ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.className = ''; }, 3000);
}

// ─── Slug helpers ─────────────────────────────────────────────────────────────
function toSlug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'guide';
}

// ─── File selection ───────────────────────────────────────────────────────────
fileInput.addEventListener('change', () => handleFile(fileInput.files[0]));

uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  const f = e.dataTransfer.files[0];
  if (f && f.name.endsWith('.zip')) handleFile(f);
  else showToast('Please drop a .zip file', 'error');
});

function handleFile(file) {
  if (!file || !file.name.endsWith('.zip')) { showToast('Please select a .zip file', 'error'); return; }
  selectedFile = file;

  // Try to read walkthrough.json from the ZIP for default title/slug
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      // dynamic import not available in plain script; use global JSZip if available, or just use filename
      const baseName = file.name.replace(/\.zip$/i, '');
      titleInput.value = titleInput.value || baseName.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      slugInput.value = slugInput.value || toSlug(baseName);
    } catch {}
  };
  reader.readAsArrayBuffer(file);

  fileBadge.innerHTML = `📦 <strong>${esc(file.name)}</strong> (${(file.size / 1024).toFixed(0)} KB)`;
  uploadForm.classList.add('visible');
  uploadZone.style.display = 'none';
}

cancelBtn.addEventListener('click', resetUploadForm);

function resetUploadForm() {
  selectedFile = null;
  fileInput.value = '';
  titleInput.value = '';
  slugInput.value = '';
  descInput.value = '';
  uploadForm.classList.remove('visible');
  uploadZone.style.display = '';
  progressWrap.style.display = 'none';
  progressFill.style.width = '0%';
  submitBtn.disabled = false;
  submitBtn.textContent = 'Publish Guide';
}

// ─── Auto-generate slug from title ───────────────────────────────────────────
titleInput.addEventListener('input', () => {
  if (!slugInput.dataset.manual) slugInput.value = toSlug(titleInput.value);
});
slugInput.addEventListener('input', () => { slugInput.dataset.manual = '1'; });

// ─── Upload ───────────────────────────────────────────────────────────────────
submitBtn.addEventListener('click', async () => {
  const title = titleInput.value.trim();
  const slug  = toSlug(slugInput.value.trim() || title);
  const desc  = descInput.value.trim();

  if (!selectedFile) { showToast('No file selected', 'error'); return; }
  if (!title) { showToast('Title is required', 'error'); return; }
  if (!slug)  { showToast('Slug is required', 'error'); return; }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Publishing…';
  progressWrap.style.display = 'block';
  progressFill.style.width = '10%';
  progressLbl.textContent = 'Uploading…';

  try {
    const form = new FormData();
    form.append('file', selectedFile, selectedFile.name);
    form.append('title', title);
    form.append('slug', slug);
    form.append('description', desc);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 80) + 10;
        progressFill.style.width = pct + '%';
      }
    };

    xhr.onload = () => {
      progressFill.style.width = '100%';
      progressLbl.textContent = 'Done!';
      if (xhr.status >= 200 && xhr.status < 300) {
        showToast('Guide published!', 'success');
        resetUploadForm();
        loadGuides();
      } else {
        let msg = 'Upload failed';
        try { msg = JSON.parse(xhr.responseText).error || msg; } catch {}
        showToast(msg, 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Publish Guide';
      }
    };

    xhr.onerror = () => {
      showToast('Network error during upload', 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Publish Guide';
    };

    xhr.send(form);
  } catch (err) {
    showToast(err.message || 'Upload error', 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Publish Guide';
  }
});

// ─── Load guides ──────────────────────────────────────────────────────────────
async function loadGuides() {
  guideGrid.innerHTML = '<div class="loading">Loading guides…</div>';
  try {
    const res = await fetch('/api/guides');
    if (!res.ok) throw new Error('Failed to load guides');
    const data = await res.json();
    const guides = data.guides || [];
    if (guides.length === 0) {
      guideGrid.innerHTML = '<div class="empty-state"><h3>No guides yet</h3><p>Upload your first walkthrough ZIP above.</p></div>';
      return;
    }
    guideGrid.innerHTML = '';
    guides.forEach(g => guideGrid.appendChild(buildGuideCard(g)));
  } catch (err) {
    guideGrid.innerHTML = `<div class="empty-state"><h3>Could not load guides</h3><p>${esc(err.message)}</p></div>`;
  }
}

function buildGuideCard(g) {
  const guideUrl = `${location.origin}/guides/${g.slug}`;
  const card = document.createElement('div');
  card.className = 'guide-card';
  const when = g.uploadedAt ? new Date(g.uploadedAt).toLocaleDateString() : '';
  card.innerHTML = `
    <div class="guide-card-info">
      <div class="guide-card-title">${esc(g.title)}</div>
      <div class="guide-card-meta">${g.stepCount ? g.stepCount + ' steps · ' : ''}${when}${g.description ? ' · ' + esc(g.description) : ''}</div>
      <a class="guide-card-url" href="${esc(guideUrl)}" target="_blank" rel="noopener">${esc(guideUrl)}</a>
    </div>
    <div class="guide-actions">
      <button class="btn btn-secondary" data-action="embed" data-slug="${g.slug}">Get Embed</button>
      <button class="btn btn-danger" data-action="delete" data-slug="${g.slug}">Delete</button>
    </div>
  `;
  card.querySelector('[data-action="embed"]').addEventListener('click', () => showEmbed(g.slug, g.title));
  card.querySelector('[data-action="delete"]').addEventListener('click', () => deleteGuide(g.slug, g.title));
  return card;
}

// ─── Embed popup ──────────────────────────────────────────────────────────────
function showEmbed(slug, title) {
  const guideUrl = `${location.origin}/guides/${slug}`;
  const code = `<iframe\n  src="${guideUrl}"\n  title="${title.replace(/"/g, '&quot;')}"\n  width="100%"\n  height="600"\n  frameborder="0"\n  allowfullscreen\n></iframe>`;
  embedCodeEl.textContent = code;
  embedPopup.classList.add('visible');
}

embedClose.addEventListener('click', () => embedPopup.classList.remove('visible'));
embedPopup.addEventListener('click', (e) => { if (e.target === embedPopup) embedPopup.classList.remove('visible'); });

embedCopy.addEventListener('click', () => {
  navigator.clipboard.writeText(embedCodeEl.textContent).then(() => {
    showToast('Copied to clipboard!');
    embedPopup.classList.remove('visible');
  });
});
embedCodeEl.addEventListener('click', () => {
  navigator.clipboard.writeText(embedCodeEl.textContent).then(() => showToast('Copied!'));
});

// ─── Delete ───────────────────────────────────────────────────────────────────
async function deleteGuide(slug, title) {
  if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
  try {
    const res = await fetch(`/api/guides/${slug}`, { method: 'DELETE' });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || 'Delete failed');
    }
    showToast('Guide deleted');
    loadGuides();
  } catch (err) {
    showToast(err.message || 'Delete failed', 'error');
  }
}

// ─── Refresh ──────────────────────────────────────────────────────────────────
refreshBtn.addEventListener('click', loadGuides);

function esc(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

// Init
loadGuides();
