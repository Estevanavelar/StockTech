import React, { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'wouter'
import { trpc } from '../lib/trpc'
import { useToast } from '../hooks/useToast'
import { useWebSocket } from '../hooks/useWebSocket.tsx'
import { useAuth } from '@/_core/hooks/useAuth'
import { useIsDesktop } from '@/hooks/useMobile'
import { useOrderTransactionMapping, parseOrderItems } from '@/hooks/useOrderTransactionMapping'
import LoginModal from '@/components/LoginModal'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../components/ui/dialog'
import { Button } from '../components/ui/button'
import { Textarea } from '../components/ui/textarea'

interface Transaction {
  id: number
  date: string
  type: 'sale' | 'purchase'
  product: string
  productId: number
  counterparty: string
  counterpartyRole: 'buyer' | 'seller'
  amount: number
  quantity: number
  status: 'completed' | 'pending' | 'cancelled'
  sellerId?: string | null
}

export default function Transactions() {
  const [, setLocation] = useLocation()
  const { showToast } = useToast()
  const { isAuthenticated, loading: authLoading, user } = useAuth({ redirectOnUnauthenticated: false })
  const isLoggedIn = isAuthenticated && !authLoading && user !== null
  const isDesktop = useIsDesktop()
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [filter, setFilter] = useState<'returns' | 'sales' | 'purchases'>('returns')
  const [headerVisible, setHeaderVisible] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)

  // Efeito de esconder/mostrar header ao rolar (apenas mobile)
  useEffect(() => {
    if (isDesktop) return
    const container = document.getElementById('main-scroll-container')
    if (!container) return

    const handleScroll = () => {
      const currentScrollY = container.scrollTop
      
      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        setHeaderVisible(false)
      } else {
        setHeaderVisible(true)
      }
      
      setLastScrollY(currentScrollY)
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [lastScrollY, isDesktop])

  const transactionsQuery = trpc.transactions.list.useQuery(undefined, {
    refetchOnMount: 'always',
    refetchOnWindowFocus: true
  })
  const ordersQuery = trpc.orders.list.useQuery(
    { status: 'all', limit: 100, offset: 0 },
    { refetchOnMount: 'always', refetchOnWindowFocus: true }
  )
  const meQuery = trpc.auth.me.useQuery(undefined, {
    refetchOnMount: 'always',
    refetchOnWindowFocus: true
  })
  const returnsQuery = trpc.returns.list.useQuery(undefined, {
    refetchOnMount: 'always',
  })
  const returns = returnsQuery.data || []
  const userIdentifiers = useMemo(
    () => [meQuery.data?.id, meQuery.data?.email].filter(Boolean) as string[],
    [meQuery.data?.id, meQuery.data?.email]
  )
  const isCurrentUser = (value?: string | null) => !!value && userIdentifiers.includes(value)
  const sellerReturns = returns.filter(r => isCurrentUser(r.sellerId))
  const { lastMessage } = useWebSocket()
  const utils = trpc.useUtils()
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [selectedOrderIdToReject, setSelectedOrderIdToReject] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [returnModalOpen, setReturnModalOpen] = useState(false)
  const [selectedReturn, setSelectedReturn] = useState<{
    orderId: number;
    productId: number;
    productName: string;
    quantity: number;
  } | null>(null)
  const [returnReason, setReturnReason] = useState('')
  const [returnResponseModal, setReturnResponseModal] = useState<{
    returnId: number;
    reason: string;
    productName: string;
    quantity: number;
  } | null>(null)
  const [validateExchangeModal, setValidateExchangeModal] = useState<{
    returnId: number;
    productName: string;
    quantity: number;
  } | null>(null)
  const [validateNotes, setValidateNotes] = useState('')
  const [resolveExchangeModal, setResolveExchangeModal] = useState<{
    returnId: number;
    productName: string;
    quantity: number;
  } | null>(null)

  const updateStatusMutation = trpc.orders.updateStatus.useMutation({
    onMutate: async ({ orderId, status }) => {
      await Promise.all([
        utils.orders.list.cancel(),
        utils.transactions.list.cancel(),
      ])
      const previousOrders = utils.orders.list.getData()
      const previousTransactions = utils.transactions.list.getData()

      if (previousOrders?.orders) {
        utils.orders.list.setData(
          { status: 'all', limit: 100, offset: 0 },
          {
            ...previousOrders,
            orders: previousOrders.orders.map((order: any) =>
              order.id === orderId ? { ...order, status } : order
            ),
          }
        )
      }

      if (previousTransactions) {
        utils.transactions.list.setData(
          undefined,
          previousTransactions.map((tx: any) =>
            tx.orderId === orderId ? { ...tx, status } : tx
          )
        )
      }

      return { previousOrders, previousTransactions }
    },
    onError: (_error, _vars, context) => {
      if (context?.previousOrders) {
        utils.orders.list.setData(
          { status: 'all', limit: 100, offset: 0 },
          context.previousOrders
        )
      }
      if (context?.previousTransactions) {
        utils.transactions.list.setData(undefined, context.previousTransactions)
      }
    },
    onSettled: () => {
      void utils.orders.list.invalidate()
      void utils.transactions.list.invalidate()
    },
  })
  const confirmPaymentMutation = trpc.orders.confirmPayment.useMutation({
    onMutate: async ({ orderId }) => {
      await Promise.all([
        utils.orders.list.cancel(),
        utils.transactions.list.cancel(),
      ])
      const previousOrders = utils.orders.list.getData()
      const previousTransactions = utils.transactions.list.getData()

      if (previousOrders?.orders) {
        utils.orders.list.setData(
          { status: 'all', limit: 100, offset: 0 },
          {
            ...previousOrders,
            orders: previousOrders.orders.map((order: any) =>
              order.id === orderId ? { ...order, status: 'paid' } : order
            ),
          }
        )
      }

      if (previousTransactions) {
        utils.transactions.list.setData(
          undefined,
          previousTransactions.map((tx: any) =>
            tx.orderId === orderId ? { ...tx, status: 'completed' } : tx
          )
        )
      }

      return { previousOrders, previousTransactions }
    },
    onError: (_error, _vars, context) => {
      if (context?.previousOrders) {
        utils.orders.list.setData(
          { status: 'all', limit: 100, offset: 0 },
          context.previousOrders
        )
      }
      if (context?.previousTransactions) {
        utils.transactions.list.setData(undefined, context.previousTransactions)
      }
    },
    onSettled: () => {
      void utils.orders.list.invalidate()
      void utils.transactions.list.invalidate()
    },
  })
  const cancelOrderMutation = trpc.orders.cancel.useMutation({
    onMutate: async ({ orderId }) => {
      await Promise.all([
        utils.orders.list.cancel(),
        utils.transactions.list.cancel(),
      ])
      const previousOrders = utils.orders.list.getData()
      const previousTransactions = utils.transactions.list.getData()

      if (previousOrders?.orders) {
        utils.orders.list.setData(
          { status: 'all', limit: 100, offset: 0 },
          {
            ...previousOrders,
            orders: previousOrders.orders.map((order: any) =>
              order.id === orderId ? { ...order, status: 'cancelled' } : order
            ),
          }
        )
      }

      if (previousTransactions) {
        utils.transactions.list.setData(
          undefined,
          previousTransactions.map((tx: any) =>
            tx.orderId === orderId ? { ...tx, status: 'cancelled' } : tx
          )
        )
      }

      return { previousOrders, previousTransactions }
    },
    onError: (_error, _vars, context) => {
      if (context?.previousOrders) {
        utils.orders.list.setData(
          { status: 'all', limit: 100, offset: 0 },
          context.previousOrders
        )
      }
      if (context?.previousTransactions) {
        utils.transactions.list.setData(undefined, context.previousTransactions)
      }
    },
    onSettled: () => {
      void utils.orders.list.invalidate()
      void utils.transactions.list.invalidate()
    },
  })

  const respondReturnMutation = trpc.returns.respond.useMutation({
    onSuccess: () => {
      showToast('Resposta enviada!', 'success')
      utils.returns.list.invalidate()
      setReturnResponseModal(null)
    },
    onError: (error) => {
      showToast(error.message, 'error')
    },
  })

  const confirmDefectiveReceivedMutation = trpc.returns.confirmDefectiveReceived.useMutation({
    onSuccess: () => {
      showToast('Recebimento confirmado!', 'success')
      utils.returns.list.invalidate()
    },
    onError: (error) => {
      showToast(error.message, 'error')
    },
  })

  const validateExchangeMutation = trpc.returns.validateExchange.useMutation({
    onSuccess: () => {
      showToast('Validação registrada!', 'success')
      utils.returns.list.invalidate()
      setValidateExchangeModal(null)
    },
    onError: (error) => {
      showToast(error.message, 'error')
    },
  })

  const resolveRejectedExchangeMutation = trpc.returns.resolveRejectedExchange.useMutation({
    onSuccess: () => {
      showToast('Resolução registrada!', 'success')
      utils.returns.list.invalidate()
      setResolveExchangeModal(null)
    },
    onError: (error) => {
      showToast(error.message, 'error')
    },
  })

  const requestReturnMutation = trpc.returns.request.useMutation({
    onSuccess: () => {
      showToast('Solicitação de troca enviada ao vendedor!', 'success')
      setReturnModalOpen(false)
      setReturnReason('')
      utils.returns.list.invalidate()
    },
    onError: (error) => {
      showToast(error.message, 'error')
    },
  })

  const transactions: Transaction[] = (transactionsQuery.data || []).map((tx: any) => ({
    id: tx.id,
    date: tx.date || tx.createdAt || null,
    type: tx.type,
    product: tx.productName,
    productId: tx.productId,
    counterparty: tx.counterparty,
    counterpartyRole: tx.counterpartyRole,
    amount: parseFloat(tx.amount || '0'),
    quantity: tx.quantity,
    status: tx.status,
    sellerId: tx.sellerId,
  }))

  const mapStatusToOrders = (status: Transaction['status']) => {
    switch (status) {
      case 'pending':
        return {
          label: 'Solicitação pendente',
          color: 'bg-yellow-100 text-yellow-800 border-yellow-200'
        }
      case 'completed':
        return {
          label: 'Finalizado',
          color: 'bg-green-100 text-green-800 border-green-200'
        }
      case 'cancelled':
        return {
          label: 'Cancelado',
          color: 'bg-red-100 text-red-800 border-red-200'
        }
      default:
        return {
          label: 'Desconhecido',
          color: 'bg-gray-100 text-gray-800 border-gray-200'
        }
    }
  }

  const mapOrderStatusInfo = (status?: string | null) => {
    switch (status) {
      case 'pending_payment':
        return {
          label: 'Solicitação pendente',
          color: 'bg-yellow-100 text-yellow-800 border-yellow-200'
        }
      case 'paid':
        return {
          label: 'Pago',
          color: 'bg-green-100 text-green-800 border-green-200'
        }
      case 'processing':
        return {
          label: 'Aceito / Em transporte',
          color: 'bg-blue-100 text-blue-800 border-blue-200'
        }
      case 'shipped':
        return {
          label: 'Enviado',
          color: 'bg-purple-100 text-purple-800 border-purple-200'
        }
      case 'delivered':
        return {
          label: 'Finalizado',
          color: 'bg-green-100 text-green-800 border-green-200'
        }
      case 'awaiting_exchange':
        return {
          label: 'Aguardando Troca',
          color: 'bg-orange-100 text-orange-800 border-orange-200'
        }
      case 'exchange_completed':
        return {
          label: 'Troca Feita',
          color: 'bg-teal-100 text-teal-800 border-teal-200'
        }
      case 'exchange_rejected':
        return {
          label: 'Troca Recusada',
          color: 'bg-red-100 text-red-800 border-red-200'
        }
      case 'cancelled':
        return {
          label: 'Cancelado',
          color: 'bg-red-100 text-red-800 border-red-200'
        }
      default:
        return null
    }
  }

  const getReturnStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      requested: 'Pendente',
      replacement_sent: 'Peça enviada',
      defective_received: 'Defeituosa recebida',
      completed_approved: 'Troca concluída',
      completed_rejected_by_vendor: 'Aguardando sua decisão',
      converted_to_sale: 'Convertido em compra',
      returned_to_stock: 'Peça devolvida',
      approved_replacement: 'Troca aprovada',
      approved_refund: 'Reembolso aprovado',
      rejected: 'Troca recusada',
      completed: 'Concluído',
    }
    return map[status] || status
  }

  const getRoleLabel = (transaction: Transaction) => {
    if (transaction.type === 'sale') return 'Venda'
    if (transaction.type === 'purchase') return 'Compra'
    return transaction.counterpartyRole === 'buyer' ? 'Compra' : 'Venda'
  }

  const formatDateOnly = (value: string | null) => {
    if (!value) return 'Data indisponível'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'Data indisponível'
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatOrderCode = (transaction: Transaction) => {
    return `ORD-${String(transaction.id).padStart(8, '0')}`
  }

  const ordersForLookup = useMemo(() => {
    const orders = ordersQuery.data?.orders || []
    return orders.map((order: any) => ({
      ...order,
      parsedItems: parseOrderItems(order.items)
    }))
  }, [ordersQuery.data])

  const orderByTransactionId = useOrderTransactionMapping(
    transactions,
    ordersForLookup,
    meQuery.data?.email || meQuery.data?.id,
  )

  const uniqueTransactions = useMemo(() => {
    // Cada transação tem id único; não deduplicar por pedido (um pedido pode ter vários itens = várias transações)
    return [...transactions]
  }, [transactions])

  const handleAcceptSale = async (orderId: number) => {
    if (!isLoggedIn) {
      setShowLoginModal(true)
      return
    }
    try {
      await updateStatusMutation.mutateAsync({ orderId, status: 'processing' })
      showToast('Venda aceita com sucesso!', 'success')
      ordersQuery.refetch()
      transactionsQuery.refetch()
    } catch (error: any) {
      showToast(error?.message || 'Erro ao aceitar venda', 'error')
    }
  }

  const handleMarkPaid = async (orderId: number) => {
    if (!isLoggedIn) {
      setShowLoginModal(true)
      return
    }
    try {
      await confirmPaymentMutation.mutateAsync({ orderId })
      showToast('Pagamento confirmado com sucesso!', 'success')
      ordersQuery.refetch()
      transactionsQuery.refetch()
    } catch (error: any) {
      showToast(error?.message || 'Erro ao marcar como pago', 'error')
    }
  }

  const handleFinalizeSale = async (orderId: number) => {
    if (!isLoggedIn) {
      setShowLoginModal(true)
      return
    }
    try {
      await updateStatusMutation.mutateAsync({ orderId, status: 'delivered' })
      showToast('Venda finalizada com sucesso!', 'success')
      ordersQuery.refetch()
      transactionsQuery.refetch()
    } catch (error: any) {
      showToast(error?.message || 'Erro ao finalizar venda', 'error')
    }
  }

  const openReturnModal = (order: any) => {
    const items = Array.isArray(order?.items) ? order.items : []
    const warrantyItem = items.find((item: any) => item?.warrantyPeriod && item.warrantyPeriod !== 'NONE')
    const firstItem = warrantyItem || items[0]
    const productId = firstItem?.productId ?? firstItem?.id
    const productName = firstItem?.productName ?? firstItem?.name ?? `Pedido ${order.orderCode}`
    const quantity = Number(firstItem?.quantity ?? 1)
    const resolvedOrderId = firstItem?.orderId ?? order.id

    if (!productId || !resolvedOrderId) {
      showToast('Não foi possível identificar o produto para troca', 'error')
      return
    }

    setSelectedReturn({
      orderId: resolvedOrderId,
      productId,
      productName,
      quantity,
    })
    setReturnReason('')
    setReturnModalOpen(true)
  }

  const handleRejectSale = (orderId: number) => {
    if (!isLoggedIn) {
      setShowLoginModal(true)
      return
    }
    setSelectedOrderIdToReject(orderId)
    setRejectReason('')
    setRejectModalOpen(true)
  }

  const confirmRejectSale = async () => {
    if (!selectedOrderIdToReject) return
    if (!rejectReason || rejectReason.trim().length < 10) {
      showToast('Informe um motivo com pelo menos 10 caracteres.', 'error')
      return
    }
    try {
      await cancelOrderMutation.mutateAsync({ orderId: selectedOrderIdToReject, reason: rejectReason.trim() })
      showToast('Pedido rejeitado com sucesso.', 'success')
      setRejectModalOpen(false)
      ordersQuery.refetch()
      transactionsQuery.refetch()
    } catch (error: any) {
      showToast(error?.message || 'Erro ao rejeitar pedido', 'error')
    }
  }

  const formatReceiptAddress = (address: any) => {
    if (!address) return 'Endereco nao informado'
    const line1 = [address.street, address.number].filter(Boolean).join(', ')
    const line2 = [address.neighborhood, address.city, address.state].filter(Boolean).join(' - ')
    const line3 = address.zipCode ? `CEP: ${address.zipCode}` : ''
    return [line1, line2, line3].filter(Boolean).join('\n')
  }

  const formatAccountAddress = (account: any) => {
    if (!account) return undefined
    const line1 = account.address || ''
    const line2 = [account.city, account.state].filter(Boolean).join(' - ')
    const line3 = account.zip_code ? `CEP: ${account.zip_code}` : ''
    const complement = account.complement ? `Complemento: ${account.complement}` : ''
    const formatted = [line1, complement, line2, line3].filter(Boolean).join('\n')
    return formatted || undefined
  }

  const buildReceiptHtml = (data: {
    orderCode?: string
    buyerName: string
    buyerCnpj?: string
    buyerPhone?: string
    buyerAddress?: string
    sellerName: string
    sellerCnpj?: string
    sellerAddress?: string
    amount: number
    date: string
    items: Array<{ name: string; quantity: number; price: number }>
  }) => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Comprovante</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
          .receipt { width: 80mm; padding: 8px; box-sizing: border-box; }
          .title { text-align: center; font-size: 13px; font-weight: bold; margin-bottom: 4px; }
          .subtitle { text-align: center; font-size: 10px; color: #666; margin-bottom: 6px; }
          .line { font-size: 10.5px; margin: 2px 0; text-align: center; }
          .section-title { font-size: 10px; font-weight: bold; text-align: center; margin-top: 6px; }
          .divider { border-top: 1px dashed #999; margin: 6px 0; }
          .items { margin-top: 6px; }
          .total { margin-top: 6px; font-weight: bold; font-size: 11px; }
          .emph { font-weight: bold; }
          .actions { display: flex; gap: 6px; margin-bottom: 8px; }
          .actions button { font-size: 11px; padding: 6px; border: 1px solid #ddd; background: #f5f5f5; border-radius: 4px; }
          @media print { .actions { display: none; } body { padding: 0; } }
        </style>
        <style id="page-size">
          @page { size: 80mm auto; margin: 0; }
        </style>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
      </head>
      <body>
        <div class="actions">
          <button onclick="downloadPDF(58)">PDF 58mm</button>
          <button onclick="downloadPDF(80)">PDF 80mm</button>
          <button onclick="printReceipt(58)">Imprimir 58mm</button>
          <button onclick="printReceipt(80)">Imprimir 80mm</button>
        </div>
        <div class="receipt" id="receipt">
          <div class="title">STOCK TECH</div>
          <div class="line">Pedido: <span class="emph">${data.orderCode || 'N/A'}</span></div>
          <div class="line">Data/Hora: ${data.date}</div>
          <div class="divider"></div>
          <div class="section-title">LOJA RESPONSAVEL</div>
          <div class="line">${data.sellerName}</div>
          <div class="line">${data.sellerCnpj || 'CNPJ: nao informado'}</div>
          <div class="line" style="white-space: pre-wrap;">${data.sellerAddress || 'Endereco: nao informado'}</div>
          <div class="divider"></div>
          <div class="section-title">COMPRADOR</div>
          <div class="line">${data.buyerName}</div>
          <div class="line">${data.buyerCnpj || 'CNPJ: nao informado'}</div>
          <div class="line">${data.buyerPhone || 'Telefone: nao informado'}</div>
          <div class="line" style="white-space: pre-wrap;">${data.buyerAddress || 'Endereco: nao informado'}</div>
          <div class="divider"></div>
          <div class="items">
            ${data.items.map(item => `
              <div class="line">${item.quantity}x ${item.name} - R$ ${item.price.toLocaleString('pt-BR')}</div>
            `).join('')}
          </div>
          <div class="divider"></div>
          <div class="total line">Total: R$ ${data.amount.toLocaleString('pt-BR')}</div>
        </div>
        <script>
          function setPaper(width) {
            const receipt = document.getElementById('receipt');
            receipt.style.width = width + 'mm';
            const styleEl = document.getElementById('page-size');
            styleEl.textContent = '@page { size: ' + width + 'mm auto; margin: 0; }';
          }
          function downloadPDF(width) {
            setPaper(width);
            const element = document.getElementById('receipt');
            const opt = {
              margin: 0,
              filename: 'cupom-fiscal-' + width + 'mm.pdf',
              image: { type: 'jpeg', quality: 0.98 },
              html2canvas: { scale: 2, useCORS: true },
              jsPDF: { unit: 'mm', format: [width, 200], orientation: 'portrait' }
            };
            html2pdf().set(opt).from(element).save();
          }
          function printReceipt(width) {
            setPaper(width);
            window.print();
          }
        </script>
      </body>
      </html>
    `
  }

  const handleReceipt = async (transaction: Transaction, order: any) => {
    let resolvedOrder = order
    if (order?.id) {
      try {
        resolvedOrder = await utils.orders.getById.fetch({ orderId: order.id })
      } catch (error) {
        console.error('Erro ao carregar pedido para recibo:', error)
      }
    }

    const items = Array.isArray(resolvedOrder?.items)
      ? resolvedOrder.items.map((item: any) => ({
          name: item.productName || transaction.product,
          quantity: Number(item.quantity || transaction.quantity || 1),
          price: Number(item.price || transaction.amount || 0),
        }))
      : [{
          name: transaction.product,
          quantity: transaction.quantity || 1,
          price: transaction.amount || 0,
        }]

    const sellerDisplayName =
      resolvedOrder?.sellerStoreName ||
      (transaction.type === 'sale' ? 'Sua loja' : transaction.counterparty)

    const receiptHtml = buildReceiptHtml({
      orderCode: resolvedOrder?.orderCode,
      buyerName: transaction.type === 'sale' ? transaction.counterparty : 'Voce',
      buyerCnpj: resolvedOrder?.buyerAccount?.cnpj,
      buyerPhone: resolvedOrder?.buyerAccount?.whatsapp,
      buyerAddress: formatReceiptAddress(resolvedOrder?.address) || formatAccountAddress(resolvedOrder?.buyerAccount),
      sellerName: sellerDisplayName,
      sellerCnpj: resolvedOrder?.sellerAccount?.cnpj,
      sellerAddress: formatAccountAddress(resolvedOrder?.sellerAccount),
      amount: transaction.amount,
      date: formatDateOnly(transaction.date),
      items,
    })

    const win = window.open('', '_blank', 'width=420,height=760')
    if (!win) return
    win.document.open()
    win.document.write(receiptHtml)
    win.document.close()
  }

  useEffect(() => {
    if (!lastMessage) return
    if (['order_created', 'payment_confirmed', 'order_updated'].includes(lastMessage.type)) {
      transactionsQuery.refetch()
      ordersQuery.refetch()
    }
  }, [lastMessage, ordersQuery, transactionsQuery])

  const filteredTransactions = uniqueTransactions
    .filter(tx => {
      if (filter === 'sales') return tx.type === 'sale'
      if (filter === 'purchases') return tx.type === 'purchase'
      return false
    })
    .sort((a, b) => {
      const aDate = new Date(a.date || '').getTime()
      const bDate = new Date(b.date || '').getTime()
      return bDate - aDate
    })

  const buildOrderDetailsUrl = (transaction: Transaction) => {
    const order = orderByTransactionId.get(transaction.id)
    const role = transaction.type === 'sale' ? 'VENDA' : 'COMPRA'
    if (order?.orderCode) {
      return `/order-details/${role}/${order.orderCode}`
    }
    if (transaction.productId && transaction.sellerId) {
      const params = new URLSearchParams({
        productId: String(transaction.productId),
        sellerId: String(transaction.sellerId),
      })
      return `/order-details?${params.toString()}`
    }
    return '/order-details'
  }

  const buildRatingUrl = (transaction: Transaction) => {
    const order = orderByTransactionId.get(transaction.id)
    const role = transaction.type === 'sale' ? 'VENDA' : 'COMPRA'
    if (order?.orderCode) {
      return `/order-details/${role}/${order.orderCode}?tab=rating`
    }
    const params = new URLSearchParams({
      transactionId: String(transaction.id),
      productId: String(transaction.productId),
      sellerId: String(transaction.sellerId || ''),
      tab: 'rating',
    })
    return `/order-details?${params.toString()}`
  }

  const totalSales = transactions
    .filter(tx => tx.type === 'sale' && tx.status !== 'cancelled')
    .reduce((sum, tx) => sum + tx.amount, 0)

  const totalPurchases = transactions
    .filter(tx => tx.type === 'purchase' && tx.status !== 'cancelled')
    .reduce((sum, tx) => sum + tx.amount, 0)

  const totalTransactions = transactions.length

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed':
        return '✅ Concluído'
      case 'pending':
        return '⏳ Pendente'
      case 'cancelled':
        return '❌ Cancelado'
      default:
        return 'Desconhecido'
    }
  }

  const getTransactionIcon = (type: string) => {
    return type === 'sale' ? '📤' : '📥'
  }

  const getTransactionColor = (type: string) => {
    return type === 'sale' ? 'border-green-200 bg-green-50' : 'border-blue-200 bg-blue-50'
  }

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const formatDateTime = (value: string | null) => {
    if (!value) return 'Data indisponível'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'Data indisponível'
    return date.toLocaleString('pt-BR')
  }

  const getWarrantyRemainingLabel = (warrantyExpiresAt?: string | Date | null) => {
    if (!warrantyExpiresAt) return 'Prazo indisponível'
    const expiresAt = new Date(warrantyExpiresAt)
    if (Number.isNaN(expiresAt.getTime())) return 'Prazo indisponível'
    const diffMs = expiresAt.getTime() - Date.now()
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
    if (diffDays < 0) return `Garantia expirada há ${Math.abs(diffDays)} dia(s)`
    return `Faltam ${diffDays} dia(s)`
  }

  const renderReturnReason = (reason?: string | null) => {
    const text = (reason || '').trim()
    if (!text) return '—'
    const shouldMarquee = text.length > 28

    if (!shouldMarquee) return text

    return (
      <div className="relative max-w-[200px] overflow-hidden whitespace-nowrap">
        <div
          className="inline-flex items-center gap-8 pr-8"
          style={{ animation: 'reasonMarquee 9s linear infinite' }}
        >
          <span>{text}</span>
          <span aria-hidden>{text}</span>
        </div>
      </div>
    )
  }

  /* ========== DESKTOP LAYOUT ========== */
  if (isDesktop) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-gray-50">
        <style>{`
          @keyframes reasonMarquee {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
        `}</style>
        {/* Breadcrumb */}
        <div className="max-w-7xl mx-auto px-6 py-3">
          <nav className="flex items-center gap-2 text-sm text-gray-500">
            <button onClick={() => setLocation('/catalog')} className="hover:text-blue-600 transition-colors">Início</button>
            <span>/</span>
            <span className="text-gray-900 font-medium">Transações</span>
          </nav>
        </div>

        <div className="max-w-7xl mx-auto px-6 pb-8">
          {/* Header com tabs */}
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">💳 Minhas Transações</h1>
              <p className="text-sm text-gray-500 mt-0.5">Vendas, compras e solicitações de troca</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('returns')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'returns' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                🔄 Trocas
              </button>
              <button
                onClick={() => setFilter('sales')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'sales' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                📤 Vendas
              </button>
              <button
                onClick={() => setFilter('purchases')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'purchases' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                📥 Compras
              </button>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
              <p className="text-xs text-gray-500 font-medium uppercase">Total</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{totalTransactions}</p>
            </div>
            <div className="bg-green-50 rounded-lg border border-green-200 p-5">
              <p className="text-xs text-green-700 font-medium uppercase">Vendas</p>
              <p className="text-xl font-bold text-green-900 mt-1">R$ {formatCurrency(totalSales)}</p>
            </div>
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-5">
              <p className="text-xs text-blue-700 font-medium uppercase">Compras</p>
              <p className="text-xl font-bold text-blue-900 mt-1">R$ {formatCurrency(totalPurchases)}</p>
            </div>
            <div className="bg-amber-50 rounded-lg border border-amber-200 p-5">
              <p className="text-xs text-amber-700 font-medium uppercase">Trocas Pendentes</p>
              <p className="text-2xl font-bold text-amber-900 mt-1">{sellerReturns.filter(r => r.status === 'requested').length}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
              <p className="text-xs text-gray-500 font-medium uppercase">Total Trocas</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{sellerReturns.length}</p>
            </div>
          </div>

          {/* Conteúdo: Trocas ou Transações */}
          {filter === 'returns' ? (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
              {returns.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-4 py-3 font-semibold text-gray-900">Produto</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-900">Código</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-900">Pedido</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-900">Qtd</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-900">Garantia</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-900">Status</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-900">Motivo</th>
                        <th className="text-right px-4 py-3 font-semibold text-gray-900">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {returns.map(ret => (
                        <tr key={ret.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{ret.productName}</td>
                          <td className="px-4 py-3 text-gray-600">{ret.productCode || '---'}</td>
                          <td className="px-4 py-3 text-gray-600">{ret.orderCode || '---'}</td>
                          <td className="px-4 py-3">{ret.quantity}</td>
                          <td className="px-4 py-3 text-gray-600">{getWarrantyRemainingLabel(ret.warrantyExpiresAt)}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
                              {getReturnStatusLabel(ret.status)}
                            </span>
                            {ret.isWithinWarranty && (
                              <span className="ml-1 px-2 py-1 bg-green-100 text-green-800 text-xs rounded">✅</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-600 max-w-[200px]" title={ret.reason}>
                            {renderReturnReason(ret.reason)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {isCurrentUser(ret.sellerId) && ret.status === 'requested' && (
                              <div className="flex gap-2 justify-end">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => respondReturnMutation.mutate({ returnId: ret.id, decision: 'approve_replacement' })}
                                  disabled={respondReturnMutation.isLoading}
                                >
                                  ✅
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => respondReturnMutation.mutate({ returnId: ret.id, decision: 'approve_refund' })}
                                  disabled={respondReturnMutation.isLoading}
                                >
                                  💰
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => setReturnResponseModal({ returnId: ret.id, reason: ret.reason, productName: ret.productName, quantity: ret.quantity })}
                                >
                                  ❌
                                </Button>
                              </div>
                            )}
                            {isCurrentUser(ret.sellerId) && ret.status === 'replacement_sent' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => confirmDefectiveReceivedMutation.mutate({ returnId: ret.id })}
                                disabled={confirmDefectiveReceivedMutation.isLoading}
                              >
                                📥 Confirmar Recebimento
                              </Button>
                            )}
                            {isCurrentUser(ret.sellerId) && ret.status === 'defective_received' && (
                              <div className="flex gap-2 justify-end">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setValidateExchangeModal({ returnId: ret.id, productName: ret.productName, quantity: ret.quantity })}
                                  disabled={validateExchangeMutation.isLoading}
                                >
                                  Validar
                                </Button>
                              </div>
                            )}
                            {isCurrentUser(ret.buyerId) && ret.status === 'completed_rejected_by_vendor' && (
                              <div className="flex gap-2 justify-end">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setResolveExchangeModal({ returnId: ret.id, productName: ret.productName, quantity: ret.quantity })}
                                  disabled={resolveRejectedExchangeMutation.isLoading}
                                >
                                  Resolver
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-12 text-center">
                  <p className="text-4xl mb-4">🔄</p>
                  <p className="text-gray-500">Nenhuma troca encontrada</p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
              {filteredTransactions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-4 py-3 font-semibold text-gray-900">Produto</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-900">Tipo</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-900">Contraparte</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-900">Qtd</th>
                        <th className="text-right px-4 py-3 font-semibold text-gray-900">Valor</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-900">Status</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-900">Data</th>
                        <th className="text-right px-4 py-3 font-semibold text-gray-900">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransactions.map(transaction => {
                        const order = orderByTransactionId.get(transaction.id)
                        const orderStatusInfo = order ? mapOrderStatusInfo(order.status) : null
                        const statusInfo = orderStatusInfo || mapStatusToOrders(transaction.status)
                        const orderCode = order?.orderCode || formatOrderCode(transaction)
                        const displayDate = order?.createdAt || transaction.date
                        const showSalesActions = transaction.type === 'sale' && !!order

                        return (
                          <tr key={transaction.id} className={`border-b border-gray-100 hover:bg-gray-50 ${transaction.type === 'sale' ? 'bg-green-50/30' : 'bg-blue-50/30'}`}>
                            <td className="px-4 py-3 font-medium text-gray-900">{transaction.product}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${transaction.type === 'sale' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                                {getRoleLabel(transaction)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-600">{transaction.counterparty}</td>
                            <td className="px-4 py-3">{transaction.quantity}</td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-900">R$ {formatCurrency(transaction.amount)}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-xs font-medium border ${statusInfo?.color || 'bg-gray-100 text-gray-800'}`}>
                                {statusInfo?.label || '—'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-600">{formatDateOnly(displayDate)}</td>
                            <td className="px-4 py-3">
                              <div className="flex gap-2 justify-end flex-wrap">
                                <button
                                  onClick={() => setLocation(buildOrderDetailsUrl(transaction))}
                                  className="px-2 py-1 text-blue-600 hover:bg-blue-50 rounded text-xs font-medium"
                                >
                                  👁️
                                </button>
                                {order && transaction.type === 'sale' && (
                                  <button onClick={() => handleReceipt(transaction, order)} className="px-2 py-1 text-gray-600 hover:bg-gray-100 rounded text-xs font-medium" title="Cupom">🧾</button>
                                )}
                                {showSalesActions && order?.status === 'pending_payment' && (
                                  <>
                                    <button onClick={() => handleAcceptSale(order.id)} disabled={updateStatusMutation.isLoading} className="px-2 py-1 text-green-600 hover:bg-green-50 rounded text-xs font-medium" title="Aceitar">✅</button>
                                    <button onClick={() => handleRejectSale(order.id)} disabled={cancelOrderMutation.isLoading} className="px-2 py-1 text-red-600 hover:bg-red-50 rounded text-xs font-medium" title="Rejeitar">❌</button>
                                  </>
                                )}
                                {showSalesActions && order?.status === 'processing' && (
                                  <button onClick={() => handleMarkPaid(order.id)} disabled={confirmPaymentMutation.isLoading} className="px-2 py-1 text-green-600 hover:bg-green-50 rounded text-xs font-medium" title="Marcar como pago">💳</button>
                                )}
                                {showSalesActions && ['paid', 'shipped'].includes(order?.status) && (
                                  <button onClick={() => handleFinalizeSale(order.id)} disabled={updateStatusMutation.isLoading} className="px-2 py-1 text-green-600 hover:bg-green-50 rounded text-xs font-medium" title="Finalizar">✅</button>
                                )}
                                {transaction.type === 'purchase' && order?.status === 'delivered' && order?.items?.some((item: any) => item?.warrantyPeriod && item.warrantyPeriod !== 'NONE') && (
                                  <button onClick={() => openReturnModal(order)} className="px-2 py-1 text-amber-600 hover:bg-amber-50 rounded text-xs font-medium" title="Solicitar troca">🔄</button>
                                )}
                                {transaction.type === 'purchase' && transaction.status === 'completed' && (
                                  <button onClick={() => setLocation(buildRatingUrl(transaction))} className="px-2 py-1 text-yellow-600 hover:bg-yellow-50 rounded text-xs font-medium" title="Avaliar">⭐</button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-12 text-center">
                  <p className="text-4xl mb-4">💳</p>
                  <p className="text-gray-500">Nenhuma transação encontrada</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modais compartilhados */}
        <Dialog open={returnModalOpen} onOpenChange={setReturnModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>🔄 Solicitar Troca de Produto</DialogTitle>
              <DialogDescription>Informe o motivo da troca para o vendedor analisar.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {selectedReturn && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm font-medium">{selectedReturn.productName}</p>
                  <p className="text-xs text-gray-600">Quantidade: {selectedReturn.quantity}</p>
                </div>
              )}
              <div>
                <Textarea value={returnReason} onChange={(e) => setReturnReason(e.target.value)} placeholder="Descreva o defeito ou problema encontrado..." rows={4} />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setReturnModalOpen(false)}>Cancelar</Button>
              <Button onClick={() => { if (!selectedReturn || !returnReason.trim() || returnReason.trim().length < 10) { showToast('Informe o motivo da troca (mín. 10 caracteres)', 'error'); return } requestReturnMutation.mutate({ orderId: selectedReturn.orderId, productId: selectedReturn.productId, quantity: selectedReturn.quantity, reason: returnReason.trim() }) }}>Enviar Solicitação</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rejeitar Venda</DialogTitle>
              <DialogDescription>Por favor, informe o motivo da rejeição para notificar o comprador.</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Textarea placeholder="Ex: Produto fora de estoque, erro no preço..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="min-h-[100px]" />
              <p className="text-xs text-gray-500 mt-2">Mínimo de 10 caracteres.</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectModalOpen(false)}>Cancelar</Button>
              <Button variant="destructive" onClick={confirmRejectSale} disabled={cancelOrderMutation.isLoading}>{cancelOrderMutation.isLoading ? 'Rejeitando...' : 'Confirmar Rejeição'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={!!returnResponseModal} onOpenChange={() => setReturnResponseModal(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rejeitar Solicitação de Troca</DialogTitle>
              <DialogDescription>Por favor, informe o motivo da rejeição para notificar o comprador.</DialogDescription>
            </DialogHeader>
            {returnResponseModal && (
              <div className="py-4">
                <div className="bg-gray-50 p-3 rounded-lg mb-4">
                  <p className="text-sm font-medium">{returnResponseModal.productName}</p>
                  <p className="text-xs text-gray-600">Quantidade: {returnResponseModal.quantity}</p>
                </div>
                <Textarea placeholder="Ex: Produto não apresenta defeito, fora do período de garantia..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="min-h-[100px]" />
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setReturnResponseModal(null)}>Cancelar</Button>
              <Button variant="destructive" onClick={() => { if (returnResponseModal && rejectReason.trim()) { respondReturnMutation.mutate({ returnId: returnResponseModal.returnId, decision: 'reject', rejectionReason: rejectReason }); setRejectReason('') } else { showToast('Informe o motivo da rejeição', 'error') } }} disabled={respondReturnMutation.isLoading || !rejectReason.trim()}>{respondReturnMutation.isLoading ? 'Rejeitando...' : 'Confirmar Rejeição'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={!!validateExchangeModal} onOpenChange={(open) => { if (!open) { setValidateExchangeModal(null); setValidateNotes('') } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Validar Troca</DialogTitle>
              <DialogDescription>A peça defeituosa atende aos critérios de troca?</DialogDescription>
            </DialogHeader>
            {validateExchangeModal && (
              <div className="py-4 space-y-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm font-medium">{validateExchangeModal.productName}</p>
                  <p className="text-xs text-gray-600">Quantidade: {validateExchangeModal.quantity}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Observações (opcional)</label>
                  <Textarea
                    placeholder="Ex: Peça em perfeito estado para troca..."
                    value={validateNotes}
                    onChange={(e) => setValidateNotes(e.target.value)}
                    className="mt-1 min-h-[80px]"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => validateExchangeMutation.mutate({ returnId: validateExchangeModal.returnId, approved: true, validationNotes: validateNotes })}
                    disabled={validateExchangeMutation.isLoading}
                  >
                    Aprovar Troca
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => validateExchangeMutation.mutate({ returnId: validateExchangeModal.returnId, approved: false, validationNotes: validateNotes })}
                    disabled={validateExchangeMutation.isLoading}
                  >
                    Rejeitar
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
        <Dialog open={!!resolveExchangeModal} onOpenChange={(open) => { if (!open) setResolveExchangeModal(null) }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Resolver Troca Rejeitada</DialogTitle>
              <DialogDescription>A peça não atende aos critérios. Escolha como deseja prosseguir:</DialogDescription>
            </DialogHeader>
            {resolveExchangeModal && (
              <div className="py-4 space-y-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm font-medium">{resolveExchangeModal.productName}</p>
                  <p className="text-xs text-gray-600">Quantidade: {resolveExchangeModal.quantity}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => resolveRejectedExchangeMutation.mutate({ returnId: resolveExchangeModal.returnId, resolution: 'pay' })}
                    disabled={resolveRejectedExchangeMutation.isLoading}
                  >
                    Pagar pela Peça
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => resolveRejectedExchangeMutation.mutate({ returnId: resolveExchangeModal.returnId, resolution: 'return_product' })}
                    disabled={resolveRejectedExchangeMutation.isLoading}
                  >
                    Devolver Peça
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
        <LoginModal open={showLoginModal} onOpenChange={setShowLoginModal} />
      </div>
    )
  }

  /* ========== MOBILE LAYOUT ========== */
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white pb-24">
      <style>{`
        @keyframes reasonMarquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
      {/* Header */}
      <header className={`bg-white border-b border-gray-100 sticky top-0 z-20 transition-transform duration-300 ${
        headerVisible ? 'translate-y-0' : '-translate-y-full'
      }`}>
        <div className="px-4 py-4">
          <h1 className="text-lg font-semibold text-gray-900">💳 Minhas Transações</h1>
          <button
            type="button"
            onClick={() => setLocation('/order-history')}
            className="text-xs text-gray-600 mt-1 hover:text-gray-900 transition-colors"
          >
            Histórico de compras e vendas
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* Modal Solicitar Troca */}
        <Dialog open={returnModalOpen} onOpenChange={setReturnModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>🔄 Solicitar Troca de Produto</DialogTitle>
              <DialogDescription>
                Informe o motivo da troca para o vendedor analisar.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {selectedReturn && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm font-medium">{selectedReturn.productName}</p>
                  <p className="text-xs text-gray-600">Quantidade: {selectedReturn.quantity}</p>
                </div>
              )}
              <div>
                <Textarea
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="Descreva o defeito ou problema encontrado..."
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button
                variant="outline"
                onClick={() => setReturnModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  if (!selectedReturn || !returnReason.trim() || returnReason.trim().length < 10) {
                    showToast('Informe o motivo da troca (mín. 10 caracteres)', 'error')
                    return
                  }
                  requestReturnMutation.mutate({
                    orderId: selectedReturn.orderId,
                    productId: selectedReturn.productId,
                    quantity: selectedReturn.quantity,
                    reason: returnReason.trim(),
                  })
                }}
              >
                Enviar Solicitação
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Rejection Modal */}
        <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rejeitar Venda</DialogTitle>
              <DialogDescription>
                Por favor, informe o motivo da rejeição para notificar o comprador.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Textarea
                placeholder="Ex: Produto fora de estoque, erro no preço..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="min-h-[100px]"
              />
              <p className="text-xs text-gray-500 mt-2">
                Mínimo de 10 caracteres.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectModalOpen(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={confirmRejectSale} disabled={cancelOrderMutation.isLoading}>
                {cancelOrderMutation.isLoading ? 'Rejeitando...' : 'Confirmar Rejeição'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Return Response Modal */}
        <Dialog open={!!returnResponseModal} onOpenChange={() => setReturnResponseModal(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rejeitar Solicitação de Troca</DialogTitle>
              <DialogDescription>
                Por favor, informe o motivo da rejeição para notificar o comprador.
              </DialogDescription>
            </DialogHeader>
            {returnResponseModal && (
              <div className="py-4">
                <div className="bg-gray-50 p-3 rounded-lg mb-4">
                  <p className="text-sm font-medium">{returnResponseModal.productName}</p>
                  <p className="text-xs text-gray-600">Quantidade: {returnResponseModal.quantity}</p>
                </div>

                <Textarea
                  placeholder="Ex: Produto não apresenta defeito, fora do período de garantia..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setReturnResponseModal(null)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (returnResponseModal && rejectReason.trim()) {
                    respondReturnMutation.mutate({
                      returnId: returnResponseModal.returnId,
                      decision: 'reject',
                      rejectionReason: rejectReason,
                    })
                    setRejectReason('')
                  } else {
                    showToast('Informe o motivo da rejeição', 'error')
                  }
                }}
                disabled={respondReturnMutation.isLoading || !rejectReason.trim()}
              >
                {respondReturnMutation.isLoading ? 'Rejeitando...' : 'Confirmar Rejeição'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!validateExchangeModal} onOpenChange={(open) => { if (!open) { setValidateExchangeModal(null); setValidateNotes('') } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Validar Troca</DialogTitle>
              <DialogDescription>A peça defeituosa atende aos critérios de troca?</DialogDescription>
            </DialogHeader>
            {validateExchangeModal && (
              <div className="py-4 space-y-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm font-medium">{validateExchangeModal.productName}</p>
                  <p className="text-xs text-gray-600">Quantidade: {validateExchangeModal.quantity}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Observações (opcional)</label>
                  <Textarea
                    placeholder="Ex: Peça em perfeito estado para troca..."
                    value={validateNotes}
                    onChange={(e) => setValidateNotes(e.target.value)}
                    className="mt-1 min-h-[80px]"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => validateExchangeMutation.mutate({ returnId: validateExchangeModal.returnId, approved: true, validationNotes: validateNotes })}
                    disabled={validateExchangeMutation.isLoading}
                  >
                    Aprovar Troca
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => validateExchangeMutation.mutate({ returnId: validateExchangeModal.returnId, approved: false, validationNotes: validateNotes })}
                    disabled={validateExchangeMutation.isLoading}
                  >
                    Rejeitar
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={!!resolveExchangeModal} onOpenChange={(open) => { if (!open) setResolveExchangeModal(null) }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Resolver Troca Rejeitada</DialogTitle>
              <DialogDescription>A peça não atende aos critérios. Escolha como deseja prosseguir:</DialogDescription>
            </DialogHeader>
            {resolveExchangeModal && (
              <div className="py-4 space-y-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm font-medium">{resolveExchangeModal.productName}</p>
                  <p className="text-xs text-gray-600">Quantidade: {resolveExchangeModal.quantity}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => resolveRejectedExchangeMutation.mutate({ returnId: resolveExchangeModal.returnId, resolution: 'pay' })}
                    disabled={resolveRejectedExchangeMutation.isLoading}
                  >
                    Pagar pela Peça
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => resolveRejectedExchangeMutation.mutate({ returnId: resolveExchangeModal.returnId, resolution: 'return_product' })}
                    disabled={resolveRejectedExchangeMutation.isLoading}
                  >
                    Devolver Peça
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm text-center">
            <p className="text-2xl font-bold text-gray-900">{totalTransactions}</p>
            <p className="text-xs text-gray-600 mt-1">Total</p>
          </div>
          <div className="bg-green-50 rounded-2xl border border-green-200 p-4 shadow-sm text-center">
            <p className="text-2xl font-bold text-green-700">📤</p>
            <p className="text-xs text-green-700 mt-1 font-medium">Vendas</p>
            <p className="text-sm font-bold text-green-900 mt-1">R$ {formatCurrency(totalSales)}</p>
          </div>
          <div className="bg-blue-50 rounded-2xl border border-blue-200 p-4 shadow-sm text-center">
            <p className="text-2xl font-bold text-blue-700">📥</p>
            <p className="text-xs text-blue-700 mt-1 font-medium">Compras</p>
            <p className="text-sm font-bold text-blue-900 mt-1">R$ {formatCurrency(totalPurchases)}</p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 bg-white rounded-2xl border border-gray-100 p-2 shadow-sm">
          <button
            onClick={() => setFilter('returns')}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'returns'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Trocas
          </button>
          <button
            onClick={() => setFilter('sales')}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'sales'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Vendas
          </button>
          <button
            onClick={() => setFilter('purchases')}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'purchases'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Compras
          </button>
        </div>

        {/* Solicitações de Troca (aba Trocas) */}
        {filter === 'returns' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-semibold text-yellow-900 mb-3">
              🔄 Trocas ({returns.length})
            </h3>
            {returns.length === 0 ? (
              <p className="text-sm text-yellow-900">Nenhuma troca encontrada.</p>
            ) : (
              <div className="space-y-3">
                {returns.map(ret => (
                  <div key={ret.id} className="bg-white rounded-lg border border-yellow-300 p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium text-sm">{ret.productName}</p>
                        <p className="text-xs text-gray-600">Código: {ret.returnCode}</p>
                        <p className="text-xs text-gray-600">Pedido: {ret.orderCode || '---'}</p>
                        <p className="text-xs text-gray-600">Produto: {ret.productCode || '---'}</p>
                        <p className="text-xs text-gray-600">Quantidade: {ret.quantity}</p>
                        <p className="text-xs text-gray-600">
                          Garantia: {getWarrantyRemainingLabel(ret.warrantyExpiresAt)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {ret.isWithinWarranty && (
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                            ✅
                          </span>
                        )}
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                          {getReturnStatusLabel(ret.status)}
                        </span>
                      </div>
                    </div>

                    <div className="bg-gray-50 p-2 rounded mt-2">
                      <p className="text-xs text-gray-600 font-medium">Motivo:</p>
                      <p className="text-xs text-gray-900">{renderReturnReason(ret.reason)}</p>
                    </div>

                    {isCurrentUser(ret.sellerId) && ret.status === 'requested' && (
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => respondReturnMutation.mutate({ returnId: ret.id, decision: 'approve_replacement' })}
                          className="flex-1"
                          disabled={respondReturnMutation.isLoading}
                        >
                          ✅
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => respondReturnMutation.mutate({ returnId: ret.id, decision: 'approve_refund' })}
                          className="flex-1"
                          disabled={respondReturnMutation.isLoading}
                        >
                          💰
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setReturnResponseModal({ returnId: ret.id, reason: ret.reason, productName: ret.productName, quantity: ret.quantity })}
                        >
                          ❌
                        </Button>
                      </div>
                    )}
                    {isCurrentUser(ret.sellerId) && ret.status === 'replacement_sent' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full mt-3"
                        onClick={() => confirmDefectiveReceivedMutation.mutate({ returnId: ret.id })}
                        disabled={confirmDefectiveReceivedMutation.isLoading}
                      >
                        📥 Confirmar Recebimento Defeituosa
                      </Button>
                    )}
                    {isCurrentUser(ret.sellerId) && ret.status === 'defective_received' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full mt-3"
                        onClick={() => setValidateExchangeModal({ returnId: ret.id, productName: ret.productName, quantity: ret.quantity })}
                        disabled={validateExchangeMutation.isLoading}
                      >
                        Validar Troca
                      </Button>
                    )}
                    {isCurrentUser(ret.buyerId) && ret.status === 'completed_rejected_by_vendor' && (
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => resolveRejectedExchangeMutation.mutate({ returnId: ret.id, resolution: 'pay' })}
                          disabled={resolveRejectedExchangeMutation.isLoading}
                        >
                          💰 Pagar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => resolveRejectedExchangeMutation.mutate({ returnId: ret.id, resolution: 'return_product' })}
                          disabled={resolveRejectedExchangeMutation.isLoading}
                        >
                          📦 Devolver
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Transactions List */}
        {filter !== 'returns' && (
          <div className="space-y-3">
            {filteredTransactions.length > 0 ? (
              filteredTransactions.map(transaction => {
              const order = orderByTransactionId.get(transaction.id)
              const orderStatusInfo = order ? mapOrderStatusInfo(order.status) : null
              const statusInfo = orderStatusInfo || mapStatusToOrders(transaction.status)
              const orderCode = order?.orderCode || formatOrderCode(transaction)
              const displayDate = order?.createdAt || transaction.date
              const showSalesActions = transaction.type === 'sale' && !!order

              return (
              <div
                key={transaction.id}
                className={`rounded-2xl border-2 p-4 shadow-sm ${getTransactionColor(transaction.type)}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3 flex-1">
                    <span className="text-2xl">{getTransactionIcon(transaction.type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold text-gray-900 text-sm">
                          {transaction.product}
                        </h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        {getRoleLabel(transaction)} {orderCode} • {transaction.quantity} unidade(s) • {formatDateOnly(displayDate)}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        {transaction.type === 'sale' ? 'Comprador' : 'Vendedor'}: {transaction.counterparty}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold text-gray-900">
                      R$ {formatCurrency(transaction.amount)}
                    </p>
                    <p className="text-xs text-gray-600">Total</p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 mt-3 pt-3 border-t border-current border-opacity-20 flex-wrap">
                  <button
                    onClick={() => setLocation(buildOrderDetailsUrl(transaction))}
                    className="flex-1 px-3 py-2 border border-current border-opacity-30 hover:bg-white hover:bg-opacity-50 text-gray-700 text-xs font-medium rounded-lg transition-colors"
                  >
                    👁️ Detalhes
                  </button>
                  {order && transaction.type === 'sale' && (
                    <button
                      onClick={() => handleReceipt(transaction, order)}
                      className="flex-1 px-3 py-2 border border-current border-opacity-30 hover:bg-white hover:bg-opacity-50 text-gray-700 text-xs font-medium rounded-lg transition-colors"
                    >
                      🧾 Cupom
                    </button>
                  )}
                  {showSalesActions && order?.status === 'pending_payment' && (
                    <button
                      onClick={() => handleAcceptSale(order.id)}
                      disabled={updateStatusMutation.isLoading}
                      className="relative flex-1 px-3 py-2 border border-current border-opacity-30 hover:bg-white hover:bg-opacity-50 text-gray-700 text-xs font-medium rounded-lg transition-colors"
                    >
                      ✅ Aceitar Venda
                      {!isLoggedIn && (
                        <span
                          className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full border-2 border-white flex items-center justify-center text-[8px]"
                          title="Login necessário"
                        >
                          !
                        </span>
                      )}
                    </button>
                  )}
                  {showSalesActions && order?.status === 'pending_payment' && (
                    <button
                      onClick={() => handleRejectSale(order.id)}
                      disabled={cancelOrderMutation.isLoading}
                      className="relative flex-1 px-3 py-2 border border-current border-opacity-30 hover:bg-white hover:bg-opacity-50 text-gray-700 text-xs font-medium rounded-lg transition-colors"
                    >
                      ❌ Rejeitar
                      {!isLoggedIn && (
                        <span
                          className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full border-2 border-white flex items-center justify-center text-[8px]"
                          title="Login necessário"
                        >
                          !
                        </span>
                      )}
                    </button>
                  )}
                  {showSalesActions && order?.status === 'processing' && (
                    <button
                      onClick={() => handleMarkPaid(order.id)}
                      disabled={confirmPaymentMutation.isLoading}
                      className="relative flex-1 px-3 py-2 border border-current border-opacity-30 hover:bg-white hover:bg-opacity-50 text-gray-700 text-xs font-medium rounded-lg transition-colors"
                    >
                      💳 Marcar como Pago
                      {!isLoggedIn && (
                        <span
                          className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full border-2 border-white flex items-center justify-center text-[8px]"
                          title="Login necessário"
                        >
                          !
                        </span>
                      )}
                    </button>
                  )}
                  {showSalesActions && ['paid', 'shipped'].includes(order?.status) && (
                    <button
                      onClick={() => handleFinalizeSale(order.id)}
                      disabled={updateStatusMutation.isLoading}
                      className="relative flex-1 px-3 py-2 border border-current border-opacity-30 hover:bg-white hover:bg-opacity-50 text-gray-700 text-xs font-medium rounded-lg transition-colors"
                    >
                      ✅ Finalizar venda
                      {!isLoggedIn && (
                        <span
                          className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full border-2 border-white flex items-center justify-center text-[8px]"
                          title="Login necessário"
                        >
                          !
                        </span>
                      )}
                    </button>
                  )}
                  {transaction.type === 'purchase' && order?.status === 'delivered' && order?.items?.some((item: any) => item?.warrantyPeriod && item.warrantyPeriod !== 'NONE') && (
                    <button
                      onClick={() => openReturnModal(order)}
                      className="flex-1 px-3 py-2 border border-current border-opacity-30 hover:bg-white hover:bg-opacity-50 text-gray-700 text-xs font-medium rounded-lg transition-colors"
                    >
                      🔄 Solicitar Troca
                    </button>
                  )}
                  {transaction.type === 'purchase' && transaction.status === 'completed' && (
                    <button
                      onClick={() => setLocation(buildRatingUrl(transaction))}
                      className="flex-1 px-3 py-2 border border-current border-opacity-30 hover:bg-white hover:bg-opacity-50 text-gray-700 text-xs font-medium rounded-lg transition-colors"
                    >
                      ⭐ Avaliar
                    </button>
                  )}
                </div>
              </div>
              )
            })
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
                <p className="text-4xl mb-4">💳</p>
                <p className="text-gray-600 mb-4">Nenhuma transação encontrada</p>
              </div>
            )}
          </div>
        )}

      </main>

      <LoginModal
        open={showLoginModal}
        onOpenChange={setShowLoginModal}
      />
    </div>
  )
}
