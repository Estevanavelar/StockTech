# Resolução de Erros: WebSocket 1011 e Dashboard AppPortal

## 1. WebSocket 1011 Internal Server Error (StockTech)

### Problema
Ao tentar conectar via WebSocket no StockTech, o console exibia o erro `1011 Internal Server Error`. Isso ocorria devido a um erro de referência no servidor ao tentar validar o token do AvAdmin, especificamente com a variável `account`.

### Causa
No arquivo `server/_core/websocket.ts`, a variável `account` não estava sendo extraída corretamente do resultado da validação do token, e a lógica de fallback para o `super_admin` tentava atribuir um valor a uma variável não declarada ou mal escopo. Além disso, havia imports residuais de módulos removidos (`sdk` e `db`).

### Solução
- Corrigida a declaração de `account` usando destruturação do objeto `validation`.
- Implementada a lógica de fallback corretamente: se `account` for nula e o usuário for `super_admin`, cria-se um objeto de conta virtual com todas as permissões.
- Removidos os imports obsoletos.
- Adicionado tratamento de erro global na conexão WebSocket para evitar o fechamento silencioso.

## 2. Erro de Sintaxe CSS e Loop de Redirecionamento (AppPortal)

### Problema
O portal falhava ao carregar (`500 Internal Server Error` no console) devido a uma falha na compilação do Tailwind CSS. O erro indicava que a classe `focus:ring-[var(--accent)]/5` não existia.

### Causa
O modificador de opacidade do Tailwind (`/5`) não funciona diretamente com variáveis CSS (`var(...)`) dentro da diretiva `@apply` sem configurações adicionais complexas ou versões específicas do compilador.

### Solução
- Alterado o `globals.css` para usar `focus:ring-[var(--selection)]`. Como a variável `--selection` já possui opacidade (definida como `rgba(0,0,0,0.1)` ou similar), o efeito visual desejado de um anel de foco suave foi alcançado de forma segura.
- Adicionadas novas classes utilitárias `.avelar-input` e `.btn-secondary` para suportar a nova interface de edição de perfil.

## 3. Integração de Dados Reais no Dashboard (AppPortal)

### Implementação
- **Plano Atual**: O card de faturamento agora consome as APIs `/api/accounts/{id}` e `/api/plans/{id}` do AvAdmin. Ele exibe dinamicamente o nome do plano (ex: "Inauguração"), o valor formatado e o status da conta.
- **Perfil do Usuário**: Criada a aba "Perfil" com visualização de dados (Nome, CPF, WhatsApp, Cargo) e funcionalidade de **Edição**. 
- **Persistência**: As edições de perfil são enviadas via `PUT` para a API de usuários do AvAdmin e sincronizadas localmente no `localStorage` e cookies através do `saveAuth`.
- **Controle**: O botão "Gerenciar Assinatura" foi desabilitado (`disabled`) conforme solicitação, mantendo-se visível mas inativo.
