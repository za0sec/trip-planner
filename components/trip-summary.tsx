"use client"

import { useMemo } from "react"
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign } from "lucide-react"

// Tipos simplificados para las props
interface Activity {
  category: string
  estimated_cost: number | null
}

interface TripExpense {
  category_name: string | null
  amount: number
}

interface TripSummaryProps {
  activities: Activity[]
  expenses: TripExpense[]
  tripCurrency: string
}

// Mapeo de categorías para unificar nombres y colores
const categoryDetails: { [key: string]: { name: string; color: string } } = {
  flight: { name: "Vuelos", color: "#ef4444" },
  accommodation: { name: "Alojamiento", color: "#8b5cf6" },
  transport: { name: "Transporte", color: "#22c55e" },
  food: { name: "Comida", color: "#f97316" },
  activity: { name: "Actividades", color: "#3b82f6" },
  shopping: { name: "Compras", color: "#ec4899" },
  Entradas: { name: "Entradas", color: "#14b8a6" },
  Seguros: { name: "Seguros", color: "#6366f1" },
  Visas: { name: "Visas", color: "#a855f7" },
  Equipaje: { name: "Equipaje", color: "#d946ef" },
  "Internet/SIM": { name: "Conectividad", color: "#0ea5e9" },
  Propinas: { name: "Propinas", color: "#f59e0b" },
  other: { name: "Otros (Actividad)", color: "#64748b" },
  "Otro (Gasto)": { name: "Otros (Gasto)", color: "#78716c" },
  default: { name: "Sin Categoría", color: "#a1a1aa" },
}

export function TripSummary({ activities, expenses, tripCurrency }: TripSummaryProps) {
  const { chartData, totalCost } = useMemo(() => {
    const categoryTotals = new Map<string, number>()

    activities.forEach((activity) => {
      const categoryKey = activity.category || "default"
      const details = categoryDetails[categoryKey] || categoryDetails.default
      const cost = activity.estimated_cost || 0
      if (cost > 0) {
        categoryTotals.set(details.name, (categoryTotals.get(details.name) || 0) + cost)
      }
    })

    expenses.forEach((expense) => {
      const categoryKey = expense.category_name || "default"
      const details = categoryDetails[categoryKey] || categoryDetails.default
      const cost = expense.amount || 0
      if (cost > 0) {
        categoryTotals.set(details.name, (categoryTotals.get(details.name) || 0) + cost)
      }
    })

    const chartData = Array.from(categoryTotals, ([name, value]) => ({
      name,
      value: Number.parseFloat(value.toFixed(2)),
      color: Object.values(categoryDetails).find((d) => d.name === name)?.color || "#a1a1aa",
    })).sort((a, b) => b.value - a.value)

    const totalCost = chartData.reduce((sum, item) => sum + item.value, 0)

    return { chartData, totalCost }
  }, [activities, expenses])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: tripCurrency,
    }).format(amount)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Resumen de Costos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2" data-tutorial="cost-chart">
              <h3 className="text-lg font-semibold mb-4">Distribución de Gastos por Categoría</h3>
              <div style={{ width: "100%", height: 350 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Costos Totales</h3>
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800" data-tutorial="total-cost">
                <div className="text-sm text-blue-700 dark:text-blue-300">Costo Total Planificado</div>
                <div className="text-3xl font-bold text-blue-900 dark:text-blue-100">{formatCurrency(totalCost)}</div>
              </div>
              <div className="space-y-2" data-tutorial="category-breakdown">
                {chartData.map((item) => (
                  <div
                    key={item.name}
                    className="flex justify-between items-center text-sm p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                      <span>{item.name}</span>
                    </div>
                    <span className="font-semibold">{formatCurrency(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
