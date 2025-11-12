import Carousel from '../ui/Carousel'
import LeafletMap from '../ui/LeafletMap'
import { useNavigate, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Landing() {
  const [hero, setHero] = useState('https://images.unsplash.com/photo-1551776235-dde6d4829808?q=80&w=2000&auto=format&fit=crop')
  const [aboutImg, setAboutImg] = useState('/about-hero.svg')
  const [checkIn, setCheckIn] = useState(() => new Date().toISOString().slice(0,10))
  const [checkOut, setCheckOut] = useState(() => new Date(Date.now()+86400000).toISOString().slice(0,10))
  const [guests, setGuests] = useState(2)
  const navigate = useNavigate()

  useEffect(() => {
    async function loadHero() {
      try {
        const imgRe = /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i
        // Intentar primero via index.json público (no requiere policy de list)
        try {
          const pubIdx = supabase.storage.from('room-photos').getPublicUrl('hero/index.json').data.publicUrl
          const resp = await fetch(pubIdx, { cache: 'no-store' })
          if (resp.ok) {
            const order = await resp.json()
            const first = Array.isArray(order) ? order.find(n=>imgRe.test(n)) : null
            if (first) {
              const url = supabase.storage.from('room-photos').getPublicUrl(`hero/${first}`).data.publicUrl
              setHero(url)
              return
            }
          }
        } catch {}
        // Priorizar carpeta hero/ para la portada usando list (requiere policy select)
        let { data } = await supabase.storage.from('room-photos').list('hero', { limit: 100, sortBy: { column: 'name', order: 'asc' } })
        let imgs = (data||[]).map(f=>f.name).filter(n=>imgRe.test(n)).map(n=>`hero/${n}`)
        if (!imgs.length) {
          // fallback a hotel/ y luego demo/
          const altH = await supabase.storage.from('room-photos').list('hotel', { limit: 100, sortBy: { column: 'name', order: 'asc' } })
          data = altH.data
          imgs = (data||[]).map(f=>f.name).filter(n=>imgRe.test(n)).map(n=>`hotel/${n}`)
        }
        if (!imgs.length) {
          const alt = await supabase.storage.from('room-photos').list('demo', { limit: 100, sortBy: { column: 'name', order: 'asc' } })
          data = alt.data
          imgs = (data||[]).map(f=>f.name).filter(n=>imgRe.test(n)).map(n=>`demo/${n}`)
        }
        if (imgs.length) {
          const url = supabase.storage.from('room-photos').getPublicUrl(imgs[0]).data.publicUrl
          setHero(url)
        }
      } catch { /* fallback already set */ }
    }
    async function loadAbout() {
      try {
        const imgRe = /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i
        const { data } = await supabase.storage.from('room-photos').list('about', { limit: 10, sortBy: { column: 'name', order: 'asc' } })
        const imgs = (data||[]).map(f=>f.name).filter(n=>imgRe.test(n)).map(n=>`about/${n}`)
        if (imgs.length) {
          const url = supabase.storage.from('room-photos').getPublicUrl(imgs[0]).data.publicUrl
          setAboutImg(url)
        }
      } catch { /* fallback remains */ }
    }
    loadHero()
    loadAbout()
  }, [])

  // Forzar coherencia de fechas y validar inputs
  useEffect(() => {
    if (checkOut < checkIn) {
      setCheckOut(checkIn)
    }
  }, [checkIn])

  const isValid = guests >= 1 && checkIn && checkOut && checkOut >= checkIn

  function handleSearch() {
    if (!isValid) return
    navigate(`/rooms?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`)
  }

  return (
    <div className="space-y-10">
      <section
        className="relative overflow-hidden full-bleed"
        style={{
          backgroundImage: `url("${hero}")`,
          backgroundPosition: 'center',
          backgroundSize: 'cover',
          minHeight: '100vh'
        }}
      >
        <div className="absolute inset-0" style={{background:'linear-gradient(180deg, rgba(5,5,5,0.55) 0%, rgba(31,58,95,0.35) 100%)'}}></div>
        <div className="relative container-page py-20 md:py-28 text-champagne fade-in-up flex flex-col items-center justify-center min-h-[100vh] text-center">
          <h1 className="text-3xl md:text-5xl font-bold text-white text-shadow-xl font-display">Hotel Sheraton Salta</h1>
          <div className="mt-1 text-sm tracking-wide uppercase text-white/80">Inicio</div>
          <p className="mt-3 max-w-2xl text-white/90 text-shadow-lg">Elegancia y confort en el corazón de Salta, Argentina.</p>
          {/* Search form removed to keep hero clean */}
        </div>
      </section>

      <section id="amenities" className="card p-6">
        <h2 className="text-2xl font-semibold text-black mb-4">Servicios destacados</h2>
        <ul className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 text-sm text-gray-700">
          <li className="border rounded px-3 py-3 hover-lift hover-bg-soft">WiFi de alta velocidad</li>
          <li className="border rounded px-3 py-3 hover-lift hover-bg-soft">Piscina y spa</li>
          <li className="border rounded px-3 py-3 hover-lift hover-bg-soft">Gimnasio</li>
          <li className="border rounded px-3 py-3 hover-lift hover-bg-soft">Restaurante y bar</li>
          <li className="border rounded px-3 py-3 hover-lift hover-bg-soft">Salones para eventos</li>
          <li className="border rounded px-3 py-3 hover-lift hover-bg-soft">Traslados al aeropuerto</li>
        </ul>
      </section>

      <section id="about" className="card p-6">
        <div className="grid md:grid-cols-2 gap-6 items-center">
          <div>
            <h2 className="text-2xl font-semibold text-black mb-3">Sobre nosotros</h2>
            <p className="text-gray-700 text-sm leading-relaxed">
              En Sheraton Salta buscamos que cada estadía sea memorable. Combinamos hospitalidad
              salteña, confort moderno y una ubicación privilegiada para descubrir la ciudad y sus paisajes.
            </p>
            <p className="text-gray-700 text-sm leading-relaxed mt-2">
              Nuestro equipo está disponible 24/7 para ayudarte con recomendaciones, traslados y experiencias
              locales. Ya sea por trabajo o placer, estás en buenas manos.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="border rounded p-3">
                <div className="text-black font-semibold text-lg">+150</div>
                <div className="text-sm text-gray-600">Habitaciones</div>
              </div>
              <div className="border rounded p-3">
                <div className="text-black font-semibold text-lg">4.7/5</div>
                <div className="text-sm text-gray-600">Calificación</div>
              </div>
              <div className="border rounded p-3">
                <div className="text-black font-semibold text-lg">24/7</div>
                <div className="text-sm text-gray-600">Atención</div>
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <a href="#amenities" className="btn-ghost">Servicios</a>
            </div>
          </div>
          <div className="rounded overflow-hidden shadow-soft">
            <Carousel folder="about" aspectClass="ar-3x2" autoInterval={4000} fallbackSlides={[aboutImg]} />
          </div>
        </div>
      </section>

      <section className="card p-0 overflow-hidden">
        <Carousel />
      </section>
      <section className="card p-0 overflow-hidden">
        <LeafletMap />
      </section>
    </div>
  )
}
