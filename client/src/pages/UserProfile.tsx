import React, { useState, useEffect, useMemo } from 'react'
import { useLocation } from 'wouter'
import { Camera } from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { useAddresses } from '../contexts/AddressContext'
import { useAuth } from "@/_core/hooks/useAuth"
import { useToast } from '../hooks/useToast'
import { compressImageFile } from '../utils/imageCompression'
import { uploadImageFile } from '../lib/storage'
import LoginModal from '@/components/LoginModal'

interface SellerProfileData {
  id: number
  userId: string
  storeName: string
  email?: string
  phone?: string
  city?: string
  state?: string
  profilePhoto?: string
  coverPhoto?: string
  description?: string
  rating: number
  totalSales: number
  totalSalesAmount: number
  totalProducts: number
  totalReviews: number
  followers: number
  responseTime?: number
  street?: string
  number?: string
  neighborhood?: string
  zipCode?: string
  latitude?: number
  longitude?: number
  createdAt: Date
  updatedAt: Date
}

export default function UserProfile() {
  const [, setLocation] = useLocation()
  const { defaultAddress } = useAddresses()
  const { user, isAuthenticated, loading: authLoading } = useAuth({ redirectOnUnauthenticated: false })
  const isLoggedIn = isAuthenticated && !authLoading && user !== null
  const { showToast } = useToast()
  const utils = trpc.useUtils()
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [uploadingProfile, setUploadingProfile] = useState(false)
  
  const [profileData, setProfileData] = useState<SellerProfileData | null>(null)
  const [formData, setFormData] = useState<Partial<SellerProfileData>>({})
  
  const deleteImageMutation = trpc.storage.deleteImage.useMutation()
  const { data: sellerData, isLoading } = trpc.sellerProfiles.getFullProfile.useQuery()
  const { data: marketplaceProducts = [] } = trpc.products.listMarketplace.useQuery()
  const updateProfileMutation = trpc.sellerProfiles.updateProfile.useMutation({
    onMutate: async ({ data }) => {
      await utils.sellerProfiles.getFullProfile.cancel()
      const previous = utils.sellerProfiles.getFullProfile.getData()
      if (previous) {
        utils.sellerProfiles.getFullProfile.setData(undefined, {
          ...previous,
          ...data,
        })
      }
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        utils.sellerProfiles.getFullProfile.setData(undefined, context.previous)
      }
    },
    onSettled: () => {
      void utils.sellerProfiles.getFullProfile.invalidate()
    },
  })
  useEffect(() => {
    if (sellerData) {
      const data = {
        ...sellerData,
        responseTime: typeof sellerData.responseTime === 'string' ? parseInt(sellerData.responseTime) : sellerData.responseTime,
        totalSalesAmount: Number(sellerData.totalSalesAmount ?? 0),
        totalSales: Number(sellerData.totalSales ?? 0),
        totalProducts: Number(sellerData.totalProducts ?? 0),
        followers: Number(sellerData.followers ?? 0),
      } as SellerProfileData
      setProfileData(data)
      setFormData(data)
    }
  }, [sellerData])

  const sellerProductsCount = useMemo(() => {
    if (!profileData?.userId) return 0
    return (marketplaceProducts as any[]).filter(
      (product) => product?.createdByUserId === String(profileData.userId)
    ).length
  }, [marketplaceProducts, profileData?.userId])

  useEffect(() => {
    if (!user?.email) return
    setFormData(prev => ({ ...prev, email: user.email as string }))
  }, [user?.email])

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const formatAddress = (address: {
    street?: string
    number?: string
    complement?: string
    neighborhood?: string
    city?: string
    state?: string
    zipCode?: string
  }) => {
    const line1 = [address.street, address.number].filter(Boolean).join(', ')
    const line2 = [address.neighborhood, address.city, address.state].filter(Boolean).join(' - ')
    const line3 = address.zipCode ? `CEP ${address.zipCode}` : ''
    const complement = address.complement ? `Complemento ${address.complement}` : ''
    return [line1, complement, line2, line3].filter(Boolean).join(', ')
  }

  const buildMapsUrl = (address: string) => {
    if (!address) return ''
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
  }

  const handleSaveProfile = async () => {
    if (!isLoggedIn) {
      setShowLoginModal(true)
      return
    }
    const previousProfile = profileData
    const optimisticProfile = previousProfile ? { ...previousProfile, ...formData } : null
    try {
      const sanitize = <T,>(value: T | null | undefined) =>
        value === null ? undefined : value

      const updateData = {
        storeName: sanitize(formData.storeName),
        email: sanitize(formData.email),
        phone: sanitize(formData.phone),
        city: sanitize(formData.city),
        state: sanitize(formData.state),
        profilePhoto: sanitize(formData.profilePhoto),
        coverPhoto: sanitize(formData.coverPhoto),
        description: sanitize(formData.description),
        street: sanitize(formData.street),
        number: sanitize(formData.number),
        neighborhood: sanitize(formData.neighborhood),
        zipCode: sanitize(formData.zipCode),
        latitude: sanitize(formData.latitude),
        longitude: sanitize(formData.longitude),
      }

      const cleanedData = Object.fromEntries(
        Object.entries(updateData).filter(([, value]) => value !== undefined)
      )

      if (optimisticProfile) {
        setProfileData(optimisticProfile)
      }
      setIsEditing(false)
      await updateProfileMutation.mutateAsync({ data: cleanedData })
      showToast('Perfil atualizado com sucesso!', 'success')
    } catch (error) {
      if (previousProfile) {
        setProfileData(previousProfile)
        setFormData(previousProfile)
      }
      console.error('Erro ao atualizar perfil:', error)
      showToast('Erro ao atualizar perfil', 'error')
    }
  }


  const handleCoverPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 10 * 1024 * 1024) {
      showToast('Arquivo muito grande. Máximo 10MB antes de compressão.', 'warning')
      return
    }

    setUploadingCover(true)
    try {
      const previousCover = (profileData?.coverPhoto || formData.coverPhoto) ?? ''
      const { file: compressedFile } = await compressImageFile(file, 5)
      const responseUrl = await uploadImageFile(compressedFile, 'sellers/cover')
      setFormData(prev => ({
        ...prev,
        coverPhoto: responseUrl
      }))
      setProfileData(prev => prev ? { ...prev, coverPhoto: responseUrl } : null)
      await updateProfileMutation.mutateAsync({ data: { coverPhoto: responseUrl } })
      if (previousCover && previousCover.startsWith('http') && previousCover !== responseUrl) {
        await deleteImageMutation.mutateAsync({ url: previousCover })
      }
    } catch (error) {
      console.error('Erro ao fazer upload da capa:', error)
      showToast('Erro ao fazer upload da capa', 'error')
    } finally {
      setUploadingCover(false)
    }
  }

  const handleProfilePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 10 * 1024 * 1024) {
      showToast('Arquivo muito grande. Máximo 10MB antes de compressão.', 'warning')
      return
    }

    setUploadingProfile(true)
    try {
      const previousProfile = (profileData?.profilePhoto || formData.profilePhoto) ?? ''
      const { file: compressedFile } = await compressImageFile(file, 5)
      const responseUrl = await uploadImageFile(compressedFile, 'sellers/profile')
      setFormData(prev => ({
        ...prev,
        profilePhoto: responseUrl
      }))
      setProfileData(prev => prev ? { ...prev, profilePhoto: responseUrl } : null)
      await updateProfileMutation.mutateAsync({ data: { profilePhoto: responseUrl } })
      if (previousProfile && previousProfile.startsWith('http') && previousProfile !== responseUrl) {
        await deleteImageMutation.mutateAsync({ url: previousProfile })
      }
    } catch (error) {
      console.error('Erro ao fazer upload da foto de perfil:', error)
      showToast('Erro ao fazer upload da foto de perfil', 'error')
    } finally {
      setUploadingProfile(false)
    }
  }

  const coverPhotoUrl = (profileData?.coverPhoto || formData.coverPhoto) ?? ''
  const profilePhotoUrl = (profileData?.profilePhoto || formData.profilePhoto) ?? ''

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white pb-20 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando perfil...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white pb-20">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => setLocation('/catalog')}
            className="text-gray-600 hover:text-gray-900 text-xl"
          >
            ←
          </button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Meu Perfil</h1>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
          <div className="px-4 sm:px-6 py-6">
            <div className="flex flex-col items-center text-center gap-4 mb-6">
              <div className="relative group">
                <div className="w-24 h-24 sm:w-28 sm:h-28 bg-gray-100 rounded-full border border-gray-200 flex items-center justify-center text-4xl overflow-hidden shadow-sm">
                  {typeof profilePhotoUrl === 'string' && profilePhotoUrl.startsWith('http') ? (
                    <img src={profilePhotoUrl} alt="Perfil" className="w-full h-full object-cover" />
                  ) : (
                    '👤'
                  )}
                </div>

                {isEditing && (
                  <label className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 rounded-full flex items-center justify-center cursor-pointer transition-all">
                    {uploadingProfile ? (
                      <div className="text-white text-xs">Enviando...</div>
                    ) : (
                      <Camera className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProfilePhotoUpload}
                      disabled={uploadingProfile}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <div className="flex-1 flex flex-col items-center w-full">
                <div className="flex flex-col items-center gap-2 w-full">
                  {isEditing ? (
                    <input
                      type="text"
                      value={formData.storeName || ''}
                      onChange={(e) => handleInputChange('storeName', e.target.value)}
                      className="text-lg sm:text-xl font-semibold text-gray-900 w-full max-w-xs border-b border-gray-300 pb-1 text-center"
                    />
                  ) : (
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-900 break-all">
                      @{profileData?.storeName || 'loja'}
                    </h2>
                  )}
                </div>
                <div className="text-sm text-gray-700 space-y-1 mt-2 w-full">
                  {isEditing ? (
                    <div className="space-y-2 w-full max-w-xs mx-auto">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={formData.city || ''}
                          onChange={(e) => handleInputChange('city', e.target.value)}
                          placeholder="Cidade"
                          className="flex-1 text-xs sm:text-sm text-gray-600 border border-gray-300 rounded px-2 py-1 text-center"
                        />
                        <input
                          type="text"
                          value={formData.state || ''}
                          onChange={(e) => handleInputChange('state', e.target.value)}
                          placeholder="UF"
                          className="w-12 text-xs sm:text-sm text-gray-600 border border-gray-300 rounded px-2 py-1 text-center"
                          maxLength={2}
                        />
                      </div>
                      <input
                        type="text"
                        value={formData.zipCode || ''}
                        onChange={(e) => handleInputChange('zipCode', e.target.value)}
                        placeholder="CEP"
                        className="w-full text-xs sm:text-sm text-gray-600 border border-gray-300 rounded px-2 py-1 text-center"
                      />
                      <input
                        type="text"
                        value={formData.street || ''}
                        onChange={(e) => handleInputChange('street', e.target.value)}
                        placeholder="Rua / Logradouro"
                        className="w-full text-xs sm:text-sm text-gray-600 border border-gray-300 rounded px-2 py-1 text-center"
                      />
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={formData.number || ''}
                          onChange={(e) => handleInputChange('number', e.target.value)}
                          placeholder="Nº"
                          className="w-16 text-xs sm:text-sm text-gray-600 border border-gray-300 rounded px-2 py-1 text-center"
                        />
                        <input
                          type="text"
                          value={formData.neighborhood || ''}
                          onChange={(e) => handleInputChange('neighborhood', e.target.value)}
                          placeholder="Bairro"
                          className="flex-1 text-xs sm:text-sm text-gray-600 border border-gray-300 rounded px-2 py-1 text-center"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="font-medium">
                      {profileData?.city || 'Cidade'}{profileData?.state ? `, ${profileData.state}` : ''}
                    </div>
                  )}
                  {isEditing ? (
                    <textarea
                      value={formData.description || ''}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      placeholder="Descrição da sua loja"
                      className="w-full max-w-md text-xs sm:text-sm text-gray-700 border border-gray-300 rounded-lg p-2 resize-none mx-auto text-center"
                      rows={2}
                    />
                  ) : (
                    profileData?.description && <div className="break-all whitespace-pre-wrap max-w-md mx-auto">{profileData.description}</div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              <div className="text-center bg-green-50 rounded-lg p-3">
                <p className="text-lg sm:text-2xl font-bold text-green-700">R$ {((profileData?.totalSalesAmount || 0) / 1000).toFixed(1)}k</p>
                <p className="text-xs text-green-600 mt-1">Vendas</p>
              </div>
              <div className="text-center bg-blue-50 rounded-lg p-3">
                <p className="text-lg sm:text-2xl font-bold text-blue-700">{profileData?.totalSales || 0}</p>
                <p className="text-xs text-blue-600 mt-1">Qtd. Vendas</p>
              </div>
              <div className="text-center bg-purple-50 rounded-lg p-3">
                <p className="text-lg sm:text-2xl font-bold text-purple-700">{sellerProductsCount}</p>
                <p className="text-xs text-purple-600 mt-1">Produtos</p>
              </div>
              <div className="text-center bg-orange-50 rounded-lg p-3">
                <p className="text-lg sm:text-2xl font-bold text-orange-700">
                  {Number(profileData?.followers ?? 0)}
                </p>
                <p className="text-xs text-orange-600 mt-1">Seguidores</p>
              </div>
            </div>

            <div className="mt-4">
              <button
                onClick={() => {
                  if (!isLoggedIn) {
                    setShowLoginModal(true)
                    return
                  }
                  if (isEditing) {
                    handleSaveProfile()
                  } else {
                    setIsEditing(true)
                  }
                }}
                disabled={updateProfileMutation.isPending}
                className="relative w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors text-sm"
              >
                {updateProfileMutation.isPending ? 'Salvando...' : isEditing ? '✓ Salvar Perfil' : '✏️ Editar Perfil'}
                {!isLoggedIn && (
                  <span
                    className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full border-2 border-white flex items-center justify-center text-[8px]"
                    title="Login necessário"
                  >
                    !
                  </span>
                )}
              </button>
            </div>

          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">📞 Informações de Contato</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-900 block mb-2">Telefone</label>
                {isEditing ? (
                  <input
                    type="tel"
                    value={formData.phone || ''}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                ) : (
                  <p className="text-sm text-gray-700">{profileData?.phone || 'Não informado'}</p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">📍 Endereço da Loja (Público)</h3>
              {!isEditing && (
                <button 
                  onClick={() => setIsEditing(true)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Editar
                </button>
              )}
            </div>
            {profileData?.street ? (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="font-semibold text-gray-900 text-sm">
                  {profileData.street}, {profileData.number}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  {profileData.neighborhood ? `${profileData.neighborhood}, ` : ''}
                  {profileData.city} - {profileData.state}
                </p>
                <p className="text-xs text-gray-500 mt-1">CEP: {profileData.zipCode}</p>
                <p className="text-[10px] text-blue-600 mt-2 font-medium">✓ Este endereço é visível para seus clientes</p>
              </div>
            ) : (
              <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                <p className="text-sm text-yellow-800">
                  Você ainda não definiu um endereço público para sua loja.
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  Seus clientes verão "Rua não informada". Clique em editar para preencher.
                </p>
              </div>
            )}
          </div>

          {defaultAddress && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">📍 Endereço de Entrega</h3>
              {(() => {
                const buyerAddress = formatAddress({
                  street: defaultAddress.street,
                  number: defaultAddress.number,
                  complement: defaultAddress.complement,
                  neighborhood: defaultAddress.neighborhood,
                  city: defaultAddress.city,
                  state: defaultAddress.state,
                  zipCode: defaultAddress.zipCode,
                })
                const mapsUrl = buildMapsUrl(buyerAddress)
                if (mapsUrl) {
                  return (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block bg-blue-50 rounded-lg p-4 border border-blue-200 mb-4 hover:bg-blue-100 transition-colors"
                    >
                      <p className="font-semibold text-gray-900 text-sm">{defaultAddress.street}, {defaultAddress.number}</p>
                      <p className="text-xs text-gray-600 mt-1">
                        {defaultAddress.complement && `${defaultAddress.complement} - `}
                        {defaultAddress.neighborhood}, {defaultAddress.city} - {defaultAddress.state}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">CEP: {defaultAddress.zipCode}</p>
                    </a>
                  )
                }

                return (
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 mb-4">
                    <p className="font-semibold text-gray-900 text-sm">{defaultAddress.street}, {defaultAddress.number}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      {defaultAddress.complement && `${defaultAddress.complement} - `}
                      {defaultAddress.neighborhood}, {defaultAddress.city} - {defaultAddress.state}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">CEP: {defaultAddress.zipCode}</p>
                  </div>
                )
              })()}
              <button
                onClick={() => {
                  if (!isLoggedIn) {
                    setShowLoginModal(true)
                    return
                  }
                  setLocation('/address-management')
                }}
                className="relative w-full px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded-lg transition-colors"
              >
                Gerenciar Endereços
                {!isLoggedIn && (
                  <span
                    className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full border-2 border-white flex items-center justify-center text-[8px]"
                    title="Login necessário"
                  >
                    !
                  </span>
                )}
              </button>
            </div>
          )}

          
        </div>

      </main>

      <LoginModal
        open={showLoginModal}
        onOpenChange={setShowLoginModal}
      />
    </div>
  )
}
