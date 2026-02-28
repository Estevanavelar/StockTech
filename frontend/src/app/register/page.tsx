'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type AccountType = 'BUYER' | 'SELLER' | 'BOTH'

interface FormData {
  // Dados pessoais
  name: string
  email: string
  phone: string
  document: string // CPF ou CNPJ
  
  // Tipo de conta
  accountType: AccountType
  
  // Dados da empresa (se CNPJ)
  companyName: string
  tradeName: string // Nome fantasia
  
  // Endereço
  cep: string
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  state: string
  
  // Credenciais
  password: string
  confirmPassword: string
  
  // Termos
  acceptTerms: boolean
}

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [step, setStep] = useState(1) // 1: Dados, 2: Endereço, 3: Senha
  const [showPassword, setShowPassword] = useState(false)
  
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    document: '',
    accountType: 'BUYER',
    companyName: '',
    tradeName: '',
    cep: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    password: '',
    confirmPassword: '',
    acceptTerms: false
  })

  // Detectar se é CNPJ (14 dígitos) ou CPF (11 dígitos)
  const isCNPJ = formData.document.replace(/\D/g, '').length > 11

  const formatDocument = (value: string) => {
    const numbers = value.replace(/\D/g, '')
    
    if (numbers.length <= 11) {
      // Format as CPF: 111.444.777-35
      return numbers
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
    } else {
      // Format as CNPJ: 11.222.333/0001-81
      return numbers
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1/$2')
        .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
    }
  }

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '')
    if (numbers.length <= 10) {
      return numbers
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{4})(\d)/, '$1-$2')
    }
    return numbers
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
  }

  const formatCEP = (value: string) => {
    const numbers = value.replace(/\D/g, '')
    return numbers.replace(/(\d{5})(\d)/, '$1-$2')
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    
    let formattedValue = value
    
    if (name === 'document') {
      formattedValue = formatDocument(value)
    } else if (name === 'phone') {
      formattedValue = formatPhone(value)
    } else if (name === 'cep') {
      formattedValue = formatCEP(value)
    }
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked
      setFormData(prev => ({ ...prev, [name]: checked }))
    } else {
      setFormData(prev => ({ ...prev, [name]: formattedValue }))
    }
    
    if (error) setError('')
  }

  // Buscar endereço pelo CEP
  const fetchAddressByCEP = async (cep: string) => {
    const cleanCEP = cep.replace(/\D/g, '')
    if (cleanCEP.length !== 8) return
    
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`)
      const data = await response.json()
      
      if (!data.erro) {
        setFormData(prev => ({
          ...prev,
          street: data.logradouro || '',
          neighborhood: data.bairro || '',
          city: data.localidade || '',
          state: data.uf || ''
        }))
      }
    } catch (err) {
      console.error('Erro ao buscar CEP:', err)
    }
  }

  const validateStep1 = () => {
    if (!formData.name.trim()) {
      setError('Nome é obrigatório')
      return false
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      setError('Email válido é obrigatório')
      return false
    }
    if (formData.phone.replace(/\D/g, '').length < 10) {
      setError('WhatsApp válido é obrigatório')
      return false
    }
    if (formData.document.replace(/\D/g, '').length < 11) {
      setError('CPF ou CNPJ válido é obrigatório')
      return false
    }
    if (isCNPJ && !formData.companyName.trim()) {
      setError('Razão Social é obrigatória para CNPJ')
      return false
    }
    return true
  }

  const validateStep2 = () => {
    if (formData.cep.replace(/\D/g, '').length !== 8) {
      setError('CEP válido é obrigatório')
      return false
    }
    if (!formData.street.trim()) {
      setError('Rua é obrigatória')
      return false
    }
    if (!formData.number.trim()) {
      setError('Número é obrigatório')
      return false
    }
    if (!formData.city.trim()) {
      setError('Cidade é obrigatória')
      return false
    }
    if (!formData.state.trim()) {
      setError('Estado é obrigatório')
      return false
    }
    return true
  }

  const validateStep3 = () => {
    if (formData.password.length < 6) {
      setError('Senha deve ter no mínimo 6 caracteres')
      return false
    }
    if (formData.password !== formData.confirmPassword) {
      setError('As senhas não conferem')
      return false
    }
    if (!formData.acceptTerms) {
      setError('Você deve aceitar os termos de uso')
      return false
    }
    return true
  }

  const nextStep = () => {
    setError('')
    if (step === 1 && validateStep1()) {
      setStep(2)
    } else if (step === 2 && validateStep2()) {
      setStep(3)
    }
  }

  const prevStep = () => {
    setError('')
    setStep(prev => Math.max(1, prev - 1))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateStep3()) return
    
    setLoading(true)
    setError('')
    
    try {
      const cleanDocument = formData.document.replace(/\D/g, '')
      const cleanPhone = formData.phone.replace(/\D/g, '')
      const cleanCEP = formData.cep.replace(/\D/g, '')
      
      const payload = {
        name: formData.name,
        email: formData.email,
        phone: cleanPhone,
        cpf: cleanDocument,
        password: formData.password,
        account_type: formData.accountType,
        company_name: isCNPJ ? formData.companyName : null,
        trade_name: isCNPJ ? formData.tradeName : null,
        address: {
          cep: cleanCEP,
          street: formData.street,
          number: formData.number,
          complement: formData.complement,
          neighborhood: formData.neighborhood,
          city: formData.city,
          state: formData.state
        }
      }
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_AVADMIN_API_URL}/api/auth-simple/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      
      const data = await response.json()
      
      if (response.ok && data.success) {
        setSuccess(true)
        // Redirecionar para login após 3 segundos
        setTimeout(() => {
          router.push('/login')
        }, 3000)
      } else {
        setError(data.message || data.detail || 'Erro ao criar conta')
      }
      
    } catch (err) {
      setError('Erro ao conectar com o servidor')
      console.error('Register error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Tela de sucesso
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-400 to-primary-600">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full mx-4 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Conta Criada com Sucesso!
          </h2>
          <p className="text-gray-600 mb-4">
            Um código de verificação foi enviado para seu WhatsApp.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Redirecionando para o login...
          </p>
          <Link
            href="/login"
            className="btn-primary inline-block"
          >
            Ir para Login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side - Register Form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-20 xl:px-24 py-12">
        <div className="mx-auto w-full max-w-lg">
          <div>
            <div className="text-center mb-6">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                📱 Criar Conta
              </h1>
              <p className="text-gray-600">
                Cadastre-se no StockTech
              </p>
            </div>

            {/* Progress Steps */}
            <div className="flex items-center justify-center mb-8">
              {[1, 2, 3].map((s) => (
                <React.Fragment key={s}>
                  <div 
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors ${
                      step >= s 
                        ? 'bg-primary-600 text-white' 
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {s}
                  </div>
                  {s < 3 && (
                    <div className={`w-16 h-1 mx-2 transition-colors ${
                      step > s ? 'bg-primary-600' : 'bg-gray-200'
                    }`} />
                  )}
                </React.Fragment>
              ))}
            </div>

            <div className="bg-white py-8 px-6 shadow-lg rounded-lg border border-gray-200">
              <form onSubmit={handleSubmit} className="space-y-5">
                
                {/* Step 1: Dados Pessoais */}
                {step === 1 && (
                  <>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      👤 Dados Pessoais
                    </h3>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nome Completo *
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        className="input-field"
                        placeholder="Seu nome completo"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email *
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className="input-field"
                        placeholder="seu@email.com"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        WhatsApp *
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className="input-field"
                        placeholder="(11) 99999-9999"
                        maxLength={15}
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        📱 Você receberá um código de verificação
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        CPF ou CNPJ *
                      </label>
                      <input
                        type="text"
                        name="document"
                        value={formData.document}
                        onChange={handleInputChange}
                        className="input-field"
                        placeholder="000.000.000-00 ou 00.000.000/0001-00"
                        maxLength={18}
                        required
                      />
                    </div>

                    {isCNPJ && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Razão Social *
                          </label>
                          <input
                            type="text"
                            name="companyName"
                            value={formData.companyName}
                            onChange={handleInputChange}
                            className="input-field"
                            placeholder="Nome da empresa"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Nome Fantasia
                          </label>
                          <input
                            type="text"
                            name="tradeName"
                            value={formData.tradeName}
                            onChange={handleInputChange}
                            className="input-field"
                            placeholder="Nome fantasia (opcional)"
                          />
                        </div>
                      </>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tipo de Conta *
                      </label>
                      <select
                        name="accountType"
                        value={formData.accountType}
                        onChange={handleInputChange}
                        className="input-field"
                      >
                        <option value="BUYER">🛒 Comprador</option>
                        <option value="SELLER">🏪 Vendedor</option>
                        <option value="BOTH">🔄 Comprador e Vendedor</option>
                      </select>
                    </div>
                  </>
                )}

                {/* Step 2: Endereço */}
                {step === 2 && (
                  <>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      📍 Endereço
                    </h3>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        CEP *
                      </label>
                      <input
                        type="text"
                        name="cep"
                        value={formData.cep}
                        onChange={handleInputChange}
                        onBlur={(e) => fetchAddressByCEP(e.target.value)}
                        className="input-field"
                        placeholder="00000-000"
                        maxLength={9}
                        required
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Rua *
                        </label>
                        <input
                          type="text"
                          name="street"
                          value={formData.street}
                          onChange={handleInputChange}
                          className="input-field"
                          placeholder="Nome da rua"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Número *
                        </label>
                        <input
                          type="text"
                          name="number"
                          value={formData.number}
                          onChange={handleInputChange}
                          className="input-field"
                          placeholder="123"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Complemento
                      </label>
                      <input
                        type="text"
                        name="complement"
                        value={formData.complement}
                        onChange={handleInputChange}
                        className="input-field"
                        placeholder="Apto, sala, etc (opcional)"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Bairro *
                      </label>
                      <input
                        type="text"
                        name="neighborhood"
                        value={formData.neighborhood}
                        onChange={handleInputChange}
                        className="input-field"
                        placeholder="Bairro"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Cidade *
                        </label>
                        <input
                          type="text"
                          name="city"
                          value={formData.city}
                          onChange={handleInputChange}
                          className="input-field"
                          placeholder="Cidade"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          UF *
                        </label>
                        <input
                          type="text"
                          name="state"
                          value={formData.state}
                          onChange={handleInputChange}
                          className="input-field"
                          placeholder="SP"
                          maxLength={2}
                          required
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Step 3: Senha */}
                {step === 3 && (
                  <>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      🔐 Criar Senha
                    </h3>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Senha *
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          name="password"
                          value={formData.password}
                          onChange={handleInputChange}
                          className="input-field pr-10"
                          placeholder="Mínimo 6 caracteres"
                          minLength={6}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        >
                          {showPassword ? '🙈' : '👁️'}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Confirmar Senha *
                      </label>
                      <input
                        type="password"
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        className="input-field"
                        placeholder="Repita a senha"
                        minLength={6}
                        required
                      />
                    </div>

                    <div className="flex items-start">
                      <input
                        type="checkbox"
                        name="acceptTerms"
                        id="acceptTerms"
                        checked={formData.acceptTerms}
                        onChange={handleInputChange}
                        className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <label htmlFor="acceptTerms" className="ml-2 text-sm text-gray-600">
                        Li e aceito os{' '}
                        <a href="#" className="text-primary-600 hover:underline">
                          Termos de Uso
                        </a>{' '}
                        e a{' '}
                        <a href="#" className="text-primary-600 hover:underline">
                          Política de Privacidade
                        </a>
                      </label>
                    </div>

                    {/* Resumo */}
                    <div className="bg-gray-50 rounded-lg p-4 text-sm">
                      <h4 className="font-medium text-gray-900 mb-2">📋 Resumo do Cadastro</h4>
                      <div className="space-y-1 text-gray-600">
                        <p><strong>Nome:</strong> {formData.name}</p>
                        <p><strong>Email:</strong> {formData.email}</p>
                        <p><strong>WhatsApp:</strong> {formData.phone}</p>
                        <p><strong>Documento:</strong> {formData.document}</p>
                        <p><strong>Tipo:</strong> {
                          formData.accountType === 'BUYER' ? 'Comprador' :
                          formData.accountType === 'SELLER' ? 'Vendedor' : 'Comprador e Vendedor'
                        }</p>
                        <p><strong>Cidade:</strong> {formData.city}/{formData.state}</p>
                      </div>
                    </div>
                  </>
                )}

                {/* Error message */}
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    <div className="flex items-center">
                      <span className="mr-2">⚠️</span>
                      <p className="text-sm font-medium">{error}</p>
                    </div>
                  </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex justify-between pt-4">
                  {step > 1 ? (
                    <button
                      type="button"
                      onClick={prevStep}
                      className="btn-secondary"
                    >
                      ← Voltar
                    </button>
                  ) : (
                    <Link href="/login" className="btn-secondary">
                      ← Login
                    </Link>
                  )}

                  {step < 3 ? (
                    <button
                      type="button"
                      onClick={nextStep}
                      className="btn-primary"
                    >
                      Próximo →
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={loading}
                      className="btn-primary disabled:opacity-50"
                    >
                      {loading ? (
                        <span className="flex items-center">
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                          Criando...
                        </span>
                      ) : (
                        '✅ Criar Conta'
                      )}
                    </button>
                  )}
                </div>

                <div className="text-center pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-600">
                    Já tem conta?{' '}
                    <Link href="/login" className="text-primary-600 hover:text-primary-500 font-medium">
                      Fazer login
                    </Link>
                  </p>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
      
      {/* Right side - Branding */}
      <div className="hidden lg:flex lg:flex-1 lg:relative lg:overflow-hidden">
        <div className="relative bg-gradient-to-br from-primary-600 to-green-600 w-full flex items-center justify-center">
          <div className="text-center text-white max-w-md px-8">
            <h1 className="text-6xl font-bold mb-6">📱</h1>
            <h2 className="text-4xl font-bold mb-4">StockTech</h2>
            <p className="text-xl opacity-90 mb-8">Marketplace B2B de Eletrônicos</p>
            
            <div className="bg-white/10 rounded-lg p-6 backdrop-blur-sm text-left">
              <h3 className="text-lg font-semibold mb-4 text-center">🎁 Benefícios do Cadastro</h3>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <span className="mr-3 text-xl">🛒</span>
                  <div>
                    <strong>Catálogo Exclusivo</strong>
                    <p className="text-sm opacity-80">Acesso a produtos selecionados</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="mr-3 text-xl">💰</span>
                  <div>
                    <strong>Preços B2B</strong>
                    <p className="text-sm opacity-80">Condições especiais para revendedores</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="mr-3 text-xl">📱</span>
                  <div>
                    <strong>WhatsApp Integrado</strong>
                    <p className="text-sm opacity-80">Negociação direta e rápida</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="mr-3 text-xl">🔒</span>
                  <div>
                    <strong>Ambiente Seguro</strong>
                    <p className="text-sm opacity-80">Verificação de compradores e vendedores</p>
                  </div>
                </li>
              </ul>
            </div>
            
            <div className="mt-8 text-sm opacity-75">
              <p>🇧🇷 100% Brasileiro • Feito para o mercado B2B</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}