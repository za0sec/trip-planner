"use client"

import { useDollarRates } from "@/hooks/use-dollar-rates"

interface CurrencyInlineProps {
  usdAmount: number
}

export function CurrencyInline({ usdAmount }: CurrencyInlineProps) {
  const { rates } = useDollarRates()

  if (!rates.blue) {
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

  const blue = usdAmount * rates.blue.venta

  return (
    <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
      Blue: {formatARS(blue)}
    </div>
  )
}

