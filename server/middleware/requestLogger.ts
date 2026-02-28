/**
 * ========================================
 * AVELAR SYSTEM - StockTech Request Logger
 * ========================================
 * Middleware para logging estruturado de requests HTTP
 */

import { Request, Response, NextFunction } from 'express'
import healthMonitor from '../_core/health'

interface RequestLog {
  timestamp: string
  method: string
  url: string
  statusCode: number
  responseTime: number
  userAgent?: string
  ip: string
  userId?: string
  accountId?: string
  error?: string
  size?: number
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now()

  // Capturar resposta
  const originalSend = res.send
  let responseBody: any = null

  res.send = function(body: any) {
    responseBody = body
    return originalSend.call(this, body)
  }

  // Quando a resposta terminar
  res.on('finish', () => {
    const responseTime = Date.now() - startTime
    const isError = res.statusCode >= 400

    // Registrar métricas no health monitor
    healthMonitor.recordRequest(responseTime, isError)

    // Criar log estruturado
    const log: RequestLog = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress || 'unknown',
      userId: (req as any).user?.id,
      accountId: (req as any).user?.account_id,
      size: responseBody ? Buffer.byteLength(JSON.stringify(responseBody), 'utf8') : undefined
    }

    // Adicionar erro se houver
    if (isError && responseBody?.error) {
      log.error = typeof responseBody.error === 'string'
        ? responseBody.error
        : responseBody.error.message || 'Unknown error'
    }

    // Log baseado no nível
    if (isError) {
      console.error('REQUEST_ERROR:', JSON.stringify(log))
    } else if (responseTime > 1000) {
      // Log slow requests
      console.warn('REQUEST_SLOW:', JSON.stringify(log))
    } else {
      console.log('REQUEST:', JSON.stringify(log))
    }
  })

  next()
}

/**
 * Middleware para logging específico de tRPC
 */
export function trpcLogger(opts: any) {
  const startTime = Date.now()

  return {
    onSuccess: (data: any) => {
      const responseTime = Date.now() - startTime
      const isError = false

      healthMonitor.recordRequest(responseTime, isError)

      console.log('TRPC_SUCCESS:', JSON.stringify({
        timestamp: new Date().toISOString(),
        method: opts.type,
        path: opts.path,
        responseTime,
        userId: opts.ctx?.user?.id,
        accountId: opts.ctx?.user?.account_id
      }))
    },
    onError: (error: any) => {
      const responseTime = Date.now() - startTime
      const isError = true

      healthMonitor.recordRequest(responseTime, isError)

      console.error('TRPC_ERROR:', JSON.stringify({
        timestamp: new Date().toISOString(),
        method: opts.type,
        path: opts.path,
        responseTime,
        error: error.message,
        userId: opts.ctx?.user?.id,
        accountId: opts.ctx?.user?.account_id
      }))
    }
  }
}