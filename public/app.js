const token = localStorage.getItem('token') || '';
const user = JSON.parse(localStorage.getItem('user') || 'null');

const API = async (url, method='GET', body) => {
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  return res.json();
};

const guard = (roles=[]) => {
  if (!token || !user) location.href = '/login';
  if (roles.length && !roles.includes(user.role)) location.href = `/${user.role}`;
};

const setHeader = () => {
  const el = document.getElementById('whoami');
  if (el && user) el.textContent = `${user.name} (${user.role})`;
};

const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  location.href = '/login';
};

const fillProfile = async () => {
  const r = await API('/api/me');
  if (!r.ok) return;
  document.getElementById('profileName').textContent = r.data.user.name;
  document.getElementById('profileEmail').textContent = r.data.user.email;
  document.getElementById('doneTasks').innerHTML = r.data.tasks.done.map(t => `<li>${t.title} <span class='tag done'>done</span></li>`).join('') || '<li>No done tasks</li>';
  document.getElementById('pendingTasks').innerHTML = r.data.tasks.pending.map(t => `<li>${t.title} <span class='tag pending'>${t.status}</span></li>`).join('') || '<li>No pending tasks</li>';
};
