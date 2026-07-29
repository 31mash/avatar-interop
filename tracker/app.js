/* Project Tracker — single-file app logic (no build step, no dependencies).
   Role-based views are simulated client-side with a user switcher; in a real
   deployment every permission below must also be enforced by the server. */

(function () {
  'use strict';

  /* ============================== utilities ============================== */

  const $ = (s, el) => (el || document).querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  const pad = (n) => String(n).padStart(2, '0');
  const DAY = 86400000;

  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseISO = (s) => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const diffDays = (aISO, bISO) => Math.round((parseISO(bISO) - parseISO(aISO)) / DAY);
  const todayISO = () => toISO(today());
  const nowStamp = () => {
    const d = new Date();
    return `${toISO(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const uid = () => 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmt = (iso) => {
    if (!iso) return '—';
    const d = parseISO(iso);
    return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  };
  const fmtY = (iso) => {
    if (!iso) return '—';
    const d = parseISO(iso);
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  };
  const fmtDT = (stamp) => {
    if (!stamp) return '—';
    const [ds, ts] = stamp.split('T');
    return `${fmt(ds)}, ${ts || ''}`.trim().replace(/,\s*$/, '');
  };
  const relDue = (iso) => {
    const n = diffDays(todayISO(), iso);
    if (n < 0) return { text: `${-n}d overdue`, cls: 'due-late' };
    if (n === 0) return { text: 'due today', cls: 'due-soon' };
    if (n <= 7) return { text: `in ${n}d`, cls: 'due-soon' };
    return { text: `in ${n}d`, cls: 'due-ok' };
  };

  /* ============================== state ============================== */

  const LS_STATE = 'pt_state_v1';
  const LS_USER = 'pt_user_v1';
  const SS_FILTERS = 'pt_filters_v1';

  let state;
  try {
    const raw = localStorage.getItem(LS_STATE);
    state = raw ? JSON.parse(raw) : null;
    if (state && state.version !== 1) state = null;
  } catch (e) { state = null; }
  if (!state) state = window.buildSeed();

  const save = () => { try { localStorage.setItem(LS_STATE, JSON.stringify(state)); } catch (e) { /* storage full/unavailable */ } };

  const session = {
    userId: localStorage.getItem(LS_USER) || 'u2'
  };
  if (!state.users.some((u) => u.id === session.userId)) session.userId = 'u2';

  const getFilters = () => { try { return JSON.parse(sessionStorage.getItem(SS_FILTERS) || '{}'); } catch (e) { return {}; } };
  const setFilters = (f) => { try { sessionStorage.setItem(SS_FILTERS, JSON.stringify(f)); } catch (e) { /* ignore */ } };

  /* view-local ui state (not persisted) */
  const ui = {
    dashDue: 30,
    ganttZoom: 'week',
    ganttExpanded: null,      // Set of project ids
    calCursor: null,          // Date (first of month shown)
    pendingMeetingId: null
  };

  /* ============================== lookups ============================== */

  const userById = (id) => state.users.find((u) => u.id === id);
  const projById = (id) => state.projects.find((p) => p.id === id);
  const tasksOf = (p) => state.tasks.filter((t) => t.projectId === p.id);
  const milestonesOf = (p) => state.milestones.filter((m) => m.projectId === p.id);
  const blockersOf = (p) => state.blockers.filter((b) => b.projectId === p.id);
  const openBlockersOf = (p) => blockersOf(p).filter((b) => b.status === 'open');
  const commentsOf = (p) => state.comments.filter((c) => c.parentType === 'project' && c.parentId === p.id);
  const auditOf = (p) => state.audit.filter((a) => a.recordType === 'project' && a.recordId === p.id);
  const meetingById = (id) => state.meetings.find((m) => m.id === id);

  const cur = () => userById(session.userId);
  const role = () => cur().role;

  const ROLE_LABEL = { boss: 'Boss', pm: 'Project Manager', hr: 'HR', team: 'Team' };
  const STATUS_META = {
    'draft': { label: 'Draft', cls: 'b-plain' },
    'submitted': { label: 'Submitted', cls: 'b-info' },
    'approved': { label: 'Approved', cls: 'b-info' },
    'in-progress': { label: 'In progress', cls: 'b-info' },
    'on-hold': { label: 'On hold', cls: 'b-hold' },
    'completed': { label: 'Completed', cls: 'b-ok' },
    'rejected': { label: 'Rejected', cls: 'b-bad' }
  };

  /* ============================== permissions ============================== */

  const isPM = () => role() === 'pm';
  const canSeeProject = (u, p) => {
    if (u.role === 'boss' || u.role === 'pm') return true;
    if (u.role === 'hr') return false;
    return p.ownerId === u.id || (p.teamIds || []).includes(u.id) ||
      tasksOf(p).some((t) => t.assigneeId === u.id);
  };
  const visibleProjects = () => state.projects.filter((p) => canSeeProject(cur(), p));
  const canEditDraft = (p) => p.status === 'draft' && (isPM() || p.ownerId === session.userId);
  const canEditProgress = (t, p) => {
    if (p.status === 'completed' || p.status === 'on-hold') return false;
    if (isPM()) return true;
    return role() === 'team' && t.assigneeId === session.userId && p.status === 'in-progress';
  };
  const canComment = (p) => role() !== 'hr' && canSeeProject(cur(), p);

  const NAV_BY_ROLE = {
    boss: ['dashboard', 'projects', 'gantt', 'calendar', 'notifications'],
    pm: ['dashboard', 'projects', 'gantt', 'calendar', 'notifications'],
    team: ['dashboard', 'projects', 'gantt', 'calendar', 'notifications'],
    hr: ['calendar', 'notifications']
  };
  const HOME_BY_ROLE = { boss: 'dashboard', pm: 'dashboard', team: 'dashboard', hr: 'calendar' };

  /* ============================== derived logic ============================== */

  const isExec = (p) => p.status === 'approved' || p.status === 'in-progress';
  const isActiveish = (p) => isExec(p) || p.status === 'on-hold';

  function projectProgress(p) {
    if (p.progressOverride != null) return p.progressOverride;
    const ts = tasksOf(p).filter((t) => t.status !== 'cancelled');
    if (!ts.length) return 0;
    let got = 0, tot = 0;
    ts.forEach((t) => { const w = t.weight || 1; got += w * (t.progress || 0); tot += w * 100; });
    return Math.round((got / tot) * 100);
  }

  function expectedProgress(p) {
    const t = p.timeline;
    if (!t.currentStart || !t.currentEnd) return null;
    const total = diffDays(t.currentStart, t.currentEnd);
    if (total <= 0) return null;
    const gone = diffDays(t.currentStart, todayISO());
    return Math.max(0, Math.min(100, Math.round((gone / total) * 100)));
  }

  /* PRD §5.2 — health is computed and always explained */
  function projectHealth(p) {
    if (p.status === 'completed') {
      return { key: 'done', label: 'Delivered', cls: 'b-ok', reason: `Completed ${fmt(p.completedAt || p.timeline.currentEnd)}` };
    }
    if (p.status === 'on-hold') {
      return { key: 'hold', label: 'On hold', cls: 'b-hold', reason: p.holdReason ? `Paused: ${p.holdReason}` : 'Paused by the Project Manager' };
    }
    if (!isExec(p)) {
      return { key: 'na', label: 'Not started', cls: 'b-plain', reason: STATUS_META[p.status].label };
    }
    const tIso = todayISO();
    const open = tasksOf(p).filter((t) => t.status !== 'done' && t.status !== 'cancelled');
    const lateCrit = open.filter((t) => t.critical && t.end < tIso);
    if (lateCrit.length) {
      return { key: 'bad', label: 'Overdue', cls: 'b-bad', reason: `Critical task “${lateCrit[0].title}” is ${-diffDays(tIso, lateCrit[0].end)}d overdue` };
    }
    if (p.timeline.currentEnd && p.timeline.currentEnd < tIso) {
      return { key: 'bad', label: 'Overdue', cls: 'b-bad', reason: `Project deadline passed ${fmt(p.timeline.currentEnd)}` };
    }
    const blocks = openBlockersOf(p);
    if (blocks.length) {
      return { key: 'warn', label: 'At risk', cls: 'b-warn', reason: `${blocks[0].severity} blocker: ${blocks[0].desc.slice(0, 80)}${blocks[0].desc.length > 80 ? '…' : ''}` };
    }
    const soonCrit = open.filter((t) => t.critical && diffDays(tIso, t.end) <= 3);
    if (soonCrit.length) {
      return { key: 'warn', label: 'At risk', cls: 'b-warn', reason: `Critical task “${soonCrit[0].title}” due ${fmt(soonCrit[0].end)}` };
    }
    const exp = expectedProgress(p);
    const prog = projectProgress(p);
    if (exp != null && prog < exp - 15) {
      return { key: 'warn', label: 'At risk', cls: 'b-warn', reason: `Progress ${prog}% trails plan (${exp}% expected)` };
    }
    return { key: 'ok', label: 'On track', cls: 'b-ok', reason: 'No overdue critical work or open blockers' };
  }

  function deadlineItems(days, projects) {
    const tIso = todayISO();
    const items = [];
    projects.filter(isActiveish).forEach((p) => {
      if (p.timeline.currentEnd) {
        const n = diffDays(tIso, p.timeline.currentEnd);
        if (n <= days) items.push({ kind: 'project', p, title: p.name, date: p.timeline.currentEnd, n });
      }
      milestonesOf(p).filter((m) => !m.done).forEach((m) => {
        const n = diffDays(tIso, m.date);
        if (n <= days) items.push({ kind: 'milestone', p, title: m.title, date: m.date, n });
      });
    });
    return items.sort((a, b) => a.date < b.date ? -1 : 1);
  }

  function workload(projects) {
    const counts = {};
    projects.filter(isExec).forEach((p) => {
      tasksOf(p).forEach((t) => {
        if (t.status === 'todo' || t.status === 'active') {
          counts[t.assigneeId] = (counts[t.assigneeId] || 0) + 1;
        }
      });
    });
    return state.users
      .filter((u) => u.role === 'team' || u.role === 'pm')
      .map((u) => ({ u, n: counts[u.id] || 0 }))
      .sort((a, b) => b.n - a.n);
  }

  const unreadCount = () => state.notifications.filter((n) => n.userId === session.userId && !n.read).length;

  /* ============================== side effects ============================== */

  function logAudit(action, recordType, recordId, extra) {
    state.audit.push(Object.assign({
      id: uid(), at: nowStamp(), userId: session.userId, action, recordType, recordId
    }, extra || {}));
  }

  function notify(userIds, type, text, refType, refId) {
    const seen = {};
    userIds.forEach((idU) => {
      if (!idU || idU === session.userId || seen[idU]) return;
      seen[idU] = true;
      state.notifications.push({ id: uid(), userId: idU, type, text, refType, refId, at: nowStamp(), read: false });
    });
  }

  const projAudience = (p) => [p.ownerId].concat(p.teamIds || []);
  const bossIds = () => state.users.filter((u) => u.role === 'boss').map((u) => u.id);

  /* ============================== icons ============================== */

  const IC = (name, size) => {
    const s = size || 15;
    const paths = {
      dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
      projects: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
      gantt: '<path d="M4 6h9M8 12h12M4 18h7"/>',
      calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
      bell: '<path d="M18 9a6 6 0 1 0-12 0c0 6-2.5 7-2.5 7h17S18 15 18 9"/><path d="M10.3 20a2 2 0 0 0 3.4 0"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.4-3.4"/>',
      download: '<path d="M12 3v12m0 0 4-4m-4 4-4-4M4 19h16"/>',
      x: '<path d="M6 6l12 12M18 6L6 18"/>',
      check: '<path d="M4 12.5 9.5 18 20 6.5"/>',
      alert: '<path d="M12 3 2.5 19.5h19z"/><path d="M12 10v4M12 17.2v.3"/>',
      clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
      flag: '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
      users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-5-6.3"/>',
      comment: '<path d="M21 12a8 8 0 0 1-8 8H4l2.5-3A8 8 0 1 1 21 12z"/>',
      edit: '<path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17z"/><path d="M13.5 6.5l3 3"/>',
      diamond: '<rect x="7.5" y="7.5" width="9" height="9" transform="rotate(45 12 12)"/>',
      chevR: '<path d="m9 5 7 7-7 7"/>',
      chevD: '<path d="m5 9 7 7 7-7"/>',
      pause: '<path d="M9 5v14M15 5v14"/>',
      play: '<path d="M7 5v14l12-7z"/>',
      inbox: '<path d="M3 13h5l2 3h4l2-3h5"/><path d="M5 5h14l2 8v6H3v-6z"/>',
      audit: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/>'
    };
    return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
  };

  /* ============================== ui primitives ============================== */

  const badge = (label, cls, dot) =>
    `<span class="badge ${cls}">${dot ? '<span class="dot"></span>' : ''}${esc(label)}</span>`;
  const statusBadge = (p) => badge(STATUS_META[p.status].label, STATUS_META[p.status].cls);
  const healthBadge = (p) => { const h = projectHealth(p); return badge(h.label, h.cls, h.key !== 'na'); };

  const initials = (name) => name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const avatar = (u) => `<span class="avatar" title="${esc(u.name)}">${esc(initials(u.name))}</span>`;
  const avatarRow = (u, sub) => `
    <span class="avatar-row">${avatar(u)}
      <span class="who"><span class="nm">${esc(u.name)}</span>${sub ? `<span class="rl">${esc(sub)}</span>` : ''}</span>
    </span>`;

  const progBar = (pct, opts) => {
    const o = opts || {};
    return `<span class="prog ${pct >= 100 ? 'p-done' : ''}">
      <span class="track"><span class="fill" style="width:${Math.max(0, Math.min(100, pct))}%"></span></span>
      <span class="pct">${pct}%</span>${o.override ? '<span class="override-flag" title="Manually set by the Project Manager">PM override</span>' : ''}
    </span>`;
  };

  const emptyState = (icon, text, actionHTML) => `
    <div class="empty">
      <div class="ic">${IC(icon, 18)}</div>
      <p>${text}</p>
      ${actionHTML || ''}
    </div>`;

  /* toast */
  function toast(msg, kind) {
    const host = $('#toasts');
    const el = document.createElement('div');
    el.className = `toast ${kind === 'err' ? 't-err' : 't-ok'}`;
    el.innerHTML = `${IC(kind === 'err' ? 'alert' : 'check', 14)}<span>${esc(msg)}</span>`;
    host.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }

  /* modal */
  let activeModal = null;
  function openModal(title, bodyHTML, footHTML) {
    closeModal();
    const root = $('#modalRoot');
    root.innerHTML = `
      <div class="overlay" data-overlay="1">
        <div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
          <div class="modal-head">
            <h2>${esc(title)}</h2>
            <button class="icon-btn" data-action="close-modal" aria-label="Close dialog">${IC('x', 16)}</button>
          </div>
          <div class="modal-body">${bodyHTML}</div>
          ${footHTML ? `<div class="modal-foot">${footHTML}</div>` : ''}
        </div>
      </div>`;
    activeModal = root.firstElementChild;
    const first = activeModal.querySelector('input, select, textarea, button:not(.icon-btn)');
    if (first) first.focus();
    return activeModal;
  }
  function closeModal() {
    $('#modalRoot').innerHTML = '';
    activeModal = null;
  }

  function confirmDialog(title, message, confirmLabel, onYes, danger) {
    openModal(title, `<p style="font-size:13.5px;color:var(--ink-soft)">${message}</p>`,
      `<button class="btn" data-action="close-modal">Cancel</button>
       <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="confirmYes">${esc(confirmLabel)}</button>`);
    $('#confirmYes').addEventListener('click', () => { closeModal(); onYes(); });
  }

  /* drawer */
  function openDrawer(title, bodyHTML) {
    closeDrawer();
    const root = $('#drawerRoot');
    root.innerHTML = `
      <div class="drawer-overlay" data-overlay="1"></div>
      <div class="drawer" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="drawer-head">
          <h2>${esc(title)}</h2>
          <button class="icon-btn" data-action="close-drawer" aria-label="Close panel">${IC('x', 16)}</button>
        </div>
        <div class="drawer-body">${bodyHTML}</div>
      </div>`;
  }
  function closeDrawer() { $('#drawerRoot').innerHTML = ''; }

  /* form field helpers */
  const field = (id, label, inputHTML, opts) => {
    const o = opts || {};
    return `<div class="field" id="f-${id}">
      <label for="${id}">${esc(label)}${o.req ? ' <span class="req" aria-hidden="true">*</span>' : ''}</label>
      ${inputHTML}
      ${o.help ? `<div class="help">${esc(o.help)}</div>` : ''}
      <div class="err" id="err-${id}" hidden></div>
    </div>`;
  };
  function fieldError(id, msg) {
    const wrap = $(`#f-${id}`);
    if (!wrap) return;
    wrap.classList.add('invalid');
    const err = $(`#err-${id}`);
    err.textContent = msg;
    err.hidden = false;
    const input = $(`#${id}`);
    if (input) input.focus();
  }
  function clearFieldErrors(scope) {
    (scope || document).querySelectorAll('.field.invalid').forEach((f) => f.classList.remove('invalid'));
    (scope || document).querySelectorAll('.field .err').forEach((e) => { e.hidden = true; });
  }

  /* ============================== router ============================== */

  function parseHash() {
    const h = location.hash.replace(/^#\/?/, '');
    const [pathPart, queryPart] = h.split('?');
    const parts = pathPart.split('/').filter(Boolean);
    const q = {};
    new URLSearchParams(queryPart || '').forEach((v, k) => { q[k] = v; });
    return { parts, q };
  }

  const go = (hash) => { location.hash = hash; };

  function currentRouteKey(parts) {
    if (!parts.length) return HOME_BY_ROLE[role()];
    if (parts[0] === 'project') return 'projects';
    return parts[0];
  }

  /* ============================== chrome (nav, topbar) ============================== */

  const NAV_META = {
    dashboard: { label: 'Dashboard', icon: 'dashboard' },
    projects: { label: 'Projects', icon: 'projects' },
    gantt: { label: 'Gantt', icon: 'gantt' },
    calendar: { label: 'Calendar', icon: 'calendar' },
    notifications: { label: 'Notifications', icon: 'bell' }
  };

  function renderChrome(activeKey) {
    const navEl = $('#nav');
    const allowed = NAV_BY_ROLE[role()];
    navEl.innerHTML = allowed.map((k) => {
      const m = NAV_META[k];
      const isCur = k === activeKey;
      const badgeHTML = (k === 'notifications' && unreadCount())
        ? `<span class="nav-badge" aria-label="${unreadCount()} unread">${unreadCount()}</span>` : '';
      return `<a class="nav-link" href="#/${k}" ${isCur ? 'aria-current="page"' : ''}>${IC(m.icon, 16)}${m.label}${badgeHTML}</a>`;
    }).join('');

    $('#topbarTitle').textContent = NAV_META[activeKey] ? NAV_META[activeKey].label : 'Project Tracker';

    const sel = $('#userSelect');
    sel.innerHTML = state.users.map((u) =>
      `<option value="${u.id}" ${u.id === session.userId ? 'selected' : ''}>${esc(u.name)} — ${ROLE_LABEL[u.role]}</option>`
    ).join('');
    $('#roleChip').textContent = ROLE_LABEL[role()];
  }

  /* ============================== views ============================== */

  function render() {
    if (!location.hash) {
      history.replaceState(null, '', `#/${HOME_BY_ROLE[role()]}`);
    }
    const { parts, q } = parseHash();
    const routeKey = currentRouteKey(parts);
    const allowed = NAV_BY_ROLE[role()];

    closeDrawer(); closeModal();
    renderChrome(allowed.includes(routeKey) ? routeKey : '');

    const view = $('#view');
    if (!allowed.includes(routeKey)) {
      view.innerHTML = renderDenied(routeKey);
      return;
    }

    if (routeKey === 'projects' && parts[0] === 'project') {
      view.innerHTML = renderProjectDetail(parts[1], q.tab || 'overview');
    } else if (routeKey === 'dashboard') {
      view.innerHTML = role() === 'team' ? renderTeamDashboard() : renderDashboard();
    } else if (routeKey === 'projects') {
      view.innerHTML = renderProjects();
    } else if (routeKey === 'gantt') {
      view.innerHTML = renderGantt();
    } else if (routeKey === 'calendar') {
      view.innerHTML = renderCalendar();
      if (ui.pendingMeetingId) {
        const mid = ui.pendingMeetingId;
        ui.pendingMeetingId = null;
        openMeetingDrawer(mid);
      }
    } else if (routeKey === 'notifications') {
      view.innerHTML = renderNotifications();
    } else {
      view.innerHTML = renderDenied(routeKey);
    }
    view.focus({ preventScroll: true });
  }

  function renderDenied(key) {
    const home = HOME_BY_ROLE[role()];
    return `
      <div class="card card-pad" style="max-width:520px;margin:40px auto;text-align:center">
        <h2 style="margin-bottom:8px">Not available for your role</h2>
        <p style="font-size:13.5px;color:var(--ink-soft)">
          The <b>${esc(ROLE_LABEL[role()])}</b> role doesn't have access to
          <b>${esc(NAV_META[key] ? NAV_META[key].label : key)}</b>.
          ${role() === 'hr' ? 'HR sees the meeting calendar with linked project context only.' : ''}
        </p>
        <a class="btn btn-primary" href="#/${home}" style="margin-top:14px">Go to ${NAV_META[home].label}</a>
      </div>`;
  }

  /* ---------- dashboard (boss / pm) ---------- */

  function kpiCard(label, num, hint, cls, icon) {
    return `<div class="card kpi ${cls || ''}">
      <div class="label">${IC(icon, 14)}${esc(label)}</div>
      <div class="num">${num}</div>
      <div class="hint">${esc(hint || '')}</div>
    </div>`;
  }

  function renderDashboard() {
    const projects = visibleProjects();
    const active = projects.filter(isExec);
    const completed = projects.filter((p) => p.status === 'completed');
    const held = projects.filter((p) => p.status === 'on-hold');
    const overdue = active.filter((p) => projectHealth(p).key === 'bad');
    const risky = active.filter((p) => { const k = projectHealth(p).key; return k === 'warn' || k === 'bad'; });
    const submitted = state.projects.filter((p) => p.status === 'submitted');

    const healthCounts = { ok: 0, warn: 0, bad: 0, hold: held.length };
    active.forEach((p) => { const k = projectHealth(p).key; if (healthCounts[k] != null) healthCounts[k]++; });
    const totalH = healthCounts.ok + healthCounts.warn + healthCounts.bad + healthCounts.hold || 1;

    const avgProgress = active.length
      ? Math.round(active.reduce((s, p) => s + projectProgress(p), 0) / active.length) : 0;

    const deadlines = deadlineItems(ui.dashDue, projects);
    const wl = workload(projects);
    const wlMax = Math.max(1, ...wl.map((w) => w.n));
    const recent = state.audit.slice().sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 8);

    const roleNote = role() === 'boss'
      ? `<div class="notice">${IC('users', 15)}<span>You're viewing the read-only portfolio. You can open any project and add comments, but not change plans or dates.</span></div>`
      : '';

    return `
      <div class="page-head">
        <div><h1>Portfolio dashboard</h1>
        <div class="sub">${active.length} active project${active.length === 1 ? '' : 's'} · average progress ${avgProgress}%</div></div>
        <div class="actions">
          ${isPM() ? `<button class="btn btn-primary" data-action="new-project">${IC('plus', 14)}New project</button>` : ''}
        </div>
      </div>
      ${roleNote}
      <div class="grid kpis" style="margin-bottom:14px">
        ${kpiCard('Active', active.length, 'approved or in progress', '', 'play')}
        ${kpiCard('Overdue', overdue.length, overdue.length ? 'needs attention now' : 'nothing late', overdue.length ? 'k-bad' : 'k-ok', 'alert')}
        ${kpiCard('On hold', held.length, held.length ? 'paused by PM' : 'none paused', held.length ? 'k-warn' : '', 'pause')}
        ${kpiCard('Completed', completed.length, 'delivered projects', 'k-ok', 'check')}
      </div>

      <div class="grid cols-2" style="margin-bottom:14px">
        <div class="card">
          <div class="card-head"><h2>Project health</h2></div>
          <div class="card-pad">
            <div class="stackbar" role="img" aria-label="Health distribution: ${healthCounts.ok} on track, ${healthCounts.warn} at risk, ${healthCounts.bad} overdue, ${healthCounts.hold} on hold">
              ${healthCounts.ok ? `<span class="s-ok" style="width:${healthCounts.ok / totalH * 100}%"></span>` : ''}
              ${healthCounts.warn ? `<span class="s-warn" style="width:${healthCounts.warn / totalH * 100}%"></span>` : ''}
              ${healthCounts.bad ? `<span class="s-bad" style="width:${healthCounts.bad / totalH * 100}%"></span>` : ''}
              ${healthCounts.hold ? `<span class="s-hold" style="width:${healthCounts.hold / totalH * 100}%"></span>` : ''}
            </div>
            <div class="legend">
              <span class="li"><span class="sw" style="background:#12B76A"></span>On track <b>${healthCounts.ok}</b></span>
              <span class="li"><span class="sw" style="background:#F79009"></span>At risk <b>${healthCounts.warn}</b></span>
              <span class="li"><span class="sw" style="background:#F04438"></span>Overdue <b>${healthCounts.bad}</b></span>
              <span class="li"><span class="sw" style="background:#98A2B3"></span>On hold <b>${healthCounts.hold}</b></span>
            </div>
            ${(() => {
              const byDept = {};
              const act = projects.filter(isActiveish);
              act.forEach((p) => { byDept[p.dept] = (byDept[p.dept] || 0) + 1; });
              const entries = Object.entries(byDept).sort((a, b) => b[1] - a[1]);
              const mx = Math.max(1, ...entries.map((e) => e[1]));
              return entries.length ? `
                <h2 style="font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--ink-mute);margin:18px 0 10px">Active by department</h2>
                <div class="wl">${entries.map(([dpt, n]) => `
                  <div class="wl-row">
                    <span class="nm">${esc(dpt)}</span>
                    <span class="track"><span class="fill" style="width:${n / mx * 100}%"></span></span>
                    <span class="ct">${n}</span>
                  </div>`).join('')}
                </div>` : '';
            })()}
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <h2>Upcoming deadlines</h2>
            <div class="right">
              <div class="seg" role="group" aria-label="Deadline window">
                ${[7, 30, 60].map((n) => `<button data-action="dash-due" data-n="${n}" aria-pressed="${ui.dashDue === n}">${n}d</button>`).join('')}
              </div>
            </div>
          </div>
          <div class="rows">
            ${deadlines.length ? deadlines.slice(0, 6).map((it) => {
              const r = relDue(it.date);
              return `<button class="row-item" data-action="open-project" data-id="${it.p.id}">
                <span class="feed-ic ${it.n < 0 ? 'f-bad' : it.n <= 7 ? 'f-warn' : ''}">${IC(it.kind === 'milestone' ? 'diamond' : 'flag', 14)}</span>
                <span class="grow"><span class="ttl">${esc(it.title)}</span>
                <span class="sub">${it.kind === 'milestone' ? 'Milestone · ' : 'Project deadline · '}${esc(it.p.name)}</span></span>
                <span class="end"><span class="due-chip ${r.cls}">${fmt(it.date)} · ${r.text}</span></span>
              </button>`;
            }).join('') : emptyState('check', `Nothing due in the next ${ui.dashDue} days.`)}
          </div>
        </div>
      </div>

      <div class="grid cols-2" style="margin-bottom:14px">
        <div class="card">
          <div class="card-head"><h2>At risk & blocked</h2></div>
          <div class="rows">
            ${risky.length ? risky.map((p) => {
              const h = projectHealth(p);
              return `<button class="row-item" data-action="open-project" data-id="${p.id}">
                <span class="feed-ic ${h.key === 'bad' ? 'f-bad' : 'f-warn'}">${IC('alert', 14)}</span>
                <span class="grow"><span class="ttl">${esc(p.name)}</span>
                <span class="sub">${esc(h.reason)}</span></span>
                <span class="end">${badge(h.label, h.cls, true)}</span>
              </button>`;
            }).join('') : emptyState('check', 'No projects at risk right now.')}
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h2>Recent activity</h2></div>
          <div class="feed">
            ${recent.map(feedItem).join('') || emptyState('audit', 'No activity yet.')}
          </div>
        </div>
      </div>

      <div class="grid cols-2">
        <div class="card">
          <div class="card-head"><h2>Team workload</h2><div class="right"><span class="hint" style="font-size:12px;color:var(--ink-mute)">open tasks on active projects</span></div></div>
          <div class="card-pad wl">
            ${wl.map((w) => `
              <div class="wl-row">
                <span class="nm">${esc(w.u.name)}</span>
                <span class="track"><span class="fill" style="width:${w.n / wlMax * 100}%"></span></span>
                <span class="ct">${w.n}</span>
              </div>`).join('')}
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h2>${isPM() ? 'Awaiting your review' : 'Awaiting approval'}</h2></div>
          <div class="rows">
            ${submitted.length ? submitted.map((p) => `
              <div class="row-item">
                <span class="feed-ic f-info">${IC('inbox', 14)}</span>
                <span class="grow">
                  <span class="ttl"><a href="#/project/${p.id}">${esc(p.name)}</a></span>
                  <span class="sub">Proposed ${fmt(p.timeline.proposedStart)} → ${fmt(p.timeline.proposedEnd)} · by ${esc(userById(p.ownerId).name)}</span>
                </span>
                ${isPM() ? `<span class="end" style="display:flex;gap:6px">
                  <button class="btn btn-sm btn-primary" data-action="approve-project" data-id="${p.id}">Approve</button>
                  <button class="btn btn-sm" data-action="return-project" data-id="${p.id}">Return</button>
                </span>` : `<span class="end">${badge('Submitted', 'b-info')}</span>`}
              </div>`).join('') : emptyState('check', 'No submissions waiting.')}
          </div>
        </div>
      </div>`;
  }

  const FEED_ICON = {
    'created': ['edit', 'f-info'], 'submitted': ['inbox', 'f-info'], 'approved': ['check', 'f-ok'],
    'returned': ['chevR', 'f-warn'], 'rejected': ['x', 'f-bad'], 'started': ['play', 'f-info'],
    'completed': ['check', 'f-ok'], 'reopened': ['play', 'f-warn'], 'on-hold': ['pause', 'f-warn'],
    'resumed': ['play', 'f-ok'], 'timeline-changed': ['clock', 'f-warn'], 'blocker-reported': ['alert', 'f-bad'],
    'blocker-resolved': ['check', 'f-ok'], 'task-added': ['plus', 'f-info'], 'progress-override': ['edit', 'f-warn'],
    'completion-requested': ['flag', 'f-info'], 'milestone': ['diamond', 'f-info']
  };

  function feedItem(a) {
    const [icon, cls] = FEED_ICON[a.action] || ['audit', ''];
    const u = userById(a.userId);
    let rec = a.recordType === 'project' ? projById(a.recordId) : null;
    if (!rec && a.recordType === 'blocker') {
      const b = state.blockers.find((x) => x.id === a.recordId);
      if (b) rec = projById(b.projectId);
    }
    const recName = rec ? rec.name : a.recordId;
    const label = a.action.replace(/-/g, ' ');
    return `<div class="feed-item">
      <span class="feed-ic ${cls}">${IC(icon, 14)}</span>
      <div class="feed-body">
        <div class="tx"><b>${esc(u ? u.name : 'System')}</b> ${esc(label)} —
          ${rec ? `<a href="#/project/${rec.id}">${esc(recName)}</a>` : esc(recName)}
          ${a.field === 'currentEnd' && a.prev && a.next ? ` <span class="t-sub">(${fmt(a.prev)} → ${fmt(a.next)})</span>` : ''}
        </div>
        ${a.reason ? `<div class="feed-reason">Reason: ${esc(a.reason)}</div>` : ''}
        <div class="meta">${fmtDT(a.at)}</div>
      </div>
    </div>`;
  }

  /* ---------- team dashboard ---------- */

  function renderTeamDashboard() {
    const me = cur();
    const myProjects = visibleProjects();
    const myTasks = state.tasks
      .filter((t) => t.assigneeId === me.id && t.status !== 'done' && t.status !== 'cancelled')
      .map((t) => ({ t, p: projById(t.projectId) }))
      .filter((x) => x.p && isExec(x.p))
      .sort((a, b) => (a.t.end < b.t.end ? -1 : 1));
    const myBlockers = state.blockers.filter((b) => b.status === 'open' && (b.ownerId === me.id || b.reporterId === me.id));
    const myDrafts = state.projects.filter((p) => p.status === 'draft' && p.ownerId === me.id);
    const deadlines = deadlineItems(30, myProjects);

    return `
      <div class="page-head">
        <div><h1>My workspace</h1>
        <div class="sub">${myTasks.length} open task${myTasks.length === 1 ? '' : 's'} across ${myProjects.filter(isExec).length} active project${myProjects.filter(isExec).length === 1 ? '' : 's'}</div></div>
        <div class="actions">
          <button class="btn btn-primary" data-action="new-project">${IC('plus', 14)}New draft proposal</button>
        </div>
      </div>

      <div class="grid cols-3-2" style="margin-bottom:14px">
        <div class="card">
          <div class="card-head"><h2>My tasks</h2><div class="right"><span style="font-size:12px;color:var(--ink-mute)">update progress as you work</span></div></div>
          <div class="table-wrap">
            ${myTasks.length ? `<table class="tbl"><thead><tr>
              <th scope="col">Task</th><th scope="col">Due</th><th scope="col">Progress</th></tr></thead>
              <tbody>${myTasks.map(({ t, p }) => {
                const r = relDue(t.end);
                return `<tr>
                  <td><div class="t-main">${t.critical ? `<span class="crit-flag" title="Critical task" style="color:var(--bad)">${IC('flag', 12)}</span> ` : ''}${esc(t.title)}</div>
                      <div class="t-sub"><a href="#/project/${p.id}">${esc(p.name)}</a></div></td>
                  <td class="t-num"><span class="due-chip ${r.cls}">${fmt(t.end)} · ${r.text}</span></td>
                  <td>${progressEditor(t, p)}</td>
                </tr>`;
              }).join('')}</tbody></table>` : emptyState('check', 'No open tasks assigned to you.')}
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h2>My drafts & proposals</h2></div>
          <div class="rows">
            ${myDrafts.length ? myDrafts.map((p) => `
              <button class="row-item" data-action="open-project" data-id="${p.id}">
                <span class="feed-ic">${IC('edit', 14)}</span>
                <span class="grow"><span class="ttl">${esc(p.name)}</span>
                  <span class="sub">Proposed ${fmt(p.timeline.proposedStart)} → ${fmt(p.timeline.proposedEnd)}</span></span>
                <span class="end">${badge('Draft', 'b-plain')}</span>
              </button>`).join('')
            : emptyState('edit', 'No drafts. Propose a project when you have an idea.',
              `<button class="btn btn-sm" data-action="new-project">${IC('plus', 13)}New draft</button>`)}
          </div>
          ${myBlockers.length ? `<div class="card-head" style="border-top:1px solid var(--border)"><h2>My open blockers</h2></div>
          <div class="rows">${myBlockers.map((b) => {
            const p = projById(b.projectId);
            return `<button class="row-item" data-action="open-project" data-id="${p.id}">
              <span class="feed-ic f-bad">${IC('alert', 14)}</span>
              <span class="grow"><span class="ttl">${esc(b.desc.slice(0, 60))}${b.desc.length > 60 ? '…' : ''}</span>
              <span class="sub">${esc(p.name)} · review ${fmt(b.nextReview)}</span></span>
              <span class="end">${badge(b.severity, b.severity === 'High' ? 'b-bad' : 'b-warn')}</span>
            </button>`;
          }).join('')}</div>` : ''}
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h2>Upcoming deadlines on my projects</h2></div>
        <div class="rows">
          ${deadlines.length ? deadlines.slice(0, 6).map((it) => {
            const r = relDue(it.date);
            return `<button class="row-item" data-action="open-project" data-id="${it.p.id}">
              <span class="feed-ic ${it.n < 0 ? 'f-bad' : it.n <= 7 ? 'f-warn' : ''}">${IC(it.kind === 'milestone' ? 'diamond' : 'flag', 14)}</span>
              <span class="grow"><span class="ttl">${esc(it.title)}</span>
              <span class="sub">${it.kind === 'milestone' ? 'Milestone · ' : 'Deadline · '}${esc(it.p.name)}</span></span>
              <span class="end"><span class="due-chip ${r.cls}">${fmt(it.date)} · ${r.text}</span></span>
            </button>`;
          }).join('') : emptyState('check', 'Nothing due in the next 30 days.')}
        </div>
      </div>`;
  }

  function progressEditor(t, p) {
    if (!canEditProgress(t, p)) return progBar(t.progress || 0);
    const opts = [0, 10, 25, 40, 50, 60, 75, 90, 100];
    if (!opts.includes(t.progress)) opts.push(t.progress);
    opts.sort((a, b) => a - b);
    return `<span class="prog-edit">
      ${progBar(t.progress || 0)}
      <select data-change="task-progress" data-id="${t.id}" aria-label="Progress for ${esc(t.title)}">
        ${opts.map((v) => `<option value="${v}" ${v === t.progress ? 'selected' : ''}>${v}%</option>`).join('')}
      </select>
    </span>`;
  }

  /* ---------- projects list ---------- */

  const DEPTS = ['Avatars', 'Wearables', 'Animation', 'Web', 'Production'];

  function filteredProjects() {
    const f = getFilters();
    let list = visibleProjects();
    if (f.q) {
      const q = f.q.toLowerCase();
      list = list.filter((p) =>
        p.name.toLowerCase().includes(q) || (p.desc || '').toLowerCase().includes(q) ||
        userById(p.ownerId).name.toLowerCase().includes(q) ||
        tasksOf(p).some((t) => t.title.toLowerCase().includes(q)) ||
        milestonesOf(p).some((m) => m.title.toLowerCase().includes(q)));
    }
    if (f.status) list = list.filter((p) => p.status === f.status);
    if (f.health) list = list.filter((p) => projectHealth(p).key === f.health);
    if (f.dept) list = list.filter((p) => p.dept === f.dept);
    if (f.owner) list = list.filter((p) => p.ownerId === f.owner);
    const order = { 'in-progress': 0, 'approved': 1, 'submitted': 2, 'draft': 3, 'on-hold': 4, 'completed': 5, 'rejected': 6 };
    return list.sort((a, b) => (order[a.status] - order[b.status]) || (a.timeline.currentEnd < b.timeline.currentEnd ? -1 : 1));
  }

  function renderProjects() {
    const f = getFilters();
    const list = filteredProjects();
    const owners = state.users.filter((u) => u.role === 'team' || u.role === 'pm');
    const hasFilters = f.q || f.status || f.health || f.dept || f.owner;

    return `
      <div class="page-head">
        <div><h1>Projects</h1><div class="sub">${list.length} of ${visibleProjects().length} project${visibleProjects().length === 1 ? '' : 's'} shown</div></div>
        <div class="actions">
          <button class="btn" data-action="export-csv">${IC('download', 14)}Export CSV</button>
          ${role() === 'boss' ? '' : `<button class="btn btn-primary" data-action="new-project">${IC('plus', 14)}${isPM() ? 'New project' : 'New draft proposal'}</button>`}
        </div>
      </div>

      <div class="filterbar" role="search">
        <div class="search-box">
          ${IC('search', 14)}
          <input type="text" id="projSearch" data-change="filter-q" value="${esc(f.q || '')}" placeholder="Search projects, tasks, milestones…" aria-label="Search projects" />
        </div>
        <select data-change="filter-status" aria-label="Filter by status">
          <option value="">All statuses</option>
          ${Object.keys(STATUS_META).map((s) => `<option value="${s}" ${f.status === s ? 'selected' : ''}>${STATUS_META[s].label}</option>`).join('')}
        </select>
        <select data-change="filter-health" aria-label="Filter by health">
          <option value="">All health</option>
          <option value="ok" ${f.health === 'ok' ? 'selected' : ''}>On track</option>
          <option value="warn" ${f.health === 'warn' ? 'selected' : ''}>At risk</option>
          <option value="bad" ${f.health === 'bad' ? 'selected' : ''}>Overdue</option>
          <option value="hold" ${f.health === 'hold' ? 'selected' : ''}>On hold</option>
        </select>
        <select data-change="filter-dept" aria-label="Filter by department">
          <option value="">All departments</option>
          ${DEPTS.map((d) => `<option value="${d}" ${f.dept === d ? 'selected' : ''}>${d}</option>`).join('')}
        </select>
        <select data-change="filter-owner" aria-label="Filter by owner">
          <option value="">All owners</option>
          ${owners.map((u) => `<option value="${u.id}" ${f.owner === u.id ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}
        </select>
        ${hasFilters ? `<button class="btn btn-ghost btn-sm filter-clear" data-action="clear-filters">${IC('x', 12)}Clear</button>` : ''}
      </div>

      <div class="card">
        <div class="table-wrap">
          ${list.length ? `<table class="tbl">
            <thead><tr>
              <th scope="col">Project</th><th scope="col">Status</th><th scope="col">Health</th>
              <th scope="col">Progress</th><th scope="col">Owner</th><th scope="col">Deadline</th>
            </tr></thead>
            <tbody>
              ${list.map((p) => {
                const h = projectHealth(p);
                const owner = userById(p.ownerId);
                const t = p.timeline;
                const slip = t.baselineEnd && t.currentEnd ? diffDays(t.baselineEnd, t.currentEnd) : 0;
                return `<tr class="rowlink" data-action="open-project" data-id="${p.id}" tabindex="0" role="link" aria-label="Open ${esc(p.name)}">
                  <td style="min-width:200px"><div class="t-main">${esc(p.name)}</div><div class="t-sub">${esc(p.dept)} · ${esc(p.priority)} priority</div></td>
                  <td>${statusBadge(p)}</td>
                  <td><div>${badge(h.label, h.cls, h.key !== 'na')}</div>${h.key === 'warn' || h.key === 'bad' ? `<div class="health-reason">${esc(h.reason)}</div>` : ''}</td>
                  <td>${progBar(projectProgress(p), { override: p.progressOverride != null })}</td>
                  <td>${avatarRow(owner)}</td>
                  <td class="t-num">
                    <div>${fmt(t.currentEnd)}</div>
                    ${slip > 0 ? `<div class="variance-late">+${slip}d vs baseline</div>` : (t.baselineEnd ? '<div class="variance-ok">on baseline</div>' : '<div class="variance-ok">proposed</div>')}
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>` : emptyState('search', 'No projects match the current filters.',
            `<button class="btn btn-sm" data-action="clear-filters">Clear filters</button>`)}
        </div>
      </div>`;
  }

  /* ---------- project detail ---------- */

  function renderProjectDetail(id, tab) {
    const p = projById(id);
    if (!p) return emptyState('search', 'Project not found.', `<a class="btn btn-sm" href="#/projects">Back to projects</a>`);
    if (!canSeeProject(cur(), p)) {
      return `<div class="card card-pad" style="max-width:520px;margin:40px auto;text-align:center">
        <h2 style="margin-bottom:8px">You don't have access to this project</h2>
        <p style="font-size:13.5px;color:var(--ink-soft)">Team members see only projects they own or are assigned to.</p>
        <a class="btn btn-primary" href="#/${HOME_BY_ROLE[role()]}" style="margin-top:14px">Back</a>
      </div>`;
    }
    const h = projectHealth(p);
    const t = p.timeline;
    const slip = t.baselineEnd && t.currentEnd ? diffDays(t.baselineEnd, t.currentEnd) : 0;
    const tabs = ['overview', 'tasks', 'timeline', 'activity'];
    const TAB_LABEL = { overview: 'Overview', tasks: 'Tasks', timeline: 'Timeline', activity: 'Activity' };
    if (!tabs.includes(tab)) tab = 'overview';

    return `
      <div style="margin-bottom:10px"><a href="#/projects" style="font-size:13px">← All projects</a></div>
      <div class="card card-pad proj-head">
        <div class="proj-title-row">
          <h1>${esc(p.name)}</h1>
          <div class="proj-badges">${statusBadge(p)}${badge(h.label, h.cls, h.key !== 'na')}</div>
        </div>
        ${h.key === 'warn' || h.key === 'bad' || h.key === 'hold' ? `<div class="notice n-warn" style="margin:0">${IC('alert', 15)}<span>${esc(h.reason)}</span></div>` : ''}
        <div class="proj-meta">
          <span class="mi"><span class="k">Progress</span><span class="v">${progBar(projectProgress(p), { override: p.progressOverride != null })}</span></span>
          <span class="mi"><span class="k">Owner</span><span class="v">${esc(userById(p.ownerId).name)}</span></span>
          <span class="mi"><span class="k">Project manager</span><span class="v">${esc(userById(p.managerId).name)}</span></span>
          <span class="mi"><span class="k">Department</span><span class="v">${esc(p.dept)} · ${esc(p.priority)}</span></span>
          <span class="mi"><span class="k">${t.baselineEnd ? 'Baseline' : 'Proposed'}</span><span class="v">${fmt(t.baselineStart || t.proposedStart)} → ${fmt(t.baselineEnd || t.proposedEnd)}</span></span>
          <span class="mi"><span class="k">Current</span><span class="v">${fmt(t.currentStart)} → ${fmt(t.currentEnd)}${slip > 0 ? ` <span class="variance-late">+${slip}d</span>` : ''}</span></span>
        </div>
        ${projectActions(p)}
      </div>

      <div class="tabs" role="tablist">
        ${tabs.map((k) => `<button class="tab" role="tab" aria-selected="${k === tab}" data-action="proj-tab" data-id="${p.id}" data-tab="${k}">${TAB_LABEL[k]}</button>`).join('')}
      </div>
      ${tab === 'overview' ? projOverview(p) : tab === 'tasks' ? projTasks(p) : tab === 'timeline' ? projTimeline(p) : projActivity(p)}`;
  }

  function projectActions(p) {
    const btns = [];
    const mine = p.ownerId === session.userId;
    if (role() === 'team') {
      if (p.status === 'draft' && mine) {
        btns.push(`<button class="btn btn-primary" data-action="submit-project" data-id="${p.id}">${IC('inbox', 14)}Submit for approval</button>`);
        btns.push(`<button class="btn" data-action="edit-draft" data-id="${p.id}">${IC('edit', 14)}Edit draft</button>`);
      }
      if (p.status === 'in-progress' && canSeeProject(cur(), p)) {
        btns.push(`<button class="btn" data-action="report-blocker" data-id="${p.id}">${IC('alert', 14)}Report blocker</button>`);
        if (!p.completionRequested && projectProgress(p) >= 100) {
          btns.push(`<button class="btn btn-primary" data-action="request-completion" data-id="${p.id}">${IC('flag', 14)}Request completion</button>`);
        } else if (p.completionRequested) {
          btns.push(badge('Completion requested', 'b-info'));
        }
      }
    }
    if (isPM()) {
      if (p.status === 'draft') {
        btns.push(`<button class="btn" data-action="edit-draft" data-id="${p.id}">${IC('edit', 14)}Edit draft</button>`);
        btns.push(`<button class="btn btn-primary" data-action="submit-project" data-id="${p.id}">${IC('inbox', 14)}Submit for review</button>`);
      }
      if (p.status === 'submitted') {
        btns.push(`<button class="btn btn-primary" data-action="approve-project" data-id="${p.id}">${IC('check', 14)}Approve</button>`);
        btns.push(`<button class="btn" data-action="return-project" data-id="${p.id}">Return for revision</button>`);
        btns.push(`<button class="btn btn-danger" data-action="reject-project" data-id="${p.id}">Reject</button>`);
      }
      if (p.status === 'approved') {
        btns.push(`<button class="btn btn-primary" data-action="start-project" data-id="${p.id}">${IC('play', 14)}Start work</button>`);
        btns.push(`<button class="btn" data-action="edit-timeline" data-id="${p.id}">${IC('clock', 14)}Change dates</button>`);
      }
      if (p.status === 'in-progress') {
        btns.push(`<button class="btn btn-primary" data-action="complete-project" data-id="${p.id}">${IC('check', 14)}Mark completed${p.completionRequested ? ' (requested)' : ''}</button>`);
        btns.push(`<button class="btn" data-action="edit-timeline" data-id="${p.id}">${IC('clock', 14)}Change dates</button>`);
        btns.push(`<button class="btn" data-action="hold-project" data-id="${p.id}">${IC('pause', 14)}Place on hold</button>`);
        btns.push(`<button class="btn" data-action="report-blocker" data-id="${p.id}">${IC('alert', 14)}Report blocker</button>`);
        btns.push(`<button class="btn btn-ghost" data-action="override-progress" data-id="${p.id}">Override progress</button>`);
      }
      if (p.status === 'on-hold') {
        btns.push(`<button class="btn btn-primary" data-action="resume-project" data-id="${p.id}">${IC('play', 14)}Resume</button>`);
      }
      if (p.status === 'completed') {
        btns.push(`<button class="btn" data-action="reopen-project" data-id="${p.id}">Reopen</button>`);
      }
      if (p.status === 'rejected') {
        btns.push(`<button class="btn" data-action="duplicate-draft" data-id="${p.id}">Duplicate to new draft</button>`);
      }
    }
    if (role() === 'boss') {
      btns.push(`<span style="font-size:12.5px;color:var(--ink-mute)">Read-only — you can comment in the Activity tab.</span>`);
    }
    return btns.length ? `<div class="proj-actions">${btns.join('')}</div>` : '';
  }

  function projOverview(p) {
    const ms = milestonesOf(p).sort((a, b) => (a.date < b.date ? -1 : 1));
    const blocks = blockersOf(p);
    const team = (p.teamIds || []).map(userById).filter(Boolean);
    const next = nextActions(p);
    return `
      <div class="grid cols-3-2">
        <div>
          <div class="card card-pad" style="margin-bottom:14px">
            <h2 style="margin-bottom:6px">About</h2>
            <p style="font-size:13.5px;color:var(--ink-soft)">${esc(p.desc || 'No description yet.')}</p>
          </div>
          <div class="card" style="margin-bottom:14px">
            <div class="card-head"><h2>Milestones</h2>
              <div class="right">${isPM() && p.status !== 'completed' ? `<button class="btn btn-sm" data-action="add-milestone" data-id="${p.id}">${IC('plus', 13)}Add</button>` : ''}</div>
            </div>
            <div class="card-pad">
              ${ms.length ? ms.map((m) => `
                <div class="milestone-li">
                  ${isPM() && p.status !== 'completed'
                    ? `<button class="icon-btn ms-mark ${m.done ? 'done' : ''}" style="margin:0;width:24px;height:24px" data-action="toggle-milestone" data-id="${m.id}" aria-label="${m.done ? 'Mark milestone incomplete' : 'Mark milestone complete'}">${IC(m.done ? 'check' : 'diamond', 14)}</button>`
                    : `<span class="ms-mark ${m.done ? 'done' : ''}">${IC(m.done ? 'check' : 'diamond', 14)}</span>`}
                  <span style="${m.done ? 'color:var(--ink-mute)' : ''}">${esc(m.title)}</span>
                  ${m.done ? badge('Done', 'b-ok') : ''}
                  <span class="dt">${fmt(m.date)}</span>
                </div>`).join('') : emptyState('diamond', 'No milestones defined.')}
            </div>
          </div>
          <div class="card">
            <div class="card-head"><h2>Risks & blockers</h2></div>
            <div class="rows">
              ${blocks.length ? blocks.map((b) => `
                <div class="row-item">
                  <span class="feed-ic ${b.status === 'open' ? (b.severity === 'High' ? 'f-bad' : 'f-warn') : 'f-ok'}">${IC(b.status === 'open' ? 'alert' : 'check', 14)}</span>
                  <span class="grow">
                    <span class="ttl">${esc(b.desc)}</span>
                    <span class="sub">${esc(b.severity)} · owner ${esc(userById(b.ownerId).name)} · ${b.status === 'open' ? `next review ${fmt(b.nextReview)}` : `resolved ${fmtDT(b.resolvedAt)}`}</span>
                  </span>
                  <span class="end">
                    ${b.status === 'open' ? badge('Open', b.severity === 'High' ? 'b-bad' : 'b-warn', true) : badge('Resolved', 'b-ok')}
                    ${b.status === 'open' && (isPM() || b.ownerId === session.userId) ? `<div style="margin-top:5px"><button class="btn btn-sm" data-action="resolve-blocker" data-id="${b.id}">Resolve</button></div>` : ''}
                  </span>
                </div>`).join('') : emptyState('check', 'No blockers reported.')}
            </div>
          </div>
        </div>
        <div>
          <div class="card card-pad" style="margin-bottom:14px">
            <h2 style="margin-bottom:8px">Next actions</h2>
            ${next.length ? `<ul class="plain next-actions">${next.map((n) => `<li>• ${n}</li>`).join('')}</ul>` : '<p style="font-size:13px;color:var(--ink-mute)">Nothing urgent — keep progress updated.</p>'}
          </div>
          <div class="card card-pad">
            <h2 style="margin-bottom:8px">Team</h2>
            ${team.length ? team.map((u) => `<div style="margin-bottom:8px">${avatarRow(u, u.title || u.dept)}</div>`).join('') : '<p style="font-size:13px;color:var(--ink-mute)">No members assigned yet.</p>'}
          </div>
        </div>
      </div>`;
  }

  function nextActions(p) {
    const out = [];
    const tIso = todayISO();
    if (p.status === 'submitted') out.push(`Waiting on ${esc(userById(p.managerId).name)} to review the proposal.`);
    if (p.status === 'draft') out.push('Finish the proposal and submit it for approval.');
    if (p.status === 'approved') out.push('All tasks need an assignee, then the PM starts work.');
    tasksOf(p).filter((t) => t.status !== 'done' && t.status !== 'cancelled' && t.end < tIso)
      .forEach((t) => out.push(`Overdue: <b>${esc(t.title)}</b> (${esc(userById(t.assigneeId)?.name || 'unassigned')}) was due ${fmt(t.end)}.`));
    openBlockersOf(p).forEach((b) => out.push(`Review blocker with ${esc(userById(b.ownerId).name)} by ${fmt(b.nextReview)}.`));
    milestonesOf(p).filter((m) => !m.done && diffDays(tIso, m.date) >= 0 && diffDays(tIso, m.date) <= 14)
      .forEach((m) => out.push(`Milestone <b>${esc(m.title)}</b> lands ${fmt(m.date)}.`));
    if (p.completionRequested && isPM()) out.push('The team requested completion — confirm and close the project.');
    return out.slice(0, 6);
  }

  function projTasks(p) {
    const ts = tasksOf(p).sort((a, b) => (a.start < b.start ? -1 : 1));
    const deps = state.dependencies.filter((d) => ts.some((t) => t.id === d.predecessorId || t.id === d.successorId));
    const canAdd = (isPM() && p.status !== 'completed') || canEditDraft(p);
    const lockNote = p.status === 'submitted'
      ? `<div class="notice">${IC('clock', 15)}<span>Dates are locked while the proposal awaits review. Only the Project Manager can change them after approval.</span></div>` : '';
    return `
      ${lockNote}
      <div class="card">
        <div class="card-head"><h2>Tasks</h2>
          <div class="right">${canAdd ? `<button class="btn btn-sm" data-action="add-task" data-id="${p.id}">${IC('plus', 13)}Add task</button>` : ''}</div>
        </div>
        <div class="table-wrap">
          ${ts.length ? `<table class="tbl"><thead><tr>
            <th scope="col">Task</th><th scope="col">Assignee</th><th scope="col">Dates</th>
            <th scope="col">Weight</th><th scope="col">Progress</th>${isPM() && p.status !== 'completed' ? '<th scope="col"><span class="sr-only">Actions</span></th>' : ''}
          </tr></thead><tbody>
            ${ts.map((t) => {
              const late = t.status !== 'done' && t.status !== 'cancelled' && t.end < todayISO();
              const assignee = userById(t.assigneeId);
              return `<tr>
                <td style="min-width:180px"><div class="t-main">${t.critical ? `<span title="Critical task" style="color:var(--bad)">${IC('flag', 12)}</span> ` : ''}${t.status === 'cancelled' ? `<s>${esc(t.title)}</s>` : esc(t.title)}</div>
                  ${t.status === 'done' ? `<div class="t-sub">done ${fmt(t.actualEnd || t.end)}</div>` : late ? `<div class="variance-late">overdue since ${fmt(t.end)}</div>` : ''}</td>
                <td>${assignee ? avatarRow(assignee) : badge('Unassigned', 'b-warn')}</td>
                <td class="t-num">${fmt(t.start)} → ${fmt(t.end)}</td>
                <td class="t-num">${t.weight || 1}</td>
                <td>${t.status === 'cancelled' ? badge('Cancelled', 'b-hold') : progressEditor(t, p)}</td>
                ${isPM() && p.status !== 'completed' ? `<td><button class="btn btn-sm btn-ghost" data-action="edit-task" data-id="${t.id}" aria-label="Edit ${esc(t.title)}">${IC('edit', 13)}</button></td>` : ''}
              </tr>`;
            }).join('')}
          </tbody></table>` : emptyState('projects', 'No tasks yet.', canAdd ? `<button class="btn btn-sm" data-action="add-task" data-id="${p.id}">${IC('plus', 13)}Add the first task</button>` : '')}
        </div>
        ${deps.length ? `<div class="card-pad" style="border-top:1px solid var(--border)">
          <h2 style="font-size:13px;margin-bottom:6px">Dependencies</h2>
          ${deps.map((dp) => {
            const a = state.tasks.find((t) => t.id === dp.predecessorId);
            const b = state.tasks.find((t) => t.id === dp.successorId);
            return a && b ? `<div style="font-size:12.5px;color:var(--ink-soft);margin-bottom:3px">${esc(a.title)} ${IC('chevR', 11)} ${esc(b.title)} <span style="color:var(--ink-mute)">(finish–start)</span></div>` : '';
          }).join('')}
          <div class="help" style="font-size:11.5px;color:var(--ink-mute);margin-top:4px">Dependencies are managed by the Project Manager.</div>
        </div>` : ''}
      </div>`;
  }

  /* project timeline tab — mini gantt + change history */
  function projTimeline(p) {
    const changes = auditOf(p).filter((a) => a.action === 'timeline-changed').sort((a, b) => (a.at < b.at ? 1 : -1));
    return `
      <div class="card" style="margin-bottom:14px">
        <div class="card-head"><h2>Timeline</h2>
          <div class="right">
            ${isPM() && (p.status === 'approved' || p.status === 'in-progress') ? `<button class="btn btn-sm" data-action="edit-timeline" data-id="${p.id}">${IC('clock', 13)}Change project dates</button>` : ''}
          </div>
        </div>
        ${ganttHTML([p], { zoom: 'week', tasksAlways: true })}
      </div>
      <div class="card">
        <div class="card-head"><h2>Timeline change history</h2></div>
        <div class="feed">
          ${changes.length ? changes.map(feedItem).join('') : emptyState('audit', 'No committed-date changes recorded. Approved changes always require a reason and appear here.')}
        </div>
      </div>`;
  }

  function projActivity(p) {
    const items = []
      .concat(auditOf(p).map((a) => ({ at: a.at, html: feedItem(a) })))
      .concat(commentsOf(p).map((c) => ({ at: c.at, html: commentHTML(c) })))
      .sort((a, b) => (a.at < b.at ? 1 : -1));
    return `
      <div class="grid cols-3-2">
        <div class="card">
          <div class="card-head"><h2>Activity & comments</h2></div>
          ${canComment(p) ? `<div class="card-pad comment-box" style="border-bottom:1px solid var(--border)">
            <label for="commentBody" style="font-size:12.5px;font-weight:600;color:var(--ink-soft)">Add a comment</label>
            <textarea id="commentBody" placeholder="Share an update…"></textarea>
            <div class="hint">Mention a teammate with @ followed by their name (e.g. @Marcus Chen) to notify them.</div>
            <div class="foot"><button class="btn btn-primary btn-sm" data-action="post-comment" data-id="${p.id}">${IC('comment', 13)}Post comment</button></div>
          </div>` : ''}
          <div class="feed">${items.length ? items.map((i) => i.html).join('') : emptyState('comment', 'No activity yet.')}</div>
        </div>
        <div class="card card-pad" style="align-self:start">
          <h2 style="margin-bottom:8px">About this log</h2>
          <p style="font-size:12.5px;color:var(--ink-soft)">Approvals, status changes and every committed-date change are recorded with actor, timestamp and reason. Audit entries can't be edited or deleted.</p>
        </div>
      </div>`;
  }

  function commentHTML(c) {
    const u = userById(c.authorId);
    let body = esc(c.body);
    state.users.forEach((usr) => {
      const re = new RegExp('@' + usr.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      body = body.replace(re, `<span class="mention">@${esc(usr.name)}</span>`);
    });
    return `<div class="feed-item">
      ${avatar(u)}
      <div class="feed-body">
        <div class="meta"><b style="color:var(--ink)">${esc(u.name)}</b> · ${fmtDT(c.at)} · comment</div>
        <div class="body" style="font-size:13.5px">${body}</div>
      </div>
    </div>`;
  }

  /* ---------- gantt view ---------- */

  function renderGantt() {
    const projects = visibleProjects().filter((p) => isActiveish(p));
    if (ui.ganttExpanded === null) {
      ui.ganttExpanded = new Set(projects.filter((p) => p.status === 'in-progress').map((p) => p.id));
    }
    const note = isPM()
      ? `<div class="notice">${IC('edit', 15)}<span>You can change task and project dates — every change to a committed date asks for a reason and is recorded.</span></div>`
      : `<div class="notice">${IC('users', 15)}<span>The Gantt is read-only for your role. Date changes are made by the Project Manager.</span></div>`;
    return `
      <div class="page-head">
        <div><h1>Portfolio Gantt</h1><div class="sub">Baseline vs current dates · critical tasks highlighted</div></div>
      </div>
      ${note}
      <div class="gantt-tools">
        <div class="seg" role="group" aria-label="Zoom level">
          ${['day', 'week', 'month'].map((z) => `<button data-action="gantt-zoom" data-z="${z}" aria-pressed="${ui.ganttZoom === z}">${z[0].toUpperCase() + z.slice(1)}</button>`).join('')}
        </div>
        <span style="font-size:12.5px;color:var(--ink-mute)">Click a project row to expand its tasks</span>
      </div>
      <div class="card">
        ${projects.length ? ganttHTML(projects, { zoom: ui.ganttZoom, expandable: true }) : emptyState('gantt', 'No active projects to chart yet.')}
        <div class="gantt-legend">
          <span class="li"><span class="sw" style="width:18px;height:8px;border-radius:4px;background:#12B76A"></span>On track</span>
          <span class="li"><span class="sw" style="width:18px;height:8px;border-radius:4px;background:#F79009"></span>At risk</span>
          <span class="li"><span class="sw" style="width:18px;height:8px;border-radius:4px;background:#F04438"></span>Overdue</span>
          <span class="li"><span class="sw" style="width:18px;height:8px;border-radius:4px;background:#98A2B3"></span>On hold</span>
          <span class="li"><span class="sw" style="width:18px;height:4px;border:1px dashed var(--border-strong);background:none"></span>Baseline</span>
          <span class="li"><span style="color:var(--bad)">${IC('flag', 12)}</span>Critical task</span>
          <span class="li"><span class="sw" style="width:9px;height:9px;transform:rotate(45deg);background:var(--surface);border:2px solid var(--primary-ink);border-radius:2px"></span>Milestone</span>
        </div>
      </div>`;
  }

  const PX_PER_DAY = { day: 26, week: 9, month: 3.2 };

  function ganttHTML(projects, opts) {
    const zoom = opts.zoom || 'week';
    const px = PX_PER_DAY[zoom];
    /* range */
    let min = null, max = null;
    const push = (iso) => { if (!iso) return; if (!min || iso < min) min = iso; if (!max || iso > max) max = iso; };
    projects.forEach((p) => {
      const t = p.timeline;
      [t.baselineStart, t.baselineEnd, t.currentStart, t.currentEnd].forEach(push);
      tasksOf(p).forEach((tk) => { push(tk.start); push(tk.end); push(tk.baselineStart); push(tk.baselineEnd); });
      milestonesOf(p).forEach((m) => push(m.date));
    });
    push(todayISO());
    if (!min) return emptyState('gantt', 'No dated work to chart.');
    let start = addDays(parseISO(min), -5);
    /* align start to Monday for clean week columns */
    while (start.getDay() !== 1) start = addDays(start, -1);
    const end = addDays(parseISO(max), 8);
    const total = Math.round((end - start) / DAY);
    const width = total * px;
    const startISO = toISO(start);
    const x = (iso) => diffDays(startISO, iso) * px;

    /* axis cells */
    const cells = [];
    let cursor = new Date(start);
    while (cursor < end) {
      let nextB;
      let label;
      if (zoom === 'day') {
        nextB = addDays(cursor, 1);
        label = cursor.getDay() === 1 || cursor.getDate() === 1 ? `${cursor.getDate()} ${MONTHS[cursor.getMonth()]}` : String(cursor.getDate());
      } else if (zoom === 'week') {
        nextB = addDays(cursor, 7);
        label = `${cursor.getDate()} ${MONTHS[cursor.getMonth()]}`;
      } else {
        nextB = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
        if (nextB > end) nextB = end;
        label = `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
      }
      if (nextB > end) nextB = end;
      const w = Math.round((nextB - cursor) / DAY) * px;
      cells.push(`<div class="cell" style="width:${w}px">${label}</div>`);
      cursor = nextB;
    }

    const gridLines = cells.length
      ? (() => { let acc = 0; return cells.map((c) => { const m = c.match(/width:(\d+(?:\.\d+)?)px/); acc += Number(m[1]); return `<div class="g-grid-line" style="left:${acc}px"></div>`; }).join(''); })()
      : '';
    const todayLine = `<div class="g-today" style="left:${x(todayISO())}px" title="Today"></div>`;

    const rows = [];
    projects.forEach((p) => {
      const h = projectHealth(p);
      const barCls = p.status === 'completed' ? 'bar-done' : h.key === 'bad' ? 'bar-bad' : h.key === 'warn' ? 'bar-warn' : h.key === 'hold' ? 'bar-hold' : 'bar-ok';
      const t = p.timeline;
      const expanded = !opts.expandable || (ui.ganttExpanded && ui.ganttExpanded.has(p.id)) || opts.tasksAlways;
      const baselineDiffers = t.baselineStart && (t.baselineStart !== t.currentStart || t.baselineEnd !== t.currentEnd);
      rows.push(`
        <div class="g-row g-proj" ${opts.expandable ? `data-action="gantt-toggle" data-id="${p.id}" role="button" tabindex="0" aria-expanded="${expanded}" style="cursor:pointer"` : ''}>
          <div class="g-label">
            ${opts.expandable ? IC(expanded ? 'chevD' : 'chevR', 13) : ''}
            <span class="tt">${esc(p.name)}</span>
          </div>
          <div class="g-canvas">
            ${gridLines}${todayLine}
            ${t.currentStart && t.currentEnd ? `<div class="g-bar ${barCls}" style="left:${x(t.currentStart)}px;width:${Math.max(8, (diffDays(t.currentStart, t.currentEnd) + 1) * px - 2)}px" title="${esc(p.name)}: ${fmt(t.currentStart)} → ${fmt(t.currentEnd)} (${h.label})"></div>` : ''}
            ${baselineDiffers ? `<div class="g-baseline" style="left:${x(t.baselineStart)}px;width:${Math.max(8, (diffDays(t.baselineStart, t.baselineEnd) + 1) * px - 2)}px" title="Baseline: ${fmt(t.baselineStart)} → ${fmt(t.baselineEnd)}"></div>` : ''}
            ${milestonesOf(p).map((m) => `<span class="g-ms ${m.done ? 'done' : ''}" style="left:${x(m.date)}px" title="${esc(m.title)} — ${fmt(m.date)}"></span>`).join('')}
          </div>
        </div>`);
      if (expanded) {
        tasksOf(p).sort((a, b) => (a.start < b.start ? -1 : 1)).forEach((tk) => {
          const assignee = userById(tk.assigneeId);
          const tkLate = tk.status !== 'done' && tk.status !== 'cancelled' && tk.end < todayISO();
          const tkCls = tk.status === 'done' ? 'bar-done' : tkLate ? 'bar-bad' : tk.status === 'cancelled' ? 'bar-hold' : '';
          const tBaselineDiffers = tk.baselineStart && (tk.baselineStart !== tk.start || tk.baselineEnd !== tk.end);
          rows.push(`
            <div class="g-row">
              <div class="g-label" style="padding-left:${opts.expandable ? 33 : 12}px">
                ${tk.critical ? `<span class="crit-flag" title="Critical task">${IC('flag', 11)}</span>` : ''}
                <span class="tt">${esc(tk.title)}</span>
                ${assignee ? avatar(assignee) : ''}
                ${isPM() && (p.status === 'approved' || p.status === 'in-progress') ? `<button class="btn btn-sm btn-ghost" style="padding:2px 5px;min-height:24px" data-action="edit-task" data-id="${tk.id}" aria-label="Edit dates for ${esc(tk.title)}">${IC('edit', 12)}</button>` : ''}
              </div>
              <div class="g-canvas">
                ${gridLines}${todayLine}
                <div class="g-bar ${tkCls} ${tk.critical && tk.status !== 'done' ? 'bar-crit' : ''}" style="left:${x(tk.start)}px;width:${Math.max(8, (diffDays(tk.start, tk.end) + 1) * px - 2)}px" title="${esc(tk.title)}: ${fmt(tk.start)} → ${fmt(tk.end)} · ${tk.progress || 0}%"></div>
                ${tBaselineDiffers ? `<div class="g-baseline" style="left:${x(tk.baselineStart)}px;width:${Math.max(8, (diffDays(tk.baselineStart, tk.baselineEnd) + 1) * px - 2)}px" title="Baseline: ${fmt(tk.baselineStart)} → ${fmt(tk.baselineEnd)}"></div>` : ''}
              </div>
            </div>`);
        });
      }
    });

    return `<div class="gantt"><div class="gantt-inner" style="min-width:${240 + width}px">
      <div class="g-axis"><div class="g-label" style="border-bottom:0"><span class="tt" style="font-weight:700;font-size:11px;color:var(--ink-mute)">PROJECT / TASK</span></div>${cells.join('')}</div>
      ${rows.join('')}
    </div></div>`;
  }

  /* ---------- calendar ---------- */

  function meetingOccursOn(m, iso) {
    if (m.cancelled) return false;
    if (m.recurrence === 'weekly') {
      const anchor = parseISO(m.date);
      const d = parseISO(iso);
      if (d < anchor) return false;
      return Math.round((d - anchor) / DAY) % 7 === 0;
    }
    return m.date === iso;
  }

  function calendarItemsFor(iso) {
    const items = [];
    state.meetings.forEach((m) => {
      if (meetingOccursOn(m, iso)) items.push({ kind: 'meeting', m, sort: m.time });
    });
    const projs = role() === 'hr' ? state.projects : visibleProjects();
    projs.filter(isActiveish).forEach((p) => {
      milestonesOf(p).forEach((ms) => { if (ms.date === iso && !ms.done) items.push({ kind: 'milestone', p, ms, sort: 'zz1' }); });
      if (p.timeline.currentEnd === iso) items.push({ kind: 'deadline', p, sort: 'zz2' });
    });
    return items.sort((a, b) => (a.sort < b.sort ? -1 : 1));
  }

  function renderCalendar() {
    if (!ui.calCursor) { const t = today(); ui.calCursor = new Date(t.getFullYear(), t.getMonth(), 1); }
    const y = ui.calCursor.getFullYear(), mo = ui.calCursor.getMonth();
    const first = new Date(y, mo, 1);
    let gridStart = first;
    while (gridStart.getDay() !== 1) gridStart = addDays(gridStart, -1);
    const cells = [];
    for (let i = 0; i < 42; i++) cells.push(addDays(gridStart, i));
    const monthName = `${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][mo]} ${y}`;
    const tISO = todayISO();

    const hrNote = role() === 'hr'
      ? `<div class="notice">${IC('calendar', 15)}<span>You manage meetings here. Linked projects show name and milestones only — project plans stay with the Project Manager.</span></div>` : '';

    return `
      <div class="page-head">
        <div><h1>Calendar</h1><div class="sub">Meetings, milestones and project deadlines</div></div>
        <div class="actions">
          ${role() === 'hr' ? `<button class="btn btn-primary" data-action="new-meeting">${IC('plus', 14)}New meeting</button>` : ''}
        </div>
      </div>
      ${hrNote}
      <div class="cal-head">
        <button class="btn btn-sm" data-action="cal-nav" data-n="-1" aria-label="Previous month">←</button>
        <h2>${monthName}</h2>
        <button class="btn btn-sm" data-action="cal-nav" data-n="1" aria-label="Next month">→</button>
        <button class="btn btn-sm btn-ghost" data-action="cal-today">Today</button>
        <span style="margin-left:auto;display:flex;gap:12px;font-size:12px;color:var(--ink-soft)">
          <span class="li" style="display:flex;align-items:center;gap:5px"><span class="sw" style="width:10px;height:10px;border-radius:3px;background:var(--info-bg);border:1px solid var(--info-bd)"></span>Meeting</span>
          <span class="li" style="display:flex;align-items:center;gap:5px"><span class="sw" style="width:10px;height:10px;border-radius:3px;background:var(--surface);border:1px dashed var(--border-strong)"></span>Milestone</span>
          <span class="li" style="display:flex;align-items:center;gap:5px"><span class="sw" style="width:10px;height:10px;border-radius:3px;background:var(--warn-bg);border:1px solid var(--warn-bd)"></span>Deadline</span>
        </span>
      </div>
      <div class="card">
        <div class="cal-grid">
          ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => `<div class="cal-dow">${d}</div>`).join('')}
          ${cells.map((d) => {
            const iso = toISO(d);
            const items = calendarItemsFor(iso);
            const chips = items.slice(0, 3).map((it) => {
              if (it.kind === 'meeting') return `<span class="cal-chip chip-meeting">${esc(it.m.time)} ${esc(it.m.title)}</span>`;
              if (it.kind === 'milestone') return `<span class="cal-chip chip-milestone">◇ ${esc(it.ms.title)}</span>`;
              return `<span class="cal-chip chip-deadline">Due: ${esc(it.p.name)}</span>`;
            }).join('');
            const dots = items.slice(0, 4).map((it) => `<span class="cal-dot ${it.kind === 'meeting' ? 'dm' : it.kind === 'milestone' ? 'dms' : 'dd'}"></span>`).join('');
            return `<button class="cal-cell ${d.getMonth() !== mo ? 'other' : ''} ${iso === tISO ? 'today-cell' : ''}" data-action="cal-day" data-iso="${iso}" aria-label="${fmtY(iso)}, ${items.length} item${items.length === 1 ? '' : 's'}">
              <span class="dnum">${d.getDate()}</span>
              ${chips}
              <span class="cal-dot-row">${dots}</span>
              ${items.length > 3 ? `<span class="cal-more">+${items.length - 3} more</span>` : ''}
            </button>`;
          }).join('')}
        </div>
      </div>`;
  }

  function openDayDrawer(iso) {
    const items = calendarItemsFor(iso);
    openDrawer(fmtY(iso), `
      ${items.length ? `<div class="rows">${items.map((it) => {
        if (it.kind === 'meeting') {
          return `<button class="row-item" data-action="open-meeting" data-id="${it.m.id}" data-iso="${iso}">
            <span class="feed-ic f-info">${IC('calendar', 14)}</span>
            <span class="grow"><span class="ttl">${esc(it.m.title)}</span>
            <span class="sub">${esc(it.m.time)} · ${it.m.durationMin} min${it.m.recurrence === 'weekly' ? ' · weekly' : ''}${it.m.projectId && projById(it.m.projectId) ? ' · ' + esc(projById(it.m.projectId).name) : ''}</span></span>
            <span class="end">${IC('chevR', 13)}</span>
          </button>`;
        }
        if (it.kind === 'milestone') {
          return `<div class="row-item"><span class="feed-ic">${IC('diamond', 14)}</span>
            <span class="grow"><span class="ttl">${esc(it.ms.title)}</span><span class="sub">Milestone · ${esc(it.p.name)}</span></span></div>`;
        }
        return `<div class="row-item"><span class="feed-ic f-warn">${IC('flag', 14)}</span>
          <span class="grow"><span class="ttl">Project deadline</span><span class="sub">${esc(it.p.name)}</span></span></div>`;
      }).join('')}</div>` : emptyState('calendar', 'Nothing scheduled this day.')}
      ${role() === 'hr' ? `<div style="margin-top:14px"><button class="btn btn-primary" data-action="new-meeting" data-iso="${iso}">${IC('plus', 14)}New meeting on this day</button></div>` : ''}
    `);
  }

  function openMeetingDrawer(id, occurrenceISO) {
    const m = meetingById(id);
    if (!m) return;
    const proj = m.projectId ? projById(m.projectId) : null;
    const isHR = role() === 'hr';
    const participants = m.participantIds.map(userById).filter(Boolean);
    openDrawer(m.title, `
      <div style="display:flex;flex-direction:column;gap:14px">
        <div>
          <div style="font-size:13px;color:var(--ink-soft)">${fmtY(occurrenceISO || m.date)} · ${esc(m.time)} · ${m.durationMin} min${m.recurrence === 'weekly' ? ' · repeats weekly' : ''}</div>
          <div style="font-size:13px;color:var(--ink-soft);margin-top:2px">${esc(m.location || '')}</div>
          ${proj ? `<div style="font-size:13px;margin-top:6px">Linked project: ${role() === 'hr' ? `<b>${esc(proj.name)}</b> <span style="color:var(--ink-mute)">(owner ${esc(userById(proj.ownerId).name)})</span>` : `<a href="#/project/${proj.id}">${esc(proj.name)}</a>`}</div>` : ''}
        </div>
        ${m.agenda ? `<div><h3 style="font-size:13px;margin-bottom:4px">Agenda</h3><p style="font-size:13px;color:var(--ink-soft)">${esc(m.agenda)}</p></div>` : ''}
        <div>
          <h3 style="font-size:13px;margin-bottom:6px">Participants${isHR ? ' & attendance' : ''}</h3>
          ${participants.map((u) => `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
              ${isHR ? `<input type="checkbox" id="att-${u.id}" data-change="attendance" data-mid="${m.id}" data-uid="${u.id}" ${m.attendance && m.attendance[u.id] ? 'checked' : ''} aria-label="Mark ${esc(u.name)} attended" />` : ''}
              ${avatarRow(u, ROLE_LABEL[u.role])}
              ${!isHR && m.attendance && m.attendance[u.id] ? badge('Attended', 'b-ok') : ''}
            </div>`).join('')}
        </div>
        <div>
          <h3 style="font-size:13px;margin-bottom:4px">Notes</h3>
          ${isHR ? `<textarea id="meetingNotes" style="width:100%;border:1px solid var(--border);border-radius:7px;padding:8px 10px;font-size:13px;min-height:70px">${esc(m.notes || '')}</textarea>
          <button class="btn btn-sm" style="margin-top:6px" data-action="save-notes" data-id="${m.id}">Save notes</button>`
          : `<p style="font-size:13px;color:var(--ink-soft)">${esc(m.notes || 'No notes yet.')}</p>`}
        </div>
        <div>
          <h3 style="font-size:13px;margin-bottom:6px">Follow-up actions</h3>
          ${(m.actionItems || []).length ? m.actionItems.map((ai) => `
            <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;font-size:13px">
              <span class="feed-ic ${ai.status === 'task-created' ? 'f-ok' : 'f-info'}" style="width:24px;height:24px">${IC(ai.status === 'task-created' ? 'check' : 'flag', 12)}</span>
              <span style="flex:1">${esc(ai.text)}<br><span style="color:var(--ink-mute);font-size:12px">owner ${esc(userById(ai.ownerId)?.name || '—')}${ai.status === 'proposed' ? ' · awaiting PM approval' : ai.status === 'task-created' ? ' · converted to task' : ''}</span></span>
              ${isPM() && ai.status === 'proposed' ? `<button class="btn btn-sm" data-action="approve-action-item" data-mid="${m.id}" data-aid="${ai.id}">Approve as task</button>` : ''}
            </div>`).join('') : '<p style="font-size:12.5px;color:var(--ink-mute)">None recorded.</p>'}
          ${isHR ? `<div style="display:flex;gap:6px;margin-top:8px">
            <input type="text" id="newActionItem" placeholder="New action item…" style="flex:1;border:1px solid var(--border);border-radius:7px;padding:7px 10px;font-size:13px" aria-label="New action item" />
            <select id="newActionOwner" style="border:1px solid var(--border);border-radius:7px;font-size:13px" aria-label="Action item owner">
              ${state.users.filter((u) => u.role !== 'boss').map((u) => `<option value="${u.id}">${esc(u.name)}</option>`).join('')}
            </select>
            <button class="btn btn-sm" data-action="add-action-item" data-id="${m.id}">Add</button>
          </div>
          <div class="help" style="font-size:11.5px;color:var(--ink-mute);margin-top:4px">Action items become project tasks only after Project Manager approval.</div>` : ''}
        </div>
        ${isHR ? `<div style="display:flex;gap:8px;border-top:1px solid var(--border);padding-top:14px">
          <button class="btn" data-action="edit-meeting" data-id="${m.id}">${IC('edit', 13)}Edit / reschedule</button>
          <button class="btn btn-danger" data-action="cancel-meeting" data-id="${m.id}">Cancel meeting</button>
        </div>` : ''}
      </div>
    `);
  }

  /* ---------- notifications ---------- */

  const NOTIF_ICON = {
    submitted: ['inbox', 'f-info'], approved: ['check', 'f-ok'], returned: ['chevR', 'f-warn'],
    rejected: ['x', 'f-bad'], task: ['projects', 'f-info'], deadline: ['clock', 'f-warn'],
    overdue: ['alert', 'f-bad'], blocker: ['alert', 'f-bad'], timeline: ['clock', 'f-warn'],
    mention: ['comment', 'f-info'], meeting: ['calendar', 'f-info'], 'action-item': ['flag', 'f-info'],
    completion: ['check', 'f-ok']
  };

  function renderNotifications() {
    const mine = state.notifications
      .filter((n) => n.userId === session.userId)
      .sort((a, b) => (a.read !== b.read ? (a.read ? 1 : -1) : (a.at < b.at ? 1 : -1)));
    const unread = mine.filter((n) => !n.read).length;
    return `
      <div class="page-head">
        <div><h1>Notifications</h1><div class="sub">${unread ? `${unread} unread` : 'All caught up'}</div></div>
        <div class="actions">${unread ? `<button class="btn" data-action="notif-read-all">${IC('check', 14)}Mark all read</button>` : ''}</div>
      </div>
      <div class="card">
        <div class="rows">
          ${mine.length ? mine.map((n) => {
            const [icon, cls] = NOTIF_ICON[n.type] || ['bell', ''];
            return `<button class="row-item notif-item ${n.read ? '' : 'unread'}" data-action="open-notif" data-id="${n.id}">
              <span class="${n.read ? 'read-dot' : 'unread-dot'}"></span>
              <span class="feed-ic ${cls}">${IC(icon, 14)}</span>
              <span class="grow"><span class="ttl" style="font-weight:${n.read ? '400' : '600'}">${esc(n.text)}</span>
              <span class="sub">${fmtDT(n.at)}</span></span>
              <span class="end">${IC('chevR', 13)}</span>
            </button>`;
          }).join('') : emptyState('bell', "You're all caught up — nothing needs your attention.")}
        </div>
      </div>`;
  }

  /* ============================== modals (forms) ============================== */

  function userOptions(selectedId, filter) {
    return state.users.filter(filter || ((u) => u.role === 'team' || u.role === 'pm'))
      .map((u) => `<option value="${u.id}" ${u.id === selectedId ? 'selected' : ''}>${esc(u.name)}</option>`).join('');
  }

  function projectFormModal(p) {
    const isNew = !p;
    const creatorIsTeam = role() === 'team';
    const title = isNew ? (creatorIsTeam ? 'New draft proposal' : 'New project') : 'Edit draft';
    const v = p || { name: '', desc: '', dept: DEPTS[0], priority: 'Medium', teamIds: [], timeline: {} };
    openModal(title, `
      <form id="projForm" novalidate>
        ${creatorIsTeam && isNew ? `<div class="notice" style="margin-bottom:12px">${IC('inbox', 14)}<span>Drafts stay editable until you submit. Submission locks the proposed dates for Project Manager review.</span></div>` : ''}
        ${field('pfName', 'Project name', `<input type="text" id="pfName" value="${esc(v.name)}" required />`, { req: true })}
        ${field('pfDesc', 'Description', `<textarea id="pfDesc">${esc(v.desc || '')}</textarea>`)}
        <div class="field-row">
          ${field('pfDept', 'Department', `<select id="pfDept">${DEPTS.map((d) => `<option ${v.dept === d ? 'selected' : ''}>${d}</option>`).join('')}</select>`)}
          ${field('pfPrio', 'Priority', `<select id="pfPrio">${['High', 'Medium', 'Low'].map((x) => `<option ${v.priority === x ? 'selected' : ''}>${x}</option>`).join('')}</select>`)}
        </div>
        <div class="field-row">
          ${field('pfStart', 'Proposed start', `<input type="date" id="pfStart" value="${v.timeline.proposedStart || ''}" required />`, { req: true })}
          ${field('pfEnd', 'Proposed end', `<input type="date" id="pfEnd" value="${v.timeline.proposedEnd || ''}" required />`, { req: true })}
        </div>
        ${!creatorIsTeam ? field('pfOwner', 'Owner (accountable)', `<select id="pfOwner">${userOptions(v.ownerId || 'u4', (u) => u.role === 'team')}</select>`) : ''}
        ${field('pfTeam', 'Team members', `<div class="check-list" id="pfTeam">
          ${state.users.filter((u) => u.role === 'team').map((u) => `
            <label><input type="checkbox" value="${u.id}" ${(v.teamIds || []).includes(u.id) || (creatorIsTeam && isNew && u.id === session.userId) ? 'checked' : ''} /> ${esc(u.name)} — ${esc(u.dept)}</label>`).join('')}
        </div>`)}
      </form>`,
      `<button class="btn" data-action="close-modal">Cancel</button>
       <button class="btn btn-primary" id="projFormSave">${isNew ? 'Create draft' : 'Save changes'}</button>`);

    $('#projFormSave').addEventListener('click', () => {
      clearFieldErrors();
      const name = $('#pfName').value.trim();
      const s = $('#pfStart').value, e = $('#pfEnd').value;
      if (!name) return fieldError('pfName', 'Give the project a name.');
      if (!s) return fieldError('pfStart', 'Pick a proposed start date.');
      if (!e) return fieldError('pfEnd', 'Pick a proposed end date.');
      if (e <= s) return fieldError('pfEnd', 'End date must be after the start date.');
      const teamIds = Array.from($('#pfTeam').querySelectorAll('input:checked')).map((i) => i.value);
      if (isNew) {
        const proj = {
          id: uid(), name, desc: $('#pfDesc').value.trim(), dept: $('#pfDept').value,
          priority: $('#pfPrio').value,
          managerId: state.users.find((u) => u.role === 'pm').id,
          ownerId: creatorIsTeam ? session.userId : $('#pfOwner').value,
          teamIds, status: 'draft',
          timeline: { proposedStart: s, proposedEnd: e, baselineStart: null, baselineEnd: null, currentStart: s, currentEnd: e },
          progressOverride: null, completionRequested: false, createdAt: nowStamp()
        };
        state.projects.push(proj);
        logAudit('created', 'project', proj.id, { detail: 'Draft created' });
        save(); closeModal(); toast('Draft created — add tasks, then submit for approval.');
        go(`#/project/${proj.id}`);
      } else {
        p.name = name; p.desc = $('#pfDesc').value.trim(); p.dept = $('#pfDept').value; p.priority = $('#pfPrio').value;
        if (!creatorIsTeam) p.ownerId = $('#pfOwner').value;
        p.teamIds = teamIds;
        p.timeline.proposedStart = s; p.timeline.proposedEnd = e;
        p.timeline.currentStart = s; p.timeline.currentEnd = e;
        save(); closeModal(); toast('Draft updated.'); render();
      }
    });
  }

  function reasonModal(title, message, confirmLabel, onDone, opts) {
    const o = opts || {};
    openModal(title, `
      ${message ? `<p style="font-size:13.5px;color:var(--ink-soft);margin-bottom:12px">${message}</p>` : ''}
      ${o.extraFields || ''}
      ${field('reasonText', o.reasonLabel || 'Reason', `<textarea id="reasonText" placeholder="${esc(o.placeholder || 'Explain why — this is recorded in the audit history.')}"></textarea>`, { req: !o.optional, help: o.help })}`,
      `<button class="btn" data-action="close-modal">Cancel</button>
       <button class="btn ${o.danger ? 'btn-danger' : 'btn-primary'}" id="reasonSave">${esc(confirmLabel)}</button>`);
    $('#reasonSave').addEventListener('click', () => {
      clearFieldErrors();
      const r = $('#reasonText').value.trim();
      if (!o.optional && !r) return fieldError('reasonText', 'A reason is required and will be recorded.');
      onDone(r);
    });
  }

  function timelineModal(p) {
    const t = p.timeline;
    const committed = p.status === 'approved' || p.status === 'in-progress';
    openModal('Change project dates', `
      <p style="font-size:13px;color:var(--ink-soft);margin-bottom:12px">
        Baseline stays <b>${fmt(t.baselineStart)} → ${fmt(t.baselineEnd)}</b>. Changing committed dates requires a reason and is recorded for leadership.
      </p>
      <div class="field-row">
        ${field('tlStart', 'Current start', `<input type="date" id="tlStart" value="${t.currentStart}" />`, { req: true })}
        ${field('tlEnd', 'Current end', `<input type="date" id="tlEnd" value="${t.currentEnd}" />`, { req: true })}
      </div>
      ${field('tlReason', 'Reason for change', `<textarea id="tlReason" placeholder="e.g. Fabric sim rework needs one extra sprint."></textarea>`, { req: true })}`,
      `<button class="btn" data-action="close-modal">Cancel</button>
       <button class="btn btn-primary" id="tlSave">Save dates</button>`);
    $('#tlSave').addEventListener('click', () => {
      clearFieldErrors();
      const s = $('#tlStart').value, e = $('#tlEnd').value, r = $('#tlReason').value.trim();
      if (!s) return fieldError('tlStart', 'Pick a start date.');
      if (!e) return fieldError('tlEnd', 'Pick an end date.');
      if (e <= s) return fieldError('tlEnd', 'End date must be after the start date.');
      if (committed && !r) return fieldError('tlReason', 'Committed-date changes require a reason.');
      const prevEnd = t.currentEnd;
      t.currentStart = s; t.currentEnd = e;
      logAudit('timeline-changed', 'project', p.id, { field: 'currentEnd', prev: prevEnd, next: e, reason: r });
      notify(projAudience(p).concat(bossIds()), 'timeline',
        `Committed dates changed on “${p.name}” (${fmt(prevEnd)} → ${fmt(e)}).`, 'project', p.id);
      save(); closeModal(); toast('Dates updated and recorded in the audit history.'); render();
    });
  }

  function taskFormModal(projectId, task) {
    const p = projById(projectId || (task && task.projectId));
    const isNew = !task;
    const committed = p.status === 'approved' || p.status === 'in-progress';
    const v = task || { title: '', assigneeId: '', weight: 1, critical: false, start: p.timeline.currentStart, end: p.timeline.currentEnd, status: 'todo', progress: 0 };
    openModal(isNew ? 'Add task' : 'Edit task', `
      ${field('tkTitle', 'Task title', `<input type="text" id="tkTitle" value="${esc(v.title)}" />`, { req: true })}
      ${field('tkAssignee', 'Assignee', `<select id="tkAssignee"><option value="">Unassigned</option>${userOptions(v.assigneeId, (u) => u.role === 'team' || u.role === 'pm')}</select>`, { help: 'Every task needs an assignee before work starts.' })}
      <div class="field-row">
        ${field('tkStart', 'Start', `<input type="date" id="tkStart" value="${v.start}" />`, { req: true })}
        ${field('tkEnd', 'End', `<input type="date" id="tkEnd" value="${v.end}" />`, { req: true })}
      </div>
      <div class="field-row">
        ${field('tkWeight', 'Weight', `<input type="number" id="tkWeight" min="1" max="10" value="${v.weight || 1}" />`, { help: 'Heavier tasks count more toward project progress.' })}
        ${field('tkCrit', 'Critical task', `<select id="tkCrit"><option value="no" ${!v.critical ? 'selected' : ''}>No</option><option value="yes" ${v.critical ? 'selected' : ''}>Yes — drives health & deadline</option></select>`)}
      </div>
      ${!isNew && isPM() ? field('tkStatus', 'Status', `<select id="tkStatus">${['todo', 'active', 'done', 'cancelled'].map((sx) => `<option value="${sx}" ${v.status === sx ? 'selected' : ''}>${sx === 'todo' ? 'To do' : sx === 'active' ? 'Active' : sx === 'done' ? 'Done' : 'Cancelled (excluded from progress)'}</option>`).join('')}</select>`) : ''}
      ${!isNew && committed ? field('tkReason', 'Reason (required if dates changed)', `<textarea id="tkReason" placeholder="Only needed when you move the dates."></textarea>`) : ''}`,
      `<button class="btn" data-action="close-modal">Cancel</button>
       <button class="btn btn-primary" id="tkSave">${isNew ? 'Add task' : 'Save task'}</button>`);
    $('#tkSave').addEventListener('click', () => {
      clearFieldErrors();
      const title = $('#tkTitle').value.trim();
      const s = $('#tkStart').value, e = $('#tkEnd').value;
      if (!title) return fieldError('tkTitle', 'Give the task a title.');
      if (!s) return fieldError('tkStart', 'Pick a start date.');
      if (!e) return fieldError('tkEnd', 'Pick an end date.');
      if (e < s) return fieldError('tkEnd', 'End date can\'t be before the start date.');
      const assigneeId = $('#tkAssignee').value || null;
      const weight = Math.max(1, Math.min(10, Number($('#tkWeight').value) || 1));
      const critical = $('#tkCrit').value === 'yes';
      if (isNew) {
        const tk = { id: uid(), projectId: p.id, title, assigneeId, status: 'todo', progress: 0, weight, critical, start: s, end: e };
        state.tasks.push(tk);
        logAudit('task-added', 'project', p.id, { detail: `Task “${title}” added` });
        if (assigneeId) notify([assigneeId], 'task', `You were assigned “${title}” on “${p.name}”.`, 'project', p.id);
        save(); closeModal(); toast('Task added.'); render();
      } else {
        const datesChanged = task.start !== s || task.end !== e;
        const reasonEl = $('#tkReason');
        const r = reasonEl ? reasonEl.value.trim() : '';
        if (datesChanged && committed && !r) return fieldError('tkReason', 'Moving committed task dates requires a reason.');
        const prevAssignee = task.assigneeId;
        if (datesChanged && committed) {
          logAudit('timeline-changed', 'project', p.id, {
            field: 'task-dates', prev: `${task.start}→${task.end}`, next: `${s}→${e}`,
            reason: r, detail: `Task “${task.title}” rescheduled`
          });
          notify(projAudience(p).concat(bossIds()), 'timeline', `Task “${task.title}” on “${p.name}” was rescheduled.`, 'project', p.id);
        }
        task.title = title; task.assigneeId = assigneeId; task.start = s; task.end = e;
        task.weight = weight; task.critical = critical;
        const st = $('#tkStatus');
        if (st) {
          task.status = st.value;
          if (task.status === 'done') { task.progress = 100; task.actualEnd = task.actualEnd || todayISO(); }
        }
        if (assigneeId && assigneeId !== prevAssignee) notify([assigneeId], 'task', `You were assigned “${title}” on “${p.name}”.`, 'project', p.id);
        save(); closeModal(); toast('Task updated.'); render();
      }
    });
  }

  function meetingFormModal(meeting, presetISO) {
    const isNew = !meeting;
    const v = meeting || { title: '', date: presetISO || todayISO(), time: '15:00', durationMin: 30, participantIds: [], projectId: '', agenda: '', location: '', recurrence: null };
    openModal(isNew ? 'New meeting' : 'Edit meeting', `
      ${field('mtTitle', 'Title', `<input type="text" id="mtTitle" value="${esc(v.title)}" />`, { req: true })}
      <div class="field-row">
        ${field('mtDate', 'Date', `<input type="date" id="mtDate" value="${v.date}" />`, { req: true })}
        ${field('mtTime', 'Time', `<input type="time" id="mtTime" value="${v.time}" />`, { req: true })}
      </div>
      <div class="field-row">
        ${field('mtDur', 'Duration (min)', `<input type="number" id="mtDur" min="15" step="15" value="${v.durationMin}" />`)}
        ${field('mtRec', 'Repeats', `<select id="mtRec"><option value="" ${!v.recurrence ? 'selected' : ''}>Does not repeat</option><option value="weekly" ${v.recurrence === 'weekly' ? 'selected' : ''}>Weekly</option></select>`)}
      </div>
      ${field('mtProj', 'Linked project (optional)', `<select id="mtProj"><option value="">None</option>${state.projects.filter((px) => px.status !== 'rejected').map((px) => `<option value="${px.id}" ${v.projectId === px.id ? 'selected' : ''}>${esc(px.name)}</option>`).join('')}</select>`)}
      ${field('mtLoc', 'Location / link', `<input type="text" id="mtLoc" value="${esc(v.location || '')}" placeholder="Room or video link" />`)}
      ${field('mtAgenda', 'Agenda', `<textarea id="mtAgenda">${esc(v.agenda || '')}</textarea>`)}
      ${field('mtWho', 'Participants', `<div class="check-list" id="mtWho">
        ${state.users.map((u) => `<label><input type="checkbox" value="${u.id}" ${(v.participantIds || []).includes(u.id) ? 'checked' : ''} /> ${esc(u.name)} — ${ROLE_LABEL[u.role]}</label>`).join('')}
      </div>`, { req: true })}`,
      `<button class="btn" data-action="close-modal">Cancel</button>
       <button class="btn btn-primary" id="mtSave">${isNew ? 'Schedule meeting' : 'Save changes'}</button>`);
    $('#mtSave').addEventListener('click', () => {
      clearFieldErrors();
      const title = $('#mtTitle').value.trim();
      const date = $('#mtDate').value, time = $('#mtTime').value;
      const who = Array.from($('#mtWho').querySelectorAll('input:checked')).map((i) => i.value);
      if (!title) return fieldError('mtTitle', 'Give the meeting a title.');
      if (!date) return fieldError('mtDate', 'Pick a date.');
      if (!time) return fieldError('mtTime', 'Pick a time.');
      if (!who.length) return fieldError('mtWho', 'Choose at least one participant.');
      const payload = {
        title, date, time, durationMin: Math.max(15, Number($('#mtDur').value) || 30),
        recurrence: $('#mtRec').value || null, projectId: $('#mtProj').value || null,
        location: $('#mtLoc').value.trim(), agenda: $('#mtAgenda').value.trim(), participantIds: who
      };
      if (isNew) {
        const created = Object.assign({ id: uid(), notes: '', attendance: {}, actionItems: [], cancelled: false, createdBy: session.userId }, payload);
        state.meetings.push(created);
        notify(who, 'meeting', `“${title}” scheduled for ${fmt(date)} at ${time}.`, 'meeting', created.id);
        save(); closeModal(); toast('Meeting scheduled — participants notified.'); render();
      } else {
        const wasDate = meeting.date, wasTime = meeting.time;
        Object.assign(meeting, payload);
        if (wasDate !== date || wasTime !== time) {
          notify(who, 'meeting', `“${title}” was rescheduled to ${fmt(date)} at ${time}.`, 'meeting', meeting.id);
        }
        save(); closeModal(); toast('Meeting updated — participants notified.'); render();
      }
    });
  }

  /* ============================== actions ============================== */

  function requireProject(d) { return projById(d.id); }

  const actions = {
    'close-modal': () => closeModal(),
    'close-drawer': () => closeDrawer(),

    'reset-demo': () => confirmDialog('Reset demo data', 'This restores the sample portfolio and removes any changes you made. Nothing else is affected.', 'Reset data', () => {
      localStorage.removeItem(LS_STATE);
      state = window.buildSeed();
      save(); toast('Demo data reset.'); render();
    }, true),

    'open-project': (d) => go(`#/project/${d.id}`),
    'proj-tab': (d) => go(`#/project/${d.id}?tab=${d.tab}`),
    'dash-due': (d) => { ui.dashDue = Number(d.n); render(); },
    'gantt-zoom': (d) => { ui.ganttZoom = d.z; render(); },
    'gantt-toggle': (d) => {
      if (ui.ganttExpanded.has(d.id)) ui.ganttExpanded.delete(d.id); else ui.ganttExpanded.add(d.id);
      render();
    },

    'new-project': () => projectFormModal(null),
    'edit-draft': (d) => { const p = requireProject(d); if (p && canEditDraft(p)) projectFormModal(p); },

    'clear-filters': () => { setFilters({}); render(); },
    'export-csv': () => {
      const rows = [['Project', 'Status', 'Health', 'Health reason', 'Progress %', 'Department', 'Priority', 'Owner', 'Project manager', 'Baseline end', 'Current end', 'Slip (days)']];
      filteredProjects().forEach((p) => {
        const h = projectHealth(p);
        const t = p.timeline;
        rows.push([p.name, STATUS_META[p.status].label, h.label, h.reason, projectProgress(p), p.dept, p.priority,
          userById(p.ownerId).name, userById(p.managerId).name, t.baselineEnd || '', t.currentEnd || '',
          t.baselineEnd && t.currentEnd ? diffDays(t.baselineEnd, t.currentEnd) : '']);
      });
      const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = 'projects.csv';
      a.click();
      URL.revokeObjectURL(a.href);
      toast('Exported the currently filtered projects.');
    },

    /* lifecycle */
    'submit-project': (d) => {
      const p = requireProject(d); if (!p || p.status !== 'draft') return;
      confirmDialog('Submit for approval', `Submitting locks the proposed dates (<b>${fmt(p.timeline.proposedStart)} → ${fmt(p.timeline.proposedEnd)}</b>) until the Project Manager reviews the proposal. You can still edit tasks and notes.`, 'Submit proposal', () => {
        p.status = 'submitted'; p.submittedAt = nowStamp();
        logAudit('submitted', 'project', p.id, { detail: 'Proposal submitted; dates locked' });
        notify([p.managerId], 'submitted', `${cur().name} submitted “${p.name}” for review.`, 'project', p.id);
        save(); toast('Submitted — the Project Manager has been notified.'); render();
      });
    },
    'approve-project': (d) => {
      const p = requireProject(d); if (!p || p.status !== 'submitted' || !isPM()) return;
      confirmDialog('Approve project', `Approval creates the committed baseline <b>${fmt(p.timeline.proposedStart)} → ${fmt(p.timeline.proposedEnd)}</b>. After this, date changes require a reason and are audited.`, 'Approve & set baseline', () => {
        p.status = 'approved';
        p.timeline.baselineStart = p.timeline.proposedStart;
        p.timeline.baselineEnd = p.timeline.proposedEnd;
        p.timeline.currentStart = p.timeline.proposedStart;
        p.timeline.currentEnd = p.timeline.proposedEnd;
        logAudit('approved', 'project', p.id, { detail: 'Baseline timeline created' });
        notify(projAudience(p), 'approved', `“${p.name}” was approved — baseline ${fmt(p.timeline.baselineStart)} → ${fmt(p.timeline.baselineEnd)}.`, 'project', p.id);
        save(); toast('Approved. Baseline locked.'); render();
      });
    },
    'return-project': (d) => {
      const p = requireProject(d); if (!p || p.status !== 'submitted' || !isPM()) return;
      reasonModal('Return for revision', `The proposal goes back to draft so ${esc(userById(p.ownerId).name)} can revise it.`, 'Return to draft', (r) => {
        p.status = 'draft';
        logAudit('returned', 'project', p.id, { reason: r });
        notify(projAudience(p), 'returned', `“${p.name}” was returned for revision: ${r}`, 'project', p.id);
        save(); closeModal(); toast('Returned to draft with your note.'); render();
      });
    },
    'reject-project': (d) => {
      const p = requireProject(d); if (!p || p.status !== 'submitted' || !isPM()) return;
      reasonModal('Reject proposal', 'Rejection is recorded with your reason. The owner can duplicate it into a new draft later.', 'Reject proposal', (r) => {
        p.status = 'rejected'; p.rejectReason = r;
        logAudit('rejected', 'project', p.id, { reason: r });
        notify(projAudience(p), 'rejected', `“${p.name}” was rejected: ${r}`, 'project', p.id);
        save(); closeModal(); toast('Proposal rejected.'); render();
      }, { danger: true });
    },
    'start-project': (d) => {
      const p = requireProject(d); if (!p || p.status !== 'approved' || !isPM()) return;
      const unassigned = tasksOf(p).filter((t) => !t.assigneeId && t.status !== 'cancelled');
      if (unassigned.length) {
        toast(`Every task needs an assignee first — ${unassigned.length} unassigned.`, 'err');
        go(`#/project/${p.id}?tab=tasks`);
        return;
      }
      p.status = 'in-progress';
      logAudit('started', 'project', p.id, { detail: 'Moved to In progress' });
      notify(projAudience(p), 'task', `Work started on “${p.name}”.`, 'project', p.id);
      save(); toast('Project is now in progress.'); render();
    },
    'complete-project': (d) => {
      const p = requireProject(d); if (!p || p.status !== 'in-progress' || !isPM()) return;
      const prog = projectProgress(p);
      confirmDialog('Mark completed', `${prog < 100 ? `Progress is at <b>${prog}%</b>. ` : ''}Completed projects become read-only unless you reopen them.`, 'Complete project', () => {
        p.status = 'completed'; p.completedAt = todayISO(); p.completionRequested = false;
        logAudit('completed', 'project', p.id, { detail: 'Project closed by PM' });
        notify(projAudience(p).concat(bossIds()), 'completion', `“${p.name}” was completed.`, 'project', p.id);
        save(); toast('Project completed.'); render();
      });
    },
    'request-completion': (d) => {
      const p = requireProject(d); if (!p || p.status !== 'in-progress') return;
      p.completionRequested = true;
      logAudit('completion-requested', 'project', p.id, { detail: `${cur().name} requested completion` });
      notify([p.managerId], 'completion', `${cur().name} requested completion of “${p.name}”.`, 'project', p.id);
      save(); toast('Completion requested — the Project Manager confirms final closure.'); render();
    },
    'hold-project': (d) => {
      const p = requireProject(d); if (!p || p.status !== 'in-progress' || !isPM()) return;
      reasonModal('Place on hold', 'Work pauses but all history is kept. The reason is shown wherever the project appears.', 'Place on hold', (r) => {
        p.status = 'on-hold'; p.holdReason = r;
        logAudit('on-hold', 'project', p.id, { reason: r });
        notify(projAudience(p).concat(bossIds()), 'timeline', `“${p.name}” was placed on hold: ${r}`, 'project', p.id);
        save(); closeModal(); toast('Project placed on hold.'); render();
      });
    },
    'resume-project': (d) => {
      const p = requireProject(d); if (!p || p.status !== 'on-hold' || !isPM()) return;
      p.status = 'in-progress'; p.holdReason = null;
      logAudit('resumed', 'project', p.id, { detail: 'Work resumed' });
      notify(projAudience(p), 'task', `“${p.name}” resumed.`, 'project', p.id);
      save(); toast('Project resumed.'); render();
    },
    'reopen-project': (d) => {
      const p = requireProject(d); if (!p || p.status !== 'completed' || !isPM()) return;
      reasonModal('Reopen project', 'The project returns to In progress and the reopen is audited.', 'Reopen', (r) => {
        p.status = 'in-progress'; p.completedAt = null;
        logAudit('reopened', 'project', p.id, { reason: r });
        save(); closeModal(); toast('Project reopened.'); render();
      });
    },
    'duplicate-draft': (d) => {
      const p = requireProject(d); if (!p || !isPM()) return;
      const copy = JSON.parse(JSON.stringify(p));
      copy.id = uid(); copy.name = `${p.name} (new draft)`; copy.status = 'draft';
      copy.rejectReason = null; copy.createdAt = nowStamp();
      copy.timeline.baselineStart = copy.timeline.baselineEnd = null;
      state.projects.push(copy);
      tasksOf(p).forEach((t) => {
        state.tasks.push(Object.assign(JSON.parse(JSON.stringify(t)), { id: uid(), projectId: copy.id, status: 'todo', progress: 0, actualEnd: null }));
      });
      logAudit('created', 'project', copy.id, { detail: `Duplicated from rejected “${p.name}”` });
      save(); toast('New draft created from the rejected proposal.'); go(`#/project/${copy.id}`);
    },

    /* timeline & tasks */
    'edit-timeline': (d) => { const p = requireProject(d); if (p && isPM()) timelineModal(p); },
    'add-task': (d) => { const p = requireProject(d); if (p && (isPM() || canEditDraft(p))) taskFormModal(p.id, null); },
    'edit-task': (d) => {
      const t = state.tasks.find((x) => x.id === d.id);
      if (t && isPM()) taskFormModal(null, t);
    },
    'override-progress': (d) => {
      const p = requireProject(d); if (!p || !isPM()) return;
      reasonModal('Override calculated progress', `Calculated progress is <b>${projectProgress({ ...p, progressOverride: null })}%</b> from task weights. An override is labelled in every view.`, 'Set override', (r) => {
        const v = Number($('#ovVal').value);
        if (Number.isNaN(v) || v < 0 || v > 100) { fieldError('ovVal', 'Enter 0–100.'); return; }
        p.progressOverride = v;
        logAudit('progress-override', 'project', p.id, { prev: null, next: `${v}%`, reason: r });
        save(); closeModal(); toast('Progress override set (labelled “PM override”).'); render();
      }, {
        extraFields: field('ovVal', 'Override value (%)', `<input type="number" id="ovVal" min="0" max="100" value="${projectProgress(p)}" />`, { req: true })
      });
    },
    'report-blocker': (d) => {
      const p = requireProject(d); if (!p) return;
      reasonModal('Report a blocker', 'Blockers set the project to At risk until resolved and notify the Project Manager.', 'Report blocker', (r) => {
        const sev = $('#blkSev').value;
        const rev = $('#blkRev').value || todayISO();
        state.blockers.push({
          id: uid(), projectId: p.id, taskId: null, severity: sev, status: 'open',
          desc: r, ownerId: session.userId, nextReview: rev, reportedAt: nowStamp(), reporterId: session.userId
        });
        logAudit('blocker-reported', 'project', p.id, { detail: `${sev} severity blocker reported` });
        notify([p.managerId], 'blocker', `${sev} blocker reported on “${p.name}”: ${r.slice(0, 90)}`, 'project', p.id);
        save(); closeModal(); toast('Blocker reported — Project Manager notified.'); render();
      }, {
        reasonLabel: 'What is blocked, and why?',
        placeholder: 'Describe the blocker…',
        extraFields: `<div class="field-row">
          ${field('blkSev', 'Severity', `<select id="blkSev"><option>High</option><option selected>Medium</option><option>Low</option></select>`)}
          ${field('blkRev', 'Next review date', `<input type="date" id="blkRev" value="${toISO(addDays(today(), 2))}" />`)}
        </div>`
      });
    },
    'resolve-blocker': (d) => {
      const b = state.blockers.find((x) => x.id === d.id); if (!b) return;
      if (!(isPM() || b.ownerId === session.userId)) return;
      b.status = 'resolved'; b.resolvedAt = nowStamp();
      const p = projById(b.projectId);
      logAudit('blocker-resolved', 'project', p.id, { detail: b.desc.slice(0, 70) });
      save(); toast('Blocker resolved.'); render();
    },
    'add-milestone': (d) => {
      const p = requireProject(d); if (!p || !isPM()) return;
      openModal('Add milestone', `
        ${field('msTitle', 'Milestone', `<input type="text" id="msTitle" />`, { req: true })}
        ${field('msDate', 'Date', `<input type="date" id="msDate" value="${p.timeline.currentEnd || todayISO()}" />`, { req: true })}`,
        `<button class="btn" data-action="close-modal">Cancel</button>
         <button class="btn btn-primary" id="msSave">Add milestone</button>`);
      $('#msSave').addEventListener('click', () => {
        clearFieldErrors();
        const ttl = $('#msTitle').value.trim(); const dte = $('#msDate').value;
        if (!ttl) return fieldError('msTitle', 'Name the milestone.');
        if (!dte) return fieldError('msDate', 'Pick a date.');
        state.milestones.push({ id: uid(), projectId: p.id, title: ttl, date: dte, done: false });
        logAudit('milestone', 'project', p.id, { detail: `Milestone “${ttl}” added for ${fmt(dte)}` });
        save(); closeModal(); toast('Milestone added.'); render();
      });
    },
    'toggle-milestone': (d) => {
      const m = state.milestones.find((x) => x.id === d.id); if (!m || !isPM()) return;
      m.done = !m.done;
      const p = projById(m.projectId);
      logAudit('milestone', 'project', p.id, { detail: `Milestone “${m.title}” marked ${m.done ? 'complete' : 'incomplete'}` });
      save(); render();
    },

    /* comments */
    'post-comment': (d) => {
      const p = requireProject(d); if (!p || !canComment(p)) return;
      const box = $('#commentBody');
      const body = box.value.trim();
      if (!body) { toast('Write a comment first.', 'err'); box.focus(); return; }
      const mentions = state.users.filter((u) => body.toLowerCase().includes('@' + u.name.toLowerCase())).map((u) => u.id);
      state.comments.push({ id: uid(), parentType: 'project', parentId: p.id, authorId: session.userId, body, mentions, at: nowStamp(), editedAt: null });
      notify(mentions, 'mention', `${cur().name} mentioned you in a comment on “${p.name}”.`, 'project', p.id);
      save(); toast(mentions.length ? 'Comment posted — mentioned teammates notified.' : 'Comment posted.'); render();
    },

    /* notifications */
    'open-notif': (d) => {
      const n = state.notifications.find((x) => x.id === d.id); if (!n) return;
      n.read = true; save();
      if (n.refType === 'project' && n.refId && projById(n.refId)) {
        if (role() === 'hr') { render(); toast('Linked project details are managed by the Project Manager.', 'err'); return; }
        go(`#/project/${n.refId}`);
      } else if (n.refType === 'meeting' && n.refId && meetingById(n.refId)) {
        ui.pendingMeetingId = n.refId;
        if (parseHash().parts[0] === 'calendar') { render(); } else go('#/calendar');
      } else {
        render();
      }
    },
    'notif-read-all': () => {
      state.notifications.forEach((n) => { if (n.userId === session.userId) n.read = true; });
      save(); render();
    },

    /* calendar & meetings */
    'cal-nav': (d) => { ui.calCursor = new Date(ui.calCursor.getFullYear(), ui.calCursor.getMonth() + Number(d.n), 1); render(); },
    'cal-today': () => { const t = today(); ui.calCursor = new Date(t.getFullYear(), t.getMonth(), 1); render(); },
    'cal-day': (d) => openDayDrawer(d.iso),
    'open-meeting': (d) => openMeetingDrawer(d.id, d.iso),
    'new-meeting': (d) => { if (role() === 'hr') meetingFormModal(null, d.iso); },
    'edit-meeting': (d) => { const m = meetingById(d.id); if (m && role() === 'hr') meetingFormModal(m); },
    'cancel-meeting': (d) => {
      const m = meetingById(d.id); if (!m || role() !== 'hr') return;
      confirmDialog('Cancel meeting', `“${esc(m.title)}”${m.recurrence === 'weekly' ? ' (all weekly occurrences)' : ''} will be cancelled and participants notified.`, 'Cancel meeting', () => {
        m.cancelled = true;
        notify(m.participantIds, 'meeting', `“${m.title}” was cancelled.`, 'meeting', null);
        save(); closeDrawer(); toast('Meeting cancelled — participants notified.'); render();
      }, true);
    },
    'save-notes': (d) => {
      const m = meetingById(d.id); if (!m || role() !== 'hr') return;
      m.notes = $('#meetingNotes').value.trim();
      save(); toast('Notes saved.');
    },
    'add-action-item': (d) => {
      const m = meetingById(d.id); if (!m || role() !== 'hr') return;
      const txt = $('#newActionItem').value.trim();
      if (!txt) { toast('Describe the action item first.', 'err'); $('#newActionItem').focus(); return; }
      const ownerId = $('#newActionOwner').value;
      m.actionItems.push({ id: uid(), text: txt, ownerId, status: 'proposed', projectId: m.projectId || null });
      const pm = state.users.find((u) => u.role === 'pm');
      notify([pm.id], 'action-item', `Action item from “${m.title}” awaits your approval: ${txt.slice(0, 70)}`, 'meeting', m.id);
      save(); toast('Action item recorded — PM approval turns it into a task.'); openMeetingDrawer(m.id);
    },
    'approve-action-item': (d) => {
      const m = meetingById(d.mid); if (!m || !isPM()) return;
      const ai = m.actionItems.find((x) => x.id === d.aid); if (!ai || ai.status !== 'proposed') return;
      const targetProj = ai.projectId ? projById(ai.projectId) : null;
      if (!targetProj) { toast('Link the meeting to a project first — tasks need a home.', 'err'); return; }
      const tk = {
        id: uid(), projectId: targetProj.id, title: ai.text, assigneeId: ai.ownerId,
        status: 'todo', progress: 0, weight: 1, critical: false,
        start: todayISO(), end: toISO(addDays(today(), 7))
      };
      state.tasks.push(tk);
      ai.status = 'task-created'; ai.taskId = tk.id;
      logAudit('task-added', 'project', targetProj.id, { detail: `Task created from meeting action item: “${ai.text}”` });
      notify([ai.ownerId], 'task', `You were assigned “${ai.text}” on “${targetProj.name}” (from “${m.title}”).`, 'project', targetProj.id);
      save(); toast('Approved — task created and assigned.'); openMeetingDrawer(m.id);
    }
  };

  /* change-event handlers (selects, checkboxes, inputs) */
  const changeHandlers = {
    'task-progress': (el) => {
      const t = state.tasks.find((x) => x.id === el.dataset.id); if (!t) return;
      const p = projById(t.projectId);
      if (!canEditProgress(t, p)) return;
      const v = Math.max(0, Math.min(100, Number(el.value)));
      t.progress = v;
      t.status = v >= 100 ? 'done' : v > 0 ? 'active' : 'todo';
      if (v >= 100) t.actualEnd = todayISO(); else t.actualEnd = null;
      t.updatedBy = session.userId; t.updatedAt = nowStamp();
      save(); toast(v >= 100 ? 'Task marked done.' : `Progress set to ${v}%.`); render();
    },
    'attendance': (el) => {
      const m = meetingById(el.dataset.mid); if (!m || role() !== 'hr') return;
      m.attendance = m.attendance || {};
      m.attendance[el.dataset.uid] = el.checked;
      save();
    },
    'filter-q': (el) => { const f = getFilters(); f.q = el.value; setFilters(f); renderProjectsPreservingFocus(); },
    'filter-status': (el) => { const f = getFilters(); f.status = el.value; setFilters(f); render(); },
    'filter-health': (el) => { const f = getFilters(); f.health = el.value; setFilters(f); render(); },
    'filter-dept': (el) => { const f = getFilters(); f.dept = el.value; setFilters(f); render(); },
    'filter-owner': (el) => { const f = getFilters(); f.owner = el.value; setFilters(f); render(); }
  };

  /* re-render the projects list while keeping the search box focused */
  function renderProjectsPreservingFocus() {
    const view = $('#view');
    view.innerHTML = renderProjects();
    const input = $('#projSearch');
    if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
  }

  /* ============================== wiring ============================== */

  document.addEventListener('click', (e) => {
    const overlay = e.target.closest('[data-overlay]');
    if (overlay && e.target === overlay) { closeModal(); closeDrawer(); return; }
    const el = e.target.closest('[data-action]');
    if (!el) return;
    /* let plain links inside actionable rows work normally */
    if (e.target.closest('a') && !el.closest('a')) return;
    const fn = actions[el.dataset.action];
    if (fn) { e.preventDefault(); fn(el.dataset, el); }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeModal(); closeDrawer(); }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-action][role="link"], [data-action][role="button"]')) {
      e.preventDefault();
      const fn = actions[e.target.dataset.action];
      if (fn) fn(e.target.dataset, e.target);
    }
  });

  let searchDebounce = null;
  document.addEventListener('input', (e) => {
    const el = e.target.closest('[data-change="filter-q"]');
    if (!el) return;
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => changeHandlers['filter-q'](el), 220);
  });

  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-change]');
    if (!el) return;
    if (el.dataset.change === 'filter-q') return; // handled by input listener
    const fn = changeHandlers[el.dataset.change];
    if (fn) fn(el);
  });

  $('#userSelect').addEventListener('change', (e) => {
    session.userId = e.target.value;
    localStorage.setItem(LS_USER, session.userId);
    const { parts } = parseHash();
    const key = currentRouteKey(parts);
    toast(`Now viewing as ${cur().name} (${ROLE_LABEL[role()]}).`);
    if (!NAV_BY_ROLE[role()].includes(key)) {
      go(`#/${HOME_BY_ROLE[role()]}`);
    } else {
      render();
    }
  });

  /* mobile nav */
  const sidebar = $('#sidebar');
  const scrim = $('#sidebarScrim');
  $('#menuBtn').addEventListener('click', () => {
    const open = sidebar.classList.toggle('open');
    scrim.classList.toggle('show', open);
    $('#menuBtn').setAttribute('aria-expanded', String(open));
  });
  scrim.addEventListener('click', () => {
    sidebar.classList.remove('open'); scrim.classList.remove('show');
    $('#menuBtn').setAttribute('aria-expanded', 'false');
  });
  document.addEventListener('click', (e) => {
    if (e.target.closest('.nav-link')) {
      sidebar.classList.remove('open'); scrim.classList.remove('show');
    }
  });

  window.addEventListener('hashchange', render);
  save();
  render();
})();
