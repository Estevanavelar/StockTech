'use client'

import React, { useState } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [needsVerification, setNeedsVerification] = useState(false)
  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [formData, setFormData] = useState({
    document: '',
    password: ''
  })
  
  const formatDocument = (value: string) => {
    const numbers = value.replace(/\D/g, '')
    
    if (numbers.length <= 11) {
      // Format as CPF: 111.444.777-35
      return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
    } else {
      // Format as CNPJ: 11.222.333/0001-81
      return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
    }
  }
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    
    if (name === 'document') {
      const formatted = formatDocument(value)
      setFormData(prev => ({ ...prev, [name]: formatted }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
    
    // Clear error when user types
    if (error) setError('')
  }
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    try {
      // Clean document (remove formatting)
      const cleanDocument = formData.document.replace(/\D/g, '')
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_AVADMIN_API_URL}/api/auth-simple/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cpf: cleanDocument,
          password: formData.password
        }),
      })
      
      const data = await response.json()
      
      if (response.ok && data.success) {
        // Save token and user data
        localStorage.setItem('avadmin_token', data.token)
        localStorage.setItem('avadmin_user', JSON.stringify({
          name: data.user_name,
          role: data.role,
          cpf: cleanDocument
        }))
        
        // Determine redirect based on role
        if (data.role === 'SUPER_ADMIN') {
          // Super admin goes to AvAdmin
          window.location.href = 'https://admin.avelarcompany.com.br/dashboard'
        } else {
          // Regular user goes to StockTech dashboard
          router.push('/dashboard')
        }
        
      } else if (response.status === 422) {
        // WhatsApp verification needed
        setNeedsVerification(true)
        setWhatsappNumber(data.whatsapp || 'WhatsApp cadastrado')
        setError('')
      } else {
        setError(data.message || 'CPF/CNPJ ou senha incorretos')
      }
      
    } catch (err) {
      setError('Erro ao conectar com o servidor')
      console.error('Login error:', err)
    } finally {
      setLoading(false)
    }
  }
  
  const handleVerification = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const cleanDocument = formData.document.replace(/\D/g, '')
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_AVADMIN_API_URL}/api/auth/verify-whatsapp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cpf: cleanDocument,
          code: verificationCode
        }),
      })
      
      if (response.ok) {
        // Verification successful, try login again
        setNeedsVerification(false)
        setVerificationCode('')
        await handleLogin(e)
      } else {
        const data = await response.json()
        setError(data.detail || 'Código inválido')
      }
      
    } catch (err) {
      setError('Erro ao verificar código')
    } finally {
      setLoading(false)
    }
  }
  
  const resendCode = async () => {
    try {
      const cleanDocument = formData.document.replace(/\D/g, '')
      
      await fetch(`${process.env.NEXT_PUBLIC_AVADMIN_API_URL}/api/auth/send-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cpf: cleanDocument
        }),
      })
      
      toast.success('📱 Novo código enviado via WhatsApp!', { duration: 5000 })
      
    } catch (err) {
      console.error('Resend error:', err)
    }
  }
  
  if (needsVerification) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-400 to-primary-600">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full mx-4">
          <div className="text-center mb-6">
            <span className="text-4xl">📱</span>
            <h2 className="text-2xl font-bold text-gray-900 mt-2">
              Verificação WhatsApp
            </h2>
            <p className="text-gray-600 mt-2">
              Código enviado para: {whatsappNumber}
            </p>
          </div>
          
          <form onSubmit={handleVerification} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Código de Verificação
              </label>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="input-field text-center text-lg font-mono tracking-widest"
                placeholder="000000"
                maxLength={6}
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Digite o código de 6 dígitos recebido via WhatsApp
              </p>
            </div>
            
            {error && (
              <div className="bg-danger-50 border border-danger-200 text-danger-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}
            
            <button
              type="submit"
              disabled={loading || verificationCode.length !== 6}
              className="w-full btn-primary disabled:opacity-50"
            >
              {loading ? 'Verificando...' : 'Verificar Código'}
            </button>
            
            <div className="text-center">
              <button
                type="button"
                onClick={resendCode}
                className="text-sm text-primary-600 hover:text-primary-500"
              >
                Reenviar código
              </button>
            </div>
            
            <div className="text-center">
              <button
                type="button"
                onClick={() => setNeedsVerification(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ← Voltar ao login
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen flex">
      {/* Left side - Login Form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div>
            <div className="text-center">
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                📱 AvelarSys
              </h1>
              <p className="text-lg text-gray-600 mb-2">
                Sistema SaaS Brasileiro
              </p>
              <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
                <span>🔐 Login Obrigatório</span>
                <span>•</span>
                <span>📱 WhatsApp-First</span>
              </div>
            </div>
            
            <div className="mt-8">
              <div className="bg-white py-8 px-6 shadow-lg rounded-lg border border-gray-200">
                <form className="space-y-6" onSubmit={handleLogin}>
                  <div>
                    <label htmlFor="document" className="block text-sm font-medium text-gray-700">
                      CPF ou CNPJ
                    </label>
                    <div className="mt-1">
                      <input
                        id="document"
                        name="document"
                        type="text"
                        autoComplete="username"
                        required
                        className="document-input"
                        placeholder="000.000.000-00 ou 00.000.000/0001-00"
                        value={formData.document}
                        onChange={handleInputChange}
                        maxLength={18}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Use seu CPF ou CNPJ da empresa
                    </p>
                  </div>
                  
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                      Senha
                    </label>
                    <div className="mt-1">
                      <input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        required
                        className="input-field"
                        placeholder="Digite sua senha"
                        value={formData.password}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                  
                  {error && (
                    <div className="bg-danger-50 border border-danger-200 text-danger-700 px-4 py-3 rounded-lg">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <span className="text-danger-500">⚠️</span>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium">{error}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed py-3 text-base font-semibold"
                    >
                      {loading ? (
                        <div className="flex items-center justify-center">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                          Entrando...
                        </div>
                      ) : (
                        'Entrar no Sistema'
                      )}
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <a 
                      href="/forgot-password" 
                      className="text-primary-600 hover:text-primary-500"
                    >
                      Esqueceu a senha?
                    </a>
                    <a 
                      href="/register" 
                      className="text-primary-600 hover:text-primary-500 font-medium"
                    >
                      Criar conta
                    </a>
                  </div>
                  
                  <div className="text-center pt-4 border-t border-gray-200">
                    <p className="text-xs text-gray-500">
                      🔒 Catálogo privado • Login obrigatório para ver produtos
                    </p>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Right side - StockTech Branding */}
      <div className="hidden lg:flex lg:flex-1 lg:relative lg:overflow-hidden">
        <div className="relative bg-gradient-to-br from-primary-600 to-green-600 w-full flex items-center justify-center">
          <div className="text-center text-white">
            <h1 className="text-6xl font-bold mb-6">📱</h1>
            <h2 className="text-4xl font-bold mb-4">StockTech</h2>
            <p className="text-xl opacity-90 mb-8">Marketplace B2B de Eletrônicos</p>
            
            <div className="space-y-4 text-lg">
              <div className="flex items-center justify-center">
                <span className="mr-3">🔐</span>
                <span>Catálogo Privado</span>
              </div>
              <div className="flex items-center justify-center">
                <span className="mr-3">📱</span>
                <span>Negociações via WhatsApp</span>
              </div>
              <div className="flex items-center justify-center">
                <span className="mr-3">🤖</span>
                <span>Automação Inteligente</span>
              </div>
              <div className="flex items-center justify-center">
                <span className="mr-3">🇧🇷</span>
                <span>Feito para o Brasil</span>
              </div>
            </div>
            
            <div className="mt-12 bg-white/10 rounded-lg p-6 backdrop-blur-sm">
              <h3 className="text-lg font-semibold mb-3">💡 Como Funciona</h3>
              <div className="text-sm space-y-2 text-left">
                <p>1. 🔐 Faça login com seu CPF/CNPJ</p>
                <p>2. 📱 Verifique WhatsApp (código automático)</p>
                <p>3. 🛍️ Acesse catálogo privado de produtos</p>
                <p>4. 💬 Interesse? WhatsApp automático para vendedor</p>
                <p>5. 🤝 Negociação direta no WhatsApp</p>
              </div>
            </div>
            
            <div className="mt-8 text-sm opacity-75">
              <p>🚀 O futuro do B2B brasileiro</p>
            </div>
          </div>
          
          {/* Floating elements */}
          <div className="absolute top-0 left-0 w-full h-full opacity-10">
            <div className="absolute top-10 left-10 w-16 h-16 border-2 border-white rounded-lg rotate-12 animate-pulse-soft"></div>
            <div className="absolute bottom-20 right-20 w-20 h-20 border-2 border-white rounded-full animate-pulse-soft" style={{animationDelay: '1s'}}></div>
            <div className="absolute top-1/3 right-10 w-12 h-12 border-2 border-white rounded-full animate-pulse-soft" style={{animationDelay: '2s'}}></div>
            <div className="absolute bottom-10 left-16 w-8 h-8 border-2 border-white rounded-lg rotate-45 animate-pulse-soft" style={{animationDelay: '0.5s'}}></div>
          </div>
        </div>
      </div>
    </div>
  )
}