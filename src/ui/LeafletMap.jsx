import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useState } from 'react'

const hotelPos = { lat: -24.78553448612288, lng: -65.3984571057463 }

function haversine(a, b) {
  const toRad = (x) => (x * Math.PI) / 180
  const R = 6371
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export default function LeafletMap() {
  const [userPos, setUserPos] = useState(null)
  const [distance, setDistance] = useState(null)

  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setUserPos(p)
        setDistance(haversine(p, hotelPos).toFixed(1))
      },
      () => {
        // Silenciar errores de geolocalización (usuario denegó permisos o no disponible)
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
    )
  }, [])

  const icon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  })

  return (
    <div className="h-96">
      <MapContainer center={hotelPos} zoom={14} className="h-full w-full">
        <TileLayer 
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <Marker position={hotelPos} icon={icon}>
          <Popup>Hotel Sheraton Salta</Popup>
        </Marker>
        {userPos && (
          <Marker position={userPos} icon={icon}>
            <Popup>Tu ubicación · {distance} km al hotel</Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  )
}
