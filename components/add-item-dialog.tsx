"use client"

import { useState, useEffect, type FormEvent } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
import { usePersistentForm } from "@/hooks/use-persistent-form"
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
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { CalendarIcon, PlaneTakeoff, Hotel, Car, Utensils, Camera, ShoppingBag, MoreHorizontal, Upload, X, Users, DollarSign, Calculator } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface AddItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tripId: string
  tripCurrency: string
  tripStartDate?: string | null
  tripEndDate?: string | null
  onItemAdded: () => void
}

const activityCategories = [
  { value: "flight", label: "Vuelo", icon: PlaneTakeoff },
  { value: "accommodation", label: "Alojamiento", icon: Hotel },
  { value: "transport", label: "Transporte", icon: Car },
  { value: "food", label: "Comida", icon: Utensils },
  { value: "activity", label: "Actividad", icon: Camera },
  { value: "shopping", label: "Compras", icon: ShoppingBag },
  { value: "other", label: "Otro", icon: MoreHorizontal },
]

const splitTypeOptions = [
  { value: "equal", label: "Por partes iguales", description: "Dividir el monto total entre todos por igual" },
  { value: "custom", label: "Cantidades personalizadas", description: "Especificar cantidad exacta para cada persona" },
]

interface ActivityFormData {
  title: string
  description: string
  category: string
  date: string | undefined // Cambiar a string para localStorage
  location: string
  estimatedCost: string
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

export function AddItemDialog({ open, onOpenChange, tripId, tripCurrency, tripStartDate, tripEndDate, onItemAdded }: AddItemDialogProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [tripMembers, setTripMembers] = useState<TripMember[]>([])
  
  const initialFormData: ActivityFormData = {
    title: "",
    description: "",
    category: "",
    date: undefined,
    location: "",
    estimatedCost: "",
  }

  // Estados para división de gastos
  const [paidBy, setPaidBy] = useState<string>("")
  const [splitType, setSplitType] = useState<string>("equal")
  const [splits, setSplits] = useState<Record<string, ExpenseSplit>>({})
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set())
  const [shouldSplit, setShouldSplit] = useState(false)

  const {
    state: formData,
    updateState,
    clearState,
    isLoaded,
  } = usePersistentForm<ActivityFormData>(`add-item-${tripId}`, initialFormData)

  useEffect(() => {
    if (open) {
      fetchTripMembers()
      // Reset estados de división
      setPaidBy(user?.id || "")
      setSplitType("equal")
      setSplits({})
      setSelectedParticipants(new Set())
      setShouldSplit(false)
      setImage(null)
      setImagePreview(null)
      setError(null)
    }
  }, [open, user?.id])

  // Actualizar splits cuando cambia el costo, tipo de división o participantes
  useEffect(() => {
    if (formData.estimatedCost && selectedParticipants.size > 0 && shouldSplit) {
      updateSplits()
    }
  }, [formData.estimatedCost, splitType, selectedParticipants, shouldSplit])

  // Registrar event listener para pegar imágenes desde el portapapeles
  useEffect(() => {
    if (open) {
      document.addEventListener('paste', handlePaste)
      return () => {
        document.removeEventListener('paste', handlePaste)
      }
    }
  }, [open])

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
    const amount = parseFloat(formData.estimatedCost) || 0
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
    if (!shouldSplit) return true
    const totalAmount = parseFloat(formData.estimatedCost) || 0
    const totalSplit = getTotalSplitAmount()
    return Math.abs(totalAmount - totalSplit) < 0.01 // Permitir diferencia de 1 centavo por redondeo
  }

  const getMemberName = (member: TripMember) => {
    return member.full_name || member.email
  }

  // Resto de las funciones de imagen sin cambios...
  const handlePaste = (e: ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.type.indexOf("image") !== -1) {
        const file = item.getAsFile()
        if (file) {
          handleImageFile(file)
          e.preventDefault()
        }
      }
    }
  }

  const handleImageFile = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setError("La imagen debe ser menor a 5MB")
      return
    }

    setImage(file)
    const reader = new FileReader()
    reader.onload = () => {
      setImagePreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleImageFile(file)
  }

  const removeImage = () => {
    setImage(null)
    setImagePreview(null)
  }

  const uploadImage = async (activityId: string): Promise<string | null> => {
    if (!image || !user) return null

    setUploadingImage(true)
    try {
      const fileExt = image.name.split('.').pop()
      const fileName = `${user.id}/${activityId}-${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('trip-items')
        .upload(fileName, image)

      if (uploadError) {
        console.error('Error uploading image:', uploadError)
        return null
      }

      const { data: { publicUrl } } = supabase.storage
        .from('trip-items')
        .getPublicUrl(fileName)

      return publicUrl
    } catch (error) {
      console.error('Error uploading image:', error)
      return null
    } finally {
      setUploadingImage(false)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!formData.title || !formData.category) {
      setError("El título y la categoría son obligatorios.")
      return
    }

    // Validaciones para división de gastos
    if (shouldSplit && formData.estimatedCost) {
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
    }

    setLoading(true)
    setError(null)

    try {
      // First create the activity
      const { data: activityData, error: insertError } = await supabase.from("activities").insert({
        trip_id: tripId,
        title: formData.title,
        description: formData.description,
        category: formData.category,
        date: formData.date || null,
        location: formData.location,
        estimated_cost: formData.estimatedCost ? Number.parseFloat(formData.estimatedCost) : null,
        created_by: user?.id,
      }).select().single()

      if (insertError) {
        throw insertError
      }

      // Si hay costo y se debe dividir, crear un gasto dividido
      if (shouldSplit && formData.estimatedCost && parseFloat(formData.estimatedCost) > 0) {
        // Crear el gasto dividido en trip_expenses
        const { data: expenseData, error: expenseError } = await supabase.from("trip_expenses").insert({
          trip_id: tripId,
          title: `${formData.title} (Planificación)`,
          description: `Costo estimado para: ${formData.description || formData.title}`,
          amount: Number.parseFloat(formData.estimatedCost),
          currency: tripCurrency,
          status: 'planned',
          created_by: user?.id,
          paid_by: paidBy,
          split_type: splitType,
          is_settlement: false,
        }).select().single()

        if (expenseError) {
          console.error("Error creating divided expense:", expenseError)
          // Eliminar la actividad si falla crear el gasto
          await supabase.from("activities").delete().eq("id", activityData.id)
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
          // Eliminar tanto la actividad como el gasto si falla
          await supabase.from("trip_expenses").delete().eq("id", expenseData.id)
          await supabase.from("activities").delete().eq("id", activityData.id)
          throw new Error("Error al crear las divisiones del gasto")
        }
      }

      // Upload image if provided
      let imageUrl = null
      if (image && activityData) {
        imageUrl = await uploadImage(activityData.id)
        
        // Update activity with image URL
        if (imageUrl) {
          const { error: updateError } = await supabase
            .from("activities")
            .update({ image_url: imageUrl })
            .eq("id", activityData.id)

          if (updateError) {
            console.error("Error updating activity with image:", updateError)
          }
        }
      }

      // Limpiar formulario después del éxito
      clearState()
      setPaidBy(user?.id || "")
      setSplitType("equal")
      setSplits({})
      setSelectedParticipants(new Set())
      setShouldSplit(false)
      onItemAdded()
      onOpenChange(false)
    } catch (err: unknown) {
      console.error("Error adding activity:", err)
      setError(`Error al agregar la actividad: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  // No renderizar hasta que el estado esté cargado
  if (!isLoaded) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[480px]">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agregar Actividad / Reserva</DialogTitle>
          <DialogDescription>
            Añade un nuevo elemento a la planificación de tu viaje, como un vuelo, hotel o una visita turística.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="basic">Información Básica</TabsTrigger>
            <TabsTrigger value="cost" disabled={!formData.estimatedCost || parseFloat(formData.estimatedCost) <= 0}>
              División del Costo {formData.estimatedCost && parseFloat(formData.estimatedCost) > 0 ? `(${tripCurrency} ${formData.estimatedCost})` : ''}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            <form className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="title" className="text-right">
                  Título *
                </Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => updateState({ title: e.target.value })}
                  className="col-span-3"
                  placeholder="Ej: Vuelo a Madrid"
                  required
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="category" className="text-right">
                  Categoría *
                </Label>
                <Select value={formData.category} onValueChange={(value) => updateState({ category: value })} required>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Selecciona una categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {activityCategories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        <div className="flex items-center gap-2">
                          <cat.icon className="h-4 w-4" />
                          <span>{cat.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="description" className="text-right">
                  Descripción
                </Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => updateState({ description: e.target.value })}
                  className="col-span-3"
                  placeholder="Ej: Vuelo de ida, reserva #12345"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="date" className="text-right">
                  Fecha
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn("col-span-3 justify-start text-left font-normal", !formData.date && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.date ? (() => {
                        const [year, month, day] = formData.date.split('-')
                        const displayDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
                        return format(displayDate, "PPP", { locale: es })
                      })() : <span>Selecciona una fecha</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar 
                      mode="single" 
                      selected={formData.date ? (() => {
                        const [year, month, day] = formData.date.split('-')
                        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
                      })() : undefined} 
                      onSelect={(date) => {
                        if (date) {
                          const year = date.getFullYear()
                          const month = String(date.getMonth() + 1).padStart(2, '0')
                          const day = String(date.getDate()).padStart(2, '0')
                          const dateString = `${year}-${month}-${day}`
                          updateState({ date: dateString })
                        } else {
                          updateState({ date: undefined })
                        }
                      }}
                      disabled={(date) => {
                        if (tripStartDate && tripEndDate) {
                          const start = new Date(tripStartDate + 'T00:00:00')
                          const end = new Date(tripEndDate + 'T00:00:00')
                          return date < start || date > end
                        }
                        return false
                      }}
                      defaultMonth={
                        formData.date ? (() => {
                          const [year, month, day] = formData.date.split('-')
                          return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
                        })() : 
                        (tripStartDate ? (() => {
                          const [year, month, day] = tripStartDate.split('-')
                          return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
                        })() : new Date())
                      }
                      initialFocus 
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="location" className="text-right">
                  Ubicación
                </Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => updateState({ location: e.target.value })}
                  className="col-span-3"
                  placeholder="Ej: Aeropuerto de Barajas"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="estimatedCost" className="text-right">
                  Costo Estimado
                </Label>
                <div className="col-span-3 space-y-2">
                  <Input
                    id="estimatedCost"
                    type="number"
                    step="0.01"
                    value={formData.estimatedCost}
                    onChange={(e) => updateState({ estimatedCost: e.target.value })}
                    className="w-full"
                    placeholder={`${tripCurrency} 0.00`}
                  />
                  {formData.estimatedCost && parseFloat(formData.estimatedCost) > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        id="shouldSplit"
                        checked={shouldSplit}
                        onChange={(e) => setShouldSplit(e.target.checked)}
                        className="rounded"
                      />
                      <Label htmlFor="shouldSplit" className="cursor-pointer">
                        Dividir este costo entre los miembros del viaje
                      </Label>
                    </div>
                  )}
                </div>
              </div>

              {/* Imagen */}
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="activity-image" className="text-right">
                  Imagen
                </Label>
                <div className="col-span-3">
                  {!imagePreview ? (
                    <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center">
                      <input
                        id="activity-image"
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                      <label
                        htmlFor="activity-image"
                        className="cursor-pointer flex flex-col items-center gap-2 text-sm text-gray-600 hover:text-gray-800"
                      >
                        <Upload className="h-8 w-8" />
                        <span>Subir imagen</span>
                        <span className="text-xs text-gray-400">PNG, JPG hasta 5MB</span>
                        <span className="text-xs text-blue-400">O pega una imagen con Ctrl+V</span>
                      </label>
                    </div>
                  ) : (
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-32 object-cover rounded-lg"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={removeImage}
                        className="absolute top-2 right-2 h-8 w-8 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="cost" className="space-y-6">
            {shouldSplit && formData.estimatedCost && parseFloat(formData.estimatedCost) > 0 ? (
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
                        <span className="font-semibold">{tripCurrency} {formData.estimatedCost || '0.00'}</span>
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
            ) : (
              <div className="text-center py-8 text-gray-500">
                <DollarSign className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <p>Agrega un costo estimado y marca &quot;Dividir entre miembros&quot; para configurar la división</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex justify-between">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={
              loading || 
              uploadingImage || 
              !formData.title || 
              !formData.category || 
              (shouldSplit && formData.estimatedCost && (paidBy === "" || selectedParticipants.size === 0 || !isValidSplit())) || false
            }
          >
            {loading ? "Agregando..." : uploadingImage ? "Subiendo imagen..." : "Agregar Actividad"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
