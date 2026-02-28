# Atualizações do Sistema de Estoque e Catálogo - StockTech

Este documento descreve as melhorias e correções implementadas para automatizar a gestão de inventário e garantir a conformidade com as regras de negócio do marketplace.

## 1. Reserva Virtual de Estoque
- **Nova Lógica:** O estoque disponível para o público agora é calculado subtraindo-se as unidades presentes em carrinhos de outros usuários e em pedidos com status "pendente" ou "em processamento".
- **Benefício:** Elimina o risco de "venda dupla" (overselling), garantindo que um item reservado por um cliente não seja vendido para outro antes da expiração ou conclusão da venda.

## 2. Catálogo e Visibilidade Inteligente
- **Lógica de Bloqueio (Blacklist):** O sistema agora permite todos os planos (incluindo o plano gratuito) por padrão. Ele bloqueia o catálogo e o checkout apenas para status específicos de irregularidade: `cancelled`, `delinquent`, `inactive`, `suspended`, `blocked`, `inativo` e `inadimplente`.
- **Benefício:** Flexibilidade para novos planos e correção imediata da visibilidade para usuários regulares.
- **Ocultação por Estoque:** Itens com estoque virtual zerado são removidos da listagem principal, mas permanecem visíveis nos carrinhos de quem já os reservou (correção de bug de visibilidade).

## 3. Fluxo de Venda Automatizado
- **Baixa de Estoque:** A subtração real da quantidade na tabela `products` ocorre apenas quando o vendedor confirma o pagamento/aceita o pedido.
- **Integração com Carrinho:**
    - Ao finalizar o checkout, os itens são removidos do carrinho do comprador (a reserva passa a ser via Pedido).
    - No momento do aceite, é feita uma limpeza final para garantir a consistência dos dados.
- **Trava de Segurança:** Implementada restrição que impede o cancelamento de pedidos que já foram aceitos pelo vendedor, assegurando a integridade da transação concluída.

## 4. Validação de Checkout
- Adicionada uma camada extra de validação no momento da criação do pedido (`orders.create`), que verifica o estoque físico total e o status do vendedor, impedindo compras de última hora em itens que acabaram de sofrer restrições.

---
**Data da Atualização:** 02 de Fevereiro de 2026
**Status:** Implementado e Verificado
