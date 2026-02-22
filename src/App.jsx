import { useState, useEffect, useCallback } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import { supabase } from './supabase'
import Pedidos from './pages/Pedidos'
import Stock from './pages/Stock'
import Menu from './pages/Menu'
import Notas from './pages/Notas'
import Resumen from './pages/Resumen'
import './styles.css'

function AlarmSystem() {
  const [alarma, setAlarma] = useState(null)
  const [alertVisible, setAlertVisible] = useState(null)
  const [audioPermiso, setAudioPermiso] = useState(false)

  const verificarRecordatorios = useCallback(async () => {
    const ahora = new Date()
    const { data: recordatorios } = await supabase
      .from('recordatorios')
      .select('*')
      .eq('completado', false)
      .lte('hora_alerta', ahora.toISOString())

    if (recordatorios && recordatorios.length > 0) {
      const rec = recordatorios[0]
      setAlarma(rec)
      // Intentar reproducir sonido
      try {
        const audio = new AudioContext()
        const osc = audio.createOscillator()
        const gain = audio.createGain()
        osc.connect(gain)
        gain.connect(audio.destination)
        osc.frequency.value = 800
        gain.gain.value = 0.3
        osc.start()
        setTimeout(() => { osc.stop(); audio.close() }, 1500)
      } catch (e) { /* silencio si no hay permiso */ }
    }
  }, [])

  useEffect(() => {
    verificarRecordatorios()
    const intervalo = setInterval(verificarRecordatorios, 30000) // cada 30 seg
    return () => clearInterval(intervalo)
  }, [verificarRecordatorios])

async function aceptarAlarma() {
    if (alarma) {
      // Sonido al tocar (funciona en iOS porque es interacción del usuario)
      try {
        const audio = new AudioContext()
        const osc = audio.createOscillator()
        const gain = audio.createGain()
        osc.connect(gain)
        gain.connect(audio.destination)
        osc.frequency.value = 900
        gain.gain.value = 0.5
        osc.start()
        setTimeout(() => { osc.frequency.value = 1200 }, 200)
        setTimeout(() => { osc.frequency.value = 900 }, 400)
        setTimeout(() => { osc.frequency.value = 1200 }, 600)
        setTimeout(() => { osc.stop(); audio.close() }, 800)
      } catch (e) {}
      // Vibración
      try { navigator.vibrate([200, 100, 200, 100, 200]) } catch (e) {}
      
      await supabase.from('recordatorios').update({ completado: true }).eq('id', alarma.id)
      setAlertVisible(alarma.mensaje)
      setAlarma(null)
      setTimeout(() => setAlertVisible(null), 10000)
    }
  }

  function cerrarAlert() { setAlertVisible(null) }

  return (
    <>
      {/* Alert arriba */}
      {alertVisible && (
        <div style={{
          position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 500, zIndex: 400, padding: '12px 16px',
          background: 'linear-gradient(135deg, #e8a849 0%, #d4943a 100%)',
          color: '#1a1a1a', fontWeight: 600, fontSize: '0.85rem',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}>
          <span>🔔 {alertVisible}</span>
          <button onClick={cerrarAlert} style={{
            background: 'none', border: 'none', color: '#1a1a1a',
            fontSize: '1.2rem', cursor: 'pointer', padding: '0 4px'
          }}>✕</button>
        </div>
      )}

      {/* Modal de alarma */}
      {alarma && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500
        }}>
          <div style={{
            background: '#2a2a2a', borderRadius: 16, padding: '24px 20px',
            width: '85%', maxWidth: 350, textAlign: 'center',
            border: '2px solid #e8a849', boxShadow: '0 0 30px rgba(232,168,73,0.3)'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>🔔</div>
            <h3 style={{ color: '#e8a849', marginBottom: 8, fontSize: '1.1rem' }}>¡Recordatorio!</h3>
            <p style={{ color: '#f0e6d3', marginBottom: 20, fontSize: '0.95rem', lineHeight: 1.4 }}>
              {alarma.mensaje}
            </p>
            <button onClick={aceptarAlarma} style={{
              width: '100%', padding: '12px', borderRadius: 8, border: 'none',
              background: '#e8a849', color: '#1a1a1a', fontSize: '1rem',
              fontWeight: 700, cursor: 'pointer'
            }}>
              Aceptar
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export default function App() {
  return (
    <div className="app">
      <AlarmSystem />
      <main className="content">
        <Routes>
          <Route path="/" element={<Pedidos />} />
          <Route path="/stock" element={<Stock />} />
          <Route path="/menu" element={<Menu />} />
          <Route path="/notas" element={<Notas />} />
          <Route path="/resumen" element={<Resumen />} />
        </Routes>
      </main>
      <nav className="nav-bar">
        <NavLink to="/" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
          <span className="nav-icon">📋</span>
          Pedidos
        </NavLink>
        <NavLink to="/stock" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
          <span className="nav-icon">📦</span>
          Stock
        </NavLink>
        <NavLink to="/menu" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
          <span className="nav-icon">🍗</span>
          Menú
        </NavLink>
        <NavLink to="/notas" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
          <span className="nav-icon">📝</span>
          Notas
        </NavLink>
        <NavLink to="/resumen" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
          <span className="nav-icon">📊</span>
          Resumen
        </NavLink>
      </nav>
    </div>
  )
}