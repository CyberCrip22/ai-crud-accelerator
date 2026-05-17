import * as vscode from 'vscode';

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'alta' | 'media' | 'baixa';
  done: boolean;
  createdAt: string;
  doneAt?: string;
}

const STORAGE_KEY = 'todo-copilot.tasks';

export class TaskStore {
  constructor(private context: vscode.ExtensionContext) {}

  getAll(): Task[] {
    return this.context.globalState.get<Task[]>(STORAGE_KEY) ?? [];
  }

  private save(tasks: Task[]): void {
    this.context.globalState.update(STORAGE_KEY, tasks);
  }

  add(title: string, description: string, priority: Task['priority']): Task {
    const tasks = this.getAll();
    const task: Task = {
      id: Date.now().toString(),
      title,
      description,
      priority,
      done: false,
      createdAt: new Date().toLocaleDateString('pt-BR'),
    };
    tasks.push(task);
    this.save(tasks);
    return task;
  }

  complete(id: string): Task | undefined {
    const tasks = this.getAll();
    const task = tasks.find(t => t.id === id);
    if (!task) { return undefined; }
    task.done = true;
    task.doneAt = new Date().toLocaleDateString('pt-BR');
    this.save(tasks);
    return task;
  }

  remove(id: string): Task | undefined {
    const tasks = this.getAll();
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) { return undefined; }
    const [removed] = tasks.splice(idx, 1);
    this.save(tasks);
    return removed;
  }

  findByTitle(query: string): Task[] {
    const q = query.toLowerCase();
    return this.getAll().filter(t => t.title.toLowerCase().includes(q));
  }

  getSummary(): string {
    const tasks = this.getAll();
    const total = tasks.length;
    const done = tasks.filter(t => t.done).length;
    const pending = tasks.filter(t => !t.done);
    const highPriority = pending.filter(t => t.priority === 'alta');
    return [
      `Total: ${total} tarefa(s). Concluídas: ${done}. Pendentes: ${pending.length}.`,
      highPriority.length > 0
        ? `Alta prioridade pendentes: ${highPriority.map(t => `"${t.title}"`).join(', ')}.`
        : 'Nenhuma tarefa de alta prioridade pendente.',
      pending.length > 0
        ? `Pendentes: ${pending.map(t => `"${t.title}" (${t.priority})`).join('; ')}.`
        : '',
    ].filter(Boolean).join(' ');
  }
}
