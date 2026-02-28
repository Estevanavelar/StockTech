-- Corrige owner_cpf em transações de venda (type='sale')
-- O vendedor precisa ter owner_cpf = CPF dele para ver a transação em "Transações"
-- Quando o pedido foi criado pelo comprador, a transação de venda recebia owner_cpf do comprador (erro)
--
-- Uso: psql "$STOCKTECH_DATABASE_URL" -f scripts/fix_sale_transactions_owner_cpf.sql

SET search_path TO avelar_stocktech;

-- Atualiza transações de venda usando owner_cpf do produto (pertence ao vendedor)
UPDATE transactions t
SET owner_cpf = p.owner_cpf
FROM products p
WHERE t.product_id = p.id
  AND t.type = 'sale'
  AND t.owner_cpf != p.owner_cpf;
