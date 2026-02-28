import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

// ESM compatibility
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const hmrHost = process.env.VITE_HMR_HOST
const hmrProtocol = process.env.VITE_HMR_PROTOCOL
const devServerPort = process.env.VITE_DEV_SERVER_PORT
  ? Number(process.env.VITE_DEV_SERVER_PORT)
  : undefined
const hmrPort = process.env.VITE_HMR_PORT
  ? Number(process.env.VITE_HMR_PORT)
  : undefined
const hmrClientPort = process.env.VITE_HMR_CLIENT_PORT
  ? Number(process.env.VITE_HMR_CLIENT_PORT)
  : hmrProtocol === 'wss'
    ? 443
    : undefined

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',  // Base path para servir via subdomínio stocktech.avelarcompany.com.br
  root: 'client',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
      '@components': path.resolve(__dirname, './client/src/components'),
      '@pages': path.resolve(__dirname, './client/src/pages'),
      '@contexts': path.resolve(__dirname, './client/src/contexts'),
      '@hooks': path.resolve(__dirname, './client/src/hooks'),
      '@lib': path.resolve(__dirname, './client/src/lib'),
      '@utils': path.resolve(__dirname, './client/src/utils')
    }
  },
  build: {
    // Code splitting para melhor performance
    rollupOptions: {
      output: {
        manualChunks: {
          // Separar bibliotecas grandes
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select'],
          utils: ['date-fns', 'clsx', 'tailwind-merge'],
          // tRPC em chunk separado
          trpc: ['@trpc/client', '@trpc/react-query'],
          // Gráficos
          charts: ['recharts']
        }
      }
    },
    // Otimizações de build
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: false, // Desabilitar em produção para reduzir tamanho
    chunkSizeWarningLimit: 1000
  },
  server: {
    // Configurações de desenvolvimento
    port: devServerPort,
    host: true,
    allowedHosts: true,
    ...(hmrHost || hmrProtocol || hmrClientPort || hmrPort
      ? {
          hmr: {
            ...(hmrPort ? { port: hmrPort } : {}),
            ...(hmrHost ? { host: hmrHost } : {}),
            ...(hmrProtocol ? { protocol: hmrProtocol } : {}),
            ...(hmrClientPort ? { clientPort: hmrClientPort } : {})
          }
        }
      : {})
  },
  optimizeDeps: {
    // Pré-bundle de dependências
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@trpc/client',
      '@trpc/react-query',
      'lucide-react'
    ]
  }
})