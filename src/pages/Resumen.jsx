import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

function formatCOP(valor) {
  const num = typeof valor === 'string' ? parseFloat(valor) : valor
  if (isNaN(num) || num === 0) return '$0'
  return '$' + Math.round(num).toLocaleString('es-CO')
}

export default function Resumen() {
  const [pedidos, setPedidos] = useState([])
  const [pagos, setPagos] = useState([])
  const [pedidoItems, setPedidoItems] = useState([])
  const [stock, setStock] = useState([])
  const [menuItems, setMenuItems] = useState([])
  const [clientes, setClientes] = useState([])
  const [notas, setNotas] = useState([])
  const [loading, setLoading] = useState(true)
  const hoy = new Date().toISOString().split('T')[0]

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data: pedidosData } = await supabase.from('pedidos').select('*').eq('fecha', hoy)
    const { data: pagosData } = await supabase.from('pagos').select('*')
    const { data: pedidoItemsData } = await supabase.from('pedido_items').select('*')
    const { data: stockData } = await supabase.from('stock_diario').select('*').eq('fecha', hoy)
    const { data: menuData } = await supabase.from('menu_items').select('*')
    const { data: clientesData } = await supabase.from('clientes').select('*')
    const { data: notasData } = await supabase.from('notas_diarias').select('*').eq('fecha', hoy).eq('resuelta', false)

    const pedidoIds = (pedidosData || []).map(p => p.id)
    const pagosHoy = (pagosData || []).filter(p => pedidoIds.includes(p.pedido_id))
    const itemsHoy = (pedidoItemsData || []).filter(pi => pedidoIds.includes(pi.pedido_id))

    setPedidos(pedidosData || [])
    setPagos(pagosHoy)
    setPedidoItems(itemsHoy)
    setStock(stockData || [])
    setMenuItems(menuData || [])
    setClientes(clientesData || [])
    setNotas(notasData || [])
    setLoading(false)
  }

  function totalVentas() { return pedidos.reduce((sum, p) => sum + parseFloat(p.total), 0) }
  function totalCobrado() { return pagos.reduce((sum, p) => sum + parseFloat(p.monto), 0) }

  function pedidosPorEstado() {
    const e = { en_proceso: 0, no_entregado: 0, entregado: 0 }
    pedidos.forEach(p => { e[p.estado] = (e[p.estado] || 0) + 1 })
    return e
  }

  function pagosPorMetodo() {
    const m = {}
    pagos.forEach(p => { m[p.metodo_pago] = (m[p.metodo_pago] || 0) + parseFloat(p.monto) })
    return m
  }

  function pedidosSinPagar() {
    const pagosIds = pagos.map(p => p.pedido_id)
    return pedidos.filter(p => !pagosIds.includes(p.id))
  }

  function ventasPorProducto() {
    const productos = {}
    pedidoItems.forEach(pi => {
      const menu = menuItems.find(m => m.id === pi.menu_item_id)
      const nombre = menu?.nombre || 'Producto eliminado'
      const key = pi.menu_item_id || 'desconocido'
      if (!productos[key]) {
        productos[key] = { nombre, cantidad: 0, total: 0 }
      }
      productos[key].cantidad += pi.cantidad
      productos[key].total += parseFloat(pi.subtotal)
    })
    // Ordenar por total descendente
    return Object.values(productos).sort((a, b) => b.total - a.total)
  }

  function getMenuNombre(id) { return menuItems.find(m => m.id === id)?.nombre || 'Producto' }
  function getClienteNombre(id) { return clientes.find(c => c.id === id)?.identificador || 'Sin cliente' }

  if (loading) return <div className="empty-state"><p>Cargando...</p></div>

  const estados = pedidosPorEstado()
  const metodos = pagosPorMetodo()
  const sinPagar = pedidosSinPagar()
  const productosVendidos = ventasPorProducto()
  const totalCantidadVendida = productosVendidos.reduce((sum, p) => sum + p.cantidad, 0)

  return (
    <div>
      <div className="flex-between mb-12">
        <h1 className="page-title" style={{ marginBottom: 0 }}>📊 Resumen</h1>
        <span className="text-sm text-gray">{hoy}</span>
      </div>

      {/* VENTAS TOTALES */}
      <div className="card" style={{ borderColor: '#e8a849' }}>
        <div className="flex-between">
          <div>
            <p className="text-sm text-gray">Total ventas</p>
            <p style={{ fontSize: '1.8rem', fontWeight: 700, color: '#e8a849' }}>{formatCOP(totalVentas())}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray">Cobrado</p>
            <p style={{ fontSize: '1.4rem', fontWeight: 700, color: '#27ae60' }}>{formatCOP(totalCobrado())}</p>
          </div>
        </div>
        {totalVentas() - totalCobrado() > 0 && (
          <p className="text-sm mt-8" style={{ color: '#c0392b' }}>⚠️ Pendiente: {formatCOP(totalVentas() - totalCobrado())}</p>
        )}
      </div>

      {/* PEDIDOS POR ESTADO */}
      <div className="card">
        <p className="text-bold mb-8">Pedidos ({pedidos.length})</p>
        <div className="flex gap-8">
          <div style={{ flex: 1, textAlign: 'center', padding: 8, background: '#333', borderRadius: 8 }}>
            <p style={{ fontSize: '1.4rem', fontWeight: 700, color: '#e8a849' }}>{estados.en_proceso}</p>
            <p className="text-xs text-gray">En proceso</p>
          </div>
          <div style={{ flex: 1, textAlign: 'center', padding: 8, background: '#333', borderRadius: 8 }}>
            <p style={{ fontSize: '1.4rem', fontWeight: 700, color: '#e74c3c' }}>{estados.no_entregado}</p>
            <p className="text-xs text-gray">No entregado</p>
          </div>
          <div style={{ flex: 1, textAlign: 'center', padding: 8, background: '#333', borderRadius: 8 }}>
            <p style={{ fontSize: '1.4rem', fontWeight: 700, color: '#2ecc71' }}>{estados.entregado}</p>
            <p className="text-xs text-gray">Entregado</p>
          </div>
        </div>
      </div>

      {/* DESGLOSE POR PRODUCTO */}
      {productosVendidos.length > 0 && (
        <div className="card">
          <p className="text-bold mb-8">Ventas por producto ({totalCantidadVendida} unidades)</p>
          {productosVendidos.map((prod, i) => {
            const porcentaje = totalVentas() > 0 ? Math.round((prod.total / totalVentas()) * 100) : 0
            return (
              <div key={i} style={{ marginBottom: 10 }}>
                <div className="flex-between">
                  <span className="text-sm">{prod.nombre}</span>
                  <span className="text-sm text-bold" style={{ color: '#e8a849' }}>{formatCOP(prod.total)}</span>
                </div>
                <div className="flex-between mt-8">
                  <span className="text-xs text-gray">{prod.cantidad} vendido{prod.cantidad !== 1 ? 's' : ''}</span>
                  <span className="text-xs text-gray">{porcentaje}% del total</span>
                </div>
                <div style={{ background: '#444', borderRadius: 4, height: 4, marginTop: 4, overflow: 'hidden' }}>
                  <div style={{ background: '#e8a849', width: `${porcentaje}%`, height: '100%', borderRadius: 4, transition: 'width 0.3s' }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* PAGOS POR MÉTODO */}
      {Object.keys(metodos).length > 0 && (
        <div className="card">
          <p className="text-bold mb-8">Pagos por método</p>
          {Object.entries(metodos).map(([metodo, total]) => (
            <div key={metodo} className="flex-between" style={{ padding: '6px 0' }}>
              <span className="text-sm" style={{ textTransform: 'capitalize' }}>{metodo.replace('_', ' ')}</span>
              <span className="text-bold" style={{ color: '#27ae60' }}>{formatCOP(total)}</span>
            </div>
          ))}
        </div>
      )}

      {/* PEDIDOS SIN PAGAR */}
      {sinPagar.length > 0 && (
        <div className="card" style={{ borderColor: '#c0392b44' }}>
          <p className="text-bold mb-8" style={{ color: '#e74c3c' }}>Sin pagar ({sinPagar.length})</p>
          {sinPagar.map(p => (
            <div key={p.id} className="flex-between" style={{ padding: '4px 0' }}>
              <span className="text-sm">{getClienteNombre(p.cliente_id)}</span>
              <span className="precio-tag">{formatCOP(p.total)}</span>
            </div>
          ))}
        </div>
      )}

      {/* STOCK RESTANTE */}
      {stock.length > 0 && (
        <div className="card">
          <p className="text-bold mb-8">Stock restante</p>
          {stock.map(s => (
            <div key={s.id} className="flex-between" style={{ padding: '4px 0' }}>
              <span className="text-sm">{getMenuNombre(s.menu_item_id)}</span>
              <div className="flex gap-8" style={{ alignItems: 'center' }}>
                <span className="text-sm text-gray">{s.cantidad_disponible} / {s.cantidad_inicial}</span>
                {!s.disponible && <span className="badge badge-inactive">No disp.</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* NOTAS PENDIENTES */}
      {notas.length > 0 && (
        <div className="card" style={{ borderColor: '#e8a84944' }}>
          <p className="text-bold mb-8" style={{ color: '#e8a849' }}>Notas pendientes</p>
          {notas.map(n => <p key={n.id} className="text-sm" style={{ padding: '4px 0' }}>• {n.contenido}</p>)}
        </div>
      )}

      {pedidos.length === 0 && (
        <div className="empty-state"><div className="icon">📊</div><p>Sin datos para hoy</p><p className="text-sm mt-8">El resumen se llena conforme registres pedidos</p></div>
      )}
    </div>
  )
}