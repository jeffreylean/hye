import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initializeApi } from '@/lib/api'

const HTTP_BASE_URL = import.meta.env.VITE_HTTP_BASE_URL as string | undefined

initializeApi(HTTP_BASE_URL)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
