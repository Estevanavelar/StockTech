import React, { createContext, useContext, useState, ReactNode } from 'react'
import { trpc } from '../lib/trpc'

export interface Rating {
  id: string
  productId: string
  transactionId: string
  rating: number
  comment: string
  createdAt: string
  author: string
}

interface RatingContextType {
  ratings: Rating[]
  addRating: (rating: Omit<Rating, 'id' | 'createdAt'>) => void
  getRatingsByProduct: (productId: string) => Rating[]
  getAverageRating: (productId: string) => number
}

const RatingContext = createContext<RatingContextType | undefined>(undefined)

export function RatingProvider({ children }: { children: ReactNode }) {
  const [ratings, setRatings] = useState<Rating[]>([])
  const createMutation = trpc.ratings.create.useMutation()

  const addRating = async (rating: Omit<Rating, 'id' | 'createdAt'>) => {
    const optimisticId = `temp-${Date.now()}`
    const createdAt = new Date().toISOString()
    setRatings(prev => [
      ...prev,
      {
        id: optimisticId,
        productId: rating.productId,
        transactionId: rating.transactionId || '',
        rating: rating.rating,
        comment: rating.comment,
        createdAt,
        author: rating.author,
      }
    ])

    try {
      const created = await createMutation.mutateAsync({
        productId: parseInt(rating.productId, 10),
        transactionId: rating.transactionId ? parseInt(rating.transactionId, 10) : undefined,
        rating: rating.rating,
        comment: rating.comment,
        author: rating.author,
      })

      if (created) {
        setRatings(prev => prev.map(item => (
          item.id === optimisticId
            ? {
                id: String(created.id),
                productId: String(created.productId),
                transactionId: created.transactionId ? String(created.transactionId) : '',
                rating: created.rating,
                comment: created.comment || '',
                createdAt: created.createdAt ? new Date(created.createdAt).toISOString() : createdAt,
                author: created.author,
              }
            : item
        )))
      }
    } catch (error) {
      setRatings(prev => prev.filter(item => item.id !== optimisticId))
      throw error
    }
  }

  const getRatingsByProduct = (productId: string) => {
    return ratings.filter(r => r.productId === productId)
  }

  const getAverageRating = (productId: string) => {
    const productRatings = getRatingsByProduct(productId)
    if (productRatings.length === 0) return 0
    const sum = productRatings.reduce((acc, r) => acc + r.rating, 0)
    return sum / productRatings.length
  }

  return (
    <RatingContext.Provider
      value={{
        ratings,
        addRating,
        getRatingsByProduct,
        getAverageRating,
      }}
    >
      {children}
    </RatingContext.Provider>
  )
}

export function useRatings() {
  const context = useContext(RatingContext)
  if (context === undefined) {
    throw new Error('useRatings deve ser usado dentro de RatingProvider')
  }
  return context
}
