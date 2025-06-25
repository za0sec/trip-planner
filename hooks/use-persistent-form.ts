import { useState, useEffect, useCallback } from 'react'

export function usePersistentForm<T>(key: string, initialState: T) {
  const [state, setState] = useState<T>(initialState)
  const [isLoaded, setIsLoaded] = useState(false)

  // Cargar estado desde localStorage al montar el componente
  useEffect(() => {
    try {
      const saved = localStorage.getItem(key)
      if (saved) {
        const parsedState = JSON.parse(saved)
        setState(parsedState)
      }
    } catch (error) {
      console.error('Error loading form state from localStorage:', error)
    } finally {
      setIsLoaded(true)
    }
  }, [key])

  // Guardar estado en localStorage cada vez que cambie
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(key, JSON.stringify(state))
      } catch (error) {
        console.error('Error saving form state to localStorage:', error)
      }
    }
  }, [key, state, isLoaded])

  // Función para actualizar el estado
  const updateState = useCallback((updates: Partial<T>) => {
    setState(prevState => ({ ...prevState, ...updates }))
  }, [])

  // Función para resetear el estado
  const resetState = useCallback(() => {
    setState(initialState)
    try {
      localStorage.removeItem(key)
    } catch (error) {
      console.error('Error removing form state from localStorage:', error)
    }
  }, [key, initialState])

  // Función para limpiar el estado al completar exitosamente
  const clearState = useCallback(() => {
    try {
      localStorage.removeItem(key)
    } catch (error) {
      console.error('Error clearing form state from localStorage:', error)
    }
  }, [key])

  return {
    state,
    updateState,
    resetState,
    clearState,
    isLoaded
  }
} 