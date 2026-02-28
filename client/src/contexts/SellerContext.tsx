import React, { createContext, useContext } from 'react'

export interface SellerStore {
  id: string
  name: string
  street: string
  number: string
  neighborhood: string
  city: string
  state: string
  zipCode: string
  latitude: number
  longitude: number
  rating: number
  totalReviews: number
  phone: string
  email: string
}

interface SellerContextType {
  sellers: SellerStore[]
  getSellerById: (_id: string) => SellerStore | undefined
}

const SellerContext = createContext<SellerContextType | undefined>(undefined)

export function SellerProvider({ children }: { children: React.ReactNode }) {
  const getSellerById = (id: string) => {
    return undefined
  }

  return (
    <SellerContext.Provider
      value={{
        sellers: [],
        getSellerById,
      }}
    >
      {children}
    </SellerContext.Provider>
  )
}

export function useSellers() {
  const context = useContext(SellerContext)
  if (!context) {
    throw new Error('useSellers deve ser usado dentro de SellerProvider')
  }
  return context
}
