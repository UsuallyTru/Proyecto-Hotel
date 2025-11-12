import { useCallback, useEffect, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { supabase } from '../lib/supabase'

export default function DropzoneUploader({ bucket = 'room-photos', folderPrefix = '', maxFiles = 10, maxSizeMB = 3, exclusiveReplace = false }) {
  const [uploads, setUploads] = useState([])
  const [existingCount, setExistingCount] = useState(0)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    async function loadCount() {
      try {
        const { data } = await supabase.storage.from(bucket).list(folderPrefix, { limit: 100 })
        setExistingCount((data||[]).filter(f => f.name !== 'index.json' && f.name !== 'amenities.json').length)
      } catch { setExistingCount(0) }
    }
    if (folderPrefix) loadCount()
  }, [bucket, folderPrefix])

  const onDrop = useCallback(async (acceptedFiles) => {
    setMsg('')
    const results = []
    // filter by image type and size
    const images = acceptedFiles.filter(f => f.type.startsWith('image/'))
    const tooBig = images.filter(f => f.size > maxSizeMB * 1024 * 1024)
    const valid = images.filter(f => f.size <= maxSizeMB * 1024 * 1024)
    if (tooBig.length) {
      results.push(...tooBig.map(f => ({ file: f.name, path: '', ok: false, error: { message: `Excede ${maxSizeMB}MB` } })))
    }
    // If exclusiveReplace is enabled, remove existing images first
    if (exclusiveReplace && existingCount > 0) {
      try {
        const { data } = await supabase.storage.from(bucket).list(folderPrefix, { limit: 100 })
        const toDelete = (data||[])
          .map(f => f.name)
          .filter(n => n !== 'index.json' && n !== 'amenities.json')
          .map(n => `${folderPrefix}/${n}`)
        if (toDelete.length) {
          await supabase.storage.from(bucket).remove(toDelete)
        }
        setExistingCount(0)
      } catch {}
    }
    const remainingSlots = Math.max(0, maxFiles - (exclusiveReplace ? 0 : existingCount))
    if (valid.length > remainingSlots) {
      results.push({ file: '', path: '', ok: false, error: { message: `Límite de ${maxFiles} fotos por carpeta. Espacio disponible: ${remainingSlots}.` } })
    }
    const toUpload = valid.slice(0, remainingSlots)
    for (const f of toUpload) {
      const path = `${folderPrefix}/${Date.now()}-${f.name}`
      const { error } = await supabase.storage.from(bucket).upload(path, f, { cacheControl: '86400' })
      if (!error) {
        const url = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
        results.push({ file: f.name, path, url, ok: true })
      } else {
        results.push({ file: f.name, path, ok: false, error })
      }
    }
    setUploads(prev => [...prev, ...results])
    // refresh count y actualizar index.json si corresponde (ej: hero exclusivo)
    try {
      const { data } = await supabase.storage.from(bucket).list(folderPrefix, { limit: 100, sortBy: { column: 'name', order: 'asc' } })
      const imgs = (data||[]).map(f=>f.name).filter(n => n !== 'index.json' && n !== 'amenities.json')
      setExistingCount(imgs.length)
      if (exclusiveReplace) {
        const blob = new Blob([JSON.stringify(imgs)], { type: 'application/json' })
        await supabase.storage.from(bucket).upload(`${folderPrefix}/index.json`, blob, { upsert: true, contentType: 'application/json' })
      }
    } catch {}
  }, [bucket, folderPrefix, existingCount, maxFiles, maxSizeMB, exclusiveReplace])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'image/*': [] } })

  return (
    <div>
      <div {...getRootProps()} className={`p-6 border-2 border-dashed rounded ${isDragActive ? 'border-gold bg-ivory' : 'border-gray-300'}`}>
        <input {...getInputProps()} />
        <p className="text-center text-sm text-gray-600">Arrastrá y soltá fotos aquí, o hacé click para seleccionar</p>
        <p className="text-center text-xs text-gray-500 mt-1">Solo imágenes · Máx {maxSizeMB}MB · Hasta {maxFiles} fotos por carpeta (actual: {existingCount})</p>
      </div>
      {msg && <div className="text-sm text-red-700 mt-2">{msg}</div>}
      <ul className="mt-3 grid sm:grid-cols-2 md:grid-cols-3 gap-3">
        {uploads.map((u, i) => (
          <li key={i} className={`border rounded p-2 ${u.ok ? 'text-green-700' : 'text-red-700'}`}>
            <div className="text-xs truncate">{u.ok ? 'Subido:' : 'Error:'} {u.file} {u.path && <>→ <span className="text-gray-600">{u.path}</span></>}</div>
            {u.url && <img src={u.url} alt={u.file} className="w-full h-28 object-cover mt-2 rounded smooth" />}
            {u.error && <div className="text-xs mt-1">{u.error.message}</div>}
          </li>
        ))}
      </ul>
    </div>
  )
}
