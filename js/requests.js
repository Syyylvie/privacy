const TYPE_LABELS = {
  feature_request: '功能需求',
  bug_report: 'Bug 反馈',
  question: '问题咨询',
  other: '其他',
};

const STORAGE_KEY = 'privacy_user_requests';
const REPLIES_KEY = 'privacy_dev_replies';

function loadUserRequests() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveUserRequests(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function loadDevReplies() {
  try {
    return JSON.parse(localStorage.getItem(REPLIES_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveDevReply(id, text) {
  const replies = loadDevReplies();
  replies[id] = text;
  localStorage.setItem(REPLIES_KEY, JSON.stringify(replies));
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
}

function escapeHtml(str) {
  const el = document.createElement('span');
  el.textContent = str;
  return el.innerHTML;
}

function getReply(request, devReplies) {
  if (devReplies[request.id]) return devReplies[request.id];
  return request.reply || '';
}

async function loadAllRequests() {
  let staticRequests = [];
  try {
    const res = await fetch('data/requests.json');
    if (res.ok) staticRequests = await res.json();
  } catch {
    /* offline or missing file */
  }
  const userRequests = loadUserRequests();
  const merged = [...staticRequests, ...userRequests];
  merged.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return merged;
}

function renderRequests(requests) {
  const listEl = document.getElementById('requests-list');
  const emptyEl = document.getElementById('requests-empty');
  const devReplies = loadDevReplies();

  if (requests.length === 0) {
    listEl.innerHTML = '';
    emptyEl.hidden = false;
    return;
  }

  emptyEl.hidden = true;
  listEl.innerHTML = requests
    .map((req) => {
      const reply = getReply(req, devReplies);
      const typeLabel = TYPE_LABELS[req.type] || req.type;
      return `
        <article class="request-card" data-id="${escapeHtml(req.id)}">
          <div class="request-header">
            <span class="request-type">${escapeHtml(typeLabel)}</span>
            <time class="request-date">${escapeHtml(formatDate(req.created_at))}</time>
          </div>
          <h3 class="request-title">${escapeHtml(req.title)}</h3>
          <p class="request-content">${escapeHtml(req.content)}</p>
          ${req.email ? `<p class="request-email">联系：${escapeHtml(req.email)}</p>` : ''}

          <div class="reply-section">
            <label class="reply-label" for="reply-${escapeHtml(req.id)}">开发者回复</label>
            <textarea
              id="reply-${escapeHtml(req.id)}"
              class="reply-input"
              placeholder="在此填写开发者回复…"
              rows="3"
            >${escapeHtml(reply)}</textarea>
            <button type="button" class="btn btn-secondary btn-save-reply" data-id="${escapeHtml(req.id)}">
              保存回复
            </button>
          </div>
        </article>
      `;
    })
    .join('');

  listEl.querySelectorAll('.btn-save-reply').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const textarea = document.getElementById(`reply-${id}`);
      saveDevReply(id, textarea.value.trim());
      btn.textContent = '已保存';
      setTimeout(() => { btn.textContent = '保存回复'; }, 1500);
    });
  });
}

function showMessage(text, type) {
  const messageEl = document.getElementById('form-message');
  messageEl.textContent = text;
  messageEl.className = 'form-message ' + type;
  messageEl.hidden = false;
}

function initForm(onSubmitted) {
  const form = document.getElementById('request-form');
  const submitBtn = document.getElementById('submit-btn');

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const type = document.getElementById('type').value;
    const title = document.getElementById('title').value.trim();
    const content = document.getElementById('content').value.trim();
    const email = document.getElementById('email').value.trim();

    if (!type || !title || !content) {
      showMessage('请填写类型、标题和详细描述。', 'error');
      return;
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showMessage('邮箱格式不正确。', 'error');
      return;
    }

    const request = {
      id: 'local-' + Date.now(),
      type,
      title,
      content,
      email,
      created_at: new Date().toISOString(),
      reply: '',
    };

    const list = loadUserRequests();
    list.push(request);
    saveUserRequests(list);

    form.reset();
    showMessage('提交成功，已显示在下方列表中。', 'success');
    onSubmitted();
  });
}

async function init() {
  let requests = await loadAllRequests();
  renderRequests(requests);

  initForm(async () => {
    requests = await loadAllRequests();
    renderRequests(requests);
  });
}

init();
