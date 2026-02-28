# Project TODO - StockTech Dev

## ✅ Completed Features

### Frontend (Vite + React)
- [x] Basic homepage layout
- [x] Navigation menu com 5 abas (Catálogo, Estoque, Transações, Perfil)
- [x] Catálogo de produtos com busca avançada (nome, código, marca)
- [x] Página de Estoque com dashboard de vendedor
- [x] Página de Transações com histórico
- [x] Sistema de avaliações (modal com 5 estrelas e comentário)
- [x] Gerador de relatórios PDF/CSV
- [x] Layout responsivo mobile-first (Catálogo e AddProduct)
- [x] Página de cadastro de produtos (AddProduct) com todos os campos
- [x] Perfil unificado: UserProfile como edição privada com upload de fotos
- [x] Perfil unificado: SellerProfile como visualização pública sincronizada
- [x] Carrinho de compras com cálculo de frete
- [x] Gerenciamento de endereços (AddressManagement)
- [x] Contexto de notificações (NotificationContext) - estrutura implementada
- [x] 40+ componentes UI (Shadcn/ui) completos
- [x] Páginas: Home, Catalog, Products, Stock, Transactions, Cart, AddProduct, UserProfile, SellerProfile, AddressManagement, Notifications, ProductDetails, OrderDetails

### Backend & Infraestrutura
- [x] Backend PostgreSQL Neon com APIs REST tRPC
- [x] Schema de banco de dados com 7 tabelas principais (products, transactions, ratings, addresses, sellerProfiles, carts, orders)
- [x] Multi-tenant com isolamento por `accountId` (integração com AvAdmin)
- [x] Resolução de problema de conectividade SSL com Neon
- [x] Integrar AddProduct com APIs tRPC para salvar no banco
- [x] Implementar upload de imagens com S3
- [x] Sincronizar Transações com backend
- [x] Sincronizar Avaliações com backend
- [x] Conectar Catálogo com dados reais do banco
- [x] Conectar dashboard de Estoque com dados reais do banco
- [x] Carrinho de compras com APIs tRPC
- [x] Atualizar schema sellerProfiles com campos de perfil unificado
- [x] Criar endpoint tRPC updateProfile para sincronizar dados
- [x] **Autenticação JWT integrada ao AvAdmin** (middleware/auth.ts)
- [x] **Middleware de autenticação** com validação de token
- [x] **Proteção de rotas** com `protectedProcedure`
- [x] **Verificação de permissões** e roles de usuário
- [x] **Verificação de acesso ao módulo StockTech** por conta
- [x] Migrations Drizzle configuradas
- [x] Seed de dados inicial
- [x] Variáveis de ambiente configuradas

### UI/UX Refinements
- [x] Adicionar opção "Original Retirada" no campo Condição
- [x] Restaurar campos Modelo e Tipo no formulário AddProduct
- [x] Otimizar layout mobile para Catálogo
- [x] Otimizar layout mobile para AddProduct
- [x] Otimizar layout mobile para Profile (UserProfile e SellerProfile)

---

## 🧭 Rotas e Endpoints (Status Atual)

### Backend tRPC (pronto)
- `system.health` (ok)
- `system.getCurrentUser` (ok)
- `auth.me` / `auth.logout` (ok)
- `storage.uploadImage` (ok)
- `products.list` / `products.getById` / `products.create` / `products.update` / `products.delete` (ok)
- `transactions.list` / `transactions.getById` / `transactions.create` (ok)
- `ratings.getByProductId` / `ratings.getAverageRating` / `ratings.create` (ok)
- `addresses.list` / `addresses.create` / `addresses.update` / `addresses.delete` / `addresses.setDefault` (ok)
- `sellerProfiles.me` / `sellerProfiles.create` / `sellerProfiles.getFullProfile` / `sellerProfiles.updateProfile` / `sellerProfiles.getByUserId` (ok)
- `cart.list` / `cart.addItem` / `cart.updateQuantity` / `cart.removeItem` (ok)
- `orders.create` / `orders.list` / `orders.getById` / `orders.confirmPayment` / `orders.updateStatus` / `orders.cancel` (ok)

### Backend tRPC (pendente)
- `transactions.update` (não implementado)
- `orders.confirmPayment` ainda sem: atualizar estoque + transação financeira

### Frontend (Vite)
- `/catalog`, `/stock`, `/transactions`, `/cart`, `/checkout`, `/order-history`, `/order-details`, `/seller-orders`, `/product-details` (conectados ao backend)
- `/notifications` (conectado ao WebSocket; sem persistência)
- `/seller-profile`, `/user-profile`, `/address-management` (conectados; dados parciais)

---

## ⏳ Pending Features (Falta Implementar)

### 🔴 CRÍTICA - Checkout & Pagamento
- [ ] **Criar página de Checkout completa**
  - [ ] Resumo do carrinho com itens e valores
  - [ ] Seleção de endereço de entrega
  - [ ] Seleção de método de frete (já calculado no Cart)
  - [ ] Campo para cupons/descontos
  - [ ] Resumo final com total
- [ ] **Integrar gateway de pagamento**
  - [ ] Escolher provider (Stripe/PagSeguro/Mercado Pago)
  - [ ] Implementar tokenização de cartão
  - [ ] Verificação de cartão em tempo real
  - [ ] Suporte a múltiplos métodos (cartão, PIX, boleto)
- [ ] **Fluxo de confirmação de pedido**
  - [ ] Criar transação após pagamento confirmado
  - [ ] Atualizar estoque automaticamente
  - [ ] Enviar email de confirmação
  - [ ] Redirecionar para página de sucesso
- [ ] **Webhook para notificação de pagamento**
  - [ ] Endpoint para receber callbacks do gateway
  - [ ] Atualizar status da transação
  - [ ] Notificar usuário sobre mudança de status

### 🔴 CRÍTICA - Notificações em Tempo Real
- [ ] **Sistema de notificações em tempo real (WebSocket)**
  - [ ] Configurar servidor WebSocket (Socket.io ou similar)
  - [ ] Integrar com backend tRPC
  - [ ] Conectar frontend ao WebSocket
  - [ ] Atualizar NotificationContext para usar WebSocket
- [ ] **Alertas de estoque crítico**
  - [ ] Verificar estoque abaixo de `minQuantity`
  - [ ] Notificar vendedor automaticamente
  - [ ] Dashboard com alertas visuais
- [ ] **Notificações de novos pedidos**
  - [ ] Notificar vendedor quando recebe pedido
  - [ ] Notificar comprador sobre status do pedido
- [ ] **Notificações de status de entrega**
  - [ ] Atualizações de rastreamento
  - [ ] Confirmação de entrega
- [ ] **Email notifications (opcional)**
  - [ ] Configurar serviço de email (SendGrid/SES)
  - [ ] Templates de email
  - [ ] Envio assíncrono

### 🟡 ALTA - Otimizações Mobile
- [ ] **Otimizar layout mobile para Stock (Estoque)**
  - [ ] Dashboard responsivo
  - [ ] Tabelas adaptáveis
  - [ ] Filtros mobile-friendly
- [ ] **Otimizar layout mobile para Transactions (Transações)**
  - [ ] Lista de transações otimizada
  - [ ] Filtros e busca mobile
  - [ ] Detalhes da transação em modal
- [ ] **Otimizar layout mobile para ProductDetails**
  - [ ] Galeria de imagens mobile
  - [ ] Informações do produto otimizadas
  - [ ] Botões de ação acessíveis
- [ ] **Testar responsividade em múltiplos tamanhos de tela**
  - [ ] iPhone SE (375px)
  - [ ] iPhone 12/13/14 (390px)
  - [ ] iPad (768px)
  - [ ] Desktop (1920px)
- [ ] **Otimizar performance em conexões 3G/4G**
  - [ ] Lazy loading de imagens
  - [ ] Compressão de assets
  - [ ] Service Worker para cache

### 🟡 ALTA - Testes & Qualidade
- [ ] **Testes unitários (vitest)**
  - [ ] Testes para componentes críticos (Cart, AddProduct, Catalog)
  - [ ] Testes para hooks customizados
  - [ ] Testes para utilitários
  - [ ] Cobertura mínima de 70%
- [ ] **Testes de integração**
  - [ ] Testes para APIs tRPC
  - [ ] Testes para fluxo de checkout
  - [ ] Testes para autenticação
- [ ] **Testes E2E (Cypress/Playwright)**
  - [ ] Fluxo completo de compra
  - [ ] Cadastro de produto
  - [ ] Geração de relatórios
  - [ ] Autenticação e logout
- [ ] **Testes de segurança**
  - [ ] Validação de inputs
  - [ ] Proteção contra SQL injection
  - [ ] Verificação de permissões
  - [ ] Testes de rate limiting

### 🟡 MÉDIA - Histórico & Rastreamento
- [ ] **Criar página de Histórico de Compras do usuário**
  - [ ] Lista de pedidos do comprador
  - [ ] Filtros por data, status, vendedor
  - [ ] Detalhes de cada pedido
  - [ ] Recompra rápida
- [ ] **Implementar log de movimentações de estoque**
  - [ ] Tabela de histórico de estoque
  - [ ] Registro de entradas e saídas
  - [ ] Rastreamento de quem fez a movimentação
  - [ ] Exportação de relatório
- [ ] **Adicionar rastreamento de pedidos**
  - [ ] Código de rastreamento
  - [ ] Integração com transportadoras (Correios, etc)
  - [ ] Timeline de eventos
  - [ ] Notificações de atualização
- [ ] **Criar relatório de vendas por período**
  - [ ] Dashboard de analytics
  - [ ] Gráficos de vendas
  - [ ] Produtos mais vendidos
  - [ ] Receita por período

### 🟡 MÉDIA - Performance & Otimização
- [ ] **Lazy loading de imagens**
  - [ ] Implementar Intersection Observer
  - [ ] Placeholder enquanto carrega
  - [ ] Otimização de tamanho de imagens
- [ ] **Code splitting e otimização de bundle**
  - [ ] Lazy loading de rotas
  - [ ] Análise de bundle size
  - [ ] Remover dependências não utilizadas
- [ ] **Indexação de banco de dados**
  - [ ] Índices em campos de busca frequente
  - [ ] Índices em foreign keys
  - [ ] Otimização de queries lentas
- [ ] **Caching com Redis (opcional)**
  - [ ] Cache de produtos populares
  - [ ] Cache de sessões
  - [ ] Invalidação de cache
- [ ] **Compressão de respostas HTTP**
  - [ ] Gzip/Brotli compression
  - [ ] Compressão de assets estáticos

### 🟢 BAIXA - Funcionalidades Adicionais
- [ ] **Modal de detalhes do produto com galeria de imagens**
  - [ ] Lightbox para imagens
  - [ ] Zoom em imagens
  - [ ] Navegação entre imagens
- [ ] **Implementar carrinho persistente em localStorage**
  - [ ] Salvar carrinho localmente
  - [ ] Sincronizar com servidor ao fazer login
  - [ ] Recuperar carrinho ao voltar
- [ ] **Sistema de cupons/descontos**
  - [ ] CRUD de cupons no backend
  - [ ] Validação de cupons
  - [ ] Aplicação de desconto no checkout
  - [ ] Histórico de cupons usados
- [ ] **Wishlist (produtos favoritos)**
  - [ ] Adicionar/remover favoritos
  - [ ] Página de wishlist
  - [ ] Notificações de preço
- [ ] **Avaliações com filtros**
  - [ ] Filtrar por estrelas
  - [ ] Ordenar por mais recentes/melhores
  - [ ] Paginação de avaliações
- [ ] **Recomendações de produtos relacionados**
  - [ ] Algoritmo de recomendação
  - [ ] Produtos similares
  - [ ] Produtos frequentemente comprados juntos

### 🟢 BAIXA - Conformidade & Legal
- [ ] **Política de Privacidade**
  - [ ] Criar documento completo
  - [ ] Link no footer
  - [ ] Aceite no cadastro
- [ ] **Termos de Serviço**
  - [ ] Criar documento completo
  - [ ] Link no footer
  - [ ] Aceite no cadastro
- [ ] **Conformidade LGPD/GDPR**
  - [ ] Consentimento de cookies
  - [ ] Direito ao esquecimento
  - [ ] Exportação de dados
  - [ ] Portabilidade de dados
- [ ] **Acessibilidade WCAG 2.1 AA**
  - [ ] Navegação por teclado
  - [ ] Screen readers
  - [ ] Contraste de cores
  - [ ] Textos alternativos em imagens
- [ ] **SEO**
  - [ ] Meta tags dinâmicas
  - [ ] Sitemap.xml
  - [ ] Robots.txt
  - [ ] Open Graph tags

### 🟡 ALTA - Deployment & DevOps
- [ ] **Configurar CI/CD (GitHub Actions)**
  - [ ] Pipeline de testes automáticos
  - [ ] Build automático
  - [ ] Deploy automático em staging
  - [ ] Deploy manual para produção
- [ ] **Staging environment**
  - [ ] Ambiente de staging configurado
  - [ ] Banco de dados de staging
  - [ ] Variáveis de ambiente separadas
- [ ] **Backup automático do banco de dados**
  - [ ] Backup diário
  - [ ] Retenção de backups
  - [ ] Teste de restauração
- [ ] **Monitoramento de uptime**
  - [ ] Configurar serviço de monitoramento (UptimeRobot, etc)
  - [ ] Alertas de downtime
  - [ ] Dashboard de status
- [ ] **Documentação de deployment**
  - [ ] README com instruções
  - [ ] Guia de troubleshooting
  - [ ] Runbook de operações

### 🟡 MÉDIA - Monitoramento & Logging
- [ ] **Rastreamento de erros (Sentry)**
  - [ ] Integração com Sentry
  - [ ] Captura de erros frontend
  - [ ] Captura de erros backend
  - [ ] Alertas de erros críticos
- [ ] **Métricas de performance**
  - [ ] Tempo de resposta de APIs
  - [ ] Tempo de carregamento de páginas
  - [ ] Core Web Vitals
- [ ] **Alertas de downtime**
  - [ ] Monitoramento de saúde do servidor
  - [ ] Alertas por email/Slack
- [ ] **Logs estruturados**
  - [ ] Formato JSON para logs
  - [ ] Níveis de log (info, warn, error)
  - [ ] Agregação de logs (ELK stack ou similar)

---

## 📊 Resumo de Progresso

**Total de Tarefas:** 95
**Concluídas:** 42 (44%)
**Pendentes:** 53 (56%)

### Estatísticas por Categoria

| Categoria | Concluídas | Pendentes | Total | % Completo |
|-----------|------------|-----------|-------|------------|
| Frontend | 15 | 8 | 23 | 65% |
| Backend & Infraestrutura | 18 | 0 | 18 | 100% |
| UI/UX | 5 | 0 | 5 | 100% |
| Checkout & Pagamento | 0 | 8 | 8 | 0% |
| Notificações | 1 | 6 | 7 | 14% |
| Mobile | 1 | 5 | 6 | 17% |
| Testes | 1 | 4 | 5 | 20% |
| Histórico & Rastreamento | 0 | 4 | 4 | 0% |
| Performance | 0 | 5 | 5 | 0% |
| Funcionalidades Extras | 0 | 6 | 6 | 0% |
| Conformidade & Legal | 0 | 5 | 5 | 0% |
| DevOps | 0 | 5 | 5 | 0% |
| Monitoramento | 0 | 4 | 4 | 0% |

### Prioridade Alta (Bloqueia Lançamento) 🔴
1. **Checkout & Pagamento** (8 tarefas) - 40-60h estimadas
2. **Notificações em Tempo Real** (6 tarefas) - 15-20h estimadas
3. **Otimizações Mobile** (5 tarefas) - 15-20h estimadas
4. **Testes Unitários/E2E** (4 tarefas) - 20-30h estimadas

### Prioridade Média (Importante para MVP) 🟡
1. **Histórico de Compras** (4 tarefas) - 10-15h estimadas
2. **Performance & Otimização** (5 tarefas) - 15-20h estimadas
3. **Deployment & DevOps** (5 tarefas) - 10-15h estimadas
4. **Monitoramento & Logging** (4 tarefas) - 10-15h estimadas

### Prioridade Baixa (Nice to Have) 🟢
1. **Funcionalidades Extras** (6 tarefas) - 20-30h estimadas
2. **Conformidade & Legal** (5 tarefas) - 10-15h estimadas

---

## 🎯 Próximos Passos Recomendados

### Fase 1: MVP Essencial (2-3 semanas)
1. **Implementar Checkout Completo** (40-60h)
   - Criar página de checkout
   - Integrar gateway de pagamento
   - Fluxo de confirmação de pedido
   - Webhook de pagamento

2. **Configurar Testes Básicos** (20-30h)
   - Setup vitest completo
   - Testes unitários para componentes críticos
   - Testes de integração para APIs
   - Testes E2E para fluxo de compra

3. **Otimizar Mobile** (15-20h)
   - Layout mobile para Stock
   - Layout mobile para Transactions
   - Layout mobile para ProductDetails
   - Testes de responsividade

### Fase 2: Experiência do Usuário (1-2 semanas)
4. **Notificações em Tempo Real** (15-20h)
   - WebSocket server
   - Integração frontend
   - Alertas de estoque
   - Notificações de pedidos

5. **Histórico de Compras** (10-15h)
   - Página de histórico
   - Log de movimentações
   - Rastreamento de pedidos

### Fase 3: Produção (1 semana)
6. **Deployment & DevOps** (10-15h)
   - CI/CD pipeline
   - Staging environment
   - Backup automático
   - Monitoramento

7. **Performance & Otimização** (15-20h)
   - Lazy loading
   - Code splitting
   - Indexação de BD
   - Caching

### Fase 4: Pós-Lançamento (contínuo)
8. **Funcionalidades Extras**
   - Wishlist
   - Cupons
   - Recomendações

9. **Conformidade Legal**
   - Política de Privacidade
   - Termos de Serviço
   - LGPD/GDPR

---

## 📝 Notas Importantes

### ✅ Autenticação JÁ IMPLEMENTADA
- A autenticação está **completa e funcional**
- Integrada com AvAdmin via JWT
- Middleware de autenticação implementado
- Proteção de rotas com `protectedProcedure`
- Verificação de permissões e acesso ao módulo

### ⚠️ Pontos de Atenção
- **Notificações**: ainda sem persistência (apenas WebSocket em tempo real)
- **Frontend Next.js**: Existe estrutura mas não está sendo usada (projeto usa Vite)
- **Testes**: Apenas 1 teste existe, precisa expandir cobertura

### 🎨 Arquitetura Atual
- **Frontend**: Vite + React + TypeScript + Wouter (routing)
- **Backend**: Express + tRPC + Drizzle ORM
- **Banco**: PostgreSQL (Neon)
- **Storage**: AWS S3
- **Auth**: JWT via AvAdmin
- **UI**: Shadcn/ui + Tailwind CSS

---

## 📅 Estimativa Total

**Horas Estimadas para MVP:** 160-235 horas
**Tempo Estimado (1 dev):** 4-6 semanas
**Tempo Estimado (2 devs):** 2-3 semanas

---

**Última atualização:** 16/01/2026
**Versão do documento:** 2.0
