/**
 * StockTech - Servidor Simplificado
 * Versão básica para resolver o erro 502
 */

const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'StockTech',
    version: '1.0.0-simple',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// tRPC endpoint (simulado)
app.use('/trpc', (req, res) => {
  res.json({
    status: 'ok',
    message: 'tRPC endpoint (simulado)',
    path: req.path
  });
});

// API status
app.get('/api/status', (req, res) => {
  res.json({
    service: 'StockTech API',
    status: 'operational',
    endpoints: [
      'GET /health',
      'GET /api/status',
      'POST /trpc/*'
    ]
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'StockTech',
    status: 'running',
    message: 'Marketplace B2B de Eletrônicos - Versão Simplificada',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      api: '/api/status',
      trpc: '/trpc'
    }
  });
});

// Tratamento de erros
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 8002;

app.listen(PORT, () => {
  console.log(`🚀 StockTech (Simplificado) rodando na porta ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 API status: http://localhost:${PORT}/api/status`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('📴 Shutting down StockTech...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('📴 Shutting down StockTech...');
  process.exit(0);
});