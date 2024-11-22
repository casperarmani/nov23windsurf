import React from 'react'
import ReactDOM from 'react-dom/client'
import { 
  createBrowserRouter, 
  RouterProvider, 
  Navigate,
  createRoutesFromElements,
  Route
} from 'react-router-dom'
import App from './App.tsx'
import Home from './pages/Home.tsx'
import LoginForm from './components/LoginForm.tsx'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import './index.css'

const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      {/* Public routes */}
      <Route path="/login" element={<LoginForm />} />
      
      {/* Protected routes */}
      <Route element={<ProtectedRoute><App /></ProtectedRoute>}>
        <Route path="/" element={<Navigate to="/app/chat" replace />} />
        <Route path="/app" element={<Navigate to="/app/chat" replace />} />
        <Route path="/app/chat" element={<App />} />
        <Route path="/app/home" element={<Home />} />
      </Route>
      
      {/* Catch-all route */}
      <Route path="*" element={<Navigate to="/app/chat" replace />} />
    </>
  ),
  {
    basename: '/',
    future: {
      v7_startTransition: true,
      v7_relativeSplatPath: true,
      v7_fetcherPersist: true,
      v7_normalizeFormMethod: true,
      v7_partialHydration: true,
      v7_skipActionErrorRevalidation: true
    }
  }
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </React.StrictMode>,
)