// tasks.js
function getToken() {
  return localStorage.getItem('token');
}

const TASK_API = 'http://localhost:5000/api/tasks';
let allTasks = [];

// Wait for DOM
document.addEventListener('DOMContentLoaded', () => {

  // DOM elements
  const taskList       = document.getElementById('taskList');
  const addTaskBtn     = document.getElementById('addTaskBtn');
  const taskModal      = document.getElementById('taskModal');
  const closeModal     = document.querySelector('.close');
  const taskForm       = document.getElementById('taskForm');
  const modalTitle     = document.getElementById('modalTitle');
  const taskIdInput    = document.getElementById('taskId');
  const searchInput    = document.getElementById('searchInput');
  const filterStatus   = document.getElementById('filterStatus');
  const filterCategory = document.getElementById('filterCategory');
  const sortSelect     = document.getElementById('sortSelect');

  const totalCount     = document.getElementById('totalCount');
  const pendingCount   = document.getElementById('pendingCount');
  const completedCount = document.getElementById('completedCount');

  // Guard
  if (!addTaskBtn || !taskModal || !taskForm) {
    console.error('Dashboard DOM not loaded properly');
    return;
  }

  // Dark mode
  const toggleDark = document.getElementById('toggleDark');
  if (localStorage.getItem('darkMode') === 'enabled') {
    document.body.classList.add('dark');
    toggleDark.textContent = 'Light Mode';
  }

  toggleDark?.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    toggleDark.textContent = isDark ? 'Light Mode' : 'Dark Mode';
    localStorage.setItem('darkMode', isDark ? 'enabled' : 'disabled');
  });

  // Modal open
  addTaskBtn.addEventListener('click', () => {
    resetForm();
    taskModal.style.display = 'block';
  });

  // Modal close
  closeModal?.addEventListener('click', () => {
    taskModal.style.display = 'none';
  });

  window.addEventListener('click', e => {
    if (e.target === taskModal) taskModal.style.display = 'none';
  });

  // Form submit
  taskForm.addEventListener('submit', async e => {
    e.preventDefault();

    const token = getToken();
    if (!token) {
      alert('Session expired. Please login again.');
      location.reload();
      return;
    }

    const id          = taskIdInput.value;
    const title       = document.getElementById('taskTitle').value;
    const description = document.getElementById('taskDesc').value;
    const category    = document.getElementById('taskCategory').value;
    const priority    = document.getElementById('taskPriority').value;
    const dueDate     = document.getElementById('taskDueDate').value || null;

    const taskData = { title, description, category, priority, dueDate };

    try {
      const method = id ? 'PUT' : 'POST';
      const url    = id ? `${TASK_API}/${id}` : TASK_API;

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(taskData)
      });

      if (!res.ok) throw new Error('Failed to save task');

      taskModal.style.display = 'none';
      loadTasks();

    } catch (err) {
      alert(err.message);
    }
  });

  function resetForm() {
    taskForm.reset();
    taskIdInput.value = '';
    modalTitle.textContent = 'New Task';
  }

  // Load tasks
  async function loadTasks() {
    const token = getToken();
    if (!token) return;

    try {
      const res = await fetch(TASK_API, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.status === 401) {
        localStorage.removeItem('token');
        location.reload();
        return;
      }

      if (!res.ok) throw new Error('Failed to load tasks');

      allTasks = await res.json();
      renderTasks();

    } catch (err) {
      console.error(err);
    }
  }

  function renderTasks() {
    let tasks = [...allTasks];

    const term = searchInput.value.toLowerCase();
    if (term) tasks = tasks.filter(t => t.title.toLowerCase().includes(term));

    const status = filterStatus.value;
    if (status === 'pending')   tasks = tasks.filter(t => !t.completed);
    if (status === 'completed') tasks = tasks.filter(t => t.completed);

    const cat = filterCategory.value;
    if (cat !== 'all') tasks = tasks.filter(t => t.category === cat);

    const sort = sortSelect.value;
    if (sort === 'created-desc') {
      tasks.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sort === 'priority-desc') {
      const prioOrder = { High: 3, Medium: 2, Low: 1 };
      tasks.sort((a,b) => prioOrder[b.priority] - prioOrder[a.priority]);
    }

    totalCount.textContent     = allTasks.length;
    pendingCount.textContent   = allTasks.filter(t => !t.completed).length;
    completedCount.textContent = allTasks.filter(t => t.completed).length;

    taskList.innerHTML = '';

    tasks.forEach(task => {
      const li = document.createElement('li');

      li.innerHTML = `
        <div>
          <strong>${task.title}</strong>
          <p>${task.description || ''}</p>
        </div>
        <div class="task-actions">
          <button onclick="toggleComplete('${task._id}', ${!task.completed})">
            ${task.completed ? 'Undo' : 'Complete'}
          </button>
          <button onclick="editTask('${task._id}')">Edit</button>
          <button onclick="deleteTask('${task._id}')">Delete</button>
        </div>
      `;

      taskList.appendChild(li);
    });
  }

  // Global functions
  window.toggleComplete = async (id, completed) => {
    const token = getToken();
    await fetch(`${TASK_API}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ completed })
    });
    loadTasks();
  };

  window.editTask = id => {
    const task = allTasks.find(t => t._id === id);
    if (!task) return;

    taskIdInput.value = task._id;
    document.getElementById('taskTitle').value = task.title;
    document.getElementById('taskDesc').value = task.description || '';
    document.getElementById('taskCategory').value = task.category;
    document.getElementById('taskPriority').value = task.priority;
    document.getElementById('taskDueDate').value = task.dueDate ? task.dueDate.slice(0,10) : '';

    modalTitle.textContent = 'Edit Task';
    taskModal.style.display = 'block';
  };

  window.deleteTask = async id => {
    const token = getToken();
    if (!confirm('Delete this task?')) return;
    await fetch(`${TASK_API}/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    loadTasks();
  };

  // Live filters
  searchInput.oninput = renderTasks;
  filterStatus.onchange = renderTasks;
  filterCategory.onchange = renderTasks;
  sortSelect.onchange = renderTasks;

  // Initial load
  loadTasks();

});
