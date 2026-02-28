import React, { useState, useRef, useEffect } from 'react'
import { cn } from '../../lib/utils'

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string
  alt: string
  placeholder?: string
  errorPlaceholder?: string
  className?: string
  onLoad?: () => void
  onError?: () => void
}

export function LazyImage({
  src,
  alt,
  placeholder,
  errorPlaceholder,
  className,
  onLoad,
  onError,
  ...props
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [isInView, setIsInView] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      {
        rootMargin: '50px', // Começar a carregar 50px antes de entrar na viewport
        threshold: 0.1
      }
    )

    if (imgRef.current) {
      observer.observe(imgRef.current)
      observerRef.current = observer
    }

    return () => {
      observer.disconnect()
    }
  }, [])

  const handleLoad = () => {
    setIsLoaded(true)
    onLoad?.()
  }

  const handleError = () => {
    setHasError(true)
    onError?.()
  }

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* Placeholder/Skeleton */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center">
          {placeholder ? (
            <img
              src={placeholder}
              alt=""
              className="w-full h-full object-cover filter blur-sm"
            />
          ) : (
            <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          )}
        </div>
      )}

      {/* Error state */}
      {hasError && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
          {errorPlaceholder ? (
            <img
              src={errorPlaceholder}
              alt="Erro ao carregar imagem"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-gray-400 text-center">
              <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <p className="text-sm">Erro ao carregar</p>
            </div>
          )}
        </div>
      )}

      {/* Actual image */}
      {isInView && (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            'w-full h-full object-cover transition-opacity duration-300',
            isLoaded ? 'opacity-100' : 'opacity-0'
          )}
          {...props}
        />
      )}

      {/* Intersection observer target */}
      {!isInView && (
        <div
          ref={imgRef}
          className="w-full h-full"
          aria-hidden="true"
        />
      )}
    </div>
  )
}

// Hook personalizado para lazy loading de múltiplas imagens
export function useLazyImageLoader() {
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set())
  const [loadingImages, setLoadingImages] = useState<Set<string>>(new Set())

  const loadImage = (src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (loadedImages.has(src)) {
        resolve()
        return
      }

      if (loadingImages.has(src)) {
        // Já está carregando, esperar
        const checkLoaded = setInterval(() => {
          if (loadedImages.has(src)) {
            clearInterval(checkLoaded)
            resolve()
          }
        }, 100)
        return
      }

      setLoadingImages(prev => new Set(prev).add(src))

      const img = new Image()
      img.onload = () => {
        setLoadedImages(prev => new Set(prev).add(src))
        setLoadingImages(prev => {
          const newSet = new Set(prev)
          newSet.delete(src)
          return newSet
        })
        resolve()
      }
      img.onerror = () => {
        setLoadingImages(prev => {
          const newSet = new Set(prev)
          newSet.delete(src)
          return newSet
        })
        reject(new Error(`Failed to load image: ${src}`))
      }
      img.src = src
    })
  }

  const preloadImages = (srcs: string[]) => {
    return Promise.allSettled(srcs.map(src => loadImage(src)))
  }

  return {
    loadImage,
    preloadImages,
    isLoaded: (src: string) => loadedImages.has(src),
    isLoading: (src: string) => loadingImages.has(src)
  }
}