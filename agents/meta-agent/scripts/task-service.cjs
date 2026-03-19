#!/usr/bin/env node

/**
 * Meta Agent Task Service
 *
 * JSONL-based task queue management for the Meta Agent.
 * Follows LAVS handler conventions (stdin JSON → stdout JSON).
 *
 * Usage:
 *   echo '{"title":"做PPT"}' | node task-service.cjs submit
 *   echo '{}' | node task-service.cjs list
 *   echo '{"id":"tq_xxx"}' | node task-service.cjs get
 *   echo '{"id":"tq_xxx","updates":{"status":"done"}}' | node task-service.cjs update
 *   echo '{"id":"tq_xxx","reason":"不需要了"}' | node task-service.cjs cancel
 *   echo '{}' | node task-service.cjs archive
 *   echo '{"minutes":30}' | node task-service.cjs check-due
 *   echo '{}' | node task-service.cjs stats
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ============================================================================
// Data Paths
// ============================================================================

function getDataDir() {
  const projectPath = process.env.LAVS_PROJECT_PATH;
  if (projectPath) {
    return path.join(projectPath, 'data');
  }
  return path.join(__dirname, '../data');
}

function getActiveFile() {
  return path.join(getDataDir(), 'tasks-active.jsonl');
}

function getArchivedFile() {
  return path.join(getDataDir(), 'tasks-archived.jsonl');
}

function ensureDataDir() {
  const dir = getDataDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

console.error(`[TaskService] LAVS_PROJECT_PATH: ${process.env.LAVS_PROJECT_PATH || '(not set)'}`);
console.error(`[TaskService] Data directory: ${getDataDir()}`);

// ============================================================================
// JSONL Read / Write
// ============================================================================

function loadJsonl(filePath) {
  const items = [];
  if (!fs.existsSync(filePath)) return items;
  const content = fs.readFileSync(filePath, 'utf-8');
  for (const line of content.split('\n')) {
    if (!line.trim()) continue;
    try {
      items.push(JSON.parse(line));
    } catch (e) {
      console.error(`[TaskService] Skipping malformed line: ${line.slice(0, 80)}`);
    }
  }
  return items;
}

function saveJsonl(filePath, items) {
  ensureDataDir();
  const content = items.map(t => JSON.stringify(t)).join('\n') + (items.length > 0 ? '\n' : '');
  fs.writeFileSync(filePath, content, 'utf-8');
}

function appendJsonl(filePath, item) {
  ensureDataDir();
  fs.appendFileSync(filePath, JSON.stringify(item) + '\n', 'utf-8');
}

// ============================================================================
// ID Generation
// ============================================================================

function generateTaskId() {
  return `tq_${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
}

// ============================================================================
// Priority Sorting
// ============================================================================

const PRIORITY_ORDER = { urgent: 0, high: 1, normal: 2, low: 3 };

function sortTasks(tasks) {
  return tasks.sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 2;
    const pb = PRIORITY_ORDER[b.priority] ?? 2;
    if (pa !== pb) return pa - pb;
    if (a.dueAt && b.dueAt) return a.dueAt.localeCompare(b.dueAt);
    if (a.dueAt) return -1;
    if (b.dueAt) return 1;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

// ============================================================================
// Stdin Reader
// ============================================================================

async function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => {
      try {
        resolve(data.trim() ? JSON.parse(data) : {});
      } catch (err) {
        reject(new Error(`Invalid JSON input: ${err.message}`));
      }
    });
    process.stdin.on('error', reject);
  });
}

// ============================================================================
// Actions
// ============================================================================

async function listTasks(input) {
  let tasks = loadJsonl(getActiveFile());

  if (input.includeArchive) {
    tasks = [...tasks, ...loadJsonl(getArchivedFile())];
  }
  if (input.status) {
    tasks = tasks.filter(t => t.status === input.status);
  }
  if (input.priority) {
    tasks = tasks.filter(t => t.priority === input.priority);
  }

  console.log(JSON.stringify(sortTasks(tasks), null, 2));
}

async function submitTask(input) {
  if (!input.title) {
    throw new Error('Missing required field: title');
  }

  const now = new Date().toISOString();
  const task = {
    id: generateTaskId(),
    title: input.title,
    description: input.description || '',
    createdAt: now,
    updatedAt: now,
    status: 'pending',
    priority: input.priority || 'normal',
    progress: 0,
    progressLog: [{ timestamp: now, message: 'Task created', actor: 'system' }],
    source: {
      type: input.sourceType || 'user',
      name: input.sourceName || undefined,
    },
    assignee: { agentId: 'meta-agent' },
    tags: input.tags || [],
    relatedTaskIds: [],
  };

  if (input.startAt) task.startAt = input.startAt;
  if (input.dueAt) task.dueAt = input.dueAt;
  if (input.context) task.context = input.context;

  appendJsonl(getActiveFile(), task);
  console.log(JSON.stringify(task, null, 2));
}

async function getTask(input) {
  if (!input.id) throw new Error('Missing required field: id');

  const tasks = loadJsonl(getActiveFile());
  let task = tasks.find(t => t.id === input.id);

  if (!task) {
    const archived = loadJsonl(getArchivedFile());
    task = archived.find(t => t.id === input.id);
  }

  if (!task) {
    console.log(JSON.stringify({ error: 'Task not found', id: input.id }));
    return;
  }

  console.log(JSON.stringify(task, null, 2));
}

async function updateTask(input) {
  if (!input.id) throw new Error('Missing required field: id');

  const tasks = loadJsonl(getActiveFile());
  const idx = tasks.findIndex(t => t.id === input.id);
  if (idx === -1) throw new Error(`Task not found: ${input.id}`);

  const task = tasks[idx];
  const updates = input.updates || {};
  const now = new Date().toISOString();

  const allowedFields = [
    'title', 'description', 'status', 'priority', 'progress',
    'result', 'blockedReason', 'dueAt', 'startAt', 'tags',
    'delegatedTo', 'assignee',
  ];

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      task[field] = updates[field];
    }
  }

  if (updates.status === 'done' && !task.completedAt) {
    task.completedAt = now;
  }

  if (input.progressLog) {
    if (!task.progressLog) task.progressLog = [];
    task.progressLog.push({ timestamp: now, message: input.progressLog, actor: 'system' });
  }

  task.updatedAt = now;
  tasks[idx] = task;
  saveJsonl(getActiveFile(), tasks);

  console.log(JSON.stringify(task, null, 2));
}

async function cancelTask(input) {
  if (!input.id) throw new Error('Missing required field: id');

  const tasks = loadJsonl(getActiveFile());
  const idx = tasks.findIndex(t => t.id === input.id);
  if (idx === -1) throw new Error(`Task not found: ${input.id}`);

  const now = new Date().toISOString();
  const task = tasks[idx];
  const reason = input.reason || 'Cancelled by user';

  task.status = 'cancelled';
  task.completedAt = now;
  task.updatedAt = now;
  if (!task.progressLog) task.progressLog = [];
  task.progressLog.push({ timestamp: now, message: `Cancelled: ${reason}`, actor: 'system' });

  tasks[idx] = task;
  saveJsonl(getActiveFile(), tasks);

  console.log(JSON.stringify(task, null, 2));
}

async function archiveTasks() {
  const tasks = loadJsonl(getActiveFile());
  const toArchive = tasks.filter(t => t.status === 'done' || t.status === 'cancelled');
  const remaining = tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled');

  if (toArchive.length === 0) {
    console.log(JSON.stringify({ archivedCount: 0, remaining: remaining.length }));
    return;
  }

  for (const task of toArchive) {
    task.archivedAt = new Date().toISOString();
    appendJsonl(getArchivedFile(), task);
  }

  saveJsonl(getActiveFile(), remaining);
  console.log(JSON.stringify({ archivedCount: toArchive.length, remaining: remaining.length }));
}

async function checkDue(input) {
  const minutes = input.minutes || 30;
  const now = new Date();
  const threshold = new Date(now.getTime() + minutes * 60 * 1000);
  const tasks = loadJsonl(getActiveFile());

  const result = { overdue: [], dueSoon: [] };

  for (const task of tasks) {
    if (!task.dueAt || task.status === 'done' || task.status === 'cancelled') continue;

    const due = new Date(task.dueAt);
    if (due < now) {
      result.overdue.push({
        ...task,
        overdueBy: Math.round((now - due) / (1000 * 60)) + ' minutes',
      });
    } else if (due <= threshold) {
      result.dueSoon.push({
        ...task,
        dueIn: Math.round((due - now) / (1000 * 60)) + ' minutes',
      });
    }
  }

  result.overdue.sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
  result.dueSoon.sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));

  console.log(JSON.stringify(result, null, 2));
}

async function getStats() {
  const tasks = loadJsonl(getActiveFile());
  const archived = loadJsonl(getArchivedFile());
  const now = new Date();

  const overdue = tasks.filter(t => {
    if (!t.dueAt || t.status === 'done' || t.status === 'cancelled') return false;
    return new Date(t.dueAt) < now;
  });

  const stats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    delegated: tasks.filter(t => t.status === 'delegated').length,
    waiting_human: tasks.filter(t => t.status === 'waiting_human').length,
    blocked: tasks.filter(t => t.status === 'blocked').length,
    done: tasks.filter(t => t.status === 'done').length,
    cancelled: tasks.filter(t => t.status === 'cancelled').length,
    overdue: overdue.length,
    urgent: tasks.filter(t => t.priority === 'urgent').length,
    archived_total: archived.length,
  };

  console.log(JSON.stringify(stats, null, 2));
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const action = process.argv[2];
  if (!action) {
    console.error('Usage: node task-service.cjs <action>');
    console.error('Actions: list, submit, get, update, cancel, archive, check-due, stats');
    process.exit(1);
  }

  try {
    const input = await readStdin();

    switch (action) {
      case 'list':      await listTasks(input); break;
      case 'submit':    await submitTask(input); break;
      case 'get':       await getTask(input); break;
      case 'update':    await updateTask(input); break;
      case 'cancel':    await cancelTask(input); break;
      case 'archive':   await archiveTasks(); break;
      case 'check-due': await checkDue(input); break;
      case 'stats':     await getStats(); break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();
