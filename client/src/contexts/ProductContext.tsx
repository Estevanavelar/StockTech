import React, { createContext, useContext, ReactNode, useMemo } from 'react'
import { trpc } from '../lib/trpc'
import { useAuth } from '../_core/hooks/useAuth'

export interface Product {
  id: number
  name: string
  code: string
  brand?: string | null
  model?: string | null
  category?: string | null
  description?: string | null
  price: number
  quantity: number
  defectiveQuantity: number
  minQuantity: number
  condition: 'NEW' | 'USED' | 'REFURBISHED' | 'ORIGINAL_RETIRADA'
  images: string[]
  createdAt: string
  updatedAt: string
  createdByUserId?: string | null
}

interface ProductContextType {
  products: Product[]
  addProduct: (product: {
    code: string
    name: string
    brand?: string
    model?: string
    category?: string
    description?: string
    price: string
    quantity?: number
    minQuantity?: number
    condition?: 'NEW' | 'USED' | 'REFURBISHED' | 'ORIGINAL_RETIRADA'
    images?: string
  }) => Promise<void>
  updateProduct: (id: number, product: {
    name?: string
    brand?: string
    model?: string
    category?: string
    condition?: 'NEW' | 'USED' | 'REFURBISHED' | 'ORIGINAL_RETIRADA'
    minQuantity?: number
    price?: string
    quantity?: number
    description?: string
    images?: string
  }) => Promise<void>
  deleteProduct: (id: number) => Promise<void>
  getProductById: (id: number) => Product | undefined
}

const ProductContext = createContext<ProductContextType | undefined>(undefined)

export function ProductProvider({ children }: { children: ReactNode }) {
  const utils = trpc.useUtils()
  const { isAuthenticated } = useAuth({ redirectOnUnauthenticated: false })
  const { data = [] } = trpc.products.list.useQuery(undefined, {
    enabled: isAuthenticated, // Só carregar se estiver autenticado
  })
  const createMutation = trpc.products.create.useMutation({
    onSuccess: () => utils.products.list.invalidate(),
  })
  const updateMutation = trpc.products.update.useMutation({
    onMutate: async (input) => {
      await Promise.all([
        utils.products.list.cancel(),
        utils.products.listMarketplace.cancel(),
      ])
      const previousList = utils.products.list.getData() || []
      const previousMarketplace = utils.products.listMarketplace.getData() || []
      const now = new Date().toISOString()

      const applyUpdate = (item: any) =>
        item.id === input.id
          ? {
              ...item,
              ...input,
              updatedAt: now,
            }
          : item

      utils.products.list.setData(undefined, previousList.map(applyUpdate))
      utils.products.listMarketplace.setData(
        undefined,
        previousMarketplace.map(applyUpdate)
      )

      return { previousList, previousMarketplace }
    },
    onError: (_error, _vars, context) => {
      if (context?.previousList) {
        utils.products.list.setData(undefined, context.previousList)
      }
      if (context?.previousMarketplace) {
        utils.products.listMarketplace.setData(undefined, context.previousMarketplace)
      }
    },
    onSettled: () => {
      void utils.products.list.invalidate()
      void utils.products.listMarketplace.invalidate()
    },
  })
  const deleteMutation = trpc.products.delete.useMutation({
    onMutate: async ({ id }) => {
      await Promise.all([
        utils.products.list.cancel(),
        utils.products.listMarketplace.cancel(),
      ])
      const previousList = utils.products.list.getData() || []
      const previousMarketplace = utils.products.listMarketplace.getData() || []
      utils.products.list.setData(
        undefined,
        previousList.filter((item: any) => item.id !== id)
      )
      utils.products.listMarketplace.setData(
        undefined,
        previousMarketplace.filter((item: any) => item.id !== id)
      )
      return { previousList, previousMarketplace }
    },
    onError: (_error, _vars, context) => {
      if (context?.previousList) {
        utils.products.list.setData(undefined, context.previousList)
      }
      if (context?.previousMarketplace) {
        utils.products.listMarketplace.setData(undefined, context.previousMarketplace)
      }
    },
    onSettled: () => {
      void utils.products.list.invalidate()
      void utils.products.listMarketplace.invalidate()
    },
  })

  const products = useMemo<Product[]>(() => {
    return data.map((product: any) => ({
      id: product.id,
      name: product.name,
      code: product.code,
      brand: product.brand,
      model: product.model,
      category: product.category,
      description: product.description,
      price: parseFloat(product.price ?? '0'),
      quantity: product.quantity ?? 0,
      defectiveQuantity: product.defectiveQuantity ?? 0,
      minQuantity: product.minQuantity ?? 0,
      condition: product.condition ?? 'NEW',
      images: product.images ? JSON.parse(product.images) : [],
      createdAt: product.createdAt ? new Date(product.createdAt).toISOString() : '',
      updatedAt: product.updatedAt ? new Date(product.updatedAt).toISOString() : '',
      createdByUserId: product.createdByUserId ?? null,
    }))
  }, [data])

  const addProduct: ProductContextType['addProduct'] = async (product) => {
    await createMutation.mutateAsync({
      ...product,
      quantity: product.quantity ?? 0,
      minQuantity: product.minQuantity ?? 5,
      condition: product.condition ?? 'NEW',
    })
  }

  const updateProduct: ProductContextType['updateProduct'] = async (id, updates) => {
    await updateMutation.mutateAsync({
      id,
      ...updates,
    })
  }

  const deleteProduct: ProductContextType['deleteProduct'] = async (id) => {
    await deleteMutation.mutateAsync({ id })
  }

  const getProductById = (id: number) => {
    return products.find(p => p.id === id)
  }

  return (
    <ProductContext.Provider
      value={{
        products,
        addProduct,
        updateProduct,
        deleteProduct,
        getProductById,
      }}
    >
      {children}
    </ProductContext.Provider>
  )
}

export function useProducts() {
  const context = useContext(ProductContext)
  if (context === undefined) {
    throw new Error('useProducts deve ser usado dentro de ProductProvider')
  }
  return context
}
