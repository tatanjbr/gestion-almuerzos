import { Routes, Route, NavLink } from 'react-router-dom'
import Pedidos from './pages/Pedidos'
import Stock from './pages/Stock'
import Menu from './pages/Menu'
import Notas from './pages/Notas'
import Resumen from './pages/Resumen'
import './styles.css'

export default function App() {
  return (
    <div className="app">
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