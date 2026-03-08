const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');
const loadEnv = () => {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf-8').split(/\r?\n/);
  lines.forEach((line) => {
    if (!line || line.trim().startsWith('#') || !line.includes('=')) return;
    const idx = line.indexOf('=');
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  });
};

loadEnv();

const PORT = Number(process.env.PORT || 3000);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME = process.env.DB_NAME || 'ai_business_os';
const PUBLIC_DIR = path.join(__dirname, 'public');

const data = {
  users: [],
  organizations: [],
  products: [],
  transactions: [],
  tasks: [],
  visitors: [],
  chats: [],
  sessions: new Map()
};


const json = (res, status, payload) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
};

const parseBody = (req) => new Promise((resolve, reject) => {
  let raw = '';
  req.on('data', (chunk) => {
    raw += chunk;
    if (raw.length > 2e6) {
      reject(new Error('Payload too large'));
      req.destroy();
    }
  });
  req.on('end', () => {
    if (!raw) return resolve({});
    try {
      resolve(JSON.parse(raw));
    } catch {
      reject(new Error('Invalid JSON body'));
    }
  });
  req.on('error', reject);
});

const safeDate = (value) => {
  const date = new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const seed = () => {
  if (data.users.length) return;
  const orgId = 'org_demo';
  data.organizations.push({ id: orgId, name: 'Usta Group', plan: 'enterprise', createdAt: new Date().toISOString() });

  data.users.push(
    { id: 'u_admin', orgId, email: 'admin@demo.uz', password: 'admin123', role: 'admin', name: 'Admin User' },
    { id: 'u_manager', orgId, email: 'manager@demo.uz', password: 'manager123', role: 'manager', name: 'Manager User' },
    { id: 'u_worker', orgId, email: 'worker@demo.uz', password: 'worker123', role: 'worker', name: 'Worker User' },
    { id: 'u_customer', orgId, email: 'customer@demo.uz', password: 'customer123', role: 'customer', name: 'Customer User' }
  );

  data.products.push(
    { id: 'p_1', orgId, name: 'CRM Pro', price: 1200, cost: 500, category: 'software' },
    { id: 'p_2', orgId, name: 'Analytics AI', price: 900, cost: 300, category: 'ai' },
    { id: 'p_3', orgId, name: 'Support Suite', price: 700, cost: 280, category: 'service' }
  );

  data.transactions.push(
    { id: 'tr_1', orgId, productId: 'p_1', type: 'income', amount: 2400, createdAt: new Date(Date.now() - 86400000).toISOString(), createdBy: 'u_manager' },
    { id: 'tr_2', orgId, productId: 'p_1', type: 'expense', amount: 900, createdAt: new Date(Date.now() - 80000000).toISOString(), createdBy: 'u_manager' },
    { id: 'tr_3', orgId, productId: 'p_2', type: 'income', amount: 1800, createdAt: new Date(Date.now() - 50000000).toISOString(), createdBy: 'u_admin' },
    { id: 'tr_4', orgId, productId: 'p_3', type: 'expense', amount: 400, createdAt: new Date(Date.now() - 30000000).toISOString(), createdBy: 'u_admin' }
  );

  data.tasks.push(
    { id: 'tsk_1', orgId, title: 'Client onboarding', assignee: 'u_worker', createdBy: 'u_manager', status: 'done', dueDate: new Date().toISOString() },
    { id: 'tsk_2', orgId, title: 'Monthly report', assignee: 'u_worker', createdBy: 'u_manager', status: 'in_progress', dueDate: new Date().toISOString() },
    { id: 'tsk_3', orgId, title: 'Campaign setup', assignee: 'u_worker', createdBy: 'u_manager', status: 'todo', dueDate: new Date().toISOString() }
  );
};

const auth = (req) => {
  const token = req.headers.authorization?.replace('Bearer ', '') || '';
  if (!token) return null;
  const session = data.sessions.get(token);
  if (!session) return null;
  const user = data.users.find((u) => u.id === session.userId);
  if (!user) return null;
  return { token, user };
};

const allowRoles = (ctx, roles) => roles.includes(ctx.user.role);

const getPeriodStart = (period) => {
  const now = new Date();
  if (period === 'daily') return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'weekly') {
    const day = now.getDay() || 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - day + 1);
    monday.setHours(0, 0, 0, 0);
    return monday;
  }
  if (period === 'monthly') return new Date(now.getFullYear(), now.getMonth(), 1);
  return new Date(now.getFullYear(), 0, 1);
};

const financialStats = (orgId, period = 'yearly') => {
  const start = getPeriodStart(period);
  const tx = data.transactions.filter((t) => t.orgId === orgId && safeDate(t.createdAt) >= start);
  const income = tx.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const expense = tx.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const netProfit = income - expense;

  const byProduct = data.products
    .filter((p) => p.orgId === orgId)
    .map((p) => {
      const pTx = tx.filter((t) => t.productId === p.id);
      const pIncome = pTx.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
      const pExpense = pTx.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
      return {
        productId: p.id,
        name: p.name,
        income: pIncome,
        expense: pExpense,
        netProfit: pIncome - pExpense
      };
    });

  return { period, income, expense, netProfit, byProduct };
};

const serveFile = (res, filePath) => {
  fs.readFile(filePath, (err, dataBuf) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    const contentTypes = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8'
    };
    res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain; charset=utf-8' });
    res.end(dataBuf);
  });
};

const routeStatic = (pathname, res) => {
  const pageMap = {
    '/': 'index.html',
    '/login': 'index.html',
    '/admin': 'admin.html',
    '/manager': 'manager.html',
    '/worker': 'worker.html',
    '/customer': 'customer.html',
    '/profile': 'profile.html',
    '/chat': 'chat.html',
    '/analytics': 'analytics.html'
  };
  const selected = pageMap[pathname] || pathname.slice(1);
  const full = path.join(PUBLIC_DIR, selected);
  if (!full.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  serveFile(res, full);
};

const apiHandlers = {
  async login(req, res) {
    const body = await parseBody(req);
    const user = data.users.find((u) => u.email === body.email && u.password === body.password);
    if (!user) return json(res, 401, { ok: false, error: 'Login yoki parol xato' });
    const token = crypto.randomUUID();
    data.sessions.set(token, { userId: user.id, at: Date.now() });
    return json(res, 200, { ok: true, token, user: { id: user.id, role: user.role, name: user.name, email: user.email } });
  },

  async registerVisitor(req, res, ctx) {
    const body = await parseBody(req);
    const visitor = {
      id: `v_${crypto.randomUUID().slice(0, 8)}`,
      orgId: ctx.user.orgId,
      name: body.name || 'Guest',
      source: body.source || 'direct',
      page: body.page || 'unknown',
      at: new Date().toISOString()
    };
    data.visitors.unshift(visitor);
    return json(res, 201, { ok: true, data: visitor });
  },

  async me(req, res, ctx) {
    const myTasks = data.tasks.filter((t) => t.orgId === ctx.user.orgId && (ctx.user.role === 'worker' ? t.assignee === ctx.user.id : true));
    return json(res, 200, {
      ok: true,
      data: {
        user: ctx.user,
        tasks: {
          done: myTasks.filter((t) => t.status === 'done'),
          pending: myTasks.filter((t) => t.status !== 'done')
        }
      }
    });
  },

  async tasks(req, res, ctx) {
    if (req.method === 'GET') {
      const items = data.tasks.filter((t) => t.orgId === ctx.user.orgId && (ctx.user.role === 'worker' ? t.assignee === ctx.user.id : true));
      return json(res, 200, { ok: true, data: items });
    }
    if (!allowRoles(ctx, ['admin', 'manager'])) return json(res, 403, { ok: false, error: 'Role ruxsati yo‘q' });
    const body = await parseBody(req);
    const task = {
      id: `tsk_${crypto.randomUUID().slice(0, 8)}`,
      orgId: ctx.user.orgId,
      title: body.title,
      assignee: body.assignee,
      createdBy: ctx.user.id,
      status: body.status || 'todo',
      dueDate: body.dueDate || null,
      createdAt: new Date().toISOString()
    };
    data.tasks.unshift(task);
    return json(res, 201, { ok: true, data: task });
  },

  async updateTask(req, res, ctx, taskId) {
    const task = data.tasks.find((t) => t.id === taskId && t.orgId === ctx.user.orgId);
    if (!task) return json(res, 404, { ok: false, error: 'Task topilmadi' });
    if (!allowRoles(ctx, ['admin', 'manager']) && task.assignee !== ctx.user.id) {
      return json(res, 403, { ok: false, error: 'Ruxsat yo‘q' });
    }
    const body = await parseBody(req);
    task.status = body.status || task.status;
    task.dueDate = body.dueDate || task.dueDate;
    return json(res, 200, { ok: true, data: task });
  },

  async products(req, res, ctx) {
    if (req.method === 'GET') return json(res, 200, { ok: true, data: data.products.filter((p) => p.orgId === ctx.user.orgId) });
    if (!allowRoles(ctx, ['admin', 'manager'])) return json(res, 403, { ok: false, error: 'Role ruxsati yo‘q' });
    const body = await parseBody(req);
    const product = {
      id: `p_${crypto.randomUUID().slice(0, 8)}`,
      orgId: ctx.user.orgId,
      name: body.name,
      price: Number(body.price || 0),
      cost: Number(body.cost || 0),
      category: body.category || 'general'
    };
    data.products.unshift(product);
    return json(res, 201, { ok: true, data: product });
  },

  async transactions(req, res, ctx) {
    if (req.method === 'GET') return json(res, 200, { ok: true, data: data.transactions.filter((t) => t.orgId === ctx.user.orgId) });
    if (!allowRoles(ctx, ['admin', 'manager'])) return json(res, 403, { ok: false, error: 'Role ruxsati yo‘q' });
    const body = await parseBody(req);
    const tx = {
      id: `tr_${crypto.randomUUID().slice(0, 8)}`,
      orgId: ctx.user.orgId,
      productId: body.productId,
      type: body.type,
      amount: Number(body.amount || 0),
      note: body.note || '',
      createdBy: ctx.user.id,
      createdAt: new Date().toISOString()
    };
    data.transactions.unshift(tx);
    return json(res, 201, { ok: true, data: tx });
  },

  async finance(req, res, ctx, query) {
    const period = query.get('period') || 'yearly';
    return json(res, 200, { ok: true, data: financialStats(ctx.user.orgId, period) });
  },

  async visitors(req, res, ctx) {
    const rows = data.visitors.filter((v) => v.orgId === ctx.user.orgId).slice(0, 100);
    return json(res, 200, { ok: true, data: rows });
  },

  async dashboard(req, res, ctx) {
    const orgId = ctx.user.orgId;
    const tasks = data.tasks.filter((t) => t.orgId === orgId);
    const visitors = data.visitors.filter((v) => v.orgId === orgId);
    return json(res, 200, {
      ok: true,
      data: {
        role: ctx.user.role,
        stats: {
          tasksDone: tasks.filter((t) => t.status === 'done').length,
          tasksPending: tasks.filter((t) => t.status !== 'done').length,
          visitors: visitors.length,
          weekly: financialStats(orgId, 'weekly'),
          monthly: financialStats(orgId, 'monthly'),
          yearly: financialStats(orgId, 'yearly')
        }
      }
    });
  },

  async chatbot(req, res, ctx) {
    const body = await parseBody(req);
    const message = body.message || '';
    const finance = financialStats(ctx.user.orgId, 'monthly');
    const fallback = `Salom ${ctx.user.name}. Hozirgi oy daromad: $${finance.income}, xarajat: $${finance.expense}, sof foyda: $${finance.netProfit}. Savolingiz: ${message}`;

    if (!OPENAI_API_KEY) {
      data.chats.unshift({ id: `ch_${crypto.randomUUID().slice(0, 8)}`, orgId: ctx.user.orgId, userId: ctx.user.id, message, answer: fallback, at: new Date().toISOString() });
      return json(res, 200, { ok: true, source: 'fallback', answer: fallback });
    }

    const payload = {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a business operations assistant. Reply in Uzbek.' },
        { role: 'user', content: `Context: ${JSON.stringify(finance)}. User message: ${message}` }
      ]
    };

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: JSON.stringify(payload)
      });
      const out = await response.json();
      const answer = out?.choices?.[0]?.message?.content || fallback;
      data.chats.unshift({ id: `ch_${crypto.randomUUID().slice(0, 8)}`, orgId: ctx.user.orgId, userId: ctx.user.id, message, answer, at: new Date().toISOString() });
      return json(res, 200, { ok: true, source: 'openai', answer });
    } catch {
      return json(res, 200, { ok: true, source: 'fallback_error', answer: fallback });
    }
  }
};

const withAuth = (req, res) => {
  const ctx = auth(req);
  if (!ctx) {
    json(res, 401, { ok: false, error: 'Unauthorized' });
    return null;
  }
  return ctx;
};

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  const pathname = urlObj.pathname;

  try {
    if (!pathname.startsWith('/api/')) return routeStatic(pathname, res);

    if (pathname === '/api/auth/login' && req.method === 'POST') return apiHandlers.login(req, res);

    const ctx = withAuth(req, res);
    if (!ctx) return;

    if (pathname === '/api/me' && req.method === 'GET') return apiHandlers.me(req, res, ctx);
    if (pathname === '/api/dashboard' && req.method === 'GET') return apiHandlers.dashboard(req, res, ctx);
    if (pathname === '/api/visitors' && req.method === 'GET') return apiHandlers.visitors(req, res, ctx);
    if (pathname === '/api/visitors' && req.method === 'POST') return apiHandlers.registerVisitor(req, res, ctx);
    if (pathname === '/api/tasks' && (req.method === 'GET' || req.method === 'POST')) return apiHandlers.tasks(req, res, ctx);
    if (pathname.startsWith('/api/tasks/') && req.method === 'PATCH') return apiHandlers.updateTask(req, res, ctx, pathname.split('/').pop());
    if (pathname === '/api/products' && (req.method === 'GET' || req.method === 'POST')) return apiHandlers.products(req, res, ctx);
    if (pathname === '/api/transactions' && (req.method === 'GET' || req.method === 'POST')) return apiHandlers.transactions(req, res, ctx);
    if (pathname === '/api/finance' && req.method === 'GET') return apiHandlers.finance(req, res, ctx, urlObj.searchParams);
    if (pathname === '/api/chatbot' && req.method === 'POST') return apiHandlers.chatbot(req, res, ctx);

    return json(res, 404, { ok: false, error: 'Endpoint topilmadi' });
  } catch (e) {
    return json(res, 500, { ok: false, error: e.message || 'Server error' });
  }
});

seed();

server.listen(PORT, () => {
  console.log(`Server running http://localhost:${PORT}`);
  console.log('MongoDB URI configured:', MONGODB_URI, 'DB:', DB_NAME);
  console.log('Demo users: admin/manager/worker/customer @demo.uz');
});
