# StockTech - Marketplace B2B de Eletrônicos

Sistema de marketplace B2B para negociação de produtos eletrônicos entre vendedores e compradores.

## 🚀 Funcionalidades

- ✅ **Autenticação JWT** integrada com AvAdmin
- ✅ **Multi-tenant** com isolamento por conta SaaS
- ✅ **CRUD completo** de produtos, pedidos e transações
- ✅ **Checkout manual** (pagamento externo)
- ✅ **Painel do vendedor** para gerenciar pedidos
- ✅ **Notificações em tempo real** via WebSocket
- ✅ **Histórico de compras** e vendas
- ✅ **Interface responsiva** mobile-first
- ✅ **Sistema de testes** automatizados
- ✅ **CI/CD** com GitHub Actions
- ✅ **Containerização** com Docker
- ✅ **Monitoramento** de saúde e métricas

## 📋 Pré-requisitos

- Node.js 20+
- PostgreSQL (Neon recomendado)
- Redis (opcional, para cache)
- Docker & Docker Compose (para desenvolvimento)

## 🛠️ Instalação

### Desenvolvimento Local

1. **Clone o repositório**
   ```bash
   git clone <repository-url>
   cd stocktech
   ```

2. **Instale dependências**
   ```bash
   npm install
   ```

3. **Configure variáveis de ambiente**
   ```bash
   cp .env.example .env
   ```

   Edite `.env` com suas configurações:
   ```env
   DATABASE_URL=postgresql://user:password@localhost:5432/stocktech
   JWT_SECRET=your-jwt-secret
   NODE_ENV=development
   ```

4. **Configure o banco de dados**
   ```bash
   npm run db:push
   ```

5. **Execute em modo desenvolvimento**
   ```bash
   # Terminal 1: Servidor
   npm run dev:server

   # Terminal 2: Cliente
   npm run dev:client
   ```

### Docker (Recomendado)

```bash
# Construir e executar
docker-compose up -d

# Ver logs
docker-compose logs -f stocktech

# Parar serviços
docker-compose down
```

## 🧪 Testes

```bash
# Executar todos os testes
npm test

# Testes com watch mode
npm run test:watch

# Testes com UI
npm run test:ui

# Cobertura de testes
npm run test:coverage
```

## 🚀 Produção

### Build

```bash
# Build completo
npm run build

# Apenas cliente
npm run build:client

# Apenas servidor
npm run build:server
```

### Deploy

```bash
# Iniciar em produção
npm start

# Verificar saúde
npm run health
```

### Docker Production

```bash
# Build da imagem
npm run docker:build

# Executar container
npm run docker:run
```

## 📊 Monitoramento

### Health Check

```bash
curl http://localhost:3000/health
```

Retorna status da aplicação, incluindo:
- Status geral (healthy/degraded/unhealthy)
- Status de serviços (database, websocket, memory, disk)
- Métricas (conexões ativas, tempo de resposta, taxa de erro)

### Logs

Logs estruturados em JSON são enviados para console:

```json
{
  "timestamp": "2026-01-07T10:00:00Z",
  "method": "POST",
  "url": "/trpc/orders.create",
  "statusCode": 200,
  "responseTime": 45,
  "userId": "uuid",
  "accountId": "uuid"
}
```

## 🗄️ Banco de Dados

### Migrations

```bash
# Gerar nova migration
npm run db:generate

# Aplicar migrations
npm run db:push

# Interface gráfica
npm run db:studio
```

### Schema

Principais tabelas:
- `products` - Produtos cadastrados
- `orders` - Pedidos de compra
- `transactions` - Histórico de transações
- `ratings` - Avaliações de produtos
- `addresses` - Endereços de entrega
- `seller_profiles` - Perfis dos vendedores

## 🔧 Configuração

### Variáveis de Ambiente

| Variável | Descrição | Padrão |
|----------|-----------|---------|
| `DATABASE_URL` | URL de conexão PostgreSQL | - |
| `JWT_SECRET` | Chave secreta para JWT | - |
| `NODE_ENV` | Ambiente (development/production) | development |
| `PORT` | Porta do servidor | 3000 |
| `REDIS_URL` | URL do Redis (opcional) | - |

### Nginx (Produção)

Arquivo de configuração incluído em `nginx.conf` com:
- Compressão Gzip
- Cache de assets estáticos
- Rate limiting
- WebSocket proxy
- Headers de segurança

## 🏗️ Arquitetura

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Database      │
│   (Vite + React)│◄──►│   (Express +    │◄──►│   (PostgreSQL)  │
│                 │    │    tRPC)       │    │                 │
│ - Páginas       │    │ - API Routes   │    │ - Products      │
│ - Componentes   │    │ - WebSocket    │    │ - Orders        │
│ - Contextos     │    │ - Auth         │    │ - Transactions  │
│ - Hooks         │    │ - Health Check │    │ - Users         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   AvAdmin       │
                       │   (Sistema de  │
                       │    Autenticação)│
                       └─────────────────┘
```

## 🔒 Segurança

- **Autenticação JWT** via AvAdmin
- **Validação de entrada** em todas as APIs
- **Rate limiting** nas rotas críticas
- **Headers de segurança** (CSP, X-Frame-Options, etc.)
- **Logs de auditoria** para ações importantes

## 📱 Mobile

Interface completamente responsiva com otimizações específicas:
- Cards adaptáveis para listagens
- Formulários touch-friendly
- Navegação mobile otimizada
- Lazy loading de imagens
- Performance otimizada para 3G/4G

## 🧪 Testes

### Cobertura
- **Componentes**: Botões, formulários, contextos
- **Hooks**: useWebSocket, useToast, useNotifications
- **APIs**: tRPC routes (orders, products, transactions)
- **Utilitários**: Validadores, formatadores, helpers

### Tipos de Teste
- **Unitários**: Funções puras e componentes isolados
- **Integração**: APIs e interações entre componentes
- **E2E**: Fluxos completos (login → compra → confirmação)

## 🚦 CI/CD

### GitHub Actions

**Workflows incluídos:**
- `ci.yml` - Testes automáticos em push/PR
- `deploy.yml` - Deploy automático para staging/production

### Stages
1. **Lint** - Verificação de código
2. **Test** - Execução de testes
3. **Build** - Compilação da aplicação
4. **Deploy** - Implantação em produção

## 📈 Performance

### Otimizações Implementadas

**Frontend:**
- Code splitting por rotas
- Lazy loading de imagens
- Bundle otimizado com chunks
- Service worker (futuro)

**Backend:**
- Índices otimizados no banco
- Compressão Gzip
- Cache de respostas (futuro)
- Connection pooling

**Infraestrutura:**
- Containerização Docker
- Nginx como reverse proxy
- Health checks automáticos
- Logs estruturados

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -am 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para detalhes.

## 📞 Suporte

Para suporte, abra uma issue no GitHub ou entre em contato com a equipe de desenvolvimento.

---

**Última atualização:** Janeiro 2026
**Versão:** 1.0.0