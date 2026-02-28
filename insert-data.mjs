import postgres from 'postgres';

const DATABASE_URL = 'postgresql://neondb_owner:npg_oCKY3pE2ZMrD@ep-flat-flower-ac0rrb6f-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const sql = postgres(DATABASE_URL);

async function insertData() {
  try {
    console.log('📦 Inserindo dados...');

    // Inserir produtos
    const products = [
      ['PROD001', 'iPhone 15 Pro Max', 'Apple', 'Smartphones', 'Smartphone flagship com câmera avançada', '7999.00', 15, 5, 'NEW'],
      ['PROD002', 'Samsung Galaxy S24 Ultra', 'Samsung', 'Smartphones', 'Smartphone topo de linha com IA integrada', '6999.00', 12, 5, 'NEW'],
      ['PROD003', 'MacBook Pro 16"', 'Apple', 'Notebooks', 'Notebook profissional com processador M3 Max', '15999.00', 8, 3, 'NEW'],
      ['PROD004', 'iPad Air', 'Apple', 'Tablets', 'Tablet versátil com M1 chip', '4999.00', 20, 5, 'NEW'],
      ['PROD005', 'Google Pixel 8 Pro', 'Google', 'Smartphones', 'Smartphone com IA Gemini integrada', '5999.00', 10, 5, 'NEW'],
    ];

    for (const product of products) {
      await sql`
        INSERT INTO products (code, name, brand, category, description, price, quantity, "minQuantity", condition)
        VALUES (${product[0]}, ${product[1]}, ${product[2]}, ${product[3]}, ${product[4]}, ${product[5]}, ${product[6]}, ${product[7]}, ${product[8]})
        ON CONFLICT (code) DO NOTHING
      `;
    }
    console.log('✅ Produtos inseridos');

    // Inserir transações
    const transactions = [
      ['TRX001', 'sale', 1, 'iPhone 15 Pro Max', 'João Silva', 'buyer', '7999.00', 1, 'completed'],
      ['TRX002', 'purchase', 2, 'Samsung Galaxy S24 Ultra', 'Tech Distributor', 'seller', '5500.00', 2, 'completed'],
    ];

    for (const tx of transactions) {
      await sql`
        INSERT INTO transactions ("transactionCode", type, "productId", "productName", counterparty, "counterpartyRole", amount, quantity, status)
        VALUES (${tx[0]}, ${tx[1]}, ${tx[2]}, ${tx[3]}, ${tx[4]}, ${tx[5]}, ${tx[6]}, ${tx[7]}, ${tx[8]})
        ON CONFLICT ("transactionCode") DO NOTHING
      `;
    }
    console.log('✅ Transações inseridas');

    // Inserir ratings
    const ratings = [
      [1, null, 5, 'Excelente produto, muito satisfeito com a compra!', 'João Silva'],
      [2, null, 4, 'Bom custo-benefício, recomendo', 'Maria Santos'],
    ];

    for (const rating of ratings) {
      await sql`
        INSERT INTO ratings ("productId", "transactionId", rating, comment, author)
        VALUES (${rating[0]}, ${rating[1]}, ${rating[2]}, ${rating[3]}, ${rating[4]})
      `;
    }
    console.log('✅ Ratings inseridos');

    console.log('🎉 Dados inseridos com sucesso!');
    await sql.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    await sql.end();
    process.exit(1);
  }
}

insertData();
