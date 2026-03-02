import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import './styles.css'

const CLAVE_ADMIN = 'nuiop123456'

function parseUserAgent(ua) {
  let navegador = 'Desconocido', so = 'Desconocido', dispositivo = 'Escritorio'

  if (ua.includes('CriOS')) navegador = 'Chrome (iOS)'
  else if (ua.includes('FxiOS')) navegador = 'Firefox (iOS)'
  else if (ua.includes('EdgA') || ua.includes('Edg/')) navegador = 'Edge'
  else if (ua.includes('OPR') || ua.includes('Opera')) navegador = 'Opera'
  else if (ua.includes('SamsungBrowser')) navegador = 'Samsung Internet'
  else if (ua.includes('Chrome') && !ua.includes('Edg')) navegador = 'Chrome'
  else if (ua.includes('Safari') && !ua.includes('Chrome')) navegador = 'Safari'
  else if (ua.includes('Firefox')) navegador = 'Firefox'

  if (ua.includes('iPhone')) { so = 'iOS (iPhone)'; dispositivo = 'iPhone' }
  else if (ua.includes('iPad')) { so = 'iPadOS'; dispositivo = 'iPad' }
  else if (ua.includes('Android')) {
    so = 'Android'; dispositivo = 'Android'
    const match = ua.match(/;\s*([^;)]+)\s*Build/)
    if (match) dispositivo = match[1].trim()
  }
  else if (ua.includes('Mac OS X')) so = 'macOS'
  else if (ua.includes('Windows NT 10')) so = 'Windows 10/11'
  else if (ua.includes('Windows')) so = 'Windows'
  else if (ua.includes('Linux')) so = 'Linux'
  else if (ua.includes('CrOS')) { so = 'Chrome OS'; dispositivo = 'Chromebook' }

  return { navegador, so, dispositivo }
}

function formatFecha(fecha) {
  return new Date(fecha).toLocaleDateString('es-CO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  })
}

function tiempoRelativo(fecha) {
  const diff = Math.floor((new Date() - new Date(fecha)) / 1000)
  if (diff < 60) return 'Hace unos segundos'
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} horas`
  if (diff < 604800) return `Hace ${Math.floor(diff / 86400)} días`
  return formatFecha(fecha)
}

function DeviceIcon({ so }) {
  if (so.includes('iPhone') || so.includes('iOS') || so.includes('iPad') || so.includes('Android')) return <span>📱</span>
  if (so.includes('macOS')) return <span>💻</span>
  if (so.includes('Windows')) return <span>🖥️</span>
  return <span>🌐</span>
}

function InfoItem({ label, value }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: '0.65rem', color: '#555', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
      <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#ccc', wordBreak: 'break-all' }}>{value}</p>
    </div>
  )
}

export default function App() {
  const [registros, setRegistros] = useState([])
  const [loading, setLoading] = useState(true)
  const [autenticado, setAutenticado] = useState(false)
  const [claveInput, setClaveInput] = useState('')
  const [error, setError] = useState('')
  const [expandido, setExpandido] = useState(null)
  const [registrado, setRegistrado] = useState(false)

  // Registrar acceso silenciosamente al entrar
  useEffect(() => { registrarAcceso() }, [])

  async function registrarAcceso() {
    const { navegador, so, dispositivo } = parseUserAgent(navigator.userAgent)
    let ip = '', ciudad = '', region = '', pais = '', lat = null, lon = null

    try {
      const res = await fetch('https://ipapi.co/json/')
      const data = await res.json()
      ip = data.ip || ''; ciudad = data.city || ''; region = data.region || ''
      pais = data.country_name || ''; lat = data.latitude || null; lon = data.longitude || null
    } catch (e) {
      try {
        const res2 = await fetch('https://ipinfo.io/json')
        const data2 = await res2.json()
        ip = data2.ip || ''; ciudad = data2.city || ''; region = data2.region || ''; pais = data2.country || ''
        if (data2.loc) { const [la, lo] = data2.loc.split(','); lat = parseFloat(la); lon = parseFloat(lo) }
      } catch (e2) {}
    }

    await supabase.from('registro_accesos').insert({
      ip, ciudad, region, pais, latitud: lat, longitud: lon,
      navegador, sistema_operativo: so, dispositivo,
      pantalla: `${window.screen.width}x${window.screen.height}`,
      idioma: navigator.language || '',
      zona_horaria: Intl.DateTimeFormat().resolvedOptions().timeZone || ''
    })

    setRegistrado(true)
    setLoading(false)
  }

  function intentarLogin() {
    if (claveInput === CLAVE_ADMIN) {
      setAutenticado(true)
      setError('')
      cargarRegistros()
    } else {
      setError('Contraseña incorrecta')
      setClaveInput('')
    }
  }

  async function cargarRegistros() {
    const { data } = await supabase.from('registro_accesos').select('*').order('created_at', { ascending: false }).limit(100)
    setRegistros(data || [])
  }

  async function eliminarRegistro(id) {
    if (!confirm('¿Eliminar este registro?')) return
    await supabase.from('registro_accesos').delete().eq('id', id)
    setRegistros(registros.filter(r => r.id !== id))
    if (expandido === id) setExpandido(null)
  }

  async function eliminarTodos() {
    if (!confirm('¿Eliminar TODOS los registros?')) return
    await supabase.from('registro_accesos').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    setRegistros([])
  }

  // Pantalla de carga mientras registra
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', color: '#f0e6d3' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: 16, animation: 'pulse 1.5s infinite' }}>🔒</div>
      <p style={{ fontSize: '0.9rem', color: '#888' }}>Cargando...</p>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  )

  // Pantalla pública: no muestra nada, solo un "página no encontrada" falso
  if (!autenticado) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', color: '#f0e6d3', fontFamily: "'SF Pro Display', -apple-system, sans-serif", padding: '20px' }}>
      <div style={{ fontSize: '3rem', marginBottom: 16 }}>🔐</div>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 4, color: '#ddd' }}>Acceso restringido</h2>
      <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: 20 }}>Ingresa la contraseña para continuar</p>
      
      <input
        type="password"
        value={claveInput}
        onChange={e => { setClaveInput(e.target.value); setError('') }}
        onKeyDown={e => { if (e.key === 'Enter') intentarLogin() }}
        placeholder="Contraseña"
        style={{
          width: '100%', maxWidth: 280, padding: '12px 16px', borderRadius: 10,
          border: error ? '1px solid #e74c3c' : '1px solid #333', background: '#141414',
          color: '#f0e6d3', fontSize: '0.9rem', outline: 'none', textAlign: 'center',
          marginBottom: 8
        }}
      />
      {error && <p style={{ fontSize: '0.75rem', color: '#e74c3c', margin: '0 0 8px' }}>{error}</p>}
      
      <button onClick={intentarLogin} style={{
        width: '100%', maxWidth: 280, padding: '12px', borderRadius: 10,
        border: 'none', background: '#e8a849', color: '#1a1a1a',
        fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer'
      }}>
        Entrar
      </button>

      {registrado && <p style={{ fontSize: '0.6rem', color: '#2a2a2a', marginTop: 40 }}>·</p>}
    </div>
  )

  // Panel admin: muestra todos los registros
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#f0e6d3', fontFamily: "'SF Pro Display', -apple-system, sans-serif", padding: '0 0 40px 0' }}>

      <div style={{ background: 'linear-gradient(180deg, #1a1a1a 0%, #0a0a0a 100%)', padding: '20px 16px 16px', borderBottom: '1px solid #222', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>🛡️ Registro de Accesos</h1>
            <p style={{ fontSize: '0.75rem', color: '#666', margin: '4px 0 0' }}>{registros.length} sesión{registros.length !== 1 ? 'es' : ''} registrada{registros.length !== 1 ? 's' : ''}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {registros.length > 0 && (
              <button onClick={eliminarTodos} style={{ background: 'none', border: '1px solid #333', borderRadius: 8, color: '#e74c3c', fontSize: '0.7rem', padding: '6px 10px', cursor: 'pointer' }}>Borrar todo</button>
            )}
            <button onClick={() => setAutenticado(false)} style={{ background: 'none', border: '1px solid #333', borderRadius: 8, color: '#888', fontSize: '0.7rem', padding: '6px 10px', cursor: 'pointer' }}>Salir</button>
          </div>
        </div>
      </div>

      <div style={{ padding: '12px' }}>
        {registros.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#444' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>🔐</div>
            <p style={{ fontSize: '0.8rem' }}>No hay accesos registrados</p>
          </div>
        ) : (
          registros.map(r => {
            const abierto = expandido === r.id
            return (
              <div key={r.id} style={{ background: '#141414', border: '1px solid #1f1f1f', borderRadius: 12, marginBottom: 8, overflow: 'hidden' }}>
                <div onClick={() => setExpandido(abierto ? null : r.id)} style={{ padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: '1.5rem' }}><DeviceIcon so={r.sistema_operativo} /></span>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem' }}>{r.dispositivo} · {r.navegador}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: '#777' }}>
                      {r.ciudad || '?'}{r.pais ? ` — ${r.pais}` : ''} · {tiempoRelativo(r.created_at)}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: '0.65rem', color: '#444' }}>IP: {r.ip}</p>
                  </div>
                  <span style={{ color: '#555', fontSize: '0.8rem', transform: abierto ? 'rotate(180deg)' : 'rotate(0)', transition: '0.2s' }}>▼</span>
                </div>

                {abierto && (
                  <div style={{ padding: '0 14px 14px', borderTop: '1px solid #1f1f1f', background: '#111' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', padding: '12px 0' }}>
                      <InfoItem label="IP" value={r.ip || '—'} />
                      <InfoItem label="Ciudad" value={r.ciudad || '—'} />
                      <InfoItem label="Región" value={r.region || '—'} />
                      <InfoItem label="País" value={r.pais || '—'} />
                      <InfoItem label="Navegador" value={r.navegador || '—'} />
                      <InfoItem label="Sistema" value={r.sistema_operativo || '—'} />
                      <InfoItem label="Dispositivo" value={r.dispositivo || '—'} />
                      <InfoItem label="Pantalla" value={r.pantalla || '—'} />
                      <InfoItem label="Idioma" value={r.idioma || '—'} />
                      <InfoItem label="Zona horaria" value={r.zona_horaria || '—'} />
                      {r.latitud && r.longitud && <InfoItem label="Coordenadas" value={`${r.latitud}, ${r.longitud}`} />}
                    </div>
                    <p style={{ fontSize: '0.68rem', color: '#555', margin: '4px 0 10px' }}>{formatFecha(r.created_at)}</p>
                    <button onClick={e => { e.stopPropagation(); eliminarRegistro(r.id) }} style={{
                      width: '100%', padding: '8px', borderRadius: 8, border: '1px solid #331a1a',
                      background: '#1a0a0a', color: '#e74c3c', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600
                    }}>Eliminar registro</button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  )
}