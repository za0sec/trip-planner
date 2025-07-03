"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useAuth } from "@/components/auth-provider"
import { supabase } from "@/lib/supabase"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Upload, X, Users, DollarSign, Calculator } from "lucide-react"

interface AddExpenseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tripId: string
  tripCurrency: string
  onExpenseAdded: () => void
}

interface Category {
  id: string
  name: string
  icon: string
  color: string
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
  }[] | null
}

interface ExpenseSplit {
  user_id: string
  amount: number
  paid: boolean
}

const statusOptions = [
  { value: "planned", label: "Planificado", color: "bg-yellow-100 text-yellow-800" },
  { value: "purchased", label: "Comprado", color: "bg-green-100 text-green-800" },
  { value: "refunded", label: "Reembolsado", color: "bg-red-100 text-red-800" },
]

const splitTypeOptions = [
  { value: "equal", label: "Por partes iguales", description: "Dividir el monto total entre todos por igual" },
  { value: "custom", label: "Cantidades personalizadas", description: "Especificar cantidad exacta para cada persona" },
  { value: "percentage", label: "Por porcentajes", description: "Asignar porcentaje a cada persona" },
]

export function AddExpenseDialog({ open, onOpenChange, tripId, tripCurrency, onExpenseAdded }: AddExpenseDialogProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [tripMembers, setTripMembers] = useState<TripMember[]>([])
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category_id: "",
    amount: "",
    purchase_date: "",
    location: "",
    status: "planned",
    notes: "",
  })

  // Nuevos estados para división de gastos
  const [paidBy, setPaidBy] = useState<string>("")
  const [splitType, setSplitType] = useState<string>("equal")
  const [splits, setSplits] = useState<Record<string, ExpenseSplit>>({})
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (open) {
      fetchCategories()
      fetchTripMembers()
      // Reset form and image when dialog opens
      setImage(null)
      setImagePreview(null)
      setFormData({
        title: "",
        description: "",
        category_id: "",
        amount: "",
        purchase_date: "",
        location: "",
        status: "planned",
        notes: "",
      })
      // Reset división de gastos
      setPaidBy(user?.id || "")
      setSplitType("equal")
      setSplits({})
      setSelectedParticipants(new Set())
    }
  }, [open, user?.id])

  // Actualizar splits cuando cambia el monto, tipo de división o participantes
  useEffect(() => {
    if (formData.amount && selectedParticipants.size > 0) {
      updateSplits()
    }
  }, [formData.amount, splitType, selectedParticipants])

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase.from("categories").select("*").order("name")

      if (error) {
        console.error("Error fetching categories:", error)
      } else {
        setCategories(data || [])
      }
    } catch (error) {
      console.error("Error fetching categories:", error)
    }
  }

  const fetchTripMembers = async () => {
    try {
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
        console.error("Error fetching trip:", tripError)
        return
      }

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
        console.error("Error fetching trip members:", membersError)
        return
      }

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
      }

      // Agregar miembros (evitando duplicar el owner)
      if (membersData) {
        membersData.forEach((member: TripMemberData) => {
          if (member.user_id !== tripData.created_by && member.profiles && member.profiles.length > 0) {
            const profile = member.profiles[0]
            allMembers.push({
              user_id: member.user_id,
              email: profile.email,
              full_name: profile.full_name,
              avatar_url: profile.avatar_url,
              role: member.role
            })
          }
        })
      }

      console.log("🔍 Trip members loaded:", allMembers)
      setTripMembers(allMembers)
      
      // Por defecto, incluir a todos los miembros en la división
      if (allMembers.length > 0) {
        const allMemberIds = new Set(allMembers.map(member => member.user_id))
        setSelectedParticipants(allMemberIds)
      }
    } catch (error) {
      console.error("Error fetching trip members:", error)
    }
  }

  const updateSplits = () => {
    const amount = parseFloat(formData.amount) || 0
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
      // Para tipos custom y percentage, mantener valores existentes o inicializar en 0
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
    const totalAmount = parseFloat(formData.amount) || 0
    const totalSplit = getTotalSplitAmount()
    return Math.abs(totalAmount - totalSplit) < 0.01 // Permitir diferencia de 1 centavo por redondeo
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        alert("La imagen debe ser menor a 5MB")
        return
      }
      
      setImage(file)
      const reader = new FileReader()
      reader.onload = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeImage = () => {
    setImage(null)
    setImagePreview(null)
  }

  const uploadImage = async (expenseId: string): Promise<string | null> => {
    if (!image || !user) return null

    setUploadingImage(true)
    try {
      const fileExt = image.name.split('.').pop()
      const fileName = `${user.id}/${expenseId}-${Date.now()}.${fileExt}`

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    // Validaciones
    if (!paidBy) {
      alert("Debe seleccionar quién pagó el gasto")
      return
    }

    if (selectedParticipants.size === 0) {
      alert("Debe seleccionar al menos una persona para dividir el gasto")
      return
    }

    if (!isValidSplit()) {
      alert("La suma de las divisiones debe ser igual al monto total del gasto")
      return
    }

    setLoading(true)

    try {
      // Verificar permisos usando RPC
      const { data: canAdd } = await supabase.rpc("user_can_add_expense", {
        trip_uuid: tripId,
        user_uuid: user.id,
      })

      if (!canAdd) {
        alert("No tienes permisos para agregar gastos a este viaje")
        return
      }

      // Crear el gasto
      const { data: expenseData, error } = await supabase.from("trip_expenses").insert({
        trip_id: tripId,
        category_id: formData.category_id || null,
        title: formData.title,
        description: formData.description || null,
        amount: Number.parseFloat(formData.amount),
        currency: tripCurrency,
        purchase_date: formData.purchase_date || null,
        location: formData.location || null,
        status: formData.status,
        notes: formData.notes || null,
        created_by: user.id,
        paid_by: paidBy,
        split_type: splitType,
        is_settlement: false,
      }).select().single()

      if (error) {
        console.error("Error adding expense:", error)
        alert("Error al agregar el gasto")
        return
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
        // Intentar eliminar el gasto creado si falla la división
        await supabase.from("trip_expenses").delete().eq("id", expenseData.id)
        alert("Error al crear las divisiones del gasto")
        return
      }

      // Upload image if provided
      if (image && expenseData) {
        const imageUrl = await uploadImage(expenseData.id)
        
        // Update expense with image URL
        if (imageUrl) {
          const { error: updateError } = await supabase
            .from("trip_expenses")
            .update({ image_url: imageUrl })
            .eq("id", expenseData.id)

          if (updateError) {
            console.error("Error updating expense with image:", updateError)
          }
        }
      }

      // Reset form and image
      setFormData({
        title: "",
        description: "",
        category_id: "",
        amount: "",
        purchase_date: "",
        location: "",
        status: "planned",
        notes: "",
      })
      setImage(null)
      setImagePreview(null)
      setPaidBy(user?.id || "")
      setSplitType("equal")
      setSplits({})
      setSelectedParticipants(new Set())

      onExpenseAdded()
      onOpenChange(false)
    } catch (error) {
      console.error("Error adding expense:", error)
      alert("Error al agregar el gasto")
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value })
  }

  const getMemberName = (member: TripMember) => {
    return member.full_name || member.email
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agregar Gasto al Viaje</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="basic">Información Básica</TabsTrigger>
            <TabsTrigger value="split">División del Gasto</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-6">
            <form className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Título *</Label>
                  <Input
                    id="title"
                    placeholder="ej. Entradas Disney World"
                    value={formData.title}
                    onChange={(e) => handleChange("title", e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">Precio ({tripCurrency}) *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => handleChange("amount", e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Categoría</Label>
                <Select value={formData.category_id} onValueChange={(value) => handleChange("category_id", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        <div className="flex items-center gap-2">
                          <span>{category.icon}</span>
                          {category.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  placeholder="Detalles adicionales sobre este gasto..."
                  value={formData.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="purchase_date">Fecha de Compra</Label>
                  <Input
                    id="purchase_date"
                    type="date"
                    value={formData.purchase_date}
                    onChange={(e) => handleChange("purchase_date", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Estado</Label>
                  <Select value={formData.status} onValueChange={(value) => handleChange("status", value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={status.color}>
                              {status.label}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Lugar de Compra</Label>
                <Input
                  id="location"
                  placeholder="ej. Sitio web oficial, tienda física..."
                  value={formData.location}
                  onChange={(e) => handleChange("location", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notas Adicionales</Label>
                <Textarea
                  id="notes"
                  placeholder="Información adicional, números de confirmación, etc..."
                  value={formData.notes}
                  onChange={(e) => handleChange("notes", e.target.value)}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="expense-image">Imagen / Recibo</Label>
                {!imagePreview ? (
                  <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center">
                    <input
                      id="expense-image"
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                    <label
                      htmlFor="expense-image"
                      className="cursor-pointer flex flex-col items-center gap-2 text-sm text-gray-600 hover:text-gray-800"
                    >
                      <Upload className="h-8 w-8" />
                      <span>Subir imagen o recibo</span>
                      <span className="text-xs text-gray-400">PNG, JPG hasta 5MB</span>
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
            </form>
          </TabsContent>

          <TabsContent value="split" className="space-y-6">
            <div className="space-y-6">
              {/* Quién pagó */}
              <div className="space-y-2">
                <Label className="text-base font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  ¿Quién pagó este gasto?
                </Label>
                <Select value={paidBy} onValueChange={setPaidBy}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona quién pagó" />
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
                  ¿Cómo dividir el gasto?
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
                  Participantes en el gasto
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
                            <Badge variant="outline">
                              {tripCurrency} {(splits[member.user_id]?.amount || 0).toFixed(2)}
                            </Badge>
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
                            <Badge className="bg-green-100 text-green-800">Ya pagó</Badge>
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
                      <span>Total del gasto:</span>
                      <span className="font-semibold">{tripCurrency} {formData.amount || '0.00'}</span>
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
          </TabsContent>
        </Tabs>

        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="font-semibold text-green-900 mb-2">💡 Ejemplos de gastos para dividir</h3>
          <ul className="text-sm text-green-800 space-y-1">
            <li>• 🎫 Entradas a parques temáticos compartidas</li>
            <li>• 🍽️ Cenas grupales en restaurantes</li>
            <li>• 🚗 Combustible o peajes del viaje</li>
            <li>• 🏠 Alojamiento compartido (Airbnb, hotel)</li>
            <li>• 🎭 Actividades grupales (tours, espectáculos)</li>
          </ul>
        </div>

        <div className="flex gap-4 pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading || uploadingImage || !formData.title || !formData.amount || !paidBy || selectedParticipants.size === 0 || !isValidSplit()} 
            className="flex-1"
          >
            {loading ? "Agregando..." : uploadingImage ? "Subiendo imagen..." : "Agregar Gasto"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
