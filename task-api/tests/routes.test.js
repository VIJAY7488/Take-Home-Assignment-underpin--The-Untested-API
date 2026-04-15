const request = require('supertest');
const app = require('../src/app');
const taskService = require('../src/services/taskService');

describe('Task Routes API', () => {
  beforeEach(() => {
    taskService._reset();
  });

  // ─── POST /tasks ──────────────────────────────────────────────────────────────

  describe('POST /tasks', () => {
    test('should create a task and return 201', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ title: 'New task' });

      expect(res.statusCode).toBe(201);
      expect(res.body.title).toBe('New task');
      expect(res.body).toHaveProperty('id');
    });

    test('should return 400 when title is missing', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    test('should return 400 when title is empty string', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ title: '   ' });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    test('should return 400 when status is invalid', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ title: 'Task', status: 'invalid_status' });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/status/);
    });

    test('should return 400 when priority is invalid', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ title: 'Task', priority: 'urgent' });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/priority/);
    });

    test('should apply default values for omitted optional fields', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ title: 'Minimal task' });

      expect(res.body.status).toBe('todo');
      expect(res.body.priority).toBe('medium');
      expect(res.body.dueDate).toBeNull();
      expect(res.body.completedAt).toBeNull();
    });
  });

  // ─── GET /tasks ───────────────────────────────────────────────────────────────

  describe('GET /tasks', () => {
    test('should return all tasks', async () => {
      taskService.create({ title: 'Task A' });
      taskService.create({ title: 'Task B' });

      const res = await request(app).get('/tasks');

      expect(res.statusCode).toBe(200);
      expect(res.body.length).toBe(2);
    });

    test('should return empty array when no tasks exist', async () => {
      const res = await request(app).get('/tasks');

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual([]);
    });

    test('should filter tasks by status', async () => {
      taskService.create({ title: 'Task A', status: 'todo' });
      taskService.create({ title: 'Task B', status: 'done' });

      const res = await request(app).get('/tasks?status=todo');

      expect(res.statusCode).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].status).toBe('todo');
    });

    test('should return empty array for a valid but unmatched status filter', async () => {
      taskService.create({ title: 'Task A', status: 'todo' });

      const res = await request(app).get('/tasks?status=done');

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual([]);
    });

    test('should return empty array for an unrecognised status value', async () => {
      taskService.create({ title: 'Task A', status: 'todo' });

      // No validation on ?status query — unknown values silently return []
      const res = await request(app).get('/tasks?status=bogus');

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual([]);
    });

    test('should return paginated tasks with page and limit', async () => {
      for (let i = 0; i < 10; i++) {
        taskService.create({ title: `Task ${i}` });
      }

      const res = await request(app).get('/tasks?page=1&limit=5');

      expect(res.statusCode).toBe(200);
      expect(res.body.length).toBe(5);
    });

    test('should return second page correctly', async () => {
      for (let i = 0; i < 10; i++) {
        taskService.create({ title: `Task ${i}` });
      }

      const page1 = await request(app).get('/tasks?page=1&limit=5');
      const page2 = await request(app).get('/tasks?page=2&limit=5');

      expect(page1.body[0].title).toBe('Task 0');
      expect(page2.body[0].title).toBe('Task 5');
    });
  });

  // ─── GET /tasks/stats ─────────────────────────────────────────────────────────

  describe('GET /tasks/stats', () => {
    test('should return zero counts when no tasks exist', async () => {
      const res = await request(app).get('/tasks/stats');

      expect(res.statusCode).toBe(200);
      expect(res.body.todo).toBe(0);
      expect(res.body.in_progress).toBe(0);
      expect(res.body.done).toBe(0);
      expect(res.body.overdue).toBe(0);
    });

    test('should count tasks by status', async () => {
      taskService.create({ title: 'Task 1', status: 'todo' });
      taskService.create({ title: 'Task 2', status: 'done' });
      taskService.create({ title: 'Task 3', status: 'in_progress' });

      const res = await request(app).get('/tasks/stats');

      expect(res.body.todo).toBe(1);
      expect(res.body.done).toBe(1);
      expect(res.body.in_progress).toBe(1);
    });

    test('should include overdue count for past-due non-done tasks', async () => {
      taskService.create({ title: 'Overdue', status: 'todo', dueDate: '2000-01-01T00:00:00.000Z' });
      taskService.create({ title: 'Future', status: 'todo', dueDate: '2099-01-01T00:00:00.000Z' });

      const res = await request(app).get('/tasks/stats');

      expect(res.body.overdue).toBe(1);
    });

    test('should not count done tasks as overdue even if past due', async () => {
      taskService.create({ title: 'Done late', status: 'done', dueDate: '2000-01-01T00:00:00.000Z' });

      const res = await request(app).get('/tasks/stats');

      expect(res.body.overdue).toBe(0);
    });
  });

  // ─── PUT /tasks/:id ───────────────────────────────────────────────────────────

  describe('PUT /tasks/:id', () => {
    test('should update a task and return 200', async () => {
      const task = taskService.create({ title: 'Old Task' });

      const res = await request(app)
        .put(`/tasks/${task.id}`)
        .send({ title: 'Updated Task' });

      expect(res.statusCode).toBe(200);
      expect(res.body.title).toBe('Updated Task');
    });

    test('should return 404 for unknown id', async () => {
      const res = await request(app)
        .put('/tasks/non-existent-id')
        .send({ title: 'Test' });

      expect(res.statusCode).toBe(404);
    });

    test('should return 400 when title is set to empty string', async () => {
      const task = taskService.create({ title: 'Task' });

      const res = await request(app)
        .put(`/tasks/${task.id}`)
        .send({ title: '  ' });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    test('should return 400 when status is invalid', async () => {
      const task = taskService.create({ title: 'Task' });

      const res = await request(app)
        .put(`/tasks/${task.id}`)
        .send({ status: 'not_a_status' });

      expect(res.statusCode).toBe(400);
    });
  });

  // ─── DELETE /tasks/:id ────────────────────────────────────────────────────────

  describe('DELETE /tasks/:id', () => {
    test('should delete a task and return 204', async () => {
      const task = taskService.create({ title: 'Delete me' });

      const res = await request(app).delete(`/tasks/${task.id}`);

      expect(res.statusCode).toBe(204);
      expect(taskService.getAll().length).toBe(0);
    });

    test('should return 404 for unknown id', async () => {
      const res = await request(app).delete('/tasks/non-existent-id');

      expect(res.statusCode).toBe(404);
    });
  });

  // ─── PATCH /tasks/:id/complete ────────────────────────────────────────────────

  describe('PATCH /tasks/:id/complete', () => {
    test('should mark a task as done and return 200', async () => {
      const task = taskService.create({ title: 'Complete me' });

      const res = await request(app).patch(`/tasks/${task.id}/complete`);

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('done');
      expect(res.body.completedAt).not.toBeNull();
    });

    test('should return 404 for unknown id', async () => {
      const res = await request(app).patch('/tasks/non-existent-id/complete');

      expect(res.statusCode).toBe(404);
    });
  });

  // ─── PATCH /tasks/:id/assign ──────────────────────────────────────────────────

  describe('PATCH /tasks/:id/assign', () => {
    test('should assign a task and return 200 with updated task', async () => {
      const task = taskService.create({ title: 'Task to assign' });

      const res = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: 'Alice' });

      expect(res.statusCode).toBe(200);
      expect(res.body.assignee).toBe('Alice');
      expect(res.body.id).toBe(task.id);
    });

    test('should trim whitespace from assignee name', async () => {
      const task = taskService.create({ title: 'Task' });

      const res = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: '  Bob  ' });

      expect(res.statusCode).toBe(200);
      expect(res.body.assignee).toBe('Bob');
    });

    test('should allow reassigning to a different person', async () => {
      const task = taskService.create({ title: 'Task' });

      await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: 'Alice' });

      const res = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: 'Bob' });

      expect(res.statusCode).toBe(200);
      expect(res.body.assignee).toBe('Bob');
    });

    test('should return 404 for unknown task id', async () => {
      const res = await request(app)
        .patch('/tasks/non-existent-id/assign')
        .send({ assignee: 'Alice' });

      expect(res.statusCode).toBe(404);
    });

    test('should return 400 when assignee is missing', async () => {
      const task = taskService.create({ title: 'Task' });

      const res = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/assignee/);
    });

    test('should return 400 when assignee is empty string', async () => {
      const task = taskService.create({ title: 'Task' });

      const res = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: '' });

      expect(res.statusCode).toBe(400);
    });

    test('should return 400 when assignee is whitespace only', async () => {
      const task = taskService.create({ title: 'Task' });

      const res = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: '   ' });

      expect(res.statusCode).toBe(400);
    });

    test('should preserve all other task fields when assigning', async () => {
      const task = taskService.create({ title: 'Important', priority: 'high', status: 'in_progress' });

      const res = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: 'Charlie' });

      expect(res.body.title).toBe('Important');
      expect(res.body.priority).toBe('high');
      expect(res.body.status).toBe('in_progress');
    });
  });
});