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

export function AddItemDialog({ open, onOpenChange, tripId, tripCurrency, onItemAdded }: AddItemDialogProps) {
  const { user } = useAuth()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("")
  const [date, setDate] = useState<Date | undefined>(undefined)
  const [location, setLocation] = useState("")
  const [estimatedCost, setEstimatedCost] = useState("")
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      // Reset form when dialog opens
      setTitle("")
      setDescription("")
      setCategory("")
      setDate(undefined)
      setLocation("")
      setEstimatedCost("")
      setImage(null)
      setImagePreview(null)
      setError(null)
      setLoading(false)
    }
  }, [open])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
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
    if (!title || !category) {
      setError("El título y la categoría son obligatorios.")
      return
    }
    setLoading(true)
    setError(null)

    try {
      // First create the activity
      const { data: activityData, error: insertError } = await supabase.from("activities").insert({
        trip_id: tripId,
        title,
        description,
        category,
        date: date ? date.toISOString() : null,
        location,
        estimated_cost: estimatedCost ? Number.parseFloat(estimatedCost) : null,
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

      onItemAdded()
      onOpenChange(false)
    } catch (err: unknown) {
      console.error("Error adding activity:", err)
      setError(`Error al agregar la actividad: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
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
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="col-span-3"
              placeholder="Ej: Vuelo a Madrid"
              required
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="category" className="text-right">
              Categoría
            </Label>
            <Select value={category} onValueChange={setCategory} required>
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
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
                  className={cn("col-span-3 justify-start text-left font-normal", !date && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP", { locale: es }) : <span>Selecciona una fecha</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="location" className="text-right">
              Ubicación
            </Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
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
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(e.target.value)}
                className="pl-7"
                placeholder="0.00"
              />
              <span className="absolute left-2.5 top-2.5 text-sm text-muted-foreground">{tripCurrency}</span>
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
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="addItemForm" onClick={handleSubmit} disabled={loading || uploadingImage}>
            {loading ? "Agregando..." : uploadingImage ? "Subiendo imagen..." : "Agregar Actividad"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
