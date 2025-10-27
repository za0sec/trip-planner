"use client"

import { useState, useEffect, type FormEvent } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { DollarSign, Calculator, Users, PieChart } from "lucide-react"

interface SplitExistingCostDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  activity: {
    id: string
    title: string
    description: string | null
    estimated_cost: number
  }
  tripId: string
  tripCurrency: string
  onSplitCreated: () => void
}

interface TripMember {
  user_id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: string
}

interface TripMemberData {
  user_id: string
  role: string
  status: string
  profiles: {
    id: string
    email: string
    full_name: string | null
    avatar_url: string | null
  }[] | {
    id: string
    email: string
    full_name: string | null
    avatar_url: string | null
  } | null
}

interface ExpenseSplit {
  user_id: string
  amount: number
  paid: boolean
}

const splitTypeOptions = [
  { value: "equal", label: "Por partes iguales", description: "Dividir el monto total entre todos por igual" },
  { value: "custom", label: "Cantidades personalizadas", description: "Especificar cantidad exacta para cada persona" },
]

export function SplitExistingCostDialog({ 
  open, 
  onOpenChange, 
  activity, 
  tripId, 
  tripCurrency, 
  onSplitCreated 
}: SplitExistingCostDialogProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tripMembers, setTripMembers] = useState<TripMember[]>([])
  
  // Estados para división de gastos
  const [paidBy, setPaidBy] = useState<string>("")
  const [splitType, setSplitType] = useState<string>("equal")
  const [splits, setSplits] = useState<Record<string, ExpenseSplit>>({})
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (open) {
      fetchTripMembers()
      // Reset estados
      setPaidBy(user?.id || "")
      setSplitType("equal")
      setSplits({})
      setSelectedParticipants(new Set())
      setError(null)
    }
  }, [open, user?.id])

  // Actualizar splits cuando cambia el tipo de división o participantes
  useEffect(() => {
    if (selectedParticipants.size > 0) {
      updateSplits()
    }
  }, [splitType, selectedParticipants])

  const fetchTripMembers = async () => {
    try {
      console.log("🔍 Fetching trip members for trip:", tripId)
      
      // Obtener información del viaje y owner
      const { data: tripData, error: tripError } = await supabase
        .from("trips")
        .select(`
          id,
          created_by,
          profiles!trips_created_by_fkey (
            id,
            email,
            full_name,
            avatar_url
          )
        `)
        .eq("id", tripId)
        .single()

      if (tripError) {
        console.error("❌ Error fetching trip:", tripError)
        return
      }

      console.log("✅ Trip data:", tripData)

      // Obtener miembros del viaje
      const { data: membersData, error: membersError } = await supabase
        .from("trip_members")
        .select(`
          user_id,
          role,
          status,
          profiles!trip_members_user_id_fkey (
            id,
            email,
            full_name,
            avatar_url
          )
        `)
        .eq("trip_id", tripId)
        .eq("status", "accepted")

      if (membersError) {
        console.error("❌ Error fetching trip members:", membersError)
        return
      }

      console.log("✅ Accepted trip members:", membersData)

      // Combinar owner y miembros
      const allMembers: TripMember[] = []

      // Agregar owner
      if (tripData.profiles) {
        const ownerProfile = Array.isArray(tripData.profiles) ? tripData.profiles[0] : tripData.profiles
        allMembers.push({
          user_id: tripData.created_by,
          email: ownerProfile.email,
          full_name: ownerProfile.full_name,
          avatar_url: ownerProfile.avatar_url,
          role: 'owner'
        })
        console.log("✅ Added owner:", ownerProfile.email)
      }

      // Agregar miembros (evitando duplicar el owner)
      if (membersData) {
        membersData.forEach((member: TripMemberData) => {
          console.log("🔍 Processing member:", member.user_id, "profiles:", member.profiles)
          
          // Skip if it's the owner
          if (member.user_id === tripData.created_by) {
            console.log("⏭️ Skipped member (is owner):", member.user_id)
            return
          }
          
          // Check if profiles exists and get the profile object
          if (!member.profiles) {
            console.log("⚠️ Member has no profile:", member.user_id)
            return
          }
          
          // Handle both array and single object from Supabase
          const profile = Array.isArray(member.profiles) 
            ? (member.profiles.length > 0 ? member.profiles[0] : null)
            : member.profiles
          
          if (!profile) {
            console.log("⚠️ Could not get profile for member:", member.user_id)
            return
          }
          
          allMembers.push({
            user_id: member.user_id,
            email: profile.email,
            full_name: profile.full_name,
            avatar_url: profile.avatar_url,
            role: member.role
          })
          console.log("✅ Added member:", profile.email)
        })
      }

      console.log("🎯 Final trip members loaded:", allMembers)
      setTripMembers(allMembers)
      
      // Por defecto, incluir a todos los miembros en la división
      if (allMembers.length > 0) {
        const allMemberIds = new Set(allMembers.map(member => member.user_id))
        setSelectedParticipants(allMemberIds)
      }
    } catch (error) {
      console.error("❌ Error fetching trip members:", error)
    }
  }

  const updateSplits = () => {
    const amount = activity.estimated_cost
    const participantCount = selectedParticipants.size
    
    if (amount === 0 || participantCount === 0) return

    const newSplits: Record<string, ExpenseSplit> = {}

    if (splitType === "equal") {
      const equalAmount = amount / participantCount
      selectedParticipants.forEach(userId => {
        newSplits[userId] = {
          user_id: userId,
          amount: equalAmount,
          paid: userId === paidBy
        }
      })
    } else {
      // Para tipo custom, mantener valores existentes o inicializar en 0
      selectedParticipants.forEach(userId => {
        newSplits[userId] = splits[userId] || {
          user_id: userId,
          amount: 0,
          paid: userId === paidBy
        }
      })
    }

    setSplits(newSplits)
  }

  const handleParticipantToggle = (userId: string) => {
    const newParticipants = new Set(selectedParticipants)
    if (newParticipants.has(userId)) {
      newParticipants.delete(userId)
    } else {
      newParticipants.add(userId)
    }
    setSelectedParticipants(newParticipants)
  }

  const handleSplitAmountChange = (userId: string, amount: number) => {
    setSplits(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        amount: amount
      }
    }))
  }

  const getTotalSplitAmount = () => {
    return Object.values(splits).reduce((sum, split) => sum + split.amount, 0)
  }

  const isValidSplit = () => {
    const totalAmount = activity.estimated_cost
    const totalSplit = getTotalSplitAmount()
    return Math.abs(totalAmount - totalSplit) < 0.01 // Permitir diferencia de 1 centavo por redondeo
  }

  const getMemberName = (member: TripMember) => {
    return member.full_name || member.email
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    // Validaciones
    if (!paidBy) {
      setError("Debe seleccionar quién pagó el gasto")
      return
    }

    if (selectedParticipants.size === 0) {
      setError("Debe seleccionar al menos una persona para dividir el gasto")
      return
    }

    if (!isValidSplit()) {
      setError("La suma de las divisiones debe ser igual al monto total del gasto")
      return
    }

    setLoading(true)
    setError(null)

    try {
      // VERIFICAR SI YA EXISTE UN GASTO DIVIDIDO PARA ESTA ACTIVIDAD
      const expectedTitle = `${activity.title} (Planificación)`
      const possibleTitles = [expectedTitle, `${activity.title} (Dividido)`]
      
      const { data: existingExpenses, error: checkError } = await supabase
        .from("trip_expenses")
        .select("id, title")
        .eq("trip_id", tripId)
        .in("title", possibleTitles)

      if (checkError) {
        console.error("Error checking for existing expenses:", checkError)
        throw new Error("Error al verificar gastos existentes")
      }

      if (existingExpenses && existingExpenses.length > 0) {
        console.log("🚨 Found existing divided expense:", existingExpenses[0])
        throw new Error(`Ya existe un gasto dividido para "${activity.title}". No se pueden crear duplicados.`)
      }

      // Si no hay error o no existe, proceder a crear el gasto dividido
      const { data: expenseData, error: expenseError } = await supabase.from("trip_expenses").insert({
        trip_id: tripId,
        title: expectedTitle, // Usar sufijo consistente
        description: `Costo dividido de: ${activity.description || activity.title}`,
        amount: activity.estimated_cost,
        currency: tripCurrency,
        status: 'planned',
        created_by: user?.id,
        paid_by: paidBy,
        split_type: splitType,
        is_settlement: false,
      }).select().single()

      if (expenseError) {
        console.error("Error creating divided expense:", expenseError)
        throw new Error("Error al crear el gasto dividido")
      }

      // Crear las divisiones
      const splitInserts = Object.values(splits).map(split => ({
        expense_id: expenseData.id,
        user_id: split.user_id,
        amount: split.amount,
        paid: split.paid
      }))

      const { error: splitsError } = await supabase
        .from("expense_splits")
        .insert(splitInserts)

      if (splitsError) {
        console.error("Error creating expense splits:", splitsError)
        // Eliminar el gasto si falla crear las divisiones
        await supabase.from("trip_expenses").delete().eq("id", expenseData.id)
        throw new Error("Error al crear las divisiones del gasto")
      }

      // Éxito - limpiar y cerrar
      setPaidBy(user?.id || "")
      setSplitType("equal")
      setSplits({})
      setSelectedParticipants(new Set())
      onSplitCreated()
      onOpenChange(false)
    } catch (err: unknown) {
      console.error("Error splitting cost:", err)
      setError(`Error al dividir el costo: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5 text-green-600" />
            Dividir Costo de Actividad
          </DialogTitle>
          <DialogDescription>
            Divide el costo estimado de &ldquo;{activity.title}&rdquo; entre los miembros del viaje.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Información de la actividad */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">💡 Detalles de la Actividad</h3>
          <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <p><strong>Actividad:</strong> {activity.title}</p>
            {activity.description && <p><strong>Descripción:</strong> {activity.description}</p>}
            <p><strong>Costo Total:</strong> {new Intl.NumberFormat("es-AR", {
              style: "currency",
              currency: tripCurrency,
            }).format(activity.estimated_cost)}</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Quién pagó */}
          <div className="space-y-2">
            <Label className="text-base font-semibold flex items-center gap-2">
              <Users className="h-4 w-4" />
              ¿Quién pagará este costo?
            </Label>
            <Select value={paidBy} onValueChange={setPaidBy}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona quién pagará" />
              </SelectTrigger>
              <SelectContent>
                {tripMembers.map((member) => (
                  <SelectItem key={member.user_id} value={member.user_id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={member.avatar_url || undefined} />
                        <AvatarFallback>{getMemberName(member).charAt(0)}</AvatarFallback>
                      </Avatar>
                      {getMemberName(member)}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Tipo de división */}
          <div className="space-y-2">
            <Label className="text-base font-semibold flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              ¿Cómo dividir el costo?
            </Label>
            <Select value={splitType} onValueChange={setSplitType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {splitTypeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div>
                      <div className="font-medium">{option.label}</div>
                      <div className="text-xs text-gray-500">{option.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Participantes y divisiones */}
          <div className="space-y-4">
            <Label className="text-base font-semibold flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Participantes en el costo
            </Label>
            
            <div className="space-y-3">
              {tripMembers.map((member) => (
                <div key={member.user_id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedParticipants.has(member.user_id)}
                      onChange={() => handleParticipantToggle(member.user_id)}
                      className="rounded"
                    />
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={member.avatar_url || undefined} />
                      <AvatarFallback>{getMemberName(member).charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{getMemberName(member)}</div>
                      <div className="text-sm text-gray-500">{member.email}</div>
                    </div>
                  </div>

                  {selectedParticipants.has(member.user_id) && (
                    <div className="flex items-center gap-2">
                      {splitType === 'equal' ? (
                        <span className="font-medium">{tripCurrency} {(splits[member.user_id]?.amount || 0).toFixed(2)}</span>
                      ) : (
                        <Input
                          type="number"
                          step="0.01"
                          className="w-24"
                          placeholder="0.00"
                          value={splits[member.user_id]?.amount || ''}
                          onChange={(e) => handleSplitAmountChange(member.user_id, parseFloat(e.target.value) || 0)}
                        />
                      )}
                      {splits[member.user_id]?.paid && (
                        <span className="text-xs text-green-600">Pagará</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Resumen de división */}
            {selectedParticipants.size > 0 && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex justify-between items-center text-sm">
                  <span>Total del costo:</span>
                  <span className="font-semibold">{tripCurrency} {activity.estimated_cost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span>Total dividido:</span>
                  <span className={`font-semibold ${isValidSplit() ? 'text-green-600' : 'text-red-600'}`}>
                    {tripCurrency} {getTotalSplitAmount().toFixed(2)}
                  </span>
                </div>
                {!isValidSplit() && (
                  <div className="text-xs text-red-600 mt-1">
                    La suma de las divisiones debe ser igual al monto total
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={
              loading || 
              !paidBy || 
              selectedParticipants.size === 0 || 
              !isValidSplit()
            }
          >
            {loading ? "Dividiendo..." : "Dividir Costo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 