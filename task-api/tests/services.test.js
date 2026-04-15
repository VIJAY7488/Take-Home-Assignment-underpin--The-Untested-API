const taskService = require('../src/services/taskService');

describe('Task Service', () => {
  beforeEach(() => {
    taskService._reset();
  });

  // ─── create ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    test('should create a task with required title', () => {
      const task = taskService.create({ title: 'Test task' });

      expect(task).toHaveProperty('id');
      expect(task.title).toBe('Test task');
    });

    test('should apply default values for optional fields', () => {
      const task = taskService.create({ title: 'Defaults check' });

      expect(task.description).toBe('');
      expect(task.status).toBe('todo');
      expect(task.priority).toBe('medium');
      expect(task.dueDate).toBeNull();
      expect(task.completedAt).toBeNull();
      expect(task.createdAt).toBeDefined();
    });

    test('should persist custom field values when provided', () => {
      const task = taskService.create({
        title: 'Custom task',
        description: 'Some desc',
        status: 'in_progress',
        priority: 'high',
        dueDate: '2030-01-01T00:00:00.000Z',
      });

      expect(task.description).toBe('Some desc');
      expect(task.status).toBe('in_progress');
      expect(task.priority).toBe('high');
      expect(task.dueDate).toBe('2030-01-01T00:00:00.000Z');
    });

    test('should assign a unique id to each task', () => {
      const task1 = taskService.create({ title: 'Task A' });
      const task2 = taskService.create({ title: 'Task B' });

      expect(task1.id).not.toBe(task2.id);
    });

    test('should add the task to the store', () => {
      taskService.create({ title: 'Persisted task' });
      expect(taskService.getAll().length).toBe(1);
    });
  });

  // ─── getAll ───────────────────────────────────────────────────────────────────

  describe('getAll', () => {
    test('should return an empty array when no tasks exist', () => {
      expect(taskService.getAll()).toEqual([]);
    });

    test('should return all created tasks', () => {
      taskService.create({ title: 'Task 1' });
      taskService.create({ title: 'Task 2' });

      expect(taskService.getAll().length).toBe(2);
    });

    test('should return a copy, not the internal array', () => {
      taskService.create({ title: 'Task 1' });
      const all = taskService.getAll();
      all.push({ id: 'fake' });

      expect(taskService.getAll().length).toBe(1);
    });
  });

  // ─── findById ─────────────────────────────────────────────────────────────────

  describe('findById', () => {
    test('should find a task by its id', () => {
      const task = taskService.create({ title: 'Find me' });
      const found = taskService.findById(task.id);

      expect(found.title).toBe('Find me');
    });

    test('should return undefined for an unknown id', () => {
      const found = taskService.findById('non-existent-id');
      expect(found).toBeUndefined();
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────────

  describe('update', () => {
    test('should update specified fields', () => {
      const task = taskService.create({ title: 'Old title' });
      const updatedTask = taskService.update(task.id, { title: 'New title' });

      expect(updatedTask.title).toBe('New title');
    });

    test('should preserve fields that were not updated', () => {
      const task = taskService.create({ title: 'Original', priority: 'high' });
      const updatedTask = taskService.update(task.id, { title: 'Changed' });

      expect(updatedTask.priority).toBe('high');
      expect(updatedTask.id).toBe(task.id);
    });

    test('should return null for an unknown id', () => {
      const result = taskService.update('non-existent-id', { title: 'Nope' });
      expect(result).toBeNull();
    });
  });

  // ─── remove ───────────────────────────────────────────────────────────────────

  describe('remove', () => {
    test('should remove a task and return true', () => {
      const task = taskService.create({ title: 'Delete me' });

      const result = taskService.remove(task.id);

      expect(result).toBe(true);
      expect(taskService.getAll().length).toBe(0);
    });

    test('should return false for an unknown id', () => {
      const result = taskService.remove('non-existent-id');
      expect(result).toBe(false);
    });
  });

  // ─── completeTask ─────────────────────────────────────────────────────────────

  describe('completeTask', () => {
    test('should set status to done and record completedAt', () => {
      const task = taskService.create({ title: 'Complete me' });
      const completed = taskService.completeTask(task.id);

      expect(completed.status).toBe('done');
      expect(completed.completedAt).not.toBeNull();
    });

    test('should return null for an unknown id', () => {
      const result = taskService.completeTask('non-existent-id');
      expect(result).toBeNull();
    });

    // BUG: completeTask hardcodes priority to 'medium', overwriting the original
    test('BUG: should preserve the original priority when completing a task', () => {
      const task = taskService.create({ title: 'High priority', priority: 'high' });
      const completed = taskService.completeTask(task.id);

      // This FAILS because completeTask hardcodes priority: 'medium'
      expect(completed.priority).toBe('high');
    });
  });

  // ─── getByStatus ──────────────────────────────────────────────────────────────

  describe('getByStatus', () => {
    test('should return tasks matching the given status', () => {
      taskService.create({ title: 'Task 1', status: 'todo' });
      taskService.create({ title: 'Task 2', status: 'done' });

      const todos = taskService.getByStatus('todo');
      expect(todos.length).toBe(1);
      expect(todos[0].status).toBe('todo');
    });

    test('should return an empty array when no tasks match', () => {
      taskService.create({ title: 'Task 1', status: 'todo' });
      const result = taskService.getByStatus('done');
      expect(result.length).toBe(0);
    });

    // BUG: getByStatus uses .includes() instead of strict equality
    // so a query like 'do' matches both 'todo' and 'done'
    test('BUG: should not match partial status substrings', () => {
      taskService.create({ title: 'Task 1', status: 'todo' });
      taskService.create({ title: 'Task 2', status: 'done' });

      // This FAILS because 'do'.includes('do') matches both 'todo' and 'done'
      const result = taskService.getByStatus('do');
      expect(result.length).toBe(0);
    });
  });

  // ─── getPaginated ─────────────────────────────────────────────────────────────

  describe('getPaginated', () => {
    beforeEach(() => {
      for (let i = 0; i < 10; i++) {
        taskService.create({ title: `Task ${i}` });
      }
    });

    test('should return the correct number of items', () => {
      const page = taskService.getPaginated(1, 5);
      expect(page.length).toBe(5);
    });

    test('should return the correct slice for page 1 (first page)', () => {
      const page = taskService.getPaginated(1, 5);
      expect(page[0].title).toBe('Task 0');
      expect(page[4].title).toBe('Task 4');
    });

    // BUG: offset = page * limit, so page=1 with limit=5 gives offset=5
    // The API defaults to page=1 (via parseInt(page) || 1), so end-users
    // requesting page=1 always skip the first `limit` items
    test('BUG: page=1 should return the first page (items 0-4), not skip them', () => {
      // This FAILS: offset = 1 * 5 = 5, so it returns Task 5-9 instead of Task 0-4
      const page = taskService.getPaginated(1, 5);
      expect(page[0].title).toBe('Task 0');
    });

    test('should return empty array for out-of-bounds page', () => {
      const page = taskService.getPaginated(10, 5);
      expect(page.length).toBe(0);
    });
  });

  // ─── getStats ─────────────────────────────────────────────────────────────────

  describe('getStats', () => {
    test('should return zero counts when no tasks exist', () => {
      const stats = taskService.getStats();
      expect(stats.todo).toBe(0);
      expect(stats.in_progress).toBe(0);
      expect(stats.done).toBe(0);
      expect(stats.overdue).toBe(0);
    });

    test('should count tasks by status correctly', () => {
      taskService.create({ title: 'Task 1', status: 'todo' });
      taskService.create({ title: 'Task 2', status: 'done' });
      taskService.create({ title: 'Task 3', status: 'in_progress' });

      const stats = taskService.getStats();
      expect(stats.todo).toBe(1);
      expect(stats.done).toBe(1);
      expect(stats.in_progress).toBe(1);
    });

    test('should count overdue tasks (past dueDate and not done)', () => {
      taskService.create({ title: 'Overdue', status: 'todo', dueDate: '2000-01-01T00:00:00.000Z' });
      taskService.create({ title: 'Not overdue', status: 'todo', dueDate: '2099-01-01T00:00:00.000Z' });

      const stats = taskService.getStats();
      expect(stats.overdue).toBe(1);
    });

    test('should not count done tasks as overdue even if past dueDate', () => {
      taskService.create({ title: 'Done late', status: 'done', dueDate: '2000-01-01T00:00:00.000Z' });

      const stats = taskService.getStats();
      expect(stats.overdue).toBe(0);
    });

    test('should not count tasks without a dueDate as overdue', () => {
      taskService.create({ title: 'No due date', status: 'todo' });

      const stats = taskService.getStats();
      expect(stats.overdue).toBe(0);
    });
  });
});
