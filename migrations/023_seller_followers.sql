SET search_path TO avelar_stocktech, public;

CREATE TABLE IF NOT EXISTS seller_followers (
  id SERIAL PRIMARY KEY,
  account_id VARCHAR(14) NOT NULL,
  follower_user_id VARCHAR(11) NOT NULL,
  seller_user_id VARCHAR(11) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS seller_followers_account_id_idx
  ON seller_followers(account_id);

CREATE INDEX IF NOT EXISTS seller_followers_follower_user_id_idx
  ON seller_followers(follower_user_id);

CREATE INDEX IF NOT EXISTS seller_followers_seller_user_id_idx
  ON seller_followers(seller_user_id);

CREATE INDEX IF NOT EXISTS seller_followers_account_seller_idx
  ON seller_followers(account_id, seller_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS seller_followers_unique_follower_seller_idx
  ON seller_followers(follower_user_id, seller_user_id);
