import * as vscode from 'vscode';
import { TaskStore } from './taskStore';
import { createHandler } from './handler';

export function activate(context: vscode.ExtensionContext) {
  const store   = new TaskStore(context);
  const handler = createHandler(store);

  const participant = vscode.chat.createChatParticipant('todo-copilot.tarefas', handler);

  participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'icon.png');

  participant.followupProvider = {
    provideFollowups(_result, _context, _token) {
      return [
        { prompt: '/listar',   label: '📋 Ver tarefas',      command: 'listar'   },
        { prompt: '/analisar', label: '🤖 Analisar com IA',  command: 'analisar' },
      ];
    }
  };

  context.subscriptions.push(participant);
}

export function deactivate() {}
