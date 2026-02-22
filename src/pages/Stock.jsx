import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

function formatKgG(kg) {
  const gramos = Math.round(kg * 1000)
  if (kg % 1 === 0) return `${kg} kg (${gramos.toLocaleString('es-CO')}g)`
  return `${kg.toFixed(2)} kg (${gramos.toLocaleString('es-CO')}g)`
}

export default function Stock() {
  const [items, setItems] = useState([])
  const [stock, setStock] = useState({})
  const [loading, setLoading] = useState(true)
  const hoy = new Date().toISOString().split('T')[0]

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data: menuData } = await supabase.from('menu_items').select('*').eq('activo', true).order('nombre')
    const { data: stockData } = await supabase.from('stock_diario').select('*').eq('fecha', hoy)
    const stockMap = {}
    ;(stockData || []).forEach(s => { stockMap[s.menu_item_id] = s })
    setItems(menuData || [])
    setStock(stockMap)
    setLoading(false)
  }

  function esPeso(item) { return item.tipo_medida === 'peso' }

  async function actualizarStock(menuItemId, campo, valor) {
    const existe = stock[menuItemId]
    if (existe) {
      await supabase.from('stock_diario').update({ [campo]: valor, updated_at: new Date().toISOString() }).eq('id', existe.id)
      setStock(prev => ({ ...prev, [menuItemId]: { ...prev[menuItemId], [campo]: valor } }))
    } else {
      const nuevo = {
        menu_item_id: menuItemId, fecha: hoy,
        cantidad_inicial: campo === 'cantidad_inicial' ? valor : 0,
        cantidad_disponible: campo === 'cantidad_disponible' ? valor : (campo === 'cantidad_inicial' ? valor : 0),
        disponible: campo === 'disponible' ? valor : true
      }
      const { data } = await supabase.from('stock_diario').insert(nuevo).select().single()
      setStock(prev => ({ ...prev, [menuItemId]: data }))
    }
  }

  async function iniciarStock(menuItemId, cantidad, esPesoItem) {
    const num = esPesoItem ? parseFloat(cantidad) || 0 : parseInt(cantidad) || 0
    const existe = stock[menuItemId]
    if (existe) {
      await supabase.from('stock_diario').update({ cantidad_inicial: num, cantidad_disponible: num, updated_at: new Date().toISOString() }).eq('id', existe.id)
      setStock(prev => ({ ...prev, [menuItemId]: { ...prev[menuItemId], cantidad_inicial: num, cantidad_disponible: num } }))
    } else {
      const nuevo = { menu_item_id: menuItemId, fecha: hoy, cantidad_inicial: num, cantidad_disponible: num, disponible: true }
      const { data } = await supabase.from('stock_diario').insert(nuevo).select().single()
      setStock(prev => ({ ...prev, [menuItemId]: data }))
    }
  }

  // Solo marcar disponible sin cantidad (para productos como aguapanela)
  async function marcarSoloDisponible(menuItemId) {
    const existe = stock[menuItemId]
    if (existe) {
      await supabase.from('stock_diario').update({ disponible: true, updated_at: new Date().toISOString() }).eq('id', existe.id)
      setStock(prev => ({ ...prev, [menuItemId]: { ...prev[menuItemId], disponible: true } }))
    } else {
      const nuevo = { menu_item_id: menuItemId, fecha: hoy, cantidad_inicial: 0, cantidad_disponible: 0, disponible: true }
      const { data } = await supabase.from('stock_diario').insert(nuevo).select().single()
      setStock(prev => ({ ...prev, [menuItemId]: data }))
    }
  }

  function getStock(menuItemId) { return stock[menuItemId] || null }

  function toggleDisponible(menuItemId) {
    const s = getStock(menuItemId)
    if (s) {
      actualizarStock(menuItemId, 'disponible', !s.disponible)
    } else {
      marcarSoloDisponible(menuItemId)
    }
  }

  function cambiarDisponible(menuItemId, delta, esPesoItem) {
    const s = getStock(menuItemId)
    if (!s) return
    const paso = esPesoItem ? 0.5 : 1
    const nuevo = Math.max(0, parseFloat(s.cantidad_disponible) + (delta * paso))
    const redondeado = esPesoItem ? Math.round(nuevo * 100) / 100 : Math.round(nuevo)
    actualizarStock(menuItemId, 'cantidad_disponible', redondeado)
  }

  if (loading) return <div className="empty-state"><p>Cargando...</p></div>

  return (
    <div>
      <div className="flex-between mb-12">
        <h1 className="page-title" style={{ marginBottom: 0 }}>📦 Stock del día</h1>
        <span className="text-sm text-gray">{hoy}</span>
      </div>

      {items.length === 0 ? (
        <div className="empty-state"><div className="icon">📦</div><p>No hay productos activos</p><p className="text-sm mt-8">Agrega productos en Menú primero</p></div>
      ) : (
        items.map(item => {
          const s = getStock(item.id)
          const configurado = s !== null
          const disponible = s ? s.disponible : false
          const tieneStock = s && s.cantidad_inicial > 0
          const peso = esPeso(item)

          return (
            <div key={item.id} className="card">
              <div className="flex-between">
                <div className="flex gap-8" style={{ alignItems: 'center' }}>
                  <span className="text-bold">{item.nombre}</span>
                  {peso && <span className="badge" style={{ background: '#8e44ad22', color: '#af7ac5', fontSize: '0.65rem' }}>⚖️ kg</span>}
                </div>
                <button className={`switch ${disponible ? 'on' : ''}`} onClick={() => toggleDisponible(item.id)} />
              </div>

              {/* Texto de estado */}
              {!configurado && (
                <p className="text-xs mt-8 text-gray">Toca el interruptor para marcar disponible, o ingresa cantidad:</p>
              )}
              {configurado && !tieneStock && disponible && (
                <p className="text-xs mt-8" style={{ color: '#2ecc71' }}>✅ Disponible (sin control de cantidad)</p>
              )}
              {configurado && !disponible && (
                <p className="text-xs mt-8" style={{ color: '#c0392b' }}>⛔ No disponible</p>
              )}

              {/* Input de cantidad (siempre visible para poder agregar si quieren) */}
              {(!configurado || (configurado && !tieneStock && disponible)) && (
                <div className="mt-8">
                  <div className="flex gap-8" style={{ alignItems: 'center' }}>
                    <input className="input" inputMode={peso ? 'decimal' : 'numeric'}
                      placeholder={peso ? 'Opcional: kilos (ej: 10)' : 'Opcional: cantidad'}
                      style={{ flex: 1 }}
                      onKeyDown={e => { if (e.key === 'Enter' && e.target.value) iniciarStock(item.id, e.target.value, peso) }}
                      onBlur={e => { if (e.target.value) iniciarStock(item.id, e.target.value, peso) }}
                    />
                    <span className="text-xs text-gray">{peso ? 'kg' : 'und'}</span>
                  </div>
                </div>
              )}

              {/* Control de cantidad cuando ya tiene stock */}
              {configurado && tieneStock && (
                <div className="mt-12">
                  <div className="flex-between" style={{ alignItems: 'center' }}>
                    <div className="flex gap-8" style={{ alignItems: 'center' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => cambiarDisponible(item.id, -1, peso)}
                        style={{ width: 36, padding: '6px 0' }}>−</button>
                      <input className="input" inputMode={peso ? 'decimal' : 'numeric'}
                        value={peso ? (s.cantidad_disponible % 1 === 0 ? s.cantidad_disponible.toString() : s.cantidad_disponible.toFixed(2)) : Math.round(s.cantidad_disponible).toString()}
                        onChange={e => {
                          const val = peso ? parseFloat(e.target.value) || 0 : parseInt(e.target.value) || 0
                          actualizarStock(item.id, 'cantidad_disponible', val)
                        }}
                        onFocus={e => e.target.select()}
                        style={{ width: 70, textAlign: 'center', padding: '6px' }} />
                      <button className="btn btn-secondary btn-sm" onClick={() => cambiarDisponible(item.id, 1, peso)}
                        style={{ width: 36, padding: '6px 0' }}>+</button>
                      <span className="text-xs text-gray">{peso ? 'kg' : 'und'}</span>
                    </div>
                    <span className="text-xs text-gray">
                      de {peso ? (s.cantidad_inicial % 1 === 0 ? s.cantidad_inicial : s.cantidad_inicial.toFixed(2)) : Math.round(s.cantidad_inicial)} {peso ? 'kg' : 'und'}
                    </span>
                  </div>

                  {peso && s.cantidad_disponible > 0 && (
                    <p className="text-xs mt-8" style={{ color: '#af7ac5' }}>⚖️ Disponible: {formatKgG(s.cantidad_disponible)}</p>
                  )}

                  {disponible && s.cantidad_disponible === 0 && <p className="text-xs mt-8" style={{ color: '#e8a849' }}>⚠️ Stock agotado</p>}
                  {disponible && peso && s.cantidad_disponible > 0 && s.cantidad_disponible < 1 && (
                    <p className="text-xs mt-8" style={{ color: '#e74c3c' }}>⚠️ Menos de 1 kg</p>
                  )}
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}