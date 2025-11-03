// tarefa3-todo-manager/todoManager.js

/**
 * TodoManager — gerenciador de tarefas com CRUD, status, prioridades e códigos estilo Jira.
 * Armazena em memória. Pronto para ser trocado por um repositório depois.
 */

/** @typedef {'todo'|'in_progress'|'done'} TaskStatus */
/** @typedef {'low'|'medium'|'high'} TaskPriority */

const STATUSES = /** @type {const} */ ({
  TODO: 'todo',
  IN_PROGRESS: 'in_progress',
  DONE: 'done',
});

const PRIORITIES = /** @type {const} */ ({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
});

const VALID_STATUS = new Set(Object.values(STATUSES));
const VALID_PRIORITY = new Set(Object.values(PRIORITIES));

class InvalidInputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidInputError';
  }
}
class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
  }
}

/**
 * Valida chave de projeto estilo Jira (A-Z, 2-10 chars).
 * @param {string} key
 */
function validateProjectKey(key) {
  if (typeof key !== 'string') throw new InvalidInputError('projectKey deve ser string');
  const norm = key.trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9]{1,9}$/.test(norm)) {
    throw new InvalidInputError('projectKey inválido. Use 2-10 chars [A-Z0-9], começando por letra. Ex: PROJ, TASK, FEAT');
  }
  return norm;
}

/**
 * Gera códigos únicos estilo Jira: <PROJECT>-<N>
 */
class CodeGenerator {
  constructor() {
    /** @type {Map<string, number>} */
    this.counters = new Map();
  }

  /**
   * @param {string} projectKey
   */
  next(projectKey) {
    const key = validateProjectKey(projectKey);
    const current = this.counters.get(key) ?? 0;
    const next = current + 1;
    this.counters.set(key, next);
    return `${key}-${next}`;
  }

  /**
   * Lê o contador atual (útil para testes/diagnóstico)
   * @param {string} projectKey
   */
  peek(projectKey) {
    const key = validateProjectKey(projectKey);
    return this.counters.get(key) ?? 0;
  }
}

/**
 * Representa uma tarefa.
 */
class Task {
  /**
   * @param {object} p
   * @param {number} p.id
   * @param {string} p.code
   * @param {string} p.title
   * @param {string} p.description
   * @param {TaskPriority} p.priority
   * @param {TaskStatus} p.status
   * @param {Date} p.createdAt
   * @param {Date} p.updatedAt
   * @param {Date|null} p.completedAt
   */
  constructor(p) {
    this.id = p.id;
    this.code = p.code;
    this.title = p.title;
    this.description = p.description;
    this.status = p.status;
    this.priority = p.priority;
    this.createdAt = p.createdAt;
    this.updatedAt = p.updatedAt;
    this.completedAt = p.completedAt ?? null;
  }
}

/**
 * Util: carimba updatedAt e lida com completedAt conforme status.
 * @param {Task} task
 * @param {Partial<Pick<Task,'title'|'description'|'priority'|'status'>>} changes
 */
function applyChanges(task, changes) {
  if (changes.title != null) {
    if (typeof changes.title !== 'string' || !changes.title.trim()) {
      throw new InvalidInputError('title é obrigatório e deve ser uma string não vazia');
    }
    task.title = changes.title.trim();
  }
  if (changes.description != null) {
    if (typeof changes.description !== 'string') {
      throw new InvalidInputError('description deve ser string');
    }
    task.description = changes.description;
  }
  if (changes.priority != null) {
    if (!VALID_PRIORITY.has(changes.priority)) {
      throw new InvalidInputError('priority inválida. Use: low | medium | high');
    }
    task.priority = changes.priority;
  }
  if (changes.status != null) {
    if (!VALID_STATUS.has(changes.status)) {
      throw new InvalidInputError('status inválido. Use: todo | in_progress | done');
    }
    task.status = changes.status;
    // completedAt só quando vira done; reabre zera
    task.completedAt = task.status === STATUSES.DONE ? new Date() : null;
  }
  task.updatedAt = new Date();
}

/**
 * Busca case-insensitive parcial.
 */
function includesCI(haystack, needle) {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

/**
 * TodoManager em memória.
 */
class TodoManager {
  constructor() {
    /** @type {Task[]} */
    this._tasks = [];
    this._nextId = 1;
    this._codes = new CodeGenerator();
  }

  /**
   * Cria uma tarefa.
   * @param {object} input
   * @param {string} input.title
   * @param {string} input.description
   * @param {TaskPriority} [input.priority='medium']
   * @param {string} [input.projectKey='TASK']
   * @returns {Task}
   */
  createTask(input) {
    if (!input || typeof input !== 'object') throw new InvalidInputError('payload inválido');
    const title = typeof input.title === 'string' ? input.title.trim() : '';
    if (!title) throw new InvalidInputError('title é obrigatório');
    const description = input.description ?? '';
    const priority = input.priority ?? PRIORITIES.MEDIUM;
    if (!VALID_PRIORITY.has(priority)) throw new InvalidInputError('priority inválida. Use: low | medium | high');
    const projectKey = validateProjectKey(input.projectKey ?? 'TASK');

    const now = new Date();
    const task = new Task({
      id: this._nextId++,
      code: this._codes.next(projectKey),
      title,
      description,
      status: STATUSES.TODO,
      priority,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    });
    this._tasks.push(task);
    return task;
  }

  /**
   * Retorna cópia superficial das tarefas.
   * @returns {Task[]}
   */
  listTasks() {
    return [...this._tasks];
  }

  /**
   * Busca por ID.
   * @param {number} id
   * @returns {Task}
   */
  getTask(id) {
    if (typeof id !== 'number') throw new InvalidInputError('id deve ser número');
    const t = this._tasks.find(t => t.id === id);
    if (!t) throw new NotFoundError(`Tarefa id=${id} não encontrada`);
    return t;
  }

  /**
   * Busca por código (ex: PROJ-1).
   * @param {string} code
   * @returns {Task}
   */
  findByCode(code) {
    if (typeof code !== 'string' || !/^[A-Z][A-Z0-9]{1,9}-\d+$/.test(code.trim().toUpperCase())) {
      throw new InvalidInputError('code inválido');
    }
    const norm = code.trim().toUpperCase();
    const t = this._tasks.find(t => t.code === norm);
    if (!t) throw new NotFoundError(`Tarefa code=${norm} não encontrada`);
    return t;
  }

  /**
   * Atualiza campos de uma tarefa.
   * @param {number} id
   * @param {{title?: string, description?: string, priority?: TaskPriority}} changes
   * @returns {Task}
   */
  updateTask(id, changes) {
    const task = this.getTask(id);
    if (!changes || typeof changes !== 'object') throw new InvalidInputError('changes inválido');
    applyChanges(task, {
      title: changes.title,
      description: changes.description,
      priority: changes.priority,
    });
    return task;
  }

  /**
   * Altera status: todo -> in_progress -> done (qualquer ordem válida permitida).
   * @param {number} id
   * @param {TaskStatus} newStatus
   * @returns {Task}
   */
  changeStatus(id, newStatus) {
    const task = this.getTask(id);
    applyChanges(task, { status: newStatus });
    return task;
  }

  /**
   * Remove tarefa por ID.
   * @param {number} id
   */
  removeTask(id) {
    if (typeof id !== 'number') throw new InvalidInputError('id deve ser número');
    const idx = this._tasks.findIndex(t => t.id === id);
    if (idx === -1) throw new NotFoundError(`Tarefa id=${id} não encontrada`);
    this._tasks.splice(idx, 1);
  }

  /**
   * Filtra por status.
   * @param {TaskStatus} status
   * @returns {Task[]}
   */
  filterByStatus(status) {
    if (!VALID_STATUS.has(status)) throw new InvalidInputError('status inválido. Use: todo | in_progress | done');
    return this._tasks.filter(t => t.status === status);
  }

  /**
   * Filtra por prioridade.
   * @param {TaskPriority} priority
   * @returns {Task[]}
   */
  filterByPriority(priority) {
    if (!VALID_PRIORITY.has(priority)) throw new InvalidInputError('priority inválida. Use: low | medium | high');
    return this._tasks.filter(t => t.priority === priority);
  }

  /**
   * Busca por título (parcial, case-insensitive).
   * @param {string} query
   * @returns {Task[]}
   */
  searchByTitle(query) {
    if (typeof query !== 'string' || !query.trim()) throw new InvalidInputError('query deve ser string não vazia');
    const q = query.trim();
    return this._tasks.filter(t => includesCI(t.title, q));
  }

  /**
   * Conta tarefas por status.
   * @returns {{ todo: number, in_progress: number, done: number }}
   */
  countByStatus() {
    const acc = { todo: 0, in_progress: 0, done: 0 };
    for (const t of this._tasks) acc[t.status]++;
    return acc;
  }
}

module.exports = {
  TodoManager,
  Task,
  CodeGenerator,
  STATUSES,
  PRIORITIES,
  InvalidInputError,
  NotFoundError,
};
