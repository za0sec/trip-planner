"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AuthForm } from "@/components/auth-form"
import { MapPin, Users, CheckCircle, AlertCircle, Clock } from "lucide-react"

interface Invitation {
  id: string
  email: string
  role: string
  status: string
  expires_at: string
  trips: {
    id: string
    title: string
    destination: string
    description: string | null
    created_by: string
    profiles: {
      full_name: string | null
      email: string
    }
  }
}

export default function InvitationPage() {
  const params = useParams()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [invitation, setInvitation] = useState<Invitation | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  useEffect(() => {
    fetchInvitation()
  }, [params.token])

  useEffect(() => {
    if (!authLoading && user && invitation) {
      // Check if user email matches invitation email
      if (user.email === invitation.email) {
        acceptInvitation()
      } else {
        setMessage({
          type: "error",
          text: `Esta invitación es para ${invitation.email}, pero estás conectado como ${user.email}. Cierra sesión e inicia con el email correcto.`,
        })
      }
    }
  }, [user, authLoading, invitation])

  const fetchInvitation = async () => {
    try {
      const { data, error } = await supabase
        .from("trip_invitations")
        .select(`
          id,
          email,
          role,
          status,
          expires_at,
          trips (
            id,
            title,
            destination,
            description,
            created_by,
            profiles (
              full_name,
              email
            )
          )
        `)
        .eq("token", params.token)
        .eq("status", "pending")
        .single()

      if (error || !data) {
        console.error("Error fetching invitation:", error)
        setMessage({
          type: "error",
          text: "Invitación no encontrada o ya ha sido utilizada",
        })
      } else {
        // Check if invitation is expired
        const now = new Date()
        const expiresAt = new Date(data.expires_at)

        if (now > expiresAt) {
          setMessage({
            type: "error",
            text: "Esta invitación ha expirado",
          })
        } else {
          setInvitation(data)
        }
      }
    } catch (error) {
      console.error("Error fetching invitation:", error)
      setMessage({
        type: "error",
        text: "Error al cargar la invitación",
      })
    } finally {
      setLoading(false)
    }
  }

  const acceptInvitation = async () => {
    if (!user || !invitation) return

    setAccepting(true)

    try {
      // Create profile if it doesn't exist
      await supabase.from("profiles").upsert(
        {
          id: user.id,
          email: user.email!,
          full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Usuario",
          avatar_url: user.user_metadata?.avatar_url || null,
        },
        { onConflict: "id" },
      )

      // Add user to trip members
      const { error: memberError } = await supabase.from("trip_members").insert({
        trip_id: invitation.trips.id,
        user_id: user.id,
        role: invitation.role,
        invited_by: invitation.trips.created_by,
        status: "accepted",
        joined_at: new Date().toISOString(),
      })

      if (memberError) {
        console.error("Error adding member:", memberError)
        setMessage({
          type: "error",
          text: "Error al unirse al viaje",
        })
        return
      }

      // Mark invitation as accepted
      const { error: inviteError } = await supabase
        .from("trip_invitations")
        .update({ status: "accepted" })
        .eq("id", invitation.id)

      if (inviteError) {
        console.error("Error updating invitation:", inviteError)
      }

      setMessage({
        type: "success",
        text: "¡Te has unido al viaje exitosamente!",
      })

      // Redirect to trip after 2 seconds
      setTimeout(() => {
        router.push(`/trips/${invitation.trips.id}`)
      }, 2000)
    } catch (error) {
      console.error("Error accepting invitation:", error)
      setMessage({
        type: "error",
        text: "Error al aceptar la invitación",
      })
    } finally {
      setAccepting(false)
    }
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando invitación...</p>
        </div>
      </div>
    )
  }

  if (message?.type === "error" || !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-red-100 p-3 rounded-full">
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
            </div>
            <CardTitle>Invitación no válida</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600 mb-6">{message?.text || "Esta invitación no es válida o ha expirado"}</p>
            <Button onClick={() => router.push("/")} className="w-full">
              Ir al inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // If user is not logged in, show auth form with invitation context
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-2xl mx-auto mb-8">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="bg-blue-600 p-3 rounded-full">
                  <Users className="h-8 w-8 text-white" />
                </div>
              </div>
              <CardTitle>Invitación a Viaje</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold mb-2">{invitation.trips.title}</h2>
                <div className="flex items-center justify-center gap-2 mb-4">
                  <MapPin className="h-4 w-4 text-gray-600" />
                  <span className="text-gray-600">{invitation.trips.destination}</span>
                </div>
                <p className="text-gray-600 mb-4">
                  <strong>{invitation.trips.profiles.full_name || invitation.trips.profiles.email}</strong> te ha
                  invitado a colaborar en este viaje
                </p>
                <Badge variant="outline" className="mb-4">
                  Rol: {invitation.role === "editor" ? "Editor" : "Visualizador"}
                </Badge>
                {invitation.trips.description && (
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{invitation.trips.description}</p>
                )}
              </div>

              <Alert className="border-blue-200 bg-blue-50">
                <Clock className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  Para unirte al viaje, inicia sesión con el email <strong>{invitation.email}</strong> o crea una cuenta
                  nueva.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <AuthForm />
        </div>
      </div>
    )
  }

  // If user is logged in but accepting invitation
  if (accepting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold mb-2">Uniéndote al viaje...</h3>
            <p className="text-gray-600">Por favor espera un momento</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show success message
  if (message?.type === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-green-100 p-3 rounded-full">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <CardTitle>¡Bienvenido al viaje!</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600 mb-6">{message.text}</p>
            <p className="text-sm text-gray-500">Redirigiendo al viaje...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return null
}
