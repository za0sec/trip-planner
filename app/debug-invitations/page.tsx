"use client"

import { useEffect, useState, useCallback } from "react"
import { useAuth } from "@/components/auth-provider"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Navbar } from "@/components/navbar"

export default function DebugInvitationsPage() {
  const { user } = useAuth()
  const [debugData, setDebugData] = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState(true)

  const fetchDebugData = useCallback(async () => {
    if (!user) return

    try {
      console.log("🔍 Debug: Fetching data for user:", user.id, user.email)

      // 1. Check all trip_members for this user
      const { data: allMembers, error: membersError } = await supabase
        .from("trip_members")
        .select("*")
        .eq("user_id", user.id)

      // 2. Check pending invitations with trip details
      const { data: pendingInvitations, error: pendingError } = await supabase
        .from("trip_members")
        .select(`
          *,
          trips (
            id,
            title,
            destination,
            profiles (
              full_name,
              email
            )
          )
        `)
        .eq("user_id", user.id)
        .eq("status", "pending")

      // 3. Check all trips
      const { data: allTrips, error: tripsError } = await supabase.from("trips").select("*")

      // 4. Check profiles
      const { data: profiles, error: profilesError } = await supabase.from("profiles").select("*")

      setDebugData({
        user: {
          id: user.id,
          email: user.email,
          metadata: user.user_metadata,
        },
        allMembers: allMembers || [],
        pendingInvitations: pendingInvitations || [],
        allTrips: allTrips || [],
        profiles: profiles || [],
        errors: {
          membersError,
          pendingError,
          tripsError,
          profilesError,
        },
      })

      console.log("🔍 Debug data:", {
        allMembers,
        pendingInvitations,
        allTrips,
        profiles,
      })
    } catch (error) {
      console.error("❌ Debug error:", error)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) {
      fetchDebugData()
    }
  }, [user, fetchDebugData])

  const createTestInvitation = async () => {
    if (!user) return

    try {
      // First, let's create a test trip
      const { data: trip, error: tripError } = await supabase
        .from("trips")
        .insert({
          title: "Viaje de Prueba",
          destination: "Buenos Aires",
          description: "Un viaje de prueba para testing",
          created_by: user.id,
        })
        .select()
        .single()

      if (tripError) {
        console.error("Error creating test trip:", tripError)
        alert("Error creando viaje de prueba")
        return
      }

      // Now create a test invitation for the same user (self-invitation for testing)
      const { error: invitationError } = await supabase
        .from("trip_members")
        .insert({
          trip_id: trip.id,
          user_id: user.id,
          role: "editor",
          status: "pending",
          invited_by: user.id,
        })
        .select()

      if (invitationError) {
        console.error("Error creating test invitation:", invitationError)
        alert("Error creando invitación de prueba")
        return
      }

      alert("Invitación de prueba creada!")
      fetchDebugData()
    } catch (error) {
      console.error("Error in createTestInvitation:", error)
    }
  }

  if (!user) {
    return <div>No user found</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Debug Invitaciones</h1>
          <Button onClick={createTestInvitation}>Crear Invitación de Prueba</Button>
        </div>

        {loading ? (
          <div>Cargando...</div>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Usuario Actual</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                  {JSON.stringify(debugData.user, null, 2)}
                </pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Todos los Trip Members ({(debugData.allMembers as unknown[])?.length || 0})</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                  {JSON.stringify(debugData.allMembers, null, 2)}
                </pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Invitaciones Pendientes ({(debugData.pendingInvitations as unknown[])?.length || 0})</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                  {JSON.stringify(debugData.pendingInvitations, null, 2)}
                </pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Todos los Viajes ({(debugData.allTrips as unknown[])?.length || 0})</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                  {JSON.stringify(debugData.allTrips, null, 2)}
                </pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Perfiles ({(debugData.profiles as unknown[])?.length || 0})</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                  {JSON.stringify(debugData.profiles, null, 2)}
                </pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Errores</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                  {JSON.stringify(debugData.errors, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
