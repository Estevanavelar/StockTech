import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ordersRouter } from '../routers/orders'

// Mock do database
const mockDb = {
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      returning: vi.fn(() => Promise.resolve([{ id: 1, orderCode: 'ORD-TEST123' }]))
    }))
  })),
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(() => Promise.resolve([]))
      }))
    }))
  })),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve({}))
    }))
  }))
}

vi.mock('../db', () => ({
  getDb: vi.fn(() => Promise.resolve(mockDb))
}))

vi.mock('../_core/avadmin-client', () => ({
  getAvAdminClient: vi.fn(() => ({
    incrementUsage: vi.fn(() => Promise.resolve())
  }))
}))

describe('Orders Router', () => {
  const mockCtx = {
    user: {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      role: 'user'
    },
    account: {
      id: 'account-123',
      name: 'Test Account'
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('create order', () => {
    it('should create order successfully', async () => {
      const caller = ordersRouter.createCaller(mockCtx)

      const orderData = {
        items: [{
          productId: 1,
          productName: 'Test Product',
          price: '100.00',
          quantity: 2,
          sellerId: 'seller-123'
        }],
        addressId: 1,
        freightOption: 'delivery'
      }

      const result = await caller.create({ ...orderData })

      expect(result.success).toBe(true)
      expect(result.orders).toHaveLength(1)
      expect(result.orders[0].orderCode).toMatch(/^ORD-/)
    })

    it('should validate required fields', async () => {
      const caller = ordersRouter.createCaller(mockCtx)

      await expect(caller.create({
        items: [],
        addressId: 1,
        freightOption: 'delivery'
      })).rejects.toThrow()
    })
  })

  describe('confirm payment', () => {
    it('should confirm payment for valid order', async () => {
      // Mock para retornar um pedido válido
      mockDb.select.mockImplementation(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([{
              id: 1,
              orderCode: 'ORD-TEST123',
              status: 'pending_payment',
              sellerId: mockCtx.user!.id
            }]))
          }))
        }))
      }))

      const caller = ordersRouter.createCaller(mockCtx)
      const result = await caller.confirmPayment({ orderId: 1 })

      expect(result.success).toBe(true)
      expect(result.message).toContain('confirmado')
    })

    it('should reject if user is not the seller', async () => {
      mockDb.select.mockImplementation(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([{
              id: 1,
              status: 'pending_payment',
              sellerId: 'different-seller-id'
            }]))
          }))
        }))
      }))

      const caller = ordersRouter.createCaller(mockCtx)

      await expect(caller.confirmPayment({ orderId: 1 }))
        .rejects.toThrow('Acesso negado')
    })
  })

  describe('list orders', () => {
    it('should return orders for user', async () => {
      const mockOrders = [
        { id: 1, orderCode: 'ORD-001', status: 'pending_payment' },
        { id: 2, orderCode: 'ORD-002', status: 'paid' }
      ]

      mockDb.select.mockImplementation(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn(() => ({
                offset: vi.fn(() => Promise.resolve(mockOrders))
              }))
            }))
          }))
        }))
      }))

      const caller = ordersRouter.createCaller(mockCtx)
      const result = await caller.list()

      expect(result.orders).toHaveLength(2)
      expect(result.total).toBe(2)
    })
  })
})