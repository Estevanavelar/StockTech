import React, { createContext, useContext } from 'react'
import { trpc } from '../lib/trpc'
import { useAuth } from '../_core/hooks/useAuth'

export interface Address {
  id: number
  street: string
  number: string
  complement?: string
  neighborhood: string
  city: string
  state: string
  zipCode: string
  isDefault: boolean
}

interface AddressContextType {
  addresses: Address[]
  defaultAddress: Address | null
  addAddress: (address: Omit<Address, 'id'>) => Promise<void>
  updateAddress: (id: number, address: Omit<Address, 'id'>) => Promise<void>
  deleteAddress: (id: number) => Promise<void>
  setDefaultAddress: (id: number) => Promise<void>
  refreshAddresses: () => Promise<void>
}

const AddressContext = createContext<AddressContextType | undefined>(undefined)

export function AddressProvider({ children }: { children: React.ReactNode }) {
  const utils = trpc.useUtils()
  const { isAuthenticated } = useAuth({ redirectOnUnauthenticated: false })
  const listQuery = trpc.addresses.list.useQuery(undefined, {
    enabled: isAuthenticated, // Só carregar se estiver autenticado
  })
  const createMutation = trpc.addresses.create.useMutation({
    onMutate: async (input) => {
      await utils.addresses.list.cancel()
      const previous = utils.addresses.list.getData() || []
      const optimisticId = -Date.now()
      const next = previous.map((address: any) =>
        input.isDefault ? { ...address, isDefault: 0 } : address
      )
      next.unshift({
        id: optimisticId,
        ...input,
        isDefault: input.isDefault ? 1 : 0,
      })
      utils.addresses.list.setData(undefined, next)
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        utils.addresses.list.setData(undefined, context.previous)
      }
    },
    onSettled: () => {
      void utils.addresses.list.invalidate()
    },
  })
  const updateMutation = trpc.addresses.update.useMutation({
    onMutate: async (input) => {
      await utils.addresses.list.cancel()
      const previous = utils.addresses.list.getData() || []
      const next = previous.map((address: any) => {
        if (input.isDefault) {
          address = { ...address, isDefault: 0 }
        }
        return address.id === input.id
          ? { ...address, ...input, isDefault: input.isDefault ? 1 : 0 }
          : address
      })
      utils.addresses.list.setData(undefined, next)
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        utils.addresses.list.setData(undefined, context.previous)
      }
    },
    onSettled: () => {
      void utils.addresses.list.invalidate()
    },
  })
  const deleteMutation = trpc.addresses.delete.useMutation({
    onMutate: async ({ id }) => {
      await utils.addresses.list.cancel()
      const previous = utils.addresses.list.getData() || []
      utils.addresses.list.setData(
        undefined,
        previous.filter((address: any) => address.id !== id)
      )
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        utils.addresses.list.setData(undefined, context.previous)
      }
    },
    onSettled: () => {
      void utils.addresses.list.invalidate()
    },
  })
  const setDefaultMutation = trpc.addresses.setDefault.useMutation({
    onMutate: async ({ id }) => {
      await utils.addresses.list.cancel()
      const previous = utils.addresses.list.getData() || []
      const next = previous.map((address: any) => ({
        ...address,
        isDefault: address.id === id ? 1 : 0,
      }))
      utils.addresses.list.setData(undefined, next)
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        utils.addresses.list.setData(undefined, context.previous)
      }
    },
    onSettled: () => {
      void utils.addresses.list.invalidate()
    },
  })

  const addresses = (listQuery.data || []).map((address: any) => ({
    id: address.id,
    street: address.street,
    number: address.number,
    complement: address.complement,
    neighborhood: address.neighborhood,
    city: address.city,
    state: address.state,
    zipCode: address.zipCode,
    isDefault: address.isDefault === 1,
  }))

  const defaultAddress = addresses.find(a => a.isDefault) || addresses[0] || null

  const addAddress: AddressContextType['addAddress'] = async (address) => {
    await createMutation.mutateAsync({
      ...address,
      isDefault: address.isDefault ? 1 : 0,
    })
  }

  const updateAddress: AddressContextType['updateAddress'] = async (id, address) => {
    await updateMutation.mutateAsync({
      id,
      ...address,
      isDefault: address.isDefault ? 1 : 0,
    })
  }

  const deleteAddress: AddressContextType['deleteAddress'] = async (id) => {
    await deleteMutation.mutateAsync({ id })
  }

  const setDefaultAddress: AddressContextType['setDefaultAddress'] = async (id) => {
    await setDefaultMutation.mutateAsync({ id })
  }

  const refreshAddresses = async () => {
    await listQuery.refetch()
  }

  return (
    <AddressContext.Provider
      value={{
        addresses,
        defaultAddress,
        addAddress,
        updateAddress,
        deleteAddress,
        setDefaultAddress,
        refreshAddresses,
      }}
    >
      {children}
    </AddressContext.Provider>
  )
}

export function useAddresses() {
  const context = useContext(AddressContext)
  if (!context) {
    throw new Error('useAddresses deve ser usado dentro de AddressProvider')
  }
  return context
}
