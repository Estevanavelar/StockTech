-- Corrige seller_account_id em pedidos onde foi usado o account do comprador
-- (quando AvAdmin não retornou account_id do vendedor)
-- O vendedor precisa ter seller_account_id = conta dele para ver o pedido em "Pedidos Recebidos"
--
-- Uso: psql "$DATABASE_URL" -f scripts/fix_seller_account_orders.sql

SET search_path TO avelar_stocktech;

-- Atualiza orders usando o account_id do primeiro produto (pertence ao vendedor)
UPDATE orders o
SET seller_account_id = p.account_id
FROM products p
WHERE p.id = (
  SELECT (elem->>'productId')::int
  FROM jsonb_array_elements(o.items::jsonb) AS elem
  LIMIT 1
)
  AND o.seller_id = p.created_by_user_id
  AND (
    o.seller_account_id IS NULL
    OR o.seller_account_id = COALESCE(o.buyer_account_id, o.account_id)
  );
