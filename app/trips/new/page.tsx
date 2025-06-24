"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Navbar } from "@/components/navbar"
import { ArrowLeft, MapPin, Calendar } from "lucide-react"
import Link from "next/link"

export default function NewTripPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    destination: "",
    start_date: "",
    end_date: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) {
      setError("No hay usuario autenticado")
      return
    }

    setLoading(true)
    setError(null)

    try {
      console.log("🚀 Creating trip for user:", user.email)

      // Ensure profile exists before creating trip
      const { error: profileError } = await supabase.from("profiles").upsert(
        {
          id: user.id,
          email: user.email!,
          full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Usuario",
          avatar_url: user.user_metadata?.avatar_url || null,
        },
        { onConflict: "id" },
      )

      if (profileError) {
        console.error("❌ Profile creation error:", profileError)
        setError(`Error creando perfil: ${profileError.message}`)
        return
      }

      // Create the trip with a simple insert (no RLS to worry about)
      const tripData = {
        id: crypto.randomUUID(), // Generate UUID manually
        title: formData.title,
        description: formData.description || null,
        destination: formData.destination,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        budget: null,
        currency: "USD",
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const { data, error: insertError } = await supabase.from("trips").insert(tripData).select().single()

      if (insertError) {
        console.error("❌ Trip creation error:", insertError)
        setError(`Error creando viaje: ${insertError.message}`)
        return
      }

      console.log("✅ Trip created successfully:", data.id)

      // Add the user as owner in trip_members
      const { error: memberError } = await supabase.from("trip_members").insert({
        trip_id: data.id,
        user_id: user.id,
        role: "owner",
        status: "accepted",
        joined_at: new Date().toISOString(),
      })

      if (memberError) {
        console.error("❌ Member creation error:", memberError)
        // Don't fail the whole process for this
      }

      router.push(`/trips/${data.id}`)
    } catch (error: any) {
      console.error("❌ Unexpected error:", error)
      setError(`Error inesperado: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/trips">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Nuevo Viaje</h1>
            <p className="text-gray-600 mt-2">Crea un nuevo viaje y comienza a planificar</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Información del Viaje
            </CardTitle>
            <CardDescription>Completa los detalles básicos de tu próximo destino</CardDescription>
          </CardHeader>

          <CardContent>
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800 text-sm">{error}</p>
                <details className="mt-2">
                  <summary className="text-xs text-red-600 cursor-pointer">Ver detalles técnicos</summary>
                  <pre className="text-xs mt-1 text-red-600 whitespace-pre-wrap">{error}</pre>
                </details>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Título del Viaje *</Label>
                <Input
                  id="title"
                  name="title"
                  placeholder="ej. Viaje a París 2024"
                  value={formData.title}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Describe tu viaje, qué planeas hacer, lugares que quieres visitar..."
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="destination">Destino *</Label>
                <Input
                  id="destination"
                  name="destination"
                  placeholder="ej. París, Francia"
                  value={formData.destination}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Fecha de Inicio
                  </Label>
                  <Input
                    id="start_date"
                    name="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={handleChange}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end_date" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Fecha de Fin
                  </Label>
                  <Input id="end_date" name="end_date" type="date" value={formData.end_date} onChange={handleChange} />
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">💡 Próximos pasos</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Podrás agregar presupuesto desde la página del viaje</li>
                  <li>• Agregar vuelos, hoteles y actividades</li>
                  <li>• Invitar a otras personas para colaborar</li>
                  <li>• Hacer seguimiento de gastos en tiempo real</li>
                </ul>
              </div>

              <div className="flex gap-4 pt-4">
                <Link href="/trips" className="flex-1">
                  <Button type="button" variant="outline" className="w-full">
                    Cancelar
                  </Button>
                </Link>
                <Button type="submit" disabled={loading || !formData.title || !formData.destination} className="flex-1">
                  {loading ? "Creando..." : "Crear Viaje"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
