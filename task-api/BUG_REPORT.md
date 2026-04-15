# Bug Report — Task Manager API

Bugs discovered through code review and test-driven exploration of `task-api/src/`.

---

## Bug 1 — `getByStatus` matches partial substrings instead of exact values

**File:** `src/services/taskService.js`, line 9

**Expected behavior:**  
`getByStatus('todo')` should return only tasks with `status === 'todo'`.

**Actual behavior:**  
Uses `String.prototype.includes()`, so any substring of a status value matches.  
e.g. `getByStatus('do')` returns both `'todo'` and `'done'` tasks.

**How it was discovered:**  
Code review of `taskService.js`. Confirmed by writing a test:

```js
taskService.create({ title: 'Task 1', status: 'todo' });
taskService.create({ title: 'Task 2', status: 'done' });
const result = taskService.getByStatus('do'); // returned 2 tasks — expected 0
```

**Root cause:**
```js
// Buggy
const getByStatus = (status) => tasks.filter((t) => t.status.includes(status));
```

**Fix applied:**
```js
// Fixed
const getByStatus = (status) => tasks.filter((t) => t.status === status);
```

---

## Bug 2 — `completeTask` silently overwrites task priority with `'medium'`

**File:** `src/services/taskService.js`, lines 67–71

**Expected behavior:**  
`PATCH /tasks/:id/complete` should only set `status` to `'done'` and record `completedAt`. The task's original `priority` should be preserved.

**Actual behavior:**  
The spread object hardcodes `priority: 'medium'`, silently overwriting whatever priority the task had.

**How it was discovered:**  
Code review of `completeTask`. Confirmed by test:

```js
const task = taskService.create({ title: 'High priority task', priority: 'high' });
const completed = taskService.completeTask(task.id);
// completed.priority === 'medium'  ← expected 'high'
```

**Root cause:**
```js
// Buggy
const updated = {
  ...task,
  priority: 'medium',   // ← unintentional hardcode
  status: 'done',
  completedAt: new Date().toISOString(),
};
```

**Fix applied:**  
Removed the `priority: 'medium'` line entirely. The spread `...task` already carries the original priority.

```js
// Fixed
const updated = {
  ...task,
  status: 'done',
  completedAt: new Date().toISOString(),
};
```

---

## Bug 3 — `getPaginated` uses 0-based offset but API defaults to `page=1`

**File:** `src/services/taskService.js`, line 12  
**Related:** `src/routes/tasks.js`, line 20

**Expected behavior:**  
`GET /tasks?page=1&limit=5` should return the first 5 tasks (items 0–4).

**Actual behavior:**  
Offset is calculated as `page * limit`. With `page=1` and `limit=5`, `offset = 5`, so the first 5 tasks are skipped entirely. Users always see the wrong page.

**How it was discovered:**  
Noticed the route handler defaults to `parseInt(page) || 1`, meaning `page=1` is the minimum callers will ever send. Traced through to `getPaginated(1, 10)` → `offset = 10`, skipping the entire first page.

**Root cause:**
```js
// Buggy — 0-based internally but API is 1-based
const offset = page * limit;
```

**Fix applied:**
```js
// Fixed — converts 1-based page to 0-based offset
const offset = (page - 1) * limit;
```

---

## Summary

| # | Location | Severity | Fixed? |
|---|----------|----------|--------|
| 1 | `taskService.getByStatus` | Medium — silent wrong results | ✅ Yes |
| 2 | `taskService.completeTask` | Medium — silent data corruption | ✅ Yes |
| 3 | `taskService.getPaginated` | High — pagination always off by one page | ✅ Yes |
