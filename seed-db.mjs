import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_oCKY3pE2ZMrD@ep-flat-flower-ac0rrb6f-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const sql = postgres(DATABASE_URL);

async function seed() {
  try {
    console.log('🌱 Starting database seed...');

    // Insert products
    const products = [
      {
        code: 'PROD001',
        name: 'iPhone 15 Pro Max',
        brand: 'Apple',
        category: 'Smartphones',
        description: 'Smartphone flagship com câmera avançada',
        price: '7999.00',
        quantity: 15,
        minQuantity: 5,
        condition: 'NEW',
      },
      {
        code: 'PROD002',
        name: 'Samsung Galaxy S24 Ultra',
        brand: 'Samsung',
        category: 'Smartphones',
        description: 'Smartphone topo de linha com IA integrada',
        price: '6999.00',
        quantity: 12,
        minQuantity: 5,
        condition: 'NEW',
      },
      {
        code: 'PROD003',
        name: 'MacBook Pro 16"',
        brand: 'Apple',
        category: 'Notebooks',
        description: 'Notebook profissional com processador M3 Max',
        price: '15999.00',
        quantity: 8,
        minQuantity: 3,
        condition: 'NEW',
      },
      {
        code: 'PROD004',
        name: 'iPad Air',
        brand: 'Apple',
        category: 'Tablets',
        description: 'Tablet versátil com M1 chip',
        price: '4999.00',
        quantity: 20,
        minQuantity: 5,
        condition: 'NEW',
      },
      {
        code: 'PROD005',
        name: 'Google Pixel 8 Pro',
        brand: 'Google',
        category: 'Smartphones',
        description: 'Smartphone com IA Gemini integrada',
        price: '5999.00',
        quantity: 10,
        minQuantity: 5,
        condition: 'NEW',
      },
    ];

    for (const product of products) {
      try {
        await sql`
          INSERT INTO products (code, name, brand, category, description, price, quantity, minQuantity, condition)
          VALUES (${product.code}, ${product.name}, ${product.brand}, ${product.category}, ${product.description}, ${product.price}, ${product.quantity}, ${product.minQuantity}, ${product.condition})
          ON CONFLICT (code) DO NOTHING
        `;
      } catch (error) {
        console.warn(`Warning inserting product ${product.code}:`, error.message);
      }
    }

    console.log('✅ Products inserted successfully');

    // Insert transactions
    const transactions = [
      {
        transactionCode: 'TRX001',
        type: 'sale',
        productId: 1,
        productName: 'iPhone 15 Pro Max',
        counterparty: 'João Silva',
        counterpartyRole: 'buyer',
        amount: '7999.00',
        quantity: 1,
        status: 'completed',
      },
      {
        transactionCode: 'TRX002',
        type: 'purchase',
        productId: 2,
        productName: 'Samsung Galaxy S24 Ultra',
        counterparty: 'Tech Distributor',
        counterpartyRole: 'seller',
        amount: '5500.00',
        quantity: 2,
        status: 'completed',
      },
    ];

    for (const transaction of transactions) {
      try {
        await sql`
          INSERT INTO transactions (transactionCode, type, productId, productName, counterparty, counterpartyRole, amount, quantity, status)
          VALUES (${transaction.transactionCode}, ${transaction.type}, ${transaction.productId}, ${transaction.productName}, ${transaction.counterparty}, ${transaction.counterpartyRole}, ${transaction.amount}, ${transaction.quantity}, ${transaction.status})
          ON CONFLICT (transactionCode) DO NOTHING
        `;
      } catch (error) {
        console.warn(`Warning inserting transaction ${transaction.transactionCode}:`, error.message);
      }
    }

    console.log('✅ Transactions inserted successfully');

    // Insert ratings
    const ratings = [
      {
        productId: 1,
        rating: 5,
        comment: 'Excelente produto, muito satisfeito com a compra!',
        author: 'João Silva',
      },
      {
        productId: 2,
        rating: 4,
        comment: 'Bom custo-benefício, recomendo',
        author: 'Maria Santos',
      },
    ];

    for (const rating of ratings) {
      try {
        await sql`
          INSERT INTO ratings (productId, rating, comment, author)
          VALUES (${rating.productId}, ${rating.rating}, ${rating.comment}, ${rating.author})
        `;
      } catch (error) {
        console.warn(`Warning inserting rating:`, error.message);
      }
    }

    console.log('✅ Ratings inserted successfully');

    console.log('🎉 Database seed completed successfully!');
    await sql.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    try {
      await sql.end();
    } catch (e) {
      // ignore
    }
    process.exit(1);
  }
}

seed();
