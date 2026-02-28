/**
 * Utilitarios de compressao e conversao de imagens no navegador.
 */

function supportsWebP(): boolean {
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  return canvas.toDataURL('image/webp').indexOf('image/webp') === 5
}

export async function compressImageFile(
  file: File,
  maxSizeMB = 5,
  maxWidth = 2048,
  maxHeight = 2048,
  targetQuality = 0.85
): Promise<{
  file: File
  format: 'webp' | 'jpeg'
  originalSize: number
  compressedSize: number
}> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const useWebP = supportsWebP()
    const mimeType = useWebP ? 'image/webp' : 'image/jpeg'
    const format: 'webp' | 'jpeg' = useWebP ? 'webp' : 'jpeg'
    const maxBytes = maxSizeMB * 1024 * 1024
    const minQuality = useWebP ? 0.4 : 0.5
    const objectUrl = URL.createObjectURL(file)

    img.onload = async () => {
      URL.revokeObjectURL(objectUrl)
      const canvas = document.createElement('canvas')
      let width = img.width
      let height = img.height

      if (width > maxWidth || height > maxHeight) {
        const aspectRatio = width / height
        if (width > height) {
          width = maxWidth
          height = Math.round(width / aspectRatio)
        } else {
          height = maxHeight
          width = Math.round(height * aspectRatio)
        }
      }

      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Falha ao obter contexto do canvas'))
        return
      }

      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, width, height)

      let quality = targetQuality
      let compressedBlob: Blob | null = null

      while (quality >= minQuality) {
        compressedBlob = await new Promise<Blob | null>((resolveBlob) => {
          canvas.toBlob(
            (blob) => resolveBlob(blob),
            mimeType,
            quality
          )
        })

        if (compressedBlob && compressedBlob.size <= maxBytes) {
          break
        }
        quality -= 0.05
      }

      if (!compressedBlob) {
        reject(new Error('Falha ao comprimir imagem'))
        return
      }

      const baseName = file.name.replace(/\.[^/.]+$/, '')
      const newName = `${baseName}.${format === 'webp' ? 'webp' : 'jpg'}`
      const compressedFile = new File([compressedBlob], newName, {
        type: mimeType,
      })

      resolve({
        file: compressedFile,
        format,
        originalSize: file.size,
        compressedSize: compressedBlob.size,
      })
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Falha ao carregar imagem'))
    }

    img.src = objectUrl
  })
}
