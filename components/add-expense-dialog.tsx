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
import { Upload, X } from "lucide-react"

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

const statusOptions = [
  { value: "planned", label: "Planificado", color: "bg-yellow-100 text-yellow-800" },
  { value: "purchased", label: "Comprado", color: "bg-green-100 text-green-800" },
  { value: "refunded", label: "Reembolsado", color: "bg-red-100 text-red-800" },
]

export function AddExpenseDialog({ open, onOpenChange, tripId, tripCurrency, onExpenseAdded }: AddExpenseDialogProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
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

  useEffect(() => {
    if (open) {
      fetchCategories()
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
    }
  }, [open])

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

      // First create the expense
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
      }).select().single()

      if (error) {
        console.error("Error adding expense:", error)
        alert("Error al agregar el gasto")
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agregar Gasto al Viaje</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
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

          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="font-semibold text-green-900 mb-2">💡 Ejemplos de gastos generales</h3>
            <ul className="text-sm text-green-800 space-y-1">
              <li>• 🎫 Entradas a parques temáticos</li>
              <li>• 🛡️ Seguros de viaje</li>
              <li>• 📄 Visas y documentación</li>
              <li>• 🧳 Equipaje extra</li>
              <li>• 📱 SIM cards o internet</li>
              <li>• 💰 Propinas planificadas</li>
            </ul>
          </div>

          <div className="flex gap-4 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || uploadingImage || !formData.title || !formData.amount} className="flex-1">
              {loading ? "Agregando..." : uploadingImage ? "Subiendo imagen..." : "Agregar Gasto"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
