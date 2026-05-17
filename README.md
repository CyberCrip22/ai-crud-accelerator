# Tarefas para GitHub Copilot

Gerencie tarefas diretamente no Copilot Chat do VS Code, com análise inteligente por IA.

## Requisitos

- VS Code 1.90+
- GitHub Copilot + GitHub Copilot Chat instalados e ativos

## Como usar

Abra o Copilot Chat (`Ctrl+Alt+I`) e chame `@tarefas`:

### Comandos

| Comando | O que faz | Exemplo |
|---|---|---|
| `/nova` | Cria uma tarefa | `@tarefas /nova Revisar PR alta` |
| `/nova` com descrição | Adiciona descrição após `\|` | `@tarefas /nova Reunião \| Preparar pauta` |
| `/listar` | Lista todas as tarefas | `@tarefas /listar` |
| `/concluir` | Marca como concluída | `@tarefas /concluir Revisar PR` |
| `/excluir` | Remove uma tarefa | `@tarefas /excluir Reunião` |
| `/analisar` | Análise com IA  | `@tarefas /analisar` |

### Prioridades

Adicione `alta`, `media` ou `baixa` ao título (padrão: `media`):

```
@tarefas /nova Deploy em produção alta
@tarefas /nova Atualizar docs baixa
```

### Linguagem natural

Você também pode usar linguagem natural sem comandos:

```
@tarefas adicionar reunião com cliente
@tarefas listar tarefas
```

## Instalação para desenvolvimento

```bash
# 1. Clone / copie a pasta
cd todo-copilot-extension

# 2. Instale dependências
npm install

# 3. Compile
npm run compile

# 4. Abra no VS Code
code .

# 5. Pressione F5 para abrir a Extension Development Host
```

## Estrutura do projeto

```
todo-copilot-extension/
├── src/
│   ├── extension.ts    # Ponto de entrada, registro do participant
│   ├── handler.ts      # Lógica de todos os comandos + linguagem natural
│   └── taskStore.ts    # CRUD de tarefas com persistência (globalState)
├── package.json        # Manifesto da extensão
├── tsconfig.json
└── README.md
```

## Como a IA é usada

O comando `/analisar` usa a **Language Model API** do VS Code para chamar o modelo `gpt-4o` via Copilot (sem precisar de chave de API própria). Ele recebe um resumo das suas tarefas e retorna:

1. Situação atual com progresso
2. Foco recomendado com justificativa
3. Dica prática de produtividade

