import * as vscode from 'vscode';
import { TaskStore, Task } from './taskStore';

// ── helpers ──────────────────────────────────────────────────────────────────

function priorityIcon(p: Task['priority']): string {
  return p === 'alta' ? '🔴' : p === 'media' ? '🟡' : '🟢';
}

function formatTask(t: Task, index?: number): string {
  const prefix = index !== undefined ? `**${index + 1}.** ` : '';
  const status = t.done ? '~~' : '';
  const done   = t.done ? ' ✅' : '';
  const desc   = t.description ? `\n   > ${t.description}` : '';
  return `${prefix}${status}${priorityIcon(t.priority)} ${t.title}${status}${done} \`id:${t.id}\`${desc}`;
}

function parsePriority(text: string): Task['priority'] {
  if (/\balta\b/i.test(text))  { return 'alta'; }
  if (/\bbaixa\b/i.test(text)) { return 'baixa'; }
  return 'media';
}

// ── main handler ─────────────────────────────────────────────────────────────

export function createHandler(store: TaskStore) {
  return async (
    request: vscode.ChatRequest,
    _context: vscode.ChatContext,
    response: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<void> => {

    const cmd    = request.command;
    const prompt = request.prompt.trim();

    // ── /nova ────────────────────────────────────────────────────────────────
    if (cmd === 'nova') {
      if (!prompt) {
        response.markdown('Informe o título da tarefa. Exemplo:\n`@tarefas /nova Revisar PR de hoje`');
        return;
      }
      // extract description after " | "
      const [titlePart, descPart = ''] = prompt.split('|').map(s => s.trim());
      const priority = parsePriority(prompt);
      const cleanTitle = titlePart.replace(/\b(alta|media|baixa)\b/gi, '').trim();
      const task = store.add(cleanTitle, descPart, priority);
      response.markdown(`✅ **Tarefa criada!**\n\n${formatTask(task)}`);
      return;
    }

    // ── /listar ──────────────────────────────────────────────────────────────
    if (cmd === 'listar') {
      const tasks = store.getAll();
      if (tasks.length === 0) {
        response.markdown('Nenhuma tarefa cadastrada. Use `/nova` para adicionar.');
        return;
      }
      const pending   = tasks.filter(t => !t.done);
      const completed = tasks.filter(t =>  t.done);
      if (pending.length > 0) {
        response.markdown('### 📋 Pendentes\n' + pending.map(formatTask).join('\n'));
      }
      if (completed.length > 0) {
        response.markdown('\n### ✅ Concluídas\n' + completed.map(formatTask).join('\n'));
      }
      response.markdown(`\n---\n**Total:** ${tasks.length} | **Pendentes:** ${pending.length} | **Concluídas:** ${completed.length}`);
      return;
    }

    // ── /concluir ────────────────────────────────────────────────────────────
    if (cmd === 'concluir') {
      if (!prompt) {
        response.markdown('Informe o `id` ou parte do título da tarefa.\nExemplo: `@tarefas /concluir Revisar PR`');
        return;
      }
      let task: Task | undefined;
      // try direct id first
      task = store.getAll().find(t => t.id === prompt);
      if (!task) {
        const found = store.findByTitle(prompt);
        if (found.length === 0) {
          response.markdown(`❌ Nenhuma tarefa encontrada para: **${prompt}**`);
          return;
        }
        if (found.length > 1) {
          response.markdown(`Encontrei ${found.length} tarefas. Qual delas?\n\n` + found.map(formatTask).join('\n') + '\n\nUse o `id:` para ser preciso.');
          return;
        }
        task = found[0];
      }
      if (task.done) {
        response.markdown(`ℹ️ A tarefa **${task.title}** já está concluída.`);
        return;
      }
      store.complete(task.id);
      response.markdown(`✅ **Concluída!** "${task.title}"`);
      return;
    }

    // ── /excluir ─────────────────────────────────────────────────────────────
    if (cmd === 'excluir') {
      if (!prompt) {
        response.markdown('Informe o `id` ou parte do título da tarefa.\nExemplo: `@tarefas /excluir Revisar PR`');
        return;
      }
      let task: Task | undefined;
      task = store.getAll().find(t => t.id === prompt);
      if (!task) {
        const found = store.findByTitle(prompt);
        if (found.length === 0) {
          response.markdown(`❌ Nenhuma tarefa encontrada para: **${prompt}**`);
          return;
        }
        if (found.length > 1) {
          response.markdown(`Encontrei ${found.length} tarefas. Qual delas?\n\n` + found.map(formatTask).join('\n') + '\n\nUse o `id:` para ser preciso.');
          return;
        }
        task = found[0];
      }
      store.remove(task.id);
      response.markdown(`🗑️ Tarefa **"${task.title}"** removida.`);
      return;
    }

    // ── /analisar ────────────────────────────────────────────────────────────
    if (cmd === 'analisar') {
      const tasks = store.getAll();
      if (tasks.length === 0) {
        response.markdown('Ainda não há tarefas para analisar. Adicione algumas com `/nova`!');
        return;
      }

      response.markdown('🤖 Analisando suas tarefas…\n\n');

      const models = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4o' });
      if (models.length === 0) {
        response.markdown('❌ Modelo de IA não disponível. Certifique-se de ter o GitHub Copilot ativo.');
        return;
      }
      const model = models[0];
      const summary = store.getSummary();

      const messages = [
        vscode.LanguageModelChatMessage.User(
          `Você é um assistente de produtividade. Analise as tarefas abaixo e responda em português com:\n` +
          `1. 📊 **Situação atual** — progresso e distribuição por prioridade\n` +
          `2. 🎯 **Foco recomendado** — quais tarefas atacar primeiro e por quê\n` +
          `3. 💡 **Dica de produtividade** — uma sugestão prática baseada no contexto\n\n` +
          `Tarefas:\n${summary}\n\nSeja direto, use markdown e no máximo 200 palavras.`
        )
      ];

      const chatRequest = await model.sendRequest(messages, {}, token);
      for await (const chunk of chatRequest.text) {
        response.markdown(chunk);
      }
      return;
    }

    // ── linguagem natural (sem comando) ──────────────────────────────────────
    // Tenta interpretar intenção via keywords simples antes de chamar o LLM
    const lower = prompt.toLowerCase();
    if (/\b(adicionar?|criar?|nova?|add)\b/.test(lower)) {
      const title = prompt.replace(/^(add|adicionar?|criar?|nova?)\s*/i, '').trim();
      if (title) {
        const priority = parsePriority(title);
        const task = store.add(title, '', priority);
        response.markdown(`✅ **Tarefa criada:** ${formatTask(task)}\n\nDica: use \`/nova Título | Descrição\` para adicionar descrição.`);
        return;
      }
    }
    if (/\b(listar?|ver|mostrar?|list)\b/.test(lower)) {
      // reuse /listar logic
      request = { ...request, command: 'listar' } as vscode.ChatRequest;
    }

    // fallback: ajuda
    response.markdown(
      '## 📋 Gerenciador de Tarefas\n\n' +
      'Comandos disponíveis:\n\n' +
      '| Comando | Descrição | Exemplo |\n' +
      '|---|---|---|\n' +
      '| `/nova` | Cria uma tarefa | `/nova Revisar PR alta` |\n' +
      '| `/nova` com descrição | Título \\| Descrição | `/nova Reunião \\| Preparar pauta` |\n' +
      '| `/listar` | Lista todas as tarefas | `/listar` |\n' +
      '| `/concluir` | Marca como feita | `/concluir Revisar PR` |\n' +
      '| `/excluir` | Remove uma tarefa | `/excluir Reunião` |\n' +
      '| `/analisar` | Análise com IA 🤖 | `/analisar` |\n\n' +
      '**Prioridades:** adicione `alta`, `media` ou `baixa` ao título da tarefa.'
    );
  };
}
