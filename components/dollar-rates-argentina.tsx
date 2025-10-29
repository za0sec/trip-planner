"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { TrendingUp, DollarSign, CreditCard, Banknote, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface DollarRate {
  moneda: string
  casa: string
  nombre: string
  compra: number
  venta: number
  fechaActualizacion: string
}

export function DollarRatesArgentina() {
  const [rates, setRates] = useState<{
    oficial: DollarRate | null
    blue: DollarRate | null
    tarjeta: DollarRate | null
  }>({
    oficial: null,
    blue: null,
    tarjeta: null,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const fetchRates = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const [oficialRes, blueRes, tarjetaRes] = await Promise.all([
        fetch("https://dolarapi.com/v1/dolares/oficial"),
        fetch("https://dolarapi.com/v1/dolares/blue"),
        fetch("https://dolarapi.com/v1/dolares/tarjeta"),
      ])

      if (!oficialRes.ok || !blueRes.ok || !tarjetaRes.ok) {
        throw new Error("Error al obtener cotizaciones")
      }

      const [oficial, blue, tarjeta] = await Promise.all([
        oficialRes.json(),
        blueRes.json(),
        tarjetaRes.json(),
      ])

      setRates({ oficial, blue, tarjeta })
      setLastUpdate(new Date())
    } catch (err) {
      console.error("Error fetching dollar rates:", err)
      setError("No se pudieron cargar las cotizaciones")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRates()
    // Actualizar cada 5 minutos
    const interval = setInterval(fetchRates, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  if (loading && !rates.oficial) {
    return (
      <div className="w-full bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-950 dark:to-green-950 border-b border-blue-200 dark:border-blue-800">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Cargando cotizaciones...</span>
          </div>
        </div>
      </div>
    )
  }

  if (error && !rates.oficial) {
    return (
      <div className="w-full bg-red-50 dark:bg-red-950 border-b border-red-200 dark:border-red-800">
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={fetchRates}
              className="text-red-600 hover:text-red-700"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value)
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="w-full bg-gradient-to-r from-blue-50 via-green-50 to-blue-50 dark:from-blue-950 dark:via-green-950 dark:to-blue-950 border-b border-blue-200 dark:border-blue-800 shadow-sm">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Título */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span className="font-semibold text-gray-700 dark:text-gray-300 text-sm">
                Cotizaciones USD/ARS
              </span>
            </div>
          </div>

          {/* Cotizaciones */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Oficial */}
            {rates.oficial && (
              <Card className="bg-white/80 dark:bg-gray-800/80 border-blue-300 dark:border-blue-700 shadow-sm">
                <CardContent className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <div>
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Oficial</p>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                          {formatCurrency(rates.oficial.venta)}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Blue */}
            {rates.blue && (
              <Card className="bg-white/80 dark:bg-gray-800/80 border-indigo-300 dark:border-indigo-700 shadow-sm">
                <CardContent className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    <div>
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Blue</p>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                          {formatCurrency(rates.blue.venta)}
                        </span>
                        {rates.oficial && (
                          <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                            +{((rates.blue.venta / rates.oficial.venta - 1) * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tarjeta */}
            {rates.tarjeta && (
              <Card className="bg-white/80 dark:bg-gray-800/80 border-purple-300 dark:border-purple-700 shadow-sm">
                <CardContent className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    <div>
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Tarjeta</p>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                          {formatCurrency(rates.tarjeta.venta)}
                        </span>
                        {rates.oficial && (
                          <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                            +{((rates.tarjeta.venta / rates.oficial.venta - 1) * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Última actualización y refresh */}
          <div className="flex items-center gap-2">
            {lastUpdate && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Actualizado {formatTime(lastUpdate)}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchRates}
              disabled={loading}
              className="h-7 w-7 p-0"
              title="Actualizar cotizaciones"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Versión móvil compacta */}
        <div className="md:hidden mt-2 flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
          <span>💰 Compra también disponible</span>
          {rates.oficial && rates.blue && rates.tarjeta && (
            <span className="text-right">
              {formatCurrency(rates.oficial.compra)} / {formatCurrency(rates.blue.compra)} / {formatCurrency(rates.tarjeta.compra)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

