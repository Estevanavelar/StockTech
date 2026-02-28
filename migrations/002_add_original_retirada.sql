DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'ORIGINAL_RETIRADA'
      AND enumtypid = 'product_condition'::regtype
  ) THEN
    ALTER TYPE product_condition ADD VALUE 'ORIGINAL_RETIRADA';
  END IF;
END $$;
