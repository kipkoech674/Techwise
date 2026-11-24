import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Admin from './Admin.jsx'
import { BrowserRouter } from 'react-router-dom'

const page = window.location.pathname === '/admin' ? <Admin /> : <BrowserRouter><App /></BrowserRouter>

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {page}
  </StrictMode>,
)
