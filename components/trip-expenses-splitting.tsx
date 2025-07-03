"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/components/auth-provider"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { 
  BarChart3, 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  CheckCircle, 
  Clock,
  ArrowRight,
  Users,
  PieChart,
  History,
  AlertCircle,
  CreditCard,
  Receipt,
  ChevronDown
} from "lucide-react"

interface TripExpensesSplittingProps {
  tripId: string
  tripCurrency: string
  canEdit: boolean
  highlightExpense?: string | null
}

interface UserBalance {
  user_id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  total_paid: number
  total_owed: number
  balance: number
}

interface ExpenseWithSplits {
  id: string
  title: string
  description: string | null
  amount: number
  paid_by: string
  paid_by_name: string | null
  paid_by_email: string
  split_type: string
  is_settlement: boolean
  created_at: string
  splits: Array<{
    user_id: string
    amount: number
    paid: boolean
    user_name: string | null
    user_email: string
    user_avatar: string | null
  }>
}

interface DebtSummary {
  from_user: string
  from_name: string | null
  from_email: string
  from_avatar: string | null
  to_user: string
  to_name: string | null
  to_email: string
  to_avatar: string | null
  amount: number
}

interface SettlementDialog {
  open: boolean
  debt: DebtSummary | null
  partialAmount: string
  isPartial: boolean
}

export function TripExpensesSplitting({ tripId, tripCurrency, canEdit, highlightExpense }: TripExpensesSplittingProps) {
  const { user } = useAuth()
  const [balances, setBalances] = useState<UserBalance[]>([])
  const [expenses, setExpenses] = useState<ExpenseWithSplits[]>([])
  const [debts, setDebts] = useState<DebtSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [showExpenseDetails, setShowExpenseDetails] = useState(false)
  const [selectedExpense, setSelectedExpense] = useState<ExpenseWithSplits | null>(null)
  const [settlementDialog, setSettlementDialog] = useState<SettlementDialog>({
    open: false,
    debt: null,
    partialAmount: "",
    isPartial: false
  })
  const [processingSettlement, setProcessingSettlement] = useState(false)
  const [activeTab, setActiveTab] = useState("breakdown") // Default tab

  useEffect(() => {
    fetchData()
  }, [tripId])

  // Cambiar a la pestaña de gastos si hay un gasto específico a resaltar
  useEffect(() => {
    if (highlightExpense) {
      setActiveTab("expenses")
    }
  }, [highlightExpense])

  const fetchData = async () => {
    setLoading(true)
    await Promise.all([
      fetchBalances(),
      fetchExpensesWithSplits()
    ])
    setLoading(false)
  }

  const fetchBalances = async () => {
    if (!user?.id) return

    try {
      console.log("💰 Fetching balances:", { tripId, userId: user.id })
      
      // Intentar RPC primero
      const { data: rpcData, error: rpcError } = await supabase.rpc("get_trip_balances", {
        p_trip_id: tripId,
        p_user_id: user.id,
      })

      console.log("💰 Balances RPC Result:", { data: rpcData, error: rpcError })

      if (rpcError) {
        console.error("❌ RPC failed, calculating balances directly:", rpcError)
        
        // Backup: calcular balances directamente
        // 1. Obtener todos los usuarios (owner + members)
        const { data: trip } = await supabase
          .from("trips")
          .select(`
            created_by,
            profiles:created_by(id, email, full_name, avatar_url)
          `)
          .eq("id", tripId)
          .single()

        const { data: members } = await supabase
          .from("trip_members")
          .select(`
            user_id,
            profiles(id, email, full_name, avatar_url)
          `)
          .eq("trip_id", tripId)
          .eq("status", "accepted")

        // 2. Crear lista de todos los usuarios
        const allUsers = []
        if (trip?.profiles) {
          allUsers.push(trip.profiles)
        }
        if (members) {
          members.forEach(member => {
            if (member.profiles && member.profiles[0].id !== trip?.created_by) {
              allUsers.push(member.profiles)
            }
          })
        }

        console.log("👥 All users:", allUsers)

        // 3. Calcular balances para cada usuario
        const calculatedBalances = await Promise.all(
          allUsers.map(async (userProfile) => {
            // Total pagado por este usuario
            const { data: paidExpenses } = await supabase
              .from("trip_expenses")
              .select("amount")
              .eq("trip_id", tripId)
              .eq("paid_by", userProfile[0].id)
              .eq("is_settlement", false)

            const totalPaid = (paidExpenses || []).reduce((sum, exp) => sum + exp.amount, 0)

            // Total que debe este usuario
            const { data: userSplits } = await supabase
              .from("expense_splits")
              .select("amount, trip_expenses!inner(trip_id, is_settlement)")
              .eq("user_id", userProfile[0].id)
              .eq("trip_expenses.trip_id", tripId)
              .eq("trip_expenses.is_settlement", false)

            const totalOwed = (userSplits || []).reduce((sum, split) => sum + split.amount, 0)

            const balance = totalPaid - totalOwed

            return {
              user_id: userProfile[0].id,
              email: userProfile[0].email,
              full_name: userProfile[0].full_name,
              avatar_url: userProfile[0].avatar_url,
              total_paid: totalPaid,
              total_owed: totalOwed,
              balance: balance
            }
          })
        )

        // Filtrar solo usuarios con actividad
        const activeBalances = calculatedBalances.filter(b => b.total_paid > 0 || b.total_owed > 0)

        console.log("✅ Balances calculated directly:", activeBalances)
        setBalances(activeBalances)
        calculateDebts(activeBalances)
      } else {
        console.log("✅ Balances loaded (RPC):", rpcData?.length || 0, "users")
        console.log("💰 Balances data:", rpcData)
        setBalances(rpcData || [])
        calculateDebts(rpcData || [])
      }
    } catch (error) {
      console.error("💥 Exception fetching balances:", error)
      setBalances([])
    }
  }

  const fetchExpensesWithSplits = async () => {
    if (!user?.id) return

    try {
      console.log("🔍 Fetching expenses with splits:", { tripId, userId: user.id })
      
      // Intentar RPC primero
      const { data: rpcData, error: rpcError } = await supabase.rpc("get_trip_expenses_with_splits", {
        p_trip_id: tripId,
        p_user_id: user.id,
      })

      console.log("📊 RPC Result:", { data: rpcData, error: rpcError })

      if (rpcError) {
        console.error("❌ RPC failed, trying direct query:", rpcError)
        
        // Backup: consulta directa
        const { data: expenses, error: expenseError } = await supabase
          .from("trip_expenses")
          .select(`
            *,
            profiles:paid_by(full_name, email, avatar_url)
          `)
          .eq("trip_id", tripId)
          .not("paid_by", "is", null)
          .order("created_at", { ascending: true })

        if (expenseError) {
          console.error("❌ Direct query failed:", expenseError)
          setExpenses([])
          return
        }

        console.log("🔄 Direct query expenses:", expenses)

        // Obtener splits para cada expense
        const expensesWithSplits = await Promise.all(
          (expenses || []).map(async (expense) => {
            const { data: splits, error: splitsError } = await supabase
              .from("expense_splits")
              .select(`
                *,
                profiles(full_name, email, avatar_url)
              `)
              .eq("expense_id", expense.id)

            if (splitsError) {
              console.error("❌ Error fetching splits for expense:", expense.id, splitsError)
              return {
                ...expense,
                paid_by_name: expense.profiles?.full_name,
                paid_by_email: expense.profiles?.email,
                splits: []
              }
            }

            return {
              ...expense,
              paid_by_name: expense.profiles?.full_name,
              paid_by_email: expense.profiles?.email,
              splits: (splits || []).map(split => ({
                user_id: split.user_id,
                amount: split.amount,
                paid: split.paid,
                user_name: split.profiles?.full_name,
                user_email: split.profiles?.email,
                user_avatar: split.profiles?.avatar_url
              }))
            }
          })
        )

        console.log("✅ Expenses with splits (direct):", expensesWithSplits)
        setExpenses(expensesWithSplits)
      } else {
        console.log("✅ Expenses loaded (RPC):", rpcData?.length || 0, "expenses")
        console.log("📋 Expenses data:", rpcData)
        setExpenses(rpcData || [])
      }
    } catch (error) {
      console.error("💥 Exception fetching expenses with splits:", error)
      setExpenses([])
    }
  }

  const calculateDebts = (userBalances: UserBalance[]) => {
    const debtList: DebtSummary[] = []
    
    // Crear copias para no mutar los originales
    const debtors = userBalances.filter(u => u.balance < -0.01).map(u => ({ ...u }))
    const creditors = userBalances.filter(u => u.balance > 0.01).map(u => ({ ...u }))

    // Algoritmo simplificado para calcular settlements óptimos
    for (const debtor of debtors) {
      let remainingDebt = Math.abs(debtor.balance)
      
      for (const creditor of creditors) {
        if (remainingDebt <= 0.01) break
        
        const availableCredit = creditor.balance
        if (availableCredit <= 0.01) continue

        const settlementAmount = Math.min(remainingDebt, availableCredit)
        
        if (settlementAmount > 0.01) {
          debtList.push({
            from_user: debtor.user_id,
            from_name: debtor.full_name,
            from_email: debtor.email,
            from_avatar: debtor.avatar_url,
            to_user: creditor.user_id,
            to_name: creditor.full_name,
            to_email: creditor.email,
            to_avatar: creditor.avatar_url,
            amount: settlementAmount
          })

          remainingDebt -= settlementAmount
          creditor.balance -= settlementAmount
        }
      }
    }

    setDebts(debtList)
  }

  const openSettlementDialog = (debt: DebtSummary, isPartial: boolean = false) => {
    setSettlementDialog({
      open: true,
      debt,
      partialAmount: isPartial ? "" : debt.amount.toString(),
      isPartial
    })
  }

  const processSettlement = async () => {
    if (!settlementDialog.debt || !user?.id) return

    const amount = settlementDialog.isPartial 
      ? parseFloat(settlementDialog.partialAmount) 
      : settlementDialog.debt.amount

    if (amount <= 0 || amount > settlementDialog.debt.amount) {
      alert("Monto inválido para el settlement")
      return
    }

    setProcessingSettlement(true)

    try {
      // Crear settlement en trip_expenses
      const { data: settlementData, error: settlementError } = await supabase
        .from("trip_expenses")
        .insert({
          trip_id: tripId,
          title: `Pago de deuda`,
          description: `${settlementDialog.debt.from_name || settlementDialog.debt.from_email} pagó ${formatCurrency(amount)} a ${settlementDialog.debt.to_name || settlementDialog.debt.to_email}`,
          amount: amount,
          currency: tripCurrency,
          paid_by: settlementDialog.debt.from_user,
          split_type: 'custom',
          is_settlement: true,
          created_by: user.id,
          status: 'purchased'
        })
        .select()
        .single()

      if (settlementError) {
        console.error("Error creating settlement:", settlementError)
        throw new Error("Error al crear el settlement")
      }

      // Crear las expense_splits para el settlement
      const settlementSplits = [
        {
          expense_id: settlementData.id,
          user_id: settlementDialog.debt.from_user,
          amount: -amount, // Negativo porque está pagando
          paid: true
        },
        {
          expense_id: settlementData.id,
          user_id: settlementDialog.debt.to_user,
          amount: amount, // Positivo porque está recibiendo
          paid: false
        }
      ]

      const { error: splitsError } = await supabase
        .from("expense_splits")
        .insert(settlementSplits)

      if (splitsError) {
        console.error("Error creating settlement splits:", splitsError)
        // Eliminar el settlement si fallan las splits
        await supabase.from("trip_expenses").delete().eq("id", settlementData.id)
        throw new Error("Error al crear las divisiones del settlement")
      }

      // Cerrar dialog y refrescar datos
      setSettlementDialog({ open: false, debt: null, partialAmount: "", isPartial: false })
      await fetchData()

    } catch (error) {
      console.error("Error processing settlement:", error)
      alert(`Error al procesar el pago: ${(error as Error).message}`)
    } finally {
      setProcessingSettlement(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: tripCurrency,
    }).format(amount)
  }

  const getUserName = (user: UserBalance | { full_name?: string | null; email: string }) => {
    return user.full_name || user.email
  }

  const getBalanceColor = (balance: number) => {
    if (balance > 0.01) return "text-green-600"
    if (balance < -0.01) return "text-red-600"
    return "text-gray-600"
  }

  const getBalanceIcon = (balance: number) => {
    if (balance > 0.01) return TrendingUp
    if (balance < -0.01) return TrendingDown
    return DollarSign
  }

  const getTotalExpenses = () => {
    return expenses.filter(e => !e.is_settlement).reduce((sum, e) => sum + e.amount, 0)
  }

  const getTotalSettlements = () => {
    return expenses.filter(e => e.is_settlement).reduce((sum, e) => sum + e.amount, 0)
  }

  const getMyDebts = () => {
    return debts.filter(d => d.from_user === user?.id)
  }

  const getMyCredits = () => {
    return debts.filter(d => d.to_user === user?.id)
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

  // Debug: Ver qué datos tenemos
  console.log("🐛 Component state:", {
    loading,
    balancesLength: balances.length,
    expensesLength: expenses.length,
    debtsLength: debts.length,
    expenses: expenses,
    balances: balances
  })

  return (
    <div className="space-y-6">
      {/* Estadísticas Generales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <DollarSign className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Gastos Divididos</p>
                <p className="text-lg font-bold">{formatCurrency(getTotalExpenses())}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-green-100 p-2 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Liquidaciones Realizadas</p>
                <p className="text-lg font-bold">{formatCurrency(getTotalSettlements())}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-orange-100 p-2 rounded-lg">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Deudas Pendientes</p>
                <p className="text-lg font-bold">{debts.length} transacciones</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="breakdown">Desglose</TabsTrigger>
          <TabsTrigger value="balances">Balances</TabsTrigger>
          <TabsTrigger value="debts">Deudas ({debts.length})</TabsTrigger>
          <TabsTrigger value="expenses">Gastos ({expenses.filter(e => !e.is_settlement).length})</TabsTrigger>
          <TabsTrigger value="settlements">Liquidaciones ({expenses.filter(e => e.is_settlement).length})</TabsTrigger>
        </TabsList>

                {/* Tab de Desglose Detallado */}
        <TabsContent value="breakdown">
          <Card className="w-full overflow-hidden" style={{minWidth: '1200px'}}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Desglose Detallado de Transacciones
              </CardTitle>
              <p className="text-sm text-gray-600">
                Historial cronológico que muestra cómo se calculan los balances
              </p>
            </CardHeader>
            <CardContent className="w-full p-6 overflow-x-auto" style={{minWidth: '900px'}}>
              {expenses.filter(e => !e.is_settlement).length === 0 ? (
                <div className="text-center py-8">
                  <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No hay gastos divididos para mostrar</p>
                </div>
              ) : (
                <div className="space-y-4 w-full" style={{minWidth: '900px'}}>
                  <div className="w-full" style={{minWidth: '900px'}}>
                  {expenses
                    .filter(expense => !expense.is_settlement)
                    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                    .map((expense) => (
                    <Collapsible key={expense.id} className="border rounded-lg bg-white shadow-sm w-full overflow-hidden mb-4" style={{minWidth: '900px'}}>
                      <CollapsibleTrigger className="w-full p-4 text-left hover:bg-gray-50 transition-colors group" style={{minWidth: '900px'}}>
                        <div className="flex items-center justify-between w-full" style={{minWidth: '850px'}}>
                          <div className="flex items-center gap-3">
                            <div className="bg-blue-100 p-2 rounded-lg">
                              <Receipt className="h-4 w-4 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-lg truncate">{expense.title}</h3>
                              <p className="text-sm text-gray-500 truncate">
                                {new Date(expense.created_at).toLocaleDateString("es-AR", {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right flex-shrink-0">
                              <div className="text-xl font-bold text-blue-600">{formatCurrency(expense.amount)}</div>
                              <div className="text-xs text-gray-500 max-w-[150px] truncate">
                                Pagado por {expense.paid_by_name || expense.paid_by_email}
                              </div>
                            </div>
                            <ChevronDown className="h-5 w-5 text-gray-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                          </div>
                        </div>
                      </CollapsibleTrigger>
                                            <CollapsibleContent className="px-4 pb-4 border-t bg-gray-50 w-full overflow-hidden" style={{minWidth: '900px'}}>
                        <div className="pt-4 space-y-4 w-full overflow-hidden" style={{minWidth: '850px'}}>{expense.description && (
                           <div className="bg-white rounded-lg p-3 border w-full overflow-hidden" style={{minWidth: '850px', wordBreak: 'break-all', overflowWrap: 'anywhere'}}>
                             <p className="text-sm text-gray-600 leading-relaxed" style={{wordBreak: 'break-all', overflowWrap: 'anywhere'}}>
                               <strong>Descripción:</strong> {expense.description}
                             </p>
                           </div>
                        )}

                                              <div className="grid md:grid-cols-2 gap-6 w-full overflow-hidden" style={{minWidth: '850px'}}>
                        {/* Quién pagó */}
                        <div className="bg-white rounded-lg p-4 border overflow-hidden">
                          <h4 className="font-semibold text-green-700 mb-3 flex items-center gap-2">
                            <CreditCard className="h-4 w-4" />
                            Quién Pagó
                          </h4>
                          <div className="flex items-center gap-3 min-w-0 overflow-hidden">
                            <Avatar className="h-8 w-8 flex-shrink-0">
                              <AvatarFallback>{(expense.paid_by_name || expense.paid_by_email).charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0 overflow-hidden">
                              <div className="font-medium truncate">{expense.paid_by_name || expense.paid_by_email}</div>
                              <div className="text-sm text-gray-500 truncate">{expense.paid_by_email}</div>
                            </div>
                          </div>
                        </div>

                        {/* Cómo se dividió */}
                        <div className="bg-white rounded-lg p-4 border overflow-hidden">
                          <h4 className="font-semibold text-orange-700 mb-3 flex items-center gap-2">
                            <PieChart className="h-4 w-4" />
                            División ({expense.split_type === 'equal' ? 'Partes Iguales' : 'Personalizada'})
                          </h4>
                          <div className="space-y-2">
                            {expense.splits.map((split) => (
                              <div key={split.user_id} className="flex items-center justify-between text-sm overflow-hidden">
                                <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                                  <Avatar className="h-6 w-6 flex-shrink-0">
                                    <AvatarImage src={split.user_avatar || undefined} />
                                    <AvatarFallback className="text-xs">{(split.user_name || split.user_email).charAt(0)}</AvatarFallback>
                                  </Avatar>
                                  <span className="truncate">{split.user_name || split.user_email}</span>
                                </div>
                                <span className="font-medium flex-shrink-0">{formatCurrency(split.amount)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Impacto en balances */}
                      <div className="mt-4 bg-blue-50 rounded-lg p-4 w-full overflow-hidden" style={{minWidth: '850px'}}>
                        <h4 className="font-semibold text-blue-700 mb-3 flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" />
                          Impacto en Balances
                        </h4>
                        <div className="grid md:grid-cols-2 gap-4 text-sm w-full overflow-hidden" style={{minWidth: '800px'}}>
                          {expense.splits.map((split) => {
                            const isPayer = split.user_id === expense.paid_by
                            const netImpact = isPayer 
                              ? expense.amount - split.amount  // Lo que pagó menos lo que debe = crédito
                              : -split.amount  // Lo que debe = débito
                            
                            return (
                              <div key={split.user_id} className="flex items-center justify-between p-2 bg-white rounded border overflow-hidden">
                                <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                                  <Avatar className="h-6 w-6 flex-shrink-0">
                                    <AvatarImage src={split.user_avatar || undefined} />
                                    <AvatarFallback className="text-xs">{(split.user_name || split.user_email).charAt(0)}</AvatarFallback>
                                  </Avatar>
                                  <span className="font-medium truncate">{split.user_name || split.user_email}</span>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  {isPayer && (
                                    <div className="text-xs text-gray-500">
                                      Pagó {formatCurrency(expense.amount)} - Debe {formatCurrency(split.amount)}
                                    </div>
                                  )}
                                  <div className={`font-bold ${netImpact > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {netImpact > 0 ? '+' : ''}{formatCurrency(netImpact)}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Balance acumulado hasta este punto */}
                      <div className="mt-4 bg-gray-100 rounded-lg p-4 w-full overflow-hidden" style={{minWidth: '850px'}}>
                        <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                          <BarChart3 className="h-4 w-4" />
                          Balance Acumulado (hasta este gasto)
                        </h4>
                        <div className="grid md:grid-cols-2 gap-4 text-sm w-full overflow-hidden" style={{minWidth: '800px'}}>
                          {(() => {
                            // Calcular balance acumulado hasta este gasto
                            const expensesUpToThis = expenses
                              .filter(e => !e.is_settlement)
                              .filter(e => new Date(e.created_at) <= new Date(expense.created_at))
                            
                            const accumulatedBalances = new Map()
                            
                            expensesUpToThis.forEach(exp => {
                              exp.splits.forEach(split => {
                                const current = accumulatedBalances.get(split.user_id) || { paid: 0, owed: 0 }
                                
                                if (split.user_id === exp.paid_by) {
                                  current.paid += exp.amount
                                }
                                current.owed += split.amount
                                
                                accumulatedBalances.set(split.user_id, current)
                              })
                            })

                            return Array.from(accumulatedBalances.entries()).map(([userId, balance]) => {
                              const userSplit = expense.splits.find(s => s.user_id === userId)
                              if (!userSplit) return null
                              
                              const netBalance = balance.paid - balance.owed
                              
                              return (
                                <div key={userId} className="flex items-center justify-between p-2 bg-white rounded border overflow-hidden">
                                  <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                                    <Avatar className="h-6 w-6 flex-shrink-0">
                                      <AvatarImage src={userSplit.user_avatar || undefined} />
                                      <AvatarFallback className="text-xs">{(userSplit.user_name || userSplit.user_email).charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <span className="font-medium truncate">{userSplit.user_name || userSplit.user_email}</span>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <div className="text-xs text-gray-500">
                                      Pagó: {formatCurrency(balance.paid)} | Debe: {formatCurrency(balance.owed)}
                                    </div>
                                    <div className={`font-bold ${netBalance > 0 ? 'text-green-600' : netBalance < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                      {netBalance > 0 ? 'Le deben: ' : netBalance < 0 ? 'Debe: ' : 'Balanceado: '}
                                      {formatCurrency(Math.abs(netBalance))}
                                    </div>
                                  </div>
                                </div>
                              )
                            }).filter(Boolean)
                          })()}
                        </div>
                      </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                  </div>

                  {/* Resumen final */}
                  <div className="border-2 border-blue-200 rounded-lg p-6 bg-blue-50">
                    <h3 className="text-xl font-bold text-blue-800 mb-4 flex items-center gap-2">
                      <CheckCircle className="h-6 w-6" />
                      Resumen Final de Balances
                    </h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      {balances.map((balance) => (
                        <div key={balance.user_id} className="bg-white rounded-lg p-4 border-2 border-gray-200">
                          <div className="flex items-center gap-3 mb-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={balance.avatar_url || undefined} />
                              <AvatarFallback>{getUserName(balance).charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-bold text-lg">{getUserName(balance)}</div>
                              <div className="text-sm text-gray-500">{balance.email}</div>
                            </div>
                          </div>
                          
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Total Pagado:</span>
                              <span className="font-semibold text-green-600">{formatCurrency(balance.total_paid)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Total que Debe:</span>
                              <span className="font-semibold text-orange-600">{formatCurrency(balance.total_owed)}</span>
                            </div>
                            <div className="border-t pt-2">
                              <div className="flex justify-between items-center">
                                <span className="font-semibold">Balance Final:</span>
                                <span className={`font-bold text-lg ${getBalanceColor(balance.balance)}`}>
                                  {balance.balance > 0.01 ? 'Le deben: ' : balance.balance < -0.01 ? 'Debe: ' : 'Balanceado: '}
                                  {formatCurrency(Math.abs(balance.balance))}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab de Balances */}
        <TabsContent value="balances">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Resumen de Balances
              </CardTitle>
              <p className="text-sm text-gray-600">
                Balance de pagos y deudas de cada miembro del viaje
              </p>
            </CardHeader>
            <CardContent>
              {balances.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No hay gastos con divisiones registrados</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {balances.map((balance) => {
                    const BalanceIcon = getBalanceIcon(balance.balance)
                    return (
                      <div key={balance.user_id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={balance.avatar_url || undefined} />
                            <AvatarFallback>{getUserName(balance).charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{getUserName(balance)}</div>
                            <div className="text-sm text-gray-500">{balance.email}</div>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className={`text-lg font-bold flex items-center gap-1 ${getBalanceColor(balance.balance)}`}>
                            <BalanceIcon className="h-4 w-4" />
                            {formatCurrency(Math.abs(balance.balance))}
                          </div>
                          <div className="text-xs text-gray-500">
                            Pagó: {formatCurrency(balance.total_paid)} | Debe: {formatCurrency(balance.total_owed)}
                          </div>
                          {balance.balance > 0.01 && (
                            <Badge className="bg-green-100 text-green-800 text-xs">Le deben</Badge>
                          )}
                          {balance.balance < -0.01 && (
                            <Badge className="bg-red-100 text-red-800 text-xs">Debe</Badge>
                          )}
                          {Math.abs(balance.balance) <= 0.01 && (
                            <Badge className="bg-gray-100 text-gray-800 text-xs">Balanceado</Badge>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab de Deudas */}
        <TabsContent value="debts">
          <div className="space-y-4">
            {/* Mis Deudas */}
            {getMyDebts().length > 0 && (
              <Card className="border-red-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-700">
                    <AlertCircle className="h-5 w-5" />
                    Mis Deudas ({getMyDebts().length})
                  </CardTitle>
                  <p className="text-sm text-gray-600">
                    Dinero que debes a otros miembros
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {getMyDebts().map((debt, index) => (
                      <div key={index} className="flex items-center justify-between p-4 border rounded-lg bg-red-50">
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-gray-600">Debes a</span>
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={debt.to_avatar || undefined} />
                            <AvatarFallback>{(debt.to_name || debt.to_email).charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{debt.to_name || debt.to_email}</div>
                            <div className="text-sm text-gray-500">{debt.to_email}</div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-red-700 border-red-300">
                            {formatCurrency(debt.amount)}
                          </Badge>
                          {canEdit && (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openSettlementDialog(debt, true)}
                                className="text-orange-600 border-orange-300 hover:bg-orange-50"
                              >
                                Pago Parcial
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => openSettlementDialog(debt, false)}
                                className="bg-green-600 hover:bg-green-700 text-white"
                              >
                                <CreditCard className="h-4 w-4 mr-1" />
                                Saldar
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Dinero que me deben */}
            {getMyCredits().length > 0 && (
              <Card className="border-green-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-700">
                    <TrendingUp className="h-5 w-5" />
                    Me Deben ({getMyCredits().length})
                  </CardTitle>
                  <p className="text-sm text-gray-600">
                    Dinero que te deben otros miembros
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {getMyCredits().map((debt, index) => (
                      <div key={index} className="flex items-center justify-between p-4 border rounded-lg bg-green-50">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={debt.from_avatar || undefined} />
                            <AvatarFallback>{(debt.from_name || debt.from_email).charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{debt.from_name || debt.from_email}</div>
                            <div className="text-sm text-gray-500">Te debe</div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-green-700 border-green-300">
                            {formatCurrency(debt.amount)}
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openSettlementDialog(debt, false)}
                            className="text-green-600 border-green-300 hover:bg-green-50"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Marcar como Pagado
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Todas las deudas */}
            {debts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Todas las Deudas Pendientes
                  </CardTitle>
                  <p className="text-sm text-gray-600">
                    Resumen simplificado de todas las deudas del grupo
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {debts.map((debt, index) => (
                      <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={debt.from_avatar || undefined} />
                            <AvatarFallback>{(debt.from_name || debt.from_email).charAt(0)}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{debt.from_name || debt.from_email}</span>
                          <ArrowRight className="h-4 w-4 text-gray-400" />
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={debt.to_avatar || undefined} />
                            <AvatarFallback>{(debt.to_name || debt.to_email).charAt(0)}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{debt.to_name || debt.to_email}</span>
                        </div>
                        
                        <Badge variant="outline" className="text-orange-700 border-orange-300">
                          {formatCurrency(debt.amount)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {debts.length === 0 && (
              <Card>
                <CardContent className="text-center py-12">
                  <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-green-700 mb-2">¡Todas las cuentas están saldadas!</h3>
                  <p className="text-gray-600">No hay deudas pendientes entre los miembros del grupo.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Tab de Gastos */}
        <TabsContent value="expenses">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Gastos Divididos ({expenses.filter(e => !e.is_settlement).length})
              </CardTitle>
              <p className="text-sm text-gray-600">
                Historial de gastos con información de división
              </p>
            </CardHeader>
            <CardContent>
              {expenses.filter(e => !e.is_settlement).length === 0 ? (
                <div className="text-center py-8">
                  <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No hay gastos divididos registrados</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {expenses
                    .filter(expense => !expense.is_settlement)
                    .map((expense) => (
                    <div 
                      key={expense.id} 
                      className={`border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                        highlightExpense && (
                          expense.title === highlightExpense ||
                          expense.title === highlightExpense.replace(" (Planificación)", " (Dividido)") ||
                          expense.title === highlightExpense.replace(" (Dividido)", " (Planificación)")
                        )
                          ? 'border-blue-500 bg-blue-50 shadow-md' 
                          : ''
                      }`}
                      onClick={() => {
                        setSelectedExpense(expense)
                        setShowExpenseDetails(true)
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{expense.title}</h4>
                          <p className="text-sm text-gray-600">
                            Pagado por: {expense.paid_by_name || expense.paid_by_email}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(expense.created_at).toLocaleDateString("es-AR")} • 
                            División: {expense.split_type === 'equal' ? 'Por partes iguales' : 'Personalizada'} • 
                            {expense.splits.length} participantes
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold">{formatCurrency(expense.amount)}</div>
                          <div className="text-xs text-gray-500">
                            {expense.splits.filter(s => s.paid).length} de {expense.splits.length} pagado
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab de Liquidaciones */}
        <TabsContent value="settlements">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Historial de Liquidaciones ({expenses.filter(e => e.is_settlement).length})
              </CardTitle>
              <p className="text-sm text-gray-600">
                Registro de pagos realizados entre miembros
              </p>
            </CardHeader>
            <CardContent>
              {expenses.filter(e => e.is_settlement).length === 0 ? (
                <div className="text-center py-8">
                  <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No hay liquidaciones registradas</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {expenses
                    .filter(expense => expense.is_settlement)
                    .map((settlement) => (
                    <div key={settlement.id} className="border rounded-lg p-4 bg-green-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="bg-green-100 p-2 rounded-lg">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          </div>
                          <div>
                            <h4 className="font-medium">{settlement.title}</h4>
                            <p className="text-sm text-gray-600">{settlement.description}</p>
                            <p className="text-xs text-gray-500">
                              {new Date(settlement.created_at).toLocaleDateString("es-AR", {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-green-600">{formatCurrency(settlement.amount)}</div>
                          <Badge className="bg-green-100 text-green-800 text-xs">Liquidado</Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog de Settlement */}
      <Dialog open={settlementDialog.open} onOpenChange={(open) => 
        setSettlementDialog(prev => ({ ...prev, open }))
      }>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {settlementDialog.isPartial ? 'Pago Parcial' : 'Saldar Deuda'}
            </DialogTitle>
          </DialogHeader>
          
          {settlementDialog.debt && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={settlementDialog.debt.from_avatar || undefined} />
                    <AvatarFallback>{(settlementDialog.debt.from_name || settlementDialog.debt.from_email).charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{settlementDialog.debt.from_name || settlementDialog.debt.from_email}</span>
                  <ArrowRight className="h-4 w-4 text-gray-400" />
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={settlementDialog.debt.to_avatar || undefined} />
                    <AvatarFallback>{(settlementDialog.debt.to_name || settlementDialog.debt.to_email).charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{settlementDialog.debt.to_name || settlementDialog.debt.to_email}</span>
                </div>
                <p className="text-sm text-gray-600">
                  Deuda total: <strong>{formatCurrency(settlementDialog.debt.amount)}</strong>
                </p>
              </div>

              {settlementDialog.isPartial && (
                <div>
                  <Label htmlFor="partialAmount">Monto a pagar</Label>
                  <Input
                    id="partialAmount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={settlementDialog.partialAmount}
                    onChange={(e) => setSettlementDialog(prev => ({ 
                      ...prev, 
                      partialAmount: e.target.value 
                    }))}
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Máximo: {formatCurrency(settlementDialog.debt.amount)}
                  </p>
                </div>
              )}

              {!settlementDialog.isPartial && (
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Monto a saldar:</strong> {formatCurrency(settlementDialog.debt.amount)}
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSettlementDialog({ open: false, debt: null, partialAmount: "", isPartial: false })}
              disabled={processingSettlement}
            >
              Cancelar
            </Button>
            <Button
              onClick={processSettlement}
              disabled={processingSettlement || (settlementDialog.isPartial && !settlementDialog.partialAmount)}
              className="bg-green-600 hover:bg-green-700"
            >
              {processingSettlement ? "Procesando..." : (settlementDialog.isPartial ? "Registrar Pago" : "Saldar Deuda")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Detalles del Gasto */}
      <Dialog open={showExpenseDetails} onOpenChange={setShowExpenseDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalles del Gasto: {selectedExpense?.title}</DialogTitle>
          </DialogHeader>
          
          {selectedExpense && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong>Monto Total:</strong> {formatCurrency(selectedExpense.amount)}
                  </div>
                  <div>
                    <strong>Pagado por:</strong> {selectedExpense.paid_by_name || selectedExpense.paid_by_email}
                  </div>
                  <div>
                    <strong>Tipo de División:</strong> {
                      selectedExpense.split_type === 'equal' ? 'Por partes iguales' : 
                      selectedExpense.split_type === 'custom' ? 'Cantidades personalizadas' :
                      'Por porcentajes'
                    }
                  </div>
                  <div>
                    <strong>Fecha:</strong> {new Date(selectedExpense.created_at).toLocaleDateString("es-AR")}
                  </div>
                </div>
                {selectedExpense.description && (
                  <div className="mt-2">
                    <strong>Descripción:</strong> {selectedExpense.description}
                  </div>
                )}
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-3">División del Gasto</h4>
                <div className="space-y-2">
                  {selectedExpense.splits.map((split) => (
                    <div key={split.user_id} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={split.user_avatar || undefined} />
                          <AvatarFallback>{(split.user_name || split.user_email).charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{split.user_name || split.user_email}</div>
                          <div className="text-sm text-gray-500">{split.user_email}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{formatCurrency(Math.abs(split.amount))}</span>
                        {split.paid ? (
                          <Badge className="bg-green-100 text-green-800">Pagó</Badge>
                        ) : (
                          <Badge variant="outline" className="text-orange-700 border-orange-300">
                            {split.amount > 0 ? 'Debe recibir' : 'Debe pagar'}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
} 