import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'wouter'
import { trpc } from '../lib/trpc'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Textarea } from '../components/ui/textarea'
import { Camera, Upload, X } from 'lucide-react'
import { compressImageFile } from '../utils/imageCompression'
import { uploadBase64Image, uploadImageFile } from '../lib/storage'
import { toast } from 'sonner'
import { useNotifications } from '../contexts/NotificationContext'

export default function AddProduct() {
  const [location, navigate] = useLocation()
  const utils = trpc.useUtils()
  const { addNotification } = useNotifications()
  const deleteImage = trpc.storage.deleteImage.useMutation()
  const updateProduct = trpc.products.update.useMutation({
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
    onError: (error, _vars, context) => {
      if (context?.previousList) {
        utils.products.list.setData(undefined, context.previousList)
      }
      if (context?.previousMarketplace) {
        utils.products.listMarketplace.setData(undefined, context.previousMarketplace)
      }
      toast.error('Erro ao atualizar produto: ' + error.message)
    },
    onSettled: () => {
      void utils.products.list.invalidate()
      void utils.products.listMarketplace.invalidate()
    },
    onSuccess: () => {
      toast.success('Produto atualizado com sucesso!')
      navigate('/stock')
    },
  })
  const createProduct = trpc.products.create.useMutation({
    onMutate: async (input) => {
      await Promise.all([
        utils.products.list.cancel(),
        utils.products.listMarketplace.cancel(),
      ])
      const previousProducts = utils.products.list.getData() || []
      const previousMarketplace = utils.products.listMarketplace.getData() || []
      const now = new Date().toISOString()
      const optimisticId = -Date.now()
      const optimisticProduct: any = {
        id: optimisticId,
        name: input.name,
        code: input.code,
        brand: input.brand ?? null,
        model: input.model ?? null,
        productType: input.productType ?? null,
        category: input.category ?? null,
        description: input.description ?? null,
        price: input.price ?? '0',
        quantity: input.quantity ?? 0,
        minQuantity: input.minQuantity ?? 0,
        condition: input.condition ?? 'NEW',
        warrantyPeriod: input.warrantyPeriod ?? 'NONE',
        images: input.images ?? '[]',
        createdAt: now,
        updatedAt: now,
        createdByUserId: null,
      }
      utils.products.list.setData(undefined, [optimisticProduct, ...previousProducts])
      utils.products.listMarketplace.setData(undefined, [
        {
          ...optimisticProduct,
          sellerId: null,
          sellerStoreName: null,
        },
        ...previousMarketplace,
      ])

      addNotification({
        type: 'system',
        title: 'Produto cadastrado',
        message: `${input.name} foi adicionado ao estoque`,
      })

      return { previousProducts, previousMarketplace }
    },
    onError: (error, _vars, context) => {
      if (context?.previousProducts) {
        utils.products.list.setData(undefined, context.previousProducts)
      }
      if (context?.previousMarketplace) {
        utils.products.listMarketplace.setData(undefined, context.previousMarketplace)
      }
      toast.error('Erro ao cadastrar produto: ' + error.message)
    },
    onSettled: () => {
      void utils.products.list.invalidate()
      void utils.products.listMarketplace.invalidate()
    },
    onSuccess: () => {
      toast.success('Produto cadastrado com sucesso!')
    },
  })

  const { data: options, isLoading: loadingOptions } = trpc.productOptions.list.useQuery()

  const generateCode = () => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWYZ'
    const randomLetters = Array.from({ length: 3 }, () => letters[Math.floor(Math.random() * letters.length)]).join('')
    const randomNumbers = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
    return `PROD${randomLetters}${randomNumbers}`
  }

  const [formData, setFormData] = useState({
    name: '',
    code: generateCode(),
    brand: 'Samsung',
    model: '',
    productType: 'Smartphone',
    category: 'Câmera Frontal',
    description: '',
    price: '',
    quantity: '',
    minQuantity: '',
    condition: 'new' as 'new' | 'used' | 'refurbished' | 'original_retirada',
    warrantyPeriod: 'NONE' as 'NONE' | 'DAYS_7' | 'DAYS_30' | 'DAYS_90' | 'MONTHS_6',
    images: [] as string[],
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const editId = useMemo(() => {
    if (typeof window === 'undefined') return null
    const params = new URLSearchParams(window.location.search)
    const value = params.get('edit')
    return value ? Number(value) : null
  }, [location])

  const editCode = useMemo(() => {
    if (typeof window === 'undefined') return null
    const parts = window.location.pathname.split('/').filter(Boolean)
    if (parts.length >= 3 && parts[0] === 'add-product' && parts[1] === 'edit') {
      return decodeURIComponent(parts[2])
    }
    return null
  }, [location])

  const productQuery = trpc.products.getById.useQuery(
    { id: editId as number },
    { enabled: !!editId }
  )

  const productByCodeQuery = trpc.products.getByCode.useQuery(
    { code: editCode as string },
    { enabled: !!editCode }
  )

  useEffect(() => {
    const product = (editCode ? productByCodeQuery.data : productQuery.data) as any
    if (!product) return
    const conditionMap = {
      NEW: 'new',
      USED: 'used',
      REFURBISHED: 'refurbished',
      ORIGINAL_RETIRADA: 'original_retirada',
    } as const
    const normalizedCondition = typeof product.condition === 'string'
      ? product.condition.toUpperCase()
      : product.condition
    setFormData(prev => ({
      ...prev,
      name: product.name || '',
      code: product.code || prev.code,
      brand: product.brand || prev.brand,
      model: product.model || '',
      productType: product.productType || prev.productType,
      category: product.category || prev.category,
      description: product.description || '',
      price: product.price?.toString() || '',
      quantity: product.quantity?.toString() || '',
      minQuantity: product.minQuantity?.toString() || '',
      condition: conditionMap[normalizedCondition as keyof typeof conditionMap] || prev.condition,
      warrantyPeriod: product.warrantyPeriod || prev.warrantyPeriod,
      images: product.images ? JSON.parse(product.images) : [],
    }))
  }, [productQuery.data, productByCodeQuery.data, editCode])

  const resolvedEditId = useMemo(() => {
    if (editId) return editId
    const product = (editCode ? productByCodeQuery.data : productQuery.data) as any
    return product?.id ?? null
  }, [editId, editCode, productByCodeQuery.data, productQuery.data])

  const handleImageUpload = (source: 'camera' | 'gallery') => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.multiple = true
    
    if (source === 'camera') {
      input.capture = 'environment'
    }
    
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files
      if (files) {
        const maxImages = 2
        const availableSlots = maxImages - formData.images.length
        if (availableSlots <= 0) {
          toast.error('Máximo 2 imagens permitidas')
          return
        }
        const selected = Array.from(files).slice(0, availableSlots)
        selected.forEach(async (file) => {
          if (file.size > 10 * 1024 * 1024) {
            toast.error('Imagem muito grande. Máximo 10MB antes de compressão')
            return
          }

          try {
            const { file: compressedFile } = await compressImageFile(file, 5)
            const imageUrl = await uploadImageFile(compressedFile, 'products')
            setFormData(prev => ({
              ...prev,
              images: [...prev.images, imageUrl],
            }))
          } catch (error) {
            console.error('Erro ao processar imagem:', error)
            toast.error('Erro ao processar imagem')
          }
        })
      }
    }
    
    input.click()
  }

  const removeImage = async (index: number) => {
    const imageUrl = formData.images[index]
    if (imageUrl && imageUrl.startsWith('http')) {
      try {
        await deleteImage.mutateAsync({ url: imageUrl })
      } catch (error: any) {
        console.warn('Erro ao excluir imagem do servidor (pode já ter sido excluída):', error)
        // Não bloqueia a remoção local se for erro 404 ou erro de rede
        // Apenas avisa o usuário se for algo crítico
        if (error?.data?.code !== 'INTERNAL_SERVER_ERROR') {
           toast.error('Aviso: Não foi possível confirmar a exclusão no servidor, mas removeremos do formulário.')
        }
      }
    }
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name || !formData.code || !formData.price || !formData.quantity) {
      toast.error('Por favor, preencha todos os campos obrigatórios')
      return
    }
    
    setIsSubmitting(true)
    const imageUrls: string[] = []
    for (const image of formData.images) {
      if (image.startsWith('http')) {
        imageUrls.push(image)
        continue
      }
      if (image.startsWith('data:image')) {
        try {
          const filename = `${formData.code}-${Date.now()}.webp`
          const url = await uploadBase64Image(image, filename, 'products')
          imageUrls.push(url)
        } catch (error) {
          toast.error('Erro ao migrar imagem antiga para o S3')
          setIsSubmitting(false)
          return
        }
      }
    }
    
    const conditionMap: Record<
      typeof formData.condition,
      'NEW' | 'USED' | 'REFURBISHED' | 'ORIGINAL_RETIRADA'
    > = {
      new: 'NEW',
      used: 'USED',
      refurbished: 'REFURBISHED',
      original_retirada: 'ORIGINAL_RETIRADA',
    }

    const payload = {
      code: formData.code,
      name: formData.name,
      brand: formData.brand,
      model: formData.model,
      productType: formData.productType,
      category: formData.category,
      description: formData.description,
      price: formData.price,
      quantity: parseInt(formData.quantity),
      minQuantity: parseInt(formData.minQuantity) || 0,
      condition: conditionMap[formData.condition],
      warrantyPeriod: formData.warrantyPeriod,
      images: JSON.stringify(imageUrls),
      sellerId: 1,
    }

    try {
      if (resolvedEditId) {
        await updateProduct.mutateAsync({
          id: resolvedEditId,
          name: payload.name,
          brand: payload.brand,
          model: payload.model,
          productType: payload.productType,
          category: payload.category,
          condition: payload.condition,
          warrantyPeriod: payload.warrantyPeriod,
          price: payload.price,
          quantity: payload.quantity,
          minQuantity: payload.minQuantity,
          description: payload.description,
          images: payload.images,
        })
        setIsSubmitting(false)
        return
      }

      await createProduct.mutateAsync(payload)
      setFormData({
        name: '',
        code: generateCode(),
        brand: 'Samsung',
        model: '',
        productType: 'Smartphone',
        category: 'Câmera Frontal',
        description: '',
        price: '',
        quantity: '',
        minQuantity: '',
        condition: 'new',
        warrantyPeriod: 'NONE',
        images: [],
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-4xl font-bold text-slate-900 mb-2">
            {resolvedEditId ? 'Editar Produto' : 'Adicionar Produto'}
          </h1>
          <p className="text-sm sm:text-base text-slate-600">
            {resolvedEditId ? 'Atualize as informações do produto' : 'Cadastre um novo produto no estoque'}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <Card className="p-4 sm:p-8 shadow-xl border-slate-200">
            {/* Upload de Imagens */}
            <div className="mb-8">
              <Label className="text-sm sm:text-base font-semibold text-slate-700 mb-3 block">
                Imagens do Produto (máx. 2)
              </Label>
              <div className="flex flex-col gap-2 mb-4">
                <Button
                  type="button"
                  onClick={() => handleImageUpload('camera')}
                  variant="outline"
                  className="flex-1 h-10 sm:h-14 text-sm sm:text-lg"
                >
                  <Camera className="mr-2 h-4 sm:h-5 w-4 sm:w-5" />
                  Câmera
                </Button>
                <Button
                  type="button"
                  onClick={() => handleImageUpload('gallery')}
                  variant="outline"
                  className="flex-1 h-10 sm:h-14 text-sm sm:text-lg"
                >
                  <Upload className="mr-2 h-4 sm:h-5 w-4 sm:w-5" />
                  Galeria
                </Button>
              </div>

              {/* Preview de Imagens */}
              {formData.images.length > 0 && (
                <div className="grid grid-cols-1 gap-4">
                  {formData.images.map((image, index) => (
                    <div key={index} className="relative group rounded-lg overflow-hidden border-2 border-slate-200 bg-slate-100">
                      <img
                        src={image}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-48 sm:h-64 object-contain"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = 'https://placehold.co/600x400/e2e8f0/64748b?text=Imagem+Indisponível';
                          // Opcionalmente podemos forçar a visibilidade do botão de remoção se a imagem falhar
                        }}
                      />
                      <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-3 right-3 bg-red-500 hover:bg-red-600 text-white p-2.5 rounded-full shadow-lg transition-all transform hover:scale-110 active:scale-95 z-10"
                        title="Remover imagem"
                      >
                        <X className="h-5 w-5" />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-white/80 backdrop-blur-sm px-3 py-1.5 text-xs text-slate-500 border-t border-slate-200">
                        {image.startsWith('http') ? 'Imagem no servidor' : 'Imagem pendente'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Código do Produto */}
            <div className="mb-6">
              <Label htmlFor="code" className="text-sm sm:text-base font-semibold text-slate-700 mb-2">
                Código do Produto *
              </Label>
              <div className="flex flex-col gap-2">
                <Input
                  id="code"
                  value={formData.code}
                  readOnly
                  placeholder="Ex: PROD001"
                  className="flex-1 h-10 sm:h-12 text-sm sm:text-lg"
                  required
                />
              </div>
            </div>

            {/* Nome do Produto */}
            <div className="mb-6">
              <Label htmlFor="name" className="text-sm sm:text-base font-semibold text-slate-700 mb-2">
                Nome do Produto *
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: iPhone 15 Pro Max"
                className="h-10 sm:h-12 text-sm sm:text-lg"
                required
              />
            </div>

            {/* Marca, Modelo, Tipo, Categoria e Condição */}
            <div className="grid grid-cols-1 gap-4 mb-6">
              <div>
                <Label htmlFor="brand" className="text-sm sm:text-base font-semibold text-slate-700 mb-2">
                  Marca *
                </Label>
                <Select
                  value={formData.brand}
                  onValueChange={(value) => setFormData({ ...formData, brand: value })}
                  disabled={loadingOptions}
                >
                  <SelectTrigger className="h-10 sm:h-12 text-sm sm:text-lg">
                    <SelectValue placeholder="Selecione a marca" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
                    {options?.brands.map((brand) => (
                      <SelectItem key={brand.id} value={brand.name}>
                        {brand.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="model" className="text-sm sm:text-base font-semibold text-slate-700 mb-2">
                  Modelo (Maísculas) *
                </Label>
                <Input
                  id="model"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value.toUpperCase() })}
                  placeholder="Ex: 15 PRO MAX"
                  className="h-10 sm:h-12 text-sm sm:text-lg uppercase"
                  required
                />
              </div>

              <div>
                <Label htmlFor="type" className="text-sm sm:text-base font-semibold text-slate-700 mb-2">
                  Tipo *
                </Label>
                <Select
                  value={formData.productType}
                  onValueChange={(value) => setFormData({ ...formData, productType: value })}
                  disabled={loadingOptions}
                >
                  <SelectTrigger className="h-10 sm:h-12 text-sm sm:text-lg">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
                    {options?.productTypes.map((type) => (
                      <SelectItem key={type.id} value={type.name}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="category" className="text-sm sm:text-base font-semibold text-slate-700 mb-2">
                  Peça/Aparelho *
                </Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                  disabled={loadingOptions}
                >
                  <SelectTrigger className="h-10 sm:h-12 text-sm sm:text-lg">
                    <SelectValue placeholder="Selecione a peça/aparelho" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
                    {options?.productParts.map((part) => (
                      <SelectItem key={part.id} value={part.name}>
                        {part.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="condition" className="text-sm sm:text-base font-semibold text-slate-700 mb-2">
                  Condição *
                </Label>
                <Select
                  value={formData.condition}
                  onValueChange={(value: any) => setFormData({ ...formData, condition: value })}
                  disabled={loadingOptions}
                >
                  <SelectTrigger className="h-10 sm:h-12 text-sm sm:text-lg">
                    <SelectValue placeholder="Selecione a condição" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
                    {options?.conditions.map((cond) => (
                      <SelectItem key={cond.id} value={cond.value}>
                        {cond.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Garantia */}
              <div>
                <Label htmlFor="warranty" className="text-sm sm:text-base font-semibold text-slate-700 mb-2">
                  Período de Garantia *
                </Label>
                <Select
                  value={formData.warrantyPeriod}
                  onValueChange={(value) => setFormData({ ...formData, warrantyPeriod: value as any })}
                  disabled={loadingOptions}
                >
                  <SelectTrigger className="h-10 sm:h-12 text-sm sm:text-lg">
                    <SelectValue placeholder="Selecione a garantia" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
                    <SelectItem value="NONE">Sem Garantia</SelectItem>
                    <SelectItem value="DAYS_7">7 Dias</SelectItem>
                    <SelectItem value="DAYS_30">30 Dias</SelectItem>
                    <SelectItem value="DAYS_90">90 Dias</SelectItem>
                    <SelectItem value="MONTHS_6">6 Meses</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Descrição */}
            <div className="mb-6">
              <Label htmlFor="description" className="text-sm sm:text-base font-semibold text-slate-700 mb-2">
                Descrição
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descreva o produto..."
                className="min-h-20 sm:min-h-24 text-sm sm:text-lg"
              />
            </div>

            {/* Preço, Quantidade e Estoque Mínimo */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6">
              <div>
                <Label htmlFor="price" className="text-sm sm:text-base font-semibold text-slate-700 mb-2">
                  Preço (R$) *
                </Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="0.00"
                  className="h-10 sm:h-12 text-sm sm:text-lg"
                  required
                />
              </div>

              <div>
                <Label htmlFor="quantity" className="text-sm sm:text-base font-semibold text-slate-700 mb-2">
                  Quantidade *
                </Label>
                <Input
                  id="quantity"
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  placeholder="0"
                  className="h-10 sm:h-12 text-sm sm:text-lg"
                  required
                />
              </div>

              <div>
                <Label htmlFor="minQuantity" className="text-sm sm:text-base font-semibold text-slate-700 mb-2">
                  Estoque Mínimo
                </Label>
                <Input
                  id="minQuantity"
                  type="number"
                  value={formData.minQuantity}
                  onChange={(e) => setFormData({ ...formData, minQuantity: e.target.value })}
                  placeholder="0"
                  className="h-10 sm:h-12 text-sm sm:text-lg"
                />
              </div>
            </div>

            {/* Botões de Ação */}
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/stock')}
                className="flex-1 h-10 sm:h-14 text-sm sm:text-lg"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || createProduct.isPending || updateProduct.isPending}
                className="flex-1 h-10 sm:h-14 text-sm sm:text-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                {editId
                  ? updateProduct.isPending
                    ? 'Salvando...'
                    : 'Salvar Alterações'
                  : createProduct.isPending
                    ? 'Cadastrando...'
                    : 'Cadastrar Produto'}
              </Button>
            </div>
            {isSubmitting && (
              <div className="mt-3 h-1 w-full bg-slate-200 rounded">
                <div className="h-1 w-full bg-blue-600 animate-pulse rounded" />
              </div>
            )}
          </Card>
        </form>
      </div>
    </div>
  )
}
