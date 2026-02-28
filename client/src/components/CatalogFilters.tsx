import React from 'react'

interface CatalogFiltersProps {
  modelSearch: string
  onModelSearchChange: (value: string) => void
  selectedBrand: string | null
  onBrandChange: (value: string | null) => void
  selectedCategory: string | null
  onCategoryChange: (value: string | null) => void
  selectedCondition: string | null
  onConditionChange: (value: string | null) => void
  brands: (string | null)[]
  categories: (string | null)[]
  conditions: string[]
  products?: any[]
  variant?: 'sidebar' | 'dialog'
}

function getConditionLabel(condition: string) {
  switch (condition) {
    case 'NEW': return 'Novo'
    case 'USED': return 'Usado'
    case 'REFURBISHED': return 'Recondicionado'
    case 'ORIGINAL_RETIRADA': return 'Original Retirada'
    default: return condition
  }
}

function countByField(products: any[], field: string, value: string | null) {
  if (!products || !value) return 0
  return products.filter((p: any) => p[field] === value).length
}

export default function CatalogFilters({
  modelSearch,
  onModelSearchChange,
  selectedBrand,
  onBrandChange,
  selectedCategory,
  onCategoryChange,
  selectedCondition,
  onConditionChange,
  brands,
  categories,
  conditions,
  products = [],
  variant = 'dialog',
}: CatalogFiltersProps) {
  const isSidebar = variant === 'sidebar'

  if (isSidebar) {
    return (
      <div className="space-y-6">
        {/* Modelo */}
        <div>
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Modelo</h3>
          <input
            type="text"
            placeholder="Ex: iPhone 13, Galaxy A54..."
            value={modelSearch}
            onChange={(e) => onModelSearchChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>

        {/* Marca */}
        <div>
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Marca</h3>
          <div className="space-y-1">
            <button
              onClick={() => onBrandChange(null)}
              className={`w-full text-left px-3 py-1.5 rounded text-sm transition-colors ${
                !selectedBrand ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Todas
            </button>
            {brands.map((brand) => (
              <button
                key={brand}
                onClick={() => onBrandChange(brand)}
                className={`w-full text-left px-3 py-1.5 rounded text-sm transition-colors ${
                  selectedBrand === brand ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {brand}
                <span className="text-gray-400 ml-1">({countByField(products, 'brand', brand)})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Peça / Parte */}
        <div>
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Peça / Parte</h3>
          <div className="space-y-1">
            <button
              onClick={() => onCategoryChange(null)}
              className={`w-full text-left px-3 py-1.5 rounded text-sm transition-colors ${
                !selectedCategory ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Todas
            </button>
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => onCategoryChange(category)}
                className={`w-full text-left px-3 py-1.5 rounded text-sm transition-colors ${
                  selectedCategory === category ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {category}
                <span className="text-gray-400 ml-1">({countByField(products, 'category', category)})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Condição */}
        <div>
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Condição</h3>
          <div className="space-y-1">
            <button
              onClick={() => onConditionChange(null)}
              className={`w-full text-left px-3 py-1.5 rounded text-sm transition-colors ${
                !selectedCondition ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Todas
            </button>
            {conditions.map((condition) => (
              <button
                key={condition}
                onClick={() => onConditionChange(condition)}
                className={`w-full text-left px-3 py-1.5 rounded text-sm transition-colors ${
                  selectedCondition === condition ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {getConditionLabel(condition)}
                <span className="text-gray-400 ml-1">({countByField(products, 'condition', condition)})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Limpar filtros */}
        {(selectedBrand || selectedCategory || selectedCondition || modelSearch) && (
          <button
            onClick={() => {
              onBrandChange(null)
              onCategoryChange(null)
              onConditionChange(null)
              onModelSearchChange('')
            }}
            className="w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-200"
          >
            Limpar filtros
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4 py-4">
      <div>
        <label className="text-sm font-medium text-gray-900 block mb-2">Modelo</label>
        <input
          type="text"
          placeholder="Ex: iPhone 13, Galaxy A54..."
          value={modelSearch}
          onChange={(e) => onModelSearchChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-gray-900 block mb-2">Marca</label>
        <select
          value={selectedBrand || ''}
          onChange={(e) => onBrandChange(e.target.value || null)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todas</option>
          {brands.map((brand) => (
            <option key={brand} value={brand || ''}>{brand}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-900 block mb-2">Peça / Parte</label>
        <select
          value={selectedCategory || ''}
          onChange={(e) => onCategoryChange(e.target.value || null)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todas</option>
          {categories.map((category) => (
            <option key={category} value={category || ''}>{category}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-900 block mb-2">Condição</label>
        <select
          value={selectedCondition || ''}
          onChange={(e) => onConditionChange(e.target.value || null)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todas</option>
          {conditions.map((condition) => (
            <option key={condition} value={condition}>
              {getConditionLabel(condition)}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
