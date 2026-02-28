import React, { useState } from 'react'
import { useLocation } from 'wouter'
import { useAddresses, Address } from '../contexts/AddressContext'
import { useToast } from '../hooks/useToast'

export default function AddressManagement() {
  const [, setLocation] = useLocation()
  const { addresses, addAddress, updateAddress, deleteAddress, setDefaultAddress } = useAddresses()
  const { showToast } = useToast()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [cepLoading, setCepLoading] = useState(false)
  const [cepError, setCepError] = useState('')
  const [formData, setFormData] = useState<Omit<Address, 'id'>>({
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    zipCode: '',
    isDefault: false,
  })

  const handleAddAddress = () => {
    if (formData.street && formData.number && formData.neighborhood && formData.city && formData.state && formData.zipCode) {
      addAddress(formData)
      setFormData({
        street: '',
        number: '',
        complement: '',
        neighborhood: '',
        city: '',
        state: '',
        zipCode: '',
        isDefault: false,
      })
      setShowForm(false)
    } else {
      showToast('Por favor, preencha todos os campos obrigatórios', 'warning')
    }
  }

  const handleEditAddress = (address: Address) => {
    setEditingId(address.id)
    setFormData({
      street: address.street,
      number: address.number,
      complement: address.complement,
      neighborhood: address.neighborhood,
      city: address.city,
      state: address.state,
      zipCode: address.zipCode,
      isDefault: address.isDefault,
    })
    setShowForm(true)
  }

  const handleZipCodeChange = (value: string) => {
    const onlyNumbers = value.replace(/\D/g, '').slice(0, 8)
    setFormData(prev => ({ ...prev, zipCode: onlyNumbers }))
    if (cepError) setCepError('')
  }

  const handleZipCodeLookup = async () => {
    const zip = formData.zipCode.replace(/\D/g, '')
    if (zip.length !== 8) return
    setCepLoading(true)
    setCepError('')
    try {
      const response = await fetch(`https://viacep.com.br/ws/${zip}/json/`)
      const data = await response.json()
      if (data?.erro) {
        setCepError('CEP não encontrado')
        return
      }
      setFormData(prev => ({
        ...prev,
        street: data.logradouro || prev.street,
        neighborhood: data.bairro || prev.neighborhood,
        city: data.localidade || prev.city,
        state: data.uf || prev.state,
      }))
    } catch (error) {
      console.error('Erro ao buscar CEP:', error)
      setCepError('Falha ao buscar CEP')
    } finally {
      setCepLoading(false)
    }
  }
  const handleUpdateAddress = () => {
    if (editingId && formData.street && formData.number && formData.neighborhood && formData.city && formData.state && formData.zipCode) {
      updateAddress(editingId, formData)
      setEditingId(null)
      setFormData({
        street: '',
        number: '',
        complement: '',
        neighborhood: '',
        city: '',
        state: '',
        zipCode: '',
        isDefault: false,
      })
      setShowForm(false)
    } else {
      showToast('Por favor, preencha todos os campos obrigatórios', 'warning')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white pb-24">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => setLocation('/user-profile')}
            className="text-gray-600 hover:text-gray-900 text-xl"
          >
            ←
          </button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">📍 Meus Endereços</h1>
            <p className="text-xs text-gray-600 mt-1">{addresses.length} endereço(s) cadastrado(s)</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        
        {/* Address List */}
        {addresses.map(address => (
          <div key={address.id} className={`bg-white rounded-2xl border-2 p-4 shadow-sm ${address.isDefault ? 'border-blue-300 bg-blue-50' : 'border-gray-100'}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-gray-900">{address.street}, {address.number}</h3>
                  {address.isDefault && (
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                      ✓ Padrão
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600">
                  {address.complement && `${address.complement} - `}
                  {address.neighborhood}, {address.city} - {address.state}
                </p>
                <p className="text-xs text-gray-500 mt-1">CEP: {address.zipCode}</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-3 border-t border-gray-100">
              {!address.isDefault && (
                <button
                  onClick={() => setDefaultAddress(address.id)}
                  className="flex-1 px-3 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-lg transition-colors"
                >
                  Definir como Padrão
                </button>
              )}
              <button
                onClick={() => handleEditAddress(address)}
                className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
              >
                ✏️ Editar
              </button>
              <button
                onClick={() => deleteAddress(address.id)}
                className="flex-1 px-3 py-2 border border-red-300 hover:bg-red-50 text-red-700 text-xs font-medium rounded-lg transition-colors"
              >
                🗑️ Remover
              </button>
            </div>
          </div>
        ))}

        {/* Add Address Button */}
        {!showForm && (
          <button
            onClick={() => {
              setEditingId(null)
              setFormData({
                street: '',
                number: '',
                complement: '',
                neighborhood: '',
                city: '',
                state: '',
                zipCode: '',
                isDefault: false,
              })
              setShowForm(true)
            }}
            className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            + Adicionar Novo Endereço
          </button>
        )}

        {/* Form */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {editingId ? 'Editar Endereço' : 'Novo Endereço'}
            </h3>

            <div className="space-y-3">
              <div className="flex gap-3">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="CEP (somente números)"
                  value={formData.zipCode}
                  onChange={(e) => handleZipCodeChange(e.target.value)}
                  onBlur={handleZipCodeLookup}
                  className="flex-1 min-w-0 px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {cepLoading && (
                <p className="text-xs text-gray-500">Buscando CEP...</p>
              )}
              {cepError && (
                <p className="text-xs text-red-600">{cepError}</p>
              )}
              <input
                type="text"
                placeholder="Rua"
                value={formData.street}
                onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Número"
                  value={formData.number}
                  onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                  className="w-24 sm:w-32 flex-none px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Complemento (opcional)"
                  value={formData.complement}
                  onChange={(e) => setFormData({ ...formData, complement: e.target.value })}
                  className="flex-1 min-w-0 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <input
                type="text"
                placeholder="Bairro"
                value={formData.neighborhood}
                onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Cidade"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Estado (SP)"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  maxLength={2}
                  className="w-16 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <label className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700">Padrão</span>
              </label>
            </div>

            <div className="flex gap-3 pt-4 border-t border-gray-100">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={editingId ? handleUpdateAddress : handleAddAddress}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                {editingId ? 'Atualizar' : 'Adicionar'}
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
