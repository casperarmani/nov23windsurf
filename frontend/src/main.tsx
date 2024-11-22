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
      <Route 
        path="/login" 
        element={<LoginForm />} 
      />
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <App />
          </ProtectedRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        }
      />
      <Route 
        path="*" 
        element={<Navigate to="/" replace />} 
      />
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