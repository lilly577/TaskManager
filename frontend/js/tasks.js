// tasks.js
function getToken() {
  return localStorage.getItem("token");
}

function resolveTaskApiBase() {
  const PROD_API = "https://taskmanager-8rtb.onrender.com/api";
  if (window.__TASK_API_BASE__) return window.__TASK_API_BASE__;
  const localOverride = localStorage.getItem("taskApiBase");
  if (localOverride) return localOverride;
  const host = window.location.hostname;
  const port = window.location.port;
  if (host === "localhost" || host === "127.0.0.1") {
    if (port === "5000") return `${window.location.origin}/api`;
    return "http://localhost:5000/api";
  }
  if (window.location.protocol === "file:") return "http://localhost:5000/api";
  return PROD_API;
}

const TASK_API_BASE = resolveTaskApiBase();
const TASK_API = `${TASK_API_BASE}/tasks`;

let allTasks = [];
let currentView = "list";
let isLoading = false;

const undoState = {
  timer: null,
  undo: null,
  commit: null
};

document.addEventListener("DOMContentLoaded", () => {
  const taskList = document.getElementById("taskList");
  const boardView = document.getElementById("boardView");
  const timelineView = document.getElementById("timelineView");
  const listView = document.getElementById("listView");
  const loadingSkeleton = document.getElementById("loadingSkeleton");
  const emptyState = document.getElementById("emptyState");
  const emptyActionBtn = document.getElementById("emptyActionBtn");

  const addTaskBtn = document.getElementById("addTaskBtn");
  const taskModal = document.getElementById("taskModal");
  const closeModal = document.querySelector(".close");
  const taskForm = document.getElementById("taskForm");
  const modalTitle = document.getElementById("modalTitle");
  const taskIdInput = document.getElementById("taskId");

  const searchInput = document.getElementById("searchInput");
  const filterStatus = document.getElementById("filterStatus");
  const filterCategory = document.getElementById("filterCategory");
  const sortSelect = document.getElementById("sortSelect");
  const savePresetBtn = document.getElementById("savePresetBtn");
  const savedPresetSelect = document.getElementById("savedPresetSelect");
  const clearFiltersBtn = document.getElementById("clearFiltersBtn");

  const quickAddForm = document.getElementById("quickAddForm");
  const focusList = document.getElementById("focusList");

  const totalCount = document.getElementById("totalCount");
  const pendingCount = document.getElementById("pendingCount");
  const completedCount = document.getElementById("completedCount");
  const streakCount = document.getElementById("streakCount");
  const workloadCount = document.getElementById("workloadCount");

  const themePreset = document.getElementById("themePreset");
  const densitySelect = document.getElementById("densitySelect");
  const toggleDark = document.getElementById("toggleDark");

  const toast = document.getElementById("toast");

  initAppearanceControls();

  if (!taskList || !taskModal || !taskForm) {
    return;
  }

  hydrateSavedFilters();
  renderSkeleton();

  document.querySelectorAll(".view-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentView = btn.dataset.view;
      document.querySelectorAll(".view-btn").forEach((el) => el.classList.remove("active"));
      btn.classList.add("active");
      renderTasks();
    });
  });

  addTaskBtn.addEventListener("click", () => {
    resetForm();
    openModal();
  });

  emptyActionBtn.addEventListener("click", () => {
    resetForm();
    openModal();
  });

  closeModal?.addEventListener("click", closeTaskModal);

  window.addEventListener("click", (e) => {
    if (e.target === taskModal) closeTaskModal();
  });

  document.addEventListener("keydown", (e) => {
    const tag = (document.activeElement?.tagName || "").toLowerCase();
    const typing = ["input", "textarea", "select"].includes(tag);

    if (e.key === "/" && !typing) {
      e.preventDefault();
      searchInput.focus();
    }

    if ((e.key === "n" || e.key === "N") && !typing) {
      e.preventDefault();
      resetForm();
      openModal();
    }

    if (e.key === "Escape" && taskModal.style.display === "block") {
      closeTaskModal();
    }
  });

  quickAddForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("quickTitle").value.trim();
    const dueDate = document.getElementById("quickDueDate").value || null;
    const priority = document.getElementById("quickPriority").value;

    if (!title) return;

    const payload = {
      title,
      dueDate,
      priority,
      description: "",
      category: "Other",
      estimatedTime: 0
    };

    try {
      await request(TASK_API, { method: "POST", body: JSON.stringify(payload) });
      quickAddForm.reset();
      await loadTasks();
    } catch (err) {
      showToast(`Quick add failed: ${err.message}`);
    }
  });

  taskForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = taskIdInput.value;
    const startDate = document.getElementById("taskStartDate").value || null;
    const dueDate = document.getElementById("taskDueDate").value || null;

    if (startDate && dueDate && new Date(startDate) > new Date(dueDate)) {
      showToast("Due date must be after start date.");
      return;
    }

    const taskData = {
      title: document.getElementById("taskTitle").value.trim(),
      description: document.getElementById("taskDesc").value.trim(),
      category: document.getElementById("taskCategory").value,
      priority: document.getElementById("taskPriority").value,
      startDate,
      dueDate,
      estimatedTime: Number(document.getElementById("taskEstimatedTime").value) || 0
    };

    try {
      const method = id ? "PUT" : "POST";
      const url = id ? `${TASK_API}/${id}` : TASK_API;
      await request(url, { method, body: JSON.stringify(taskData) });
      closeTaskModal();
      await loadTasks();
    } catch (err) {
      showToast(`Save failed: ${err.message}`);
    }
  });

  taskList.addEventListener("click", handleTaskAction);
  boardView.addEventListener("click", handleTaskAction);
  timelineView.addEventListener("click", handleTaskAction);

  taskList.addEventListener("dragstart", onDragStart);
  taskList.addEventListener("dragover", onDragOver);
  taskList.addEventListener("drop", onDrop);

  searchInput.oninput = renderTasks;
  filterStatus.onchange = renderTasks;
  filterCategory.onchange = renderTasks;
  sortSelect.onchange = renderTasks;

  savePresetBtn.addEventListener("click", saveCurrentFilter);
  savedPresetSelect.addEventListener("change", applySavedFilter);
  clearFiltersBtn.addEventListener("click", resetFilters);

  loadTasks();

  window.addEventListener("taskhub:auth-success", () => {
    loadTasks();
  });

  function initAppearanceControls() {
    const mode = localStorage.getItem("darkMode");
    if (mode === "enabled") {
      document.body.classList.add("dark");
      if (toggleDark) toggleDark.textContent = "Light Mode";
    } else if (toggleDark) {
      toggleDark.textContent = "Dark Mode";
    }

    const preset = localStorage.getItem("themePreset") || themePreset?.value || "ocean";
    document.body.dataset.theme = preset;
    if (themePreset) themePreset.value = preset;

    const density = localStorage.getItem("density") || densitySelect?.value || "cozy";
    document.body.dataset.density = density;
    if (densitySelect) densitySelect.value = density;

    toggleDark?.addEventListener("click", () => {
      document.body.classList.toggle("dark");
      const isDark = document.body.classList.contains("dark");
      localStorage.setItem("darkMode", isDark ? "enabled" : "disabled");
      toggleDark.textContent = isDark ? "Light Mode" : "Dark Mode";
    });

    themePreset?.addEventListener("change", () => {
      document.body.dataset.theme = themePreset.value;
      localStorage.setItem("themePreset", themePreset.value);
    });

    densitySelect?.addEventListener("change", () => {
      document.body.dataset.density = densitySelect.value;
      localStorage.setItem("density", densitySelect.value);
    });
  }

  function hydrateSavedFilters() {
    const presets = getSavedFilters();
    savedPresetSelect.innerHTML = '<option value="">Saved Filters</option>';
    presets.forEach((preset, idx) => {
      const option = document.createElement("option");
      option.value = String(idx);
      option.textContent = preset.name;
      savedPresetSelect.appendChild(option);
    });
  }

  function getSavedFilters() {
    try {
      return JSON.parse(localStorage.getItem("savedTaskFilters") || "[]");
    } catch {
      return [];
    }
  }

  function resetFilters() {
    searchInput.value = "";
    filterStatus.value = "all";
    filterCategory.value = "all";
    sortSelect.value = "created-desc";
    renderTasks();
  }

  function saveCurrentFilter() {
    const existing = getSavedFilters();
    const next = {
      name: `Filter ${existing.length + 1}`,
      search: searchInput.value,
      status: filterStatus.value,
      category: filterCategory.value,
      sort: sortSelect.value
    };

    existing.push(next);
    localStorage.setItem("savedTaskFilters", JSON.stringify(existing));
    hydrateSavedFilters();
    showToast("Filter saved.");
  }

  function applySavedFilter() {
    if (!savedPresetSelect.value) return;
    const presets = getSavedFilters();
    const selected = presets[Number(savedPresetSelect.value)];
    if (!selected) return;

    searchInput.value = selected.search;
    filterStatus.value = selected.status;
    filterCategory.value = selected.category;
    sortSelect.value = selected.sort;
    renderTasks();
  }

  function openModal() {
    taskModal.style.display = "block";
    taskModal.setAttribute("aria-hidden", "false");
  }

  function closeTaskModal() {
    taskModal.style.display = "none";
    taskModal.setAttribute("aria-hidden", "true");
  }

  function resetForm() {
    taskForm.reset();
    taskIdInput.value = "";
    modalTitle.textContent = "New Task";
    document.getElementById("taskEstimatedTime").value = "0";
  }

  async function loadTasks() {
    if (!getToken()) return;
    isLoading = true;
    renderTasks();

    try {
      const res = await request(TASK_API, { method: "GET" });
      allTasks = Array.isArray(res) ? res : [];
      syncManualOrder();
    } catch (err) {
      showToast(`Load failed: ${err.message}`);
    } finally {
      isLoading = false;
      renderTasks();
    }
  }

  function request(url, options = {}) {
    const token = getToken();
    if (!token) {
      localStorage.removeItem("token");
      location.reload();
      return Promise.reject(new Error("Session expired"));
    }

    const headers = {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {})
    };

    return fetch(url, {
      ...options,
      headers
    }).then(async (res) => {
      if (res.status === 401) {
        localStorage.removeItem("token");
        location.reload();
        throw new Error("Unauthorized");
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Request failed");
      }
      return data;
    });
  }

  function renderTasks() {
    loadingSkeleton.style.display = isLoading ? "grid" : "none";

    const filtered = getFilteredTasks();
    renderStats();
    renderFocus(filtered);

    const hasAny = filtered.length > 0;
    emptyState.style.display = isLoading || hasAny ? "none" : "block";

    listView.classList.toggle("active", currentView === "list");
    boardView.classList.toggle("active", currentView === "board");
    timelineView.classList.toggle("active", currentView === "timeline");

    if (currentView === "list") renderListView(filtered);
    if (currentView === "board") renderBoardView(filtered);
    if (currentView === "timeline") renderTimelineView(filtered);
  }

  function renderListView(tasks) {
    taskList.innerHTML = "";

    if (sortSelect.value === "manual") {
      const hint = document.createElement("p");
      hint.className = "drag-hint";
      hint.textContent = "Drag tasks to reorder manually.";
      taskList.appendChild(hint);
    }

    tasks.forEach((task) => {
      const li = document.createElement("li");
      li.className = getTaskClass(task);
      li.dataset.id = task._id;
      li.draggable = sortSelect.value === "manual";
      li.innerHTML = renderTaskInner(task);
      taskList.appendChild(li);
    });
  }

  function renderBoardView(tasks) {
    const groups = {
      pending: tasks.filter((t) => !t.completed && !isOverdue(t)),
      overdue: tasks.filter((t) => !t.completed && isOverdue(t)),
      completed: tasks.filter((t) => t.completed)
    };

    boardView.innerHTML = `
      <div class="board-grid">
        ${renderBoardColumn("Pending", groups.pending)}
        ${renderBoardColumn("Overdue", groups.overdue)}
        ${renderBoardColumn("Completed", groups.completed)}
      </div>
    `;
  }

  function renderBoardColumn(title, tasks) {
    const cards = tasks
      .map(
        (task) => `
          <article class="board-mini ${getTaskClass(task)}" data-id="${task._id}">
            <p class="task-title">${escapeHtml(task.title)}</p>
            <div class="meta-row">
              <span class="meta-chip">${escapeHtml(task.priority || "Medium")}</span>
              <span class="meta-chip">${escapeHtml(task.category || "Other")}</span>
            </div>
            <div class="task-actions" style="margin-top:0.45rem;">
              <button data-action="toggle" data-id="${task._id}" class="complete-btn" type="button">${task.completed ? "Undo" : "Done"}</button>
              <button data-action="edit" data-id="${task._id}" class="edit-btn" type="button">Edit</button>
              <button data-action="delete" data-id="${task._id}" class="delete-btn" type="button">Delete</button>
            </div>
          </article>
        `
      )
      .join("");

    return `
      <section class="board-column">
        <h3>${title} (${tasks.length})</h3>
        <div class="board-list">${cards || "<p>No tasks</p>"}</div>
      </section>
    `;
  }

  function renderTimelineView(tasks) {
    const groups = new Map();

    tasks.forEach((task) => {
      const key = task.dueDate ? task.dueDate.slice(0, 10) : "no-date";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(task);
    });

    const sections = [...groups.entries()]
      .sort((a, b) => {
        if (a[0] === "no-date") return 1;
        if (b[0] === "no-date") return -1;
        return new Date(a[0]) - new Date(b[0]);
      })
      .map(
        ([day, tasksForDay]) => `
          <section class="timeline-group">
            <h3>${day === "no-date" ? "No due date" : formatDayKey(day)}</h3>
            <div class="timeline-list">
              ${tasksForDay
                .map(
                  (task) => `
                    <article class="${getTaskClass(task)}" data-id="${task._id}">
                      ${renderTaskInner(task)}
                    </article>
                  `
                )
                .join("")}
            </div>
          </section>
        `
      )
      .join("");

    timelineView.innerHTML = sections || "<p>No tasks for timeline.</p>";
  }

  function renderTaskInner(task) {
    const dueText = task.dueDate ? formatDayKey(task.dueDate) : "No due date";
    const startText = task.startDate ? formatDayKey(task.startDate) : "No start date";
    const hours = Number(task.estimatedTime || 0);

    return `
      <div class="task-main">
        <p class="task-title">${escapeHtml(task.title)}</p>
        <p class="task-desc">${escapeHtml(task.description || "No description")}</p>
        <div class="meta-row">
          <span class="meta-chip">${escapeHtml(task.category || "Other")}</span>
          <span class="meta-chip">${escapeHtml(task.priority || "Medium")}</span>
          <span class="meta-chip">Start: ${escapeHtml(startText)}</span>
          <span class="meta-chip ${isOverdue(task) && !task.completed ? "overdue" : ""}">Due: ${escapeHtml(dueText)}</span>
          <span class="meta-chip">Est: ${hours.toFixed(1)}h</span>
        </div>
      </div>
      <div class="task-actions">
        <button data-action="toggle" data-id="${task._id}" class="complete-btn" type="button">${task.completed ? "Undo" : "Complete"}</button>
        <button data-action="edit" data-id="${task._id}" class="edit-btn" type="button">Edit</button>
        <button data-action="delete" data-id="${task._id}" class="delete-btn" type="button">Delete</button>
      </div>
    `;
  }

  function getTaskClass(task) {
    const classes = ["task-item", `priority-${task.priority || "Medium"}`];
    if (task.completed) classes.push("completed");
    return classes.join(" ");
  }

  function getFilteredTasks() {
    const term = searchInput.value.trim().toLowerCase();
    const status = filterStatus.value;
    const category = filterCategory.value;
    const sort = sortSelect.value;

    let tasks = [...allTasks];

    if (term) {
      tasks = tasks.filter((t) => {
        return [t.title, t.description, t.category]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(term));
      });
    }

    if (status === "pending") tasks = tasks.filter((t) => !t.completed);
    if (status === "completed") tasks = tasks.filter((t) => t.completed);
    if (status === "overdue") tasks = tasks.filter((t) => !t.completed && isOverdue(t));

    if (category !== "all") tasks = tasks.filter((t) => t.category === category);

    if (sort === "created-desc") {
      tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    if (sort === "priority-desc") {
      const order = { High: 3, Medium: 2, Low: 1 };
      tasks.sort((a, b) => (order[b.priority] || 0) - (order[a.priority] || 0));
    }

    if (sort === "due-asc") {
      tasks.sort((a, b) => byDueDate(a, b, true));
    }

    if (sort === "due-desc") {
      tasks.sort((a, b) => byDueDate(a, b, false));
    }

    if (sort === "manual") {
      const order = getManualOrder();
      const rank = new Map(order.map((id, idx) => [id, idx]));
      tasks.sort((a, b) => (rank.get(a._id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b._id) ?? Number.MAX_SAFE_INTEGER));
    }

    return tasks;
  }

  function byDueDate(a, b, asc) {
    const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    return asc ? aDate - bDate : bDate - aDate;
  }

  function renderStats() {
    totalCount.textContent = String(allTasks.length);
    pendingCount.textContent = String(allTasks.filter((t) => !t.completed).length);
    completedCount.textContent = String(allTasks.filter((t) => t.completed).length);
    streakCount.textContent = `${calcStreakDays()}d`;
    workloadCount.textContent = `${calcSevenDayWorkload().toFixed(1)}h`;
  }

  function renderFocus(tasks) {
    const pending = tasks.filter((t) => !t.completed);
    const ranked = pending
      .map((task) => ({ task, score: focusScore(task) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(({ task }) => task);

    focusList.innerHTML = "";

    if (!ranked.length) {
      const li = document.createElement("li");
      li.innerHTML = "<span>No critical tasks right now.</span><span>Ready</span>";
      focusList.appendChild(li);
      return;
    }

    ranked.forEach((task) => {
      const li = document.createElement("li");
      li.innerHTML = `<span>${escapeHtml(task.title)}</span><span>${escapeHtml(task.priority)}</span>`;
      focusList.appendChild(li);
    });
  }

  function focusScore(task) {
    const priorityPoints = { High: 40, Medium: 20, Low: 8 };
    const dueMs = task.dueDate ? new Date(task.dueDate).getTime() : Date.now() + 1000 * 60 * 60 * 24 * 30;
    const daysLeft = (dueMs - Date.now()) / (1000 * 60 * 60 * 24);
    const urgency = Math.max(0, 30 - daysLeft);
    return (priorityPoints[task.priority] || 0) + urgency;
  }

  function calcStreakDays() {
    const completedDates = allTasks
      .filter((t) => t.completed)
      .map((t) => new Date(t.updatedAt || t.createdAt))
      .map((d) => dayStamp(d));

    const unique = new Set(completedDates);
    let streak = 0;
    const cursor = new Date();

    while (unique.has(dayStamp(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    return streak;
  }

  function calcSevenDayWorkload() {
    const now = new Date();
    const inSeven = new Date();
    inSeven.setDate(now.getDate() + 7);

    return allTasks
      .filter((t) => !t.completed)
      .filter((t) => {
        if (!t.dueDate) return false;
        const d = new Date(t.dueDate);
        return d >= now && d <= inSeven;
      })
      .reduce((sum, t) => sum + Number(t.estimatedTime || 0), 0);
  }

  function isOverdue(task) {
    return !!task.dueDate && new Date(task.dueDate) < new Date(new Date().toDateString());
  }

  function formatDayKey(dateLike) {
    const d = new Date(dateLike);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function dayStamp(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  async function handleTaskAction(e) {
    const button = e.target.closest("button[data-action]");
    if (!button) return;

    const id = button.dataset.id;
    const action = button.dataset.action;
    const task = allTasks.find((t) => t._id === id);
    if (!task) return;

    if (action === "edit") {
      openEdit(task);
      return;
    }

    if (action === "toggle") {
      queueUndoableAction({
        message: task.completed ? "Task marked pending." : "Task completed.",
        undoMessage: "Reverted status change.",
        applyLocal: () => {
          task.completed = !task.completed;
          renderTasks();
        },
        undoLocal: () => {
          task.completed = !task.completed;
          renderTasks();
        },
        commit: () => request(`${TASK_API}/${id}`, {
          method: "PUT",
          body: JSON.stringify({ completed: task.completed })
        }).then(loadTasks)
      });
      return;
    }

    if (action === "delete") {
      const snapshot = { ...task };
      queueUndoableAction({
        message: "Task deleted.",
        undoMessage: "Delete undone.",
        applyLocal: () => {
          allTasks = allTasks.filter((t) => t._id !== id);
          renderTasks();
        },
        undoLocal: () => {
          allTasks = [snapshot, ...allTasks.filter((t) => t._id !== id)];
          syncManualOrder();
          renderTasks();
        },
        commit: () => request(`${TASK_API}/${id}`, { method: "DELETE" }).then(loadTasks)
      });
    }
  }

  function openEdit(task) {
    taskIdInput.value = task._id;
    document.getElementById("taskTitle").value = task.title || "";
    document.getElementById("taskDesc").value = task.description || "";
    document.getElementById("taskCategory").value = task.category || "Other";
    document.getElementById("taskPriority").value = task.priority || "Medium";
    document.getElementById("taskStartDate").value = task.startDate ? task.startDate.slice(0, 10) : "";
    document.getElementById("taskDueDate").value = task.dueDate ? task.dueDate.slice(0, 10) : "";
    document.getElementById("taskEstimatedTime").value = String(Number(task.estimatedTime || 0));

    modalTitle.textContent = "Edit Task";
    openModal();
  }

  function queueUndoableAction({ message, undoMessage, applyLocal, undoLocal, commit }) {
    clearUndo();
    applyLocal();

    undoState.undo = () => {
      clearTimeout(undoState.timer);
      undoLocal();
      showToast(undoMessage);
      clearUndo();
    };

    undoState.commit = commit;

    showToast(message, true);

    undoState.timer = setTimeout(async () => {
      try {
        await undoState.commit?.();
      } catch (err) {
        showToast(`Sync failed: ${err.message}`);
      } finally {
        clearUndo();
      }
    }, 4200);
  }

  function clearUndo() {
    if (undoState.timer) clearTimeout(undoState.timer);
    undoState.timer = null;
    undoState.undo = null;
    undoState.commit = null;
  }

  function showToast(message, withUndo = false) {
    toast.classList.add("active");
    toast.innerHTML = `
      <div class="toast-content">
        <span>${escapeHtml(message)}</span>
        ${withUndo ? '<button id="undoBtn" type="button">Undo</button>' : '<button id="dismissToast" type="button">Dismiss</button>'}
      </div>
    `;

    const undoBtn = document.getElementById("undoBtn");
    undoBtn?.addEventListener("click", () => {
      undoState.undo?.();
      toast.classList.remove("active");
    });

    const dismissBtn = document.getElementById("dismissToast");
    dismissBtn?.addEventListener("click", () => {
      toast.classList.remove("active");
    });

    if (!withUndo) {
      setTimeout(() => toast.classList.remove("active"), 2200);
    }
  }

  function renderSkeleton() {
    loadingSkeleton.innerHTML = "";
    for (let i = 0; i < 4; i += 1) {
      const item = document.createElement("div");
      item.className = "skeleton";
      loadingSkeleton.appendChild(item);
    }
  }

  function getManualOrder() {
    try {
      return JSON.parse(localStorage.getItem("manualTaskOrder") || "[]");
    } catch {
      return [];
    }
  }

  function syncManualOrder() {
    const current = getManualOrder();
    const ids = new Set(allTasks.map((t) => t._id));
    const cleaned = current.filter((id) => ids.has(id));

    allTasks.forEach((t) => {
      if (!cleaned.includes(t._id)) cleaned.push(t._id);
    });

    localStorage.setItem("manualTaskOrder", JSON.stringify(cleaned));
  }

  function onDragStart(e) {
    const item = e.target.closest("li[data-id]");
    if (!item || sortSelect.value !== "manual") return;
    e.dataTransfer.setData("text/plain", item.dataset.id);
  }

  function onDragOver(e) {
    if (sortSelect.value !== "manual") return;
    e.preventDefault();
  }

  function onDrop(e) {
    if (sortSelect.value !== "manual") return;
    e.preventDefault();

    const draggedId = e.dataTransfer.getData("text/plain");
    const target = e.target.closest("li[data-id]");
    if (!draggedId || !target || draggedId === target.dataset.id) return;

    const order = getManualOrder();
    const from = order.indexOf(draggedId);
    const to = order.indexOf(target.dataset.id);
    if (from < 0 || to < 0) return;

    order.splice(from, 1);
    order.splice(to, 0, draggedId);
    localStorage.setItem("manualTaskOrder", JSON.stringify(order));
    renderTasks();
  }
});

