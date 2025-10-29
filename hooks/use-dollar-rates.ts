import { useEffect, useState } from "react"

interface DollarRate {
  moneda: string
  casa: string
  nombre: string
  compra: number
  venta: number
  fechaActualizacion: string
}

interface DollarRates {
  oficial: DollarRate | null
  blue: DollarRate | null
  tarjeta: DollarRate | null
}

export function useDollarRates() {
  const [rates, setRates] = useState<DollarRates>({
    oficial: null,
    blue: null,
    tarjeta: null,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchRates = async () => {
      try {
        const [oficialRes, blueRes, tarjetaRes] = await Promise.all([
          fetch("https://dolarapi.com/v1/dolares/oficial"),
          fetch("https://dolarapi.com/v1/dolares/blue"),
          fetch("https://dolarapi.com/v1/dolares/tarjeta"),
        ])

        if (oficialRes.ok && blueRes.ok && tarjetaRes.ok) {
          const [oficial, blue, tarjeta] = await Promise.all([
            oficialRes.json(),
            blueRes.json(),
            tarjetaRes.json(),
          ])

          setRates({ oficial, blue, tarjeta })
        }
      } catch (error) {
        console.error("Error fetching dollar rates:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchRates()
    // Actualizar cada 5 minutos
    const interval = setInterval(fetchRates, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  return { rates, loading }
}

