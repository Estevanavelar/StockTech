-- RLS policies for public schema tables used by StockTech
-- Helpers for JWT claims (works with Supabase PostgREST/Supabase Auth)
CREATE OR REPLACE FUNCTION public.jwt_claim_text(claim text)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(
    (COALESCE(current_setting('request.jwt.claims', true), '')::jsonb ->> claim),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.jwt_claim_uuid(claim text)
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(public.jwt_claim_text(claim), '')::uuid;
$$;

-- PRODUCTS
DROP POLICY IF EXISTS products_select_public ON public.products;
CREATE POLICY products_select_public
  ON public.products
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS products_insert_owner ON public.products;
CREATE POLICY products_insert_owner
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id = public.jwt_claim_uuid('account_id')
  );

DROP POLICY IF EXISTS products_update_owner ON public.products;
CREATE POLICY products_update_owner
  ON public.products
  FOR UPDATE
  TO authenticated
  USING (
    account_id = public.jwt_claim_uuid('account_id')
    AND (
      created_by_user_id IS NULL
      OR created_by_user_id = COALESCE(public.jwt_claim_uuid('user_id'), auth.uid())
    )
  );

DROP POLICY IF EXISTS products_delete_owner ON public.products;
CREATE POLICY products_delete_owner
  ON public.products
  FOR DELETE
  TO authenticated
  USING (
    account_id = public.jwt_claim_uuid('account_id')
    AND (
      created_by_user_id IS NULL
      OR created_by_user_id = COALESCE(public.jwt_claim_uuid('user_id'), auth.uid())
    )
  );

-- SELLER PROFILES
DROP POLICY IF EXISTS seller_profiles_select_public ON public."sellerProfiles";
CREATE POLICY seller_profiles_select_public
  ON public."sellerProfiles"
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS seller_profiles_insert_owner ON public."sellerProfiles";
CREATE POLICY seller_profiles_insert_owner
  ON public."sellerProfiles"
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id = public.jwt_claim_uuid('account_id')
    AND user_id = COALESCE(public.jwt_claim_uuid('user_id'), auth.uid())
  );

DROP POLICY IF EXISTS seller_profiles_update_owner ON public."sellerProfiles";
CREATE POLICY seller_profiles_update_owner
  ON public."sellerProfiles"
  FOR UPDATE
  TO authenticated
  USING (
    account_id = public.jwt_claim_uuid('account_id')
    AND user_id = COALESCE(public.jwt_claim_uuid('user_id'), auth.uid())
  );

DROP POLICY IF EXISTS seller_profiles_delete_owner ON public."sellerProfiles";
CREATE POLICY seller_profiles_delete_owner
  ON public."sellerProfiles"
  FOR DELETE
  TO authenticated
  USING (
    account_id = public.jwt_claim_uuid('account_id')
    AND user_id = COALESCE(public.jwt_claim_uuid('user_id'), auth.uid())
  );

-- RATINGS
DROP POLICY IF EXISTS ratings_select_public ON public.ratings;
CREATE POLICY ratings_select_public
  ON public.ratings
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS ratings_insert_owner ON public.ratings;
CREATE POLICY ratings_insert_owner
  ON public.ratings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id = public.jwt_claim_uuid('account_id')
    AND reviewer_id = COALESCE(public.jwt_claim_uuid('user_id'), auth.uid())
  );

DROP POLICY IF EXISTS ratings_update_owner ON public.ratings;
CREATE POLICY ratings_update_owner
  ON public.ratings
  FOR UPDATE
  TO authenticated
  USING (
    account_id = public.jwt_claim_uuid('account_id')
    AND reviewer_id = COALESCE(public.jwt_claim_uuid('user_id'), auth.uid())
  );

DROP POLICY IF EXISTS ratings_delete_owner ON public.ratings;
CREATE POLICY ratings_delete_owner
  ON public.ratings
  FOR DELETE
  TO authenticated
  USING (
    account_id = public.jwt_claim_uuid('account_id')
    AND reviewer_id = COALESCE(public.jwt_claim_uuid('user_id'), auth.uid())
  );

-- ADDRESSES
DROP POLICY IF EXISTS addresses_select_owner ON public.addresses;
CREATE POLICY addresses_select_owner
  ON public.addresses
  FOR SELECT
  TO authenticated
  USING (
    account_id = public.jwt_claim_uuid('account_id')
    AND user_id = COALESCE(public.jwt_claim_uuid('user_id'), auth.uid())
  );

DROP POLICY IF EXISTS addresses_insert_owner ON public.addresses;
CREATE POLICY addresses_insert_owner
  ON public.addresses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id = public.jwt_claim_uuid('account_id')
    AND user_id = COALESCE(public.jwt_claim_uuid('user_id'), auth.uid())
  );

DROP POLICY IF EXISTS addresses_update_owner ON public.addresses;
CREATE POLICY addresses_update_owner
  ON public.addresses
  FOR UPDATE
  TO authenticated
  USING (
    account_id = public.jwt_claim_uuid('account_id')
    AND user_id = COALESCE(public.jwt_claim_uuid('user_id'), auth.uid())
  );

DROP POLICY IF EXISTS addresses_delete_owner ON public.addresses;
CREATE POLICY addresses_delete_owner
  ON public.addresses
  FOR DELETE
  TO authenticated
  USING (
    account_id = public.jwt_claim_uuid('account_id')
    AND user_id = COALESCE(public.jwt_claim_uuid('user_id'), auth.uid())
  );

-- CARTS
DROP POLICY IF EXISTS carts_select_owner ON public.carts;
CREATE POLICY carts_select_owner
  ON public.carts
  FOR SELECT
  TO authenticated
  USING (
    account_id = public.jwt_claim_uuid('account_id')
    AND user_id = COALESCE(public.jwt_claim_uuid('user_id'), auth.uid())
  );

DROP POLICY IF EXISTS carts_insert_owner ON public.carts;
CREATE POLICY carts_insert_owner
  ON public.carts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id = public.jwt_claim_uuid('account_id')
    AND user_id = COALESCE(public.jwt_claim_uuid('user_id'), auth.uid())
  );

DROP POLICY IF EXISTS carts_update_owner ON public.carts;
CREATE POLICY carts_update_owner
  ON public.carts
  FOR UPDATE
  TO authenticated
  USING (
    account_id = public.jwt_claim_uuid('account_id')
    AND user_id = COALESCE(public.jwt_claim_uuid('user_id'), auth.uid())
  );

DROP POLICY IF EXISTS carts_delete_owner ON public.carts;
CREATE POLICY carts_delete_owner
  ON public.carts
  FOR DELETE
  TO authenticated
  USING (
    account_id = public.jwt_claim_uuid('account_id')
    AND user_id = COALESCE(public.jwt_claim_uuid('user_id'), auth.uid())
  );

-- ORDERS
DROP POLICY IF EXISTS orders_select_owner ON public.orders;
CREATE POLICY orders_select_owner
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    account_id = public.jwt_claim_uuid('account_id')
    AND (
      buyer_id = COALESCE(public.jwt_claim_uuid('user_id'), auth.uid())
      OR seller_id = COALESCE(public.jwt_claim_uuid('user_id'), auth.uid())
    )
  );

DROP POLICY IF EXISTS orders_insert_buyer ON public.orders;
CREATE POLICY orders_insert_buyer
  ON public.orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id = public.jwt_claim_uuid('account_id')
    AND buyer_id = COALESCE(public.jwt_claim_uuid('user_id'), auth.uid())
  );

DROP POLICY IF EXISTS orders_update_parties ON public.orders;
CREATE POLICY orders_update_parties
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (
    account_id = public.jwt_claim_uuid('account_id')
    AND (
      buyer_id = COALESCE(public.jwt_claim_uuid('user_id'), auth.uid())
      OR seller_id = COALESCE(public.jwt_claim_uuid('user_id'), auth.uid())
    )
  );

-- TRANSACTIONS
DROP POLICY IF EXISTS transactions_select_owner ON public.transactions;
CREATE POLICY transactions_select_owner
  ON public.transactions
  FOR SELECT
  TO authenticated
  USING (
    account_id = public.jwt_claim_uuid('account_id')
    AND (
      buyer_id = COALESCE(public.jwt_claim_uuid('user_id'), auth.uid())
      OR seller_id = COALESCE(public.jwt_claim_uuid('user_id'), auth.uid())
    )
  );

DROP POLICY IF EXISTS transactions_insert_owner ON public.transactions;
CREATE POLICY transactions_insert_owner
  ON public.transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id = public.jwt_claim_uuid('account_id')
  );
