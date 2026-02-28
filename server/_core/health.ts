/**
 * ========================================
 * AVELAR SYSTEM - StockTech Health Checks
 * ========================================
 * Monitoramento de saúde e métricas da aplicação
 */

import os from 'os'
import * as db from '../db'
import wsManager from './websocket'

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  uptime: number
  version: string
  services: {
    database: ServiceHealth
    websocket: ServiceHealth
    memory: MemoryHealth
    disk: DiskHealth
  }
  metrics: AppMetrics
}

interface ServiceHealth {
  status: 'up' | 'down' | 'degraded'
  responseTime?: number
  error?: string
  lastChecked: string
}

interface MemoryHealth {
  used: number
  total: number
  percentage: number
  status: 'healthy' | 'warning' | 'critical'
}

interface DiskHealth {
  used: number
  total: number
  percentage: number
  status: 'healthy' | 'warning' | 'critical'
}

interface AppMetrics {
  activeConnections: number
  totalRequests: number
  averageResponseTime: number
  errorRate: number
  ordersToday: number
  revenueToday: number
}

class HealthMonitor {
  private metrics = {
    totalRequests: 0,
    responseTimes: [] as number[],
    errors: 0,
    ordersToday: 0,
    revenueToday: 0
  }

  private lastHealthCheck: HealthStatus | null = null
  private checkInterval: NodeJS.Timeout | null = null

  constructor() {
    this.startPeriodicChecks()
  }

  /**
   * Executa verificação completa de saúde
   */
  async checkHealth(): Promise<HealthStatus> {
    const startTime = Date.now()

    const [
      dbHealth,
      wsHealth,
      memoryHealth,
      diskHealth,
      metrics
    ] = await Promise.all([
      this.checkDatabase(),
      this.checkWebSocket(),
      this.checkMemory(),
      this.checkDisk(),
      this.getMetrics()
    ])

    const responseTime = Date.now() - startTime

    // Determinar status geral
    const services = { database: dbHealth, websocket: wsHealth, memory: memoryHealth, disk: diskHealth }
    const allHealthy = Object.values(services).every(service =>
      service.status === 'up' || service.status === 'healthy'
    )
    const hasDegraded = Object.values(services).some(service =>
      service.status === 'degraded' || service.status === 'warning'
    )

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy'
    if (allHealthy) {
      overallStatus = 'healthy'
    } else if (hasDegraded) {
      overallStatus = 'degraded'
    } else {
      overallStatus = 'unhealthy'
    }

    const health: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      services,
      metrics
    }

    this.lastHealthCheck = health
    return health
  }

  /**
   * Verifica saúde do banco de dados
   */
  private async checkDatabase(): Promise<ServiceHealth> {
    const startTime = Date.now()

    try {
      const database = await db.getDb()
      if (!database) {
        throw new Error('Database connection not available')
      }

      // Teste simples de conectividade
      await database.execute('SELECT 1')

      return {
        status: 'up',
        responseTime: Date.now() - startTime,
        lastChecked: new Date().toISOString()
      }
    } catch (error: any) {
      return {
        status: 'down',
        responseTime: Date.now() - startTime,
        error: error.message,
        lastChecked: new Date().toISOString()
      }
    }
  }

  /**
   * Verifica saúde do WebSocket
   */
  private checkWebSocket(): ServiceHealth {
    const stats = wsManager.getStats()
    const isHealthy = stats.totalConnections >= 0 // Basic check

    return {
      status: isHealthy ? 'up' : 'degraded',
      lastChecked: new Date().toISOString()
    }
  }

  /**
   * Verifica uso de memória
   */
  private checkMemory(): MemoryHealth {
    const memUsage = process.memoryUsage()
    const used = memUsage.heapUsed
    const total = memUsage.heapTotal
    const percentage = (used / total) * 100

    let status: 'healthy' | 'warning' | 'critical'
    if (percentage < 70) {
      status = 'healthy'
    } else if (percentage < 85) {
      status = 'warning'
    } else {
      status = 'critical'
    }

    return {
      used,
      total,
      percentage,
      status
    }
  }

  /**
   * Verifica uso de disco
   */
  private checkDisk(): DiskHealth {
    // Nota: Em produção, use uma biblioteca como 'diskusage' ou 'systeminformation'
    // Para desenvolvimento, simulamos valores saudáveis
    const total = 100 * 1024 * 1024 * 1024 // 100GB
    const used = 30 * 1024 * 1024 * 1024   // 30GB
    const percentage = (used / total) * 100

    let status: 'healthy' | 'warning' | 'critical'
    if (percentage < 80) {
      status = 'healthy'
    } else if (percentage < 90) {
      status = 'warning'
    } else {
      status = 'critical'
    }

    return {
      used,
      total,
      percentage,
      status
    }
  }

  /**
   * Obtém métricas da aplicação
   */
  private async getMetrics(): Promise<AppMetrics> {
    const wsStats = wsManager.getStats()

    // Em produção, essas métricas viriam de um sistema de monitoramento
    // Por enquanto, retornamos valores simulados
    return {
      activeConnections: wsStats.totalConnections,
      totalRequests: this.metrics.totalRequests,
      averageResponseTime: this.calculateAverageResponseTime(),
      errorRate: this.calculateErrorRate(),
      ordersToday: this.metrics.ordersToday,
      revenueToday: this.metrics.revenueToday
    }
  }

  /**
   * Registra uma requisição
   */
  recordRequest(responseTime: number, isError = false) {
    this.metrics.totalRequests++
    this.metrics.responseTimes.push(responseTime)

    // Manter apenas as últimas 100 medições
    if (this.metrics.responseTimes.length > 100) {
      this.metrics.responseTimes.shift()
    }

    if (isError) {
      this.metrics.errors++
    }
  }

  /**
   * Registra um pedido
   */
  recordOrder(revenue: number) {
    this.metrics.ordersToday++
    this.metrics.revenueToday += revenue
  }

  /**
   * Calcula tempo médio de resposta
   */
  private calculateAverageResponseTime(): number {
    if (this.metrics.responseTimes.length === 0) return 0
    return this.metrics.responseTimes.reduce((a, b) => a + b, 0) / this.metrics.responseTimes.length
  }

  /**
   * Calcula taxa de erro
   */
  private calculateErrorRate(): number {
    if (this.metrics.totalRequests === 0) return 0
    return (this.metrics.errors / this.metrics.totalRequests) * 100
  }

  /**
   * Inicia verificações periódicas
   */
  private startPeriodicChecks() {
    // Reset daily metrics at midnight
    const resetDailyMetrics = () => {
      this.metrics.ordersToday = 0
      this.metrics.revenueToday = 0
      this.metrics.errors = 0
    }

    // Reset at midnight
    const now = new Date()
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0)
    const timeUntilMidnight = midnight.getTime() - now.getTime()

    setTimeout(() => {
      resetDailyMetrics()
      setInterval(resetDailyMetrics, 24 * 60 * 60 * 1000) // Every 24 hours
    }, timeUntilMidnight)

    // Periodic health checks
    this.checkInterval = setInterval(async () => {
      try {
        await this.checkHealth()
      } catch (error) {
        console.error('Health check failed:', error)
      }
    }, 60000) // Every minute
  }

  /**
   * Obtém último status de saúde
   */
  getLastHealthCheck(): HealthStatus | null {
    return this.lastHealthCheck
  }

  /**
   * Limpa recursos
   */
  cleanup() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
    }
  }
}

// Singleton instance
export const healthMonitor = new HealthMonitor()

export default healthMonitor