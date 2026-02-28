import { useEffect, useState } from 'react'

const CONSENT_KEY = 'cookie-consent'

export default function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const consent = localStorage.getItem(CONSENT_KEY)
    if (!consent) {
      setVisible(true)
    }
  }, [])

  const handleAccept = () => {
    localStorage.setItem(CONSENT_KEY, 'accepted')
    window.location.reload()
  }

  const handleReject = () => {
    localStorage.setItem(CONSENT_KEY, 'rejected')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white border border-gray-200 shadow-xl p-4">
        <p className="text-xs sm:text-sm text-gray-700">
          Usamos cookies para melhorar sua experiência. Você pode aceitar ou rejeitar.
        </p>
        <div className="mt-4 flex gap-2 justify-end">
          <button
            onClick={handleReject}
            className="px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Rejeitar
          </button>
          <button
            onClick={handleAccept}
            className="px-3 py-2 text-xs sm:text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Aceitar
          </button>
        </div>
      </div>
    </div>
  )
}
