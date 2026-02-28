import { useState, useRef, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { trpc } from '../lib/trpc'
import { useToast } from '../hooks/useToast'

interface QuickRestockDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: {
    id: number
    name: string
    code: string
    quantity: number
  } | null
}

export default function QuickRestockDialog({ open, onOpenChange, product }: QuickRestockDialogProps) {
  const [newQuantity, setNewQuantity] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { showToast } = useToast()
  const utils = trpc.useUtils()

  const quickRestock = trpc.products.quickRestock.useMutation({
    onSuccess: () => {
      utils.products.list.invalidate()
      utils.products.listMarketplace.invalidate()
    },
  })

  useEffect(() => {
    if (open && product) {
      setNewQuantity(String(product.quantity))
      setNotes('')
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 100)
    }
  }, [open, product])

  if (!product) return null

  const parsedQty = parseInt(newQuantity, 10)
  const isValid = !isNaN(parsedQty) && parsedQty >= 0
  const delta = isValid ? parsedQty - product.quantity : 0

  const handleSubmit = async () => {
    if (!isValid || delta === 0) return
    setLoading(true)
    try {
      const result = await quickRestock.mutateAsync({
        productId: product.id,
        newQuantity: parsedQty,
        notes: notes.trim() || undefined,
      })
      showToast(result.message, 'success')
      onOpenChange(false)
    } catch (err: any) {
      showToast(err?.message || 'Erro ao atualizar estoque', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Repor Estoque</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="font-medium text-gray-900 text-sm">{product.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">Codigo: {product.code}</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Qtd Atual</label>
              <div className="px-3 py-2 bg-gray-100 rounded-lg text-center font-bold text-lg text-gray-900">
                {product.quantity}
              </div>
            </div>
            <div className="text-2xl text-gray-400 pt-5">→</div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Nova Qtd</label>
              <input
                ref={inputRef}
                type="number"
                min="0"
                value={newQuantity}
                onChange={(e) => setNewQuantity(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center font-bold text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {isValid && delta !== 0 && (
            <div className={`rounded-lg p-3 text-center font-semibold text-sm ${
              delta > 0
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {delta > 0 ? `+${delta} entrada` : `${delta} saida`}
              {Math.abs(delta) > 1 ? 's' : ''}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Observacao (opcional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="Ex: Reposicao semanal, Fornecedor X..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => onOpenChange(false)}
              className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={!isValid || delta === 0 || loading}
              className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              {loading ? 'Salvando...' : 'Confirmar'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
