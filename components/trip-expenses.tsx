"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/components/auth-provider"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AddExpenseDialog } from "@/components/add-expense-dialog"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Plus, DollarSign, Trash2, Calendar, MapPin, ImageIcon } from "lucide-react"

interface TripExpense {
  id: string
  trip_id: string
  category_id: string | null
  title: string
  description: string | null
  amount: number
  currency: string
  purchase_date: string | null
  location: string | null
  status: string
  receipt_url: string | null
  notes: string | null
  created_by: string
  created_at: string
  category_name: string | null
  category_icon: string | null
  category_color: string | null
}

interface TripExpensesProps {
  tripId: string
  tripCurrency: string
  canEdit: boolean
  isOwner: boolean
}

const statusConfig = {
  planned: { label: "Planificado", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  purchased: { label: "Comprado", color: "bg-green-100 text-green-800 border-green-200" },
  refunded: { label: "Reembolsado", color: "bg-red-100 text-red-800 border-red-200" },
}

export function TripExpenses({ tripId, tripCurrency, canEdit, isOwner }: TripExpensesProps) {
  const { user } = useAuth()
  const [expenses, setExpenses] = useState<TripExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)

  useEffect(() => {
    fetchExpenses()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId])

  const fetchExpenses = async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }
    try {
      const { data, error } = await supabase.rpc("get_trip_expenses", {
        trip_uuid: tripId,
        user_uuid: user.id,
      })

      if (error) {
        console.error("Error fetching expenses:", error)
        setExpenses([])
      } else {
        setExpenses(data || [])
      }
    } catch (error) {
      console.error("Error fetching expenses:", error)
      setExpenses([])
    } finally {
      setLoading(false)
    }
  }

  const deleteExpense = async (expenseId: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar este gasto?")) return

    try {
      const expense = expenses.find((e) => e.id === expenseId)
      if (!expense || (expense.created_by !== user?.id && !isOwner)) {
        alert("No tienes permisos para eliminar este gasto")
        return
      }

      const { error } = await supabase.from("trip_expenses").delete().eq("id", expenseId)

      if (error) {
        console.error("Error deleting expense:", error)
        alert("Error al eliminar el gasto")
        return
      }

      setExpenses(expenses.filter((expense) => expense.id !== expenseId))
    } catch (error) {
      console.error("Error deleting expense:", error)
      alert("Error al eliminar el gasto")
    }
  }

  const formatCurrency = (amount: number, currency = "USD") => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: currency,
    }).format(amount)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Sin fecha"
    return new Date(dateString).toLocaleDateString("es-AR")
  }

  const getTotalByStatus = (status: string) => {
    return expenses.filter((e) => e.status === status).reduce((sum, e) => sum + e.amount, 0)
  }

  const getExpensesByStatus = (status: string) => {
    return expenses.filter((e) => e.status === status)
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="space-y-2">
              <div className="h-12 bg-gray-200 rounded"></div>
              <div className="h-12 bg-gray-200 rounded"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Gastos Generales ({expenses.length})
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Entradas, seguros, visas y otros gastos no atados a fechas específicas
            </p>
          </div>
          {canEdit && (
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Agregar Gasto
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {expenses.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">
                {canEdit ? "No hay gastos generales" : "No hay gastos registrados"}
              </h3>
              <p className="text-gray-600 mb-6">
                {canEdit
                  ? "Agrega entradas, seguros, visas y otros gastos del viaje"
                  : "Aún no se han registrado gastos generales"}
              </p>
              {canEdit && (
                <Button size="lg" onClick={() => setShowAddDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Primer Gasto
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <div className="text-sm text-yellow-700 mb-1">Planificado</div>
                  <div className="text-2xl font-bold text-yellow-900">
                    {formatCurrency(getTotalByStatus("planned"), tripCurrency)}
                  </div>
                  <div className="text-xs text-yellow-600">{getExpensesByStatus("planned").length} elementos</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <div className="text-sm text-green-700 mb-1">Comprado</div>
                  <div className="text-2xl font-bold text-green-900">
                    {formatCurrency(getTotalByStatus("purchased"), tripCurrency)}
                  </div>
                  <div className="text-xs text-green-600">{getExpensesByStatus("purchased").length} elementos</div>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="text-sm text-blue-700 mb-1">Total</div>
                  <div className="text-2xl font-bold text-blue-900">
                    {formatCurrency(getTotalByStatus("planned") + getTotalByStatus("purchased"), tripCurrency)}
                  </div>
                  <div className="text-xs text-blue-600">{expenses.length} elementos</div>
                </div>
              </div>
              <div className="space-y-3">
                {expenses.map((expense) => {
                  const statusInfo = statusConfig[expense.status as keyof typeof statusConfig]
                  return (
                    <div key={expense.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              {expense.category_icon && <span className="text-lg">{expense.category_icon}</span>}
                              <h4 className="font-semibold text-lg">{expense.title}</h4>
                            </div>
                            {statusInfo && (
                              <Badge variant="outline" className={statusInfo.color}>
                                {statusInfo.label}
                              </Badge>
                            )}
                            {expense.category_name && (
                              <Badge variant="outline" className="text-xs">
                                {expense.category_name}
                              </Badge>
                            )}
                          </div>
                          {expense.description && <p className="text-gray-600 text-sm mb-2">{expense.description}</p>}
                          <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
                            {expense.purchase_date && (
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                {formatDate(expense.purchase_date)}
                              </div>
                            )}
                            {expense.location && (
                              <div className="flex items-center gap-1">
                                <MapPin className="h-4 w-4" />
                                {expense.location}
                              </div>
                            )}
                          </div>
                          {expense.notes && (
                            <div className="mt-2 p-2 bg-gray-100 rounded text-sm text-gray-700">
                              <strong>Notas:</strong> {expense.notes}
                            </div>
                          )}
                          {expense.receipt_url && (
                            <Collapsible className="mt-3">
                              <CollapsibleTrigger asChild>
                                <Button variant="outline" size="sm" className="text-xs">
                                  <ImageIcon className="h-3 w-3 mr-1" /> Ver Recibo/Imagen
                                </Button>
                              </CollapsibleTrigger>
                              <CollapsibleContent className="mt-2">
                                <img
                                  src={expense.receipt_url || "/placeholder.svg"}
                                  alt={`Recibo de ${expense.title}`}
                                  className="rounded-lg max-w-full sm:max-w-xs max-h-48 object-contain border"
                                  loading="lazy"
                                />
                              </CollapsibleContent>
                            </Collapsible>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-xl font-bold">{formatCurrency(expense.amount, tripCurrency)}</div>
                            <div className="text-xs text-gray-500">
                              {new Date(expense.created_at).toLocaleDateString("es-AR")}
                            </div>
                          </div>
                          {canEdit && (expense.created_by === user?.id || isOwner) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteExpense(expense.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      {canEdit && (
        <AddExpenseDialog
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          tripId={tripId}
          tripCurrency={tripCurrency}
          onExpenseAdded={fetchExpenses}
        />
      )}
    </div>
  )
}
