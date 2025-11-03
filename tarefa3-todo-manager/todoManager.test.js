// tarefa3-todo-manager/todoManager.test.js

const {
  TodoManager,
  STATUSES,
  PRIORITIES,
  InvalidInputError,
  NotFoundError,
} = require('./todoManager');

describe('TodoManager - Tarefa 3', () => {
  let tm;
  beforeEach(() => {
    tm = new TodoManager();
  });

  test('Criação de tarefa com código Jira automático', () => {
    const t = tm.createTask({
      title: 'Implementar login',
      description: 'Criar sistema de autenticação',
      priority: PRIORITIES.HIGH,
      projectKey: 'PROJ',
    });

    expect(t.id).toBe(1);
    expect(t.code).toBe('PROJ-1');
    expect(t.status).toBe(STATUSES.TODO);
    expect(t.priority).toBe(PRIORITIES.HIGH);
    expect(t.createdAt instanceof Date).toBe(true);
    expect(t.updatedAt instanceof Date).toBe(true);
    expect(t.completedAt).toBeNull();

    // segundo item no mesmo projeto incrementa
    const t2 = tm.createTask({ title: 'Logout', description: '', projectKey: 'PROJ' });
    expect(t2.code).toBe('PROJ-2');

    // outro projeto tem contagem separada
    const t3 = tm.createTask({ title: 'Página inicial', description: '', projectKey: 'FEAT' });
    expect(t3.code).toBe('FEAT-1');
  });

  test('Atualização de tarefa e mudança de status registra completedAt', () => {
    const t = tm.createTask({
      title: 'Refatorar serviço',
      description: 'Limpar débitos técnicos',
      priority: PRIORITIES.MEDIUM,
      projectKey: 'TASK',
    });

    const beforeUpdate = t.updatedAt;
    tm.updateTask(t.id, { title: 'Refatorar serviço core', priority: PRIORITIES.LOW });
    const afterUpdate = tm.getTask(t.id).updatedAt;

    expect(tm.getTask(t.id).title).toBe('Refatorar serviço core');
    expect(tm.getTask(t.id).priority).toBe(PRIORITIES.LOW);
    expect(afterUpdate.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());

    // status -> in_progress não define completedAt
    tm.changeStatus(t.id, STATUSES.IN_PROGRESS);
    expect(tm.getTask(t.id).completedAt).toBeNull();

    // status -> done define completedAt
    tm.changeStatus(t.id, STATUSES.DONE);
    expect(tm.getTask(t.id).completedAt instanceof Date).toBe(true);

    // reabrir zera completedAt
    tm.changeStatus(t.id, STATUSES.TODO);
    expect(tm.getTask(t.id).completedAt).toBeNull();
  });

  test('Listagem e filtragem por status e prioridade', () => {
    tm.createTask({ title: 'A', description: '', priority: PRIORITIES.HIGH });
    const b = tm.createTask({ title: 'B', description: '', priority: PRIORITIES.LOW });
    const c = tm.createTask({ title: 'C', description: '', priority: PRIORITIES.MEDIUM });

    tm.changeStatus(b.id, STATUSES.IN_PROGRESS);
    tm.changeStatus(c.id, STATUSES.DONE);

    const all = tm.listTasks();
    expect(all).toHaveLength(3);

    const onlyTodo = tm.filterByStatus(STATUSES.TODO);
    const onlyInProgress = tm.filterByStatus(STATUSES.IN_PROGRESS);
    const onlyDone = tm.filterByStatus(STATUSES.DONE);

    expect(onlyTodo).toHaveLength(1);
    expect(onlyInProgress).toHaveLength(1);
    expect(onlyDone).toHaveLength(1);

    const high = tm.filterByPriority(PRIORITIES.HIGH);
    expect(high).toHaveLength(1);

    const counts = tm.countByStatus();
    expect(counts).toEqual({ todo: 1, in_progress: 1, done: 1 });
  });

  test('Busca por título e remoção', () => {
    const t1 = tm.createTask({ title: 'Implementar login', description: '' });
    tm.createTask({ title: 'Implementar logout', description: '' });
    tm.createTask({ title: 'Página de perfil', description: '' });

    const found = tm.searchByTitle('login');
    expect(found.map(t => t.id)).toEqual([t1.id]);

    // remover
    tm.removeTask(t1.id);
    expect(() => tm.getTask(t1.id)).toThrow(NotFoundError);
    expect(tm.listTasks()).toHaveLength(2);
  });

  test('Tratamento de erros: atualizar/remover tarefa inexistente, status inválido', () => {
    expect(() => tm.updateTask(999, { title: 'X' })).toThrow(NotFoundError);
    expect(() => tm.removeTask(999)).toThrow(NotFoundError);

    const t = tm.createTask({ title: 'Teste', description: '' });

    expect(() => tm.changeStatus(t.id, /** @type any */ ('paused'))).toThrow(InvalidInputError);
    expect(() => tm.createTask({ title: '', description: '' })).toThrow(InvalidInputError);
    expect(() => tm.filterByPriority(/** @type any */ ('urgent'))).toThrow(InvalidInputError);
    expect(() => tm.findByCode('inválido')).toThrow(InvalidInputError);
  });
});
