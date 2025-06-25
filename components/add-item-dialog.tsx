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
import { cn } from "@/lib/utils"
import { CalendarIcon, PlaneTakeoff, Hotel, Car, Utensils, Camera, ShoppingBag, MoreHorizontal, Upload, X } from "lucide-react"
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

interface ActivityFormData {
  title: string
  description: string
  category: string
  date: string | undefined // Cambiar a string para localStorage
  location: string
  estimatedCost: string
}

export function AddItemDialog({ open, onOpenChange, tripId, tripCurrency, tripStartDate, tripEndDate, onItemAdded }: AddItemDialogProps) {
  const { user } = useAuth()
  
  const { state: formData, updateState, clearState, isLoaded } = usePersistentForm<ActivityFormData>(`add-activity-${tripId}`, {
    title: "",
    description: "",
    category: "",
    date: undefined,
    location: "",
    estimatedCost: "",
  })
  
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pasteIndicator, setPasteIndicator] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      // Solo resetear imagen y estados de UI, no el formulario persistente
      setImage(null)
      setImagePreview(null)
      setError(null)
      setLoading(false)
    }
  }, [open])

  // Manejar pegado de imágenes
  useEffect(() => {
    if (!open) return

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.type.indexOf('image') !== -1) {
          e.preventDefault()
          const file = item.getAsFile()
          if (file) {
            console.log('📋 Imagen pegada:', file.name, file.type, file.size)
            setPasteIndicator(`📋 Imagen pegada: ${file.type}`)
            handleImageFile(file)
            // Limpiar indicador después de 3 segundos
            setTimeout(() => setPasteIndicator(null), 3000)
          }
          break
        }
      }
    }

    document.addEventListener('paste', handlePaste)
    return () => {
      document.removeEventListener('paste', handlePaste)
    }
  }, [open])

  const handleImageFile = (file: File) => {
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      setError("La imagen debe ser menor a 5MB")
      return
    }
    
    setImage(file)
    const reader = new FileReader()
    reader.onload = () => {
      setImagePreview(reader.result as string)
    }
    reader.readAsDataURL(file)
    setError(null) // Limpiar errores previos
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleImageFile(file)
    }
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
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Agregar Actividad / Reserva</DialogTitle>
          <DialogDescription>
            Añade un nuevo elemento a la planificación de tu viaje, como un vuelo, hotel o una visita turística.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="title" className="text-right">
              Título
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
              Categoría
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
                    // Crear fecha sin problemas de zona horaria
                    const [year, month, day] = formData.date.split('-')
                    const displayDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
                    
                    console.log('🖥️ Mostrando fecha:', {
                      storedDate: formData.date,
                      displayDate: displayDate,
                      formatted: format(displayDate, "PPP", { locale: es })
                    })
                    
                    return format(displayDate, "PPP", { locale: es })
                  })() : <span>Selecciona una fecha</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar 
                  mode="single" 
                  selected={formData.date ? (() => {
                    const [year, month, day] = formData.date.split('-')
                    const selectedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
                    
                    console.log('🎯 Fecha seleccionada en calendario:', {
                      storedDate: formData.date,
                      selectedDate: selectedDate
                    })
                    
                    return selectedDate
                  })() : undefined} 
                  onSelect={(date) => {
                    if (date) {
                      // Formatear fecha sin problemas de zona horaria
                      const year = date.getFullYear()
                      const month = String(date.getMonth() + 1).padStart(2, '0')
                      const day = String(date.getDate()).padStart(2, '0')
                      const dateString = `${year}-${month}-${day}`
                      
                      console.log('📅 Fecha seleccionada:', {
                        originalDate: date,
                        formattedString: dateString
                      })
                      
                      updateState({ date: dateString })
                    } else {
                      updateState({ date: undefined })
                    }
                  }} 
                  disabled={(date) => {
                    // Debug: log de las fechas
                    console.log('🔍 Debug fechas:', {
                      tripStartDate,
                      tripEndDate,
                      dateToCheck: date.toISOString().split('T')[0]
                    })
                    
                    // Deshabilitar fechas fuera del rango del viaje
                    if (tripStartDate && tripEndDate) {
                      // Usar comparación directa de strings YYYY-MM-DD para evitar problemas de zona horaria
                      const dateString = date.toISOString().split('T')[0]
                      
                      console.log('🔍 Comparación directa:', {
                        tripStartDate,
                        tripEndDate,
                        dateString,
                        isBeforeStart: dateString < tripStartDate,
                        isAfterEnd: dateString > tripEndDate
                      })
                      
                      return dateString < tripStartDate || dateString > tripEndDate
                    }
                    // Si no hay fechas del viaje, deshabilitar fechas pasadas
                    const today = new Date()
                    const normalizedToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
                    const dateToCheck = new Date(date.getFullYear(), date.getMonth(), date.getDate())
                    return dateToCheck < normalizedToday
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
            <div className="col-span-3 relative">
              <Input
                id="estimatedCost"
                type="number"
                value={formData.estimatedCost}
                onChange={(e) => updateState({ estimatedCost: e.target.value })}
                className="pl-2"
                placeholder={`${tripCurrency} 0.00`}
              />
            </div>
          </div>

          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="image" className="text-right pt-2">
              Imagen
            </Label>
            <div className="col-span-3 space-y-3">
              {!imagePreview ? (
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center">
                  <input
                    id="image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                  <label
                    htmlFor="image"
                    className="cursor-pointer flex flex-col items-center gap-2 text-sm text-gray-600 hover:text-gray-800"
                  >
                    <Upload className="h-8 w-8" />
                    <span>Subir imagen</span>
                    <span className="text-xs text-gray-400">PNG, JPG hasta 5MB</span>
                    <span className="text-xs text-blue-500 font-medium">💡 También puedes pegar (Ctrl+V)</span>
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

          {error && <p className="text-red-500 text-sm col-span-4 text-center">{error}</p>}
          {pasteIndicator && <p className="text-green-600 text-sm col-span-4 text-center">{pasteIndicator}</p>}
        </form>
        <DialogFooter className="flex justify-between">
          <Button 
            type="button" 
            variant="ghost" 
            onClick={clearState}
            className="text-gray-500 hover:text-gray-700"
          >
            Limpiar formulario
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="addItemForm" onClick={handleSubmit} disabled={loading || uploadingImage}>
              {loading ? "Agregando..." : uploadingImage ? "Subiendo imagen..." : "Agregar Actividad"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
