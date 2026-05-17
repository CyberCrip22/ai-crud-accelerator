import * as vscode from 'vscode';

export interface CrudConfig {
  entityName: string;      // ex: "Product"
  fields: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'date' | 'enum';
    required: boolean;
    unique?: boolean;
    enumValues?: string[];
  }>;
  language: 'typescript' | 'python' | 'csharp';
  framework?: 'express' | 'fastapi' | 'aspnetcore';
  includeTests: boolean;
  includeDocs: boolean;
}

export class CrudGenerator {
  
  async generate(config: CrudConfig, outputPath: string): Promise<string[]> {
    const files: string[] = [];
    const entityLower = config.entityName.toLowerCase();
    const entityPlural = entityLower + 's';
    
    // Para cada arquivo, usar IA para gerar o conteúdo
    const templates = await this.generateWithAI(config);
    
    // Criar os arquivos
    for (const [filename, content] of Object.entries(templates)) {
      const fullPath = vscode.Uri.joinPath(vscode.Uri.file(outputPath), filename);
      await vscode.workspace.fs.writeFile(fullPath, Buffer.from(content, 'utf8'));
      files.push(fullPath.fsPath);
    }
    
    return files;
  }
  
  private async generateWithAI(config: CrudConfig): Promise<Record<string, string>> {
    const prompts = this.buildPrompts(config);
    const results: Record<string, string> = {};
    
    // Usar GitHub Copilot API diretamente
    const models = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4o' });
    
    if (models.length === 0) {
      throw new Error('Copilot não disponível. Verifique sua instalação.');
    }
    
    const model = models[0];
    
    for (const [filename, prompt] of Object.entries(prompts)) {
      const messages = [
        vscode.LanguageModelChatMessage.User(prompt)
      ];
      
      const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);
      let content = '';
      for await (const chunk of response.text) {
        content += chunk;
      }
      
      // Extrair código do markdown se necessário
      const codeMatch = content.match(/```(?:\w+)?\n([\s\S]*?)```/);
      results[filename] = codeMatch ? codeMatch[1].trim() : content;
    }
    
    return results;
  }
  
  private buildPrompts(config: CrudConfig): Record<string, string> {
    const { entityName, fields, language, includeTests, includeDocs } = config;
    const fieldsStr = fields.map(f => `${f.name}: ${f.type}${f.required ? '' : '?'} ${f.unique ? '(unique)' : ''}`).join(', ');
    
    const prompts: Record<string, string> = {};
    
    // Model/Entity
    prompts[`${entityName.toLowerCase()}.${language === 'typescript' ? 'ts' : language === 'python' ? 'py' : 'cs'}`] = `
      Gere o modelo/entidade para ${entityName} em ${language}.
      Campos: ${fieldsStr}
      
      Requisitos:
      - Use boas práticas (validação, tipagem forte)
      - Inclua construtor ou factory method
      - Adicione timestamps padrão (createdAt, updatedAt) se aplicável
      
      Apenas o código, sem explicações.
    `;
    
    // Repository
    prompts[`${entityName}Repository.${language === 'typescript' ? 'ts' : language === 'python' ? 'py' : 'cs'}`] = `
      Gere um Repository para ${entityName} com os métodos:
      - findAll(): lista todos
      - findById(id): busca por ID
      - create(data): cria novo
      - update(id, data): atualiza
      - delete(id): remove
      
      Linguagem: ${language}
      Use padrão Repository, com in-memory storage (array/map) inicialmente.
      
      Apenas o código.
    `;
    
    // Service
    prompts[`${entityName}Service.${language === 'typescript' ? 'ts' : language === 'python' ? 'py' : 'cs'}`] = `
      Gere um Service para ${entityName} com lógica de negócio básica:
      - Validação de campos obrigatórios
      - Verificação de unicidade (se aplicável)
      - Tratamento de erros
      
      O Service deve usar o Repository injetado via DI.
      Linguagem: ${language}
      
      Apenas o código.
    `;
    
    // Controller/Handler
    const routeLang = language === 'typescript' ? 'Express.js' : language === 'python' ? 'FastAPI' : 'ASP.NET Core';
    prompts[`${entityName}Controller.${language === 'typescript' ? 'ts' : language === 'python' ? 'py' : 'cs'}`] = `
      Gere um Controller/Router para ${entityName} com endpoints REST:
      - GET /${entityPlural}
      - GET /${entityPlural}/:id
      - POST /${entityPlural}
      - PUT /${entityPlural}/:id
      - DELETE /${entityPlural}/:id
      
      Framework: ${routeLang}
      Linguagem: ${language}
      
      Inclua validação de entrada, status codes corretos (200, 201, 400, 404, 500).
      Apenas o código.
    `;
    
    // Tests
    if (includeTests) {
      prompts[`${entityName}.test.${language === 'typescript' ? 'ts' : language === 'python' ? 'py' : 'cs'}`] = `
        Gere testes unitários para o ${entityName} Service e Controller.
        
        Testes mínimos:
        - Criar ${entityName} com dados válidos
        - Falha ao criar sem campos obrigatórios
        - Buscar por ID existente e inexistente
        - Atualizar com dados parciais
        - Deletar existente
        
        Framework de teste: ${language === 'typescript' ? 'Jest' : language === 'python' ? 'pytest' : 'xUnit'}
        Apenas o código.
      `;
    }
    
    // Documentation
    if (includeDocs) {
      prompts['README.md'] = `
        Gere documentação básica para a API de ${entityName}:
        - Como rodar o projeto
        - Endpoints disponíveis (método, path, corpo, resposta)
        - Exemplos de request/response em curl
        
        Apenas markdown, sem explicações extras.
      `;
    }
    
    return prompts;
  }
}