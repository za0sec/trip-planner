"use client"

import { useDollarRates } from "@/hooks/use-dollar-rates"

interface CurrencyConversionsProps {
  usdAmount: number
  showTitle?: boolean
  className?: string
}

export function CurrencyConversions({ usdAmount, showTitle = true, className = "" }: CurrencyConversionsProps) {
  const { rates, loading } = useDollarRates()

  if (loading || !rates.oficial || !rates.blue || !rates.tarjeta) {
    return null
  }

  const formatARS = (amount: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const oficial = usdAmount * rates.oficial.venta
  const blue = usdAmount * rates.blue.venta
  const tarjeta = usdAmount * rates.tarjeta.venta

  return (
    <div className={`text-xs text-gray-500 space-y-0.5 ${className}`}>
      {showTitle && <div className="font-medium text-gray-600 mb-1">💱 Equivalente en ARS:</div>}
      <div className="flex items-center gap-2 flex-wrap">
        <span title="Dólar Oficial">
          <span className="font-medium">Oficial:</span> {formatARS(oficial)}
        </span>
        <span className="text-gray-400">•</span>
        <span title="Dólar Blue">
          <span className="font-medium">Blue:</span> {formatARS(blue)}
        </span>
        <span className="text-gray-400">•</span>
        <span title="Dólar Tarjeta">
          <span className="font-medium">Tarjeta:</span> {formatARS(tarjeta)}
        </span>
      </div>
    </div>
  )
}

