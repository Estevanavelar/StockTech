# API StockTech - Compra Rápida para Logistas

Documentação das APIs para integração com sistemas externos onde o logista realiza compras rápidas no catálogo StockTech.

**Base URL (produção):** `https://stocktech.avelarcompany.com.br`  
**Base URL (desenvolvimento):** `http://localhost:8001` (ou porta configurada)

**Prefixo tRPC:** `/trpc`

---

## Autenticação

As APIs de **adicionar ao carrinho** e **solicitar compra** exigem autenticação via token JWT do AvAdmin.

### Header

```
Authorization: Bearer <JWT_TOKEN>
```

Ou via cookie (navegador):

```
Cookie: avelar_token=<JWT_TOKEN>
```

O token é obtido no login do AvAdmin. O sistema externo deve garantir que o usuário esteja autenticado e repassar o token nas requisições.

---

## 1. Pesquisar Catálogo por Modelo

Pesquisa produtos no marketplace por modelo, nome, código ou marca. **Não requer autenticação.**

### Endpoint

| Método | Path |
|--------|------|
| GET / POST | `/trpc/products.searchCatalog` |

### Parâmetros de entrada (query)

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `query` | string | Não | Busca geral em modelo, nome, código e marca |
| `model` | string | Não | Filtrar por modelo (ex: "A03", "Galaxy") |
| `name` | string | Não | Filtrar por nome do produto |
| `code` | string | Não | Filtrar por código do produto |
| `brand` | string | Não | Filtrar por marca |

- Se `query` for informado, a busca é feita em todos os campos (model, name, code, brand).
- Se campos específicos forem informados, os filtros são aplicados em conjunto (AND).
- A busca é case-insensitive e usa correspondência parcial (LIKE %termo%).

### Exemplo de requisição (GET)

O input vai como query param `input` (JSON stringificado e URL-encoded):

```bash
# Pesquisar por modelo "A03"
curl "https://stocktech.avelarcompany.com.br/trpc/products.searchCatalog?input=%7B%22model%22%3A%22A03%22%7D"

# Pesquisar com query geral
curl "https://stocktech.avelarcompany.com.br/trpc/products.searchCatalog?input=%7B%22query%22%3A%22camera%22%7D"
```

O valor de `input` é: `encodeURIComponent(JSON.stringify({ model: "A03" }))` ou `encodeURIComponent(JSON.stringify({ query: "camera" }))`.

### Exemplo de requisição (POST - formato batch)

```bash
curl -X POST "https://stocktech.avelarcompany.com.br/trpc/products.searchCatalog?batch=1" \
  -H "Content-Type: application/json" \
  -d '{"0":{"json":{"model":"A03"}}}'
```

Ou sem batch (requisição única):

```bash
curl -X POST "https://stocktech.avelarcompany.com.br/trpc/products.searchCatalog" \
  -H "Content-Type: application/json" \
  -d '{"model":"A03"}'
```

### Exemplo de resposta

```json
[
  {
    "id": 1,
    "code": "PRODAWB957",
    "name": "Câmera Traseira A03 Core",
    "brand": "Samsung",
    "model": "A03",
    "category": "Celulares",
    "price": "89.90",
    "quantity": 5,
    "minQuantity": 2,
    "condition": "NEW",
    "warrantyPeriod": "DAYS_90",
    "images": "[\"https://...\"]",
    "sellerStoreName": "Loja Exemplo",
    "sellerUserId": "12345678901",
    "createdAt": "2025-01-15T10:00:00.000Z",
    "updatedAt": "2025-01-15T10:00:00.000Z"
  }
]
```

---

## 2. Adicionar ao Carrinho

Adiciona um produto ao carrinho do usuário autenticado. **Requer autenticação.**

### Endpoint

| Método | Path |
|--------|------|
| POST | `/trpc/cart.addItem` |

### Parâmetros de entrada (body)

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `productId` | number | Sim | ID do produto (retornado na pesquisa) |
| `quantity` | number | Sim | Quantidade (mínimo 1) |

### Exemplo de requisição

```bash
curl -X POST "https://stocktech.avelarcompany.com.br/trpc/cart.addItem" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_JWT_TOKEN" \
  -d '{"productId":1,"quantity":2}'
```

> **Nota:** O StockTech usa SuperJSON. Se o formato acima não funcionar, tente o batch: `-d '[{"id":1,"json":{"productId":1,"quantity":2}}]'`

### Resposta de sucesso

Retorna o item do carrinho criado/atualizado:

```json
{
  "id": 10,
  "accountId": "53685352000194",
  "userId": "12345678901",
  "productId": 1,
  "quantity": 2,
  "reservedUntil": "2025-01-15T11:30:00.000Z",
  "reservedAt": "2025-01-15T11:00:00.000Z",
  "createdAt": "2025-01-15T11:00:00.000Z",
  "updatedAt": "2025-01-15T11:00:00.000Z"
}
```

### Erros possíveis

| Código | Mensagem |
|--------|----------|
| UNAUTHORIZED | Token inválido ou ausente |
| NOT_FOUND | Produto não encontrado |
| BAD_REQUEST | Produto esgotado ou quantidade indisponível |

---

## 3. Solicitar Compra (Criar Pedido)

Cria um ou mais pedidos a partir dos itens informados. Agrupa automaticamente por vendedor. **Requer autenticação.**

### Endpoint

| Método | Path |
|--------|------|
| POST | `/trpc/orders.create` |

### Parâmetros de entrada (body)

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `items` | array | Sim | Lista de itens do pedido |
| `items[].productId` | number | Sim | ID do produto |
| `items[].productName` | string | Sim | Nome do produto |
| `items[].price` | string | Sim | Preço unitário (ex: "89.90") |
| `items[].quantity` | number | Sim | Quantidade |
| `items[].sellerId` | string | Sim | CPF/userId do vendedor (sellerUserId da pesquisa) |
| `items[].sellerName` | string | Não | Nome da loja (opcional) |
| `items[].warrantyPeriod` | string | Não | NONE, DAYS_7, DAYS_30, DAYS_90, MONTHS_6 |
| `addressId` | number | Sim | ID do endereço de entrega do comprador |
| `freightOption` | string | Sim | Opção de frete (ex: "standard") |
| `notes` | string | Não | Observações do pedido |

### Exemplo de requisição

```bash
curl -X POST "https://stocktech.avelarcompany.com.br/trpc/orders.create" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_JWT_TOKEN" \
  -d '{
    "items": [
      {
        "productId": 1,
        "productName": "Câmera Traseira A03 Core",
        "price": "89.90",
        "quantity": 2,
        "sellerId": "12345678901"
      }
    ],
    "addressId": 5,
    "freightOption": "standard",
    "notes": "Compra rápida via sistema externo"
  }'
```

### Resposta de sucesso

```json
{
  "success": true,
  "orders": [
    {
      "id": 100,
      "orderCode": "ORD-ABC123",
      "status": "pending_payment",
      "subtotal": "179.80",
      "freight": "15.00",
      "total": "194.80"
    }
  ],
  "totalValue": 194.80,
  "message": "Pedido criado com sucesso! Aguarde o vendedor aceitar a venda."
}
```

### Pré-requisitos

- O comprador deve ter um **endereço cadastrado** (obtido via `addresses.list`).
- Os itens devem estar em **estoque** e os `sellerId` devem corresponder aos vendedores dos produtos.
- O frete pode ser estimado antes via `orders.estimateFreight` com `addressId` e lista de itens.

---

## Fluxo Recomendado para Compra Rápida

1. **Pesquisar** → `products.searchCatalog` com `query` ou `model`
2. **Exibir resultados** → Usar `id`, `code`, `name`, `price`, `sellerUserId`, `sellerStoreName`
3. **Adicionar ao carrinho** (opcional) → `cart.addItem` com `productId` e `quantity`
4. **Ou ir direto ao pedido** → `orders.create` com itens, `addressId` e `freightOption`

### Endpoints auxiliares

| Endpoint | Descrição |
|----------|-----------|
| `addresses.list` | Listar endereços do usuário (para `addressId`) |
| `orders.estimateFreight` | Estimar frete antes de criar o pedido |
| `cart.list` | Listar itens do carrinho |

---

## Formato de Resposta tRPC

A resposta de sucesso segue o padrão tRPC:

```json
{
  "result": {
    "data": { ... }
  }
}
```

Para queries que retornam array, `data` será o array de produtos. Para mutations, `data` será o objeto retornado.

Em caso de erro, a resposta inclui `error` com `code` e `message`.

---

## Integração TypeScript/Node

Para integração em TypeScript ou Node.js, recomenda-se usar o cliente tRPC oficial (`@trpc/client`) apontando para a base URL do StockTech. Isso garante tipagem e serialização corretas (incluindo SuperJSON).
