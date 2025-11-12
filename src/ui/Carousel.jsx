import useEmblaCarousel from 'embla-carousel-react'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const defaultFallbackSlides = [
  'https://images.unsplash.com/photo-1551776235-dde6d4829808?q=80&w=1600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?q=80&w=1600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1560063871-8ed3e97a2dd8?q=80&w=1600&auto=format&fit=crop',
]

export default function Carousel({ folder = 'hotel', aspectClass = 'ar-16x9', autoInterval = 4000, fallbackSlides = defaultFallbackSlides }) {
  const [emblaRef, embla] = useEmblaCarousel({ loop: true })
  const [slides, setSlides] = useState(fallbackSlides)

  useEffect(() => {
    async function loadSlides() {
      try {
        let { data } = await supabase.storage.from('room-photos').list(folder, { limit: 100, sortBy: { column: 'name', order: 'asc' } })
        const imgRe = /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i
        let files = (data||[]).map(f => f.name).filter(n => imgRe.test(n))
        // Fallback a carpeta 'demo' solo cuando folder es 'hotel'
        if (!files.length && folder === 'hotel') {
          const alt = await supabase.storage.from('room-photos').list('demo', { limit: 100, sortBy: { column: 'name', order: 'asc' } })
          data = alt.data
          files = (data||[]).map(f => f.name).filter(n => imgRe.test(n)).map(n=>`demo/${n}`)
        } else {
          files = files.map(n=>`${folder}/${n}`)
        }
        // Aplicar orden desde index.json solo si existe
        try {
          const folderForIndex = files[0]?.startsWith('demo/') ? 'demo' : folder
          const { data: listForIndex } = await supabase.storage.from('room-photos').list(folderForIndex, { limit: 200, sortBy: { column: 'name', order: 'asc' } })
          const hasIndex = (listForIndex || []).some(f => f.name === 'index.json')
          if (hasIndex) {
            const { data: idxFile } = await supabase.storage.from('room-photos').download(`${folderForIndex}/index.json`)
            if (idxFile) {
              const text = await idxFile.text()
              const order = JSON.parse(text)
              const setOrder = new Set(order)
              const names = files.map(f=>f.split('/').pop())
              const remaining = names.filter(n => !setOrder.has(n))
              const orderedNames = [...order.filter(n => names.includes(n)), ...remaining]
              const folderPrefix = folderForIndex
              files = orderedNames.map(n=>`${folderPrefix}/${n}`)
            }
          }
        } catch {}
        const urls = files.map(path => supabase.storage.from('room-photos').getPublicUrl(path).data.publicUrl)
        if (urls.length) setSlides(urls)
      } catch {}
    }
    loadSlides()
  }, [folder])

  useEffect(() => {
    if (!embla) return
    const i = setInterval(()=>embla.scrollNext(), autoInterval)
    return ()=>clearInterval(i)
  }, [embla])

  return (
    <div className="overflow-hidden" ref={emblaRef}>
      <div className="flex">
        {slides.map((src, idx) => (
          <div className="min-w-0 flex-[0_0_100%] relative" key={idx}>
            <img src={src} alt="slide" className={aspectClass} />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(11,14,17,0.10) 0%, rgba(31,58,95,0.10) 100%)' }} />
          </div>
        ))}
      </div>
    </div>
  )
}
