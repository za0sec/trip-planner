"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/components/auth-provider"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Navbar } from "@/components/navbar"
import { PlusCircle, MapPin, Calendar, DollarSign, MoreVertical, Trash2, Crown, Edit, Eye } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import Link from "next/link"

interface Trip {
  id: string
  title: string
  description: string | null
  destination: string
  start_date: string | null
  end_date: string | null
  budget: number | null
  currency: string
  created_by: string
  created_at: string
  user_role?: string
  user_status?: string
}

const roleIcons = {
  owner: Crown,
  editor: Edit,
  viewer: Eye,
}

const roleLabels = {
  owner: "Propietario",
  editor: "Editor",
  viewer: "Visualizador",
}

export default function TripsPage() {
  const { user } = useAuth()
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      fetchTrips()
    }
  }, [user])

  const fetchTrips = async () => {
    try {
      console.log("🔍 Fetching trips for user:", user?.email)

      // First, ensure user has a profile
      await supabase.from("profiles").upsert(
        {
          id: user?.id,
          email: user?.email!,
          full_name: user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Usuario",
          avatar_url: user?.user_metadata?.avatar_url || null,
        },
        { onConflict: "id" },
      )

      // Since RLS is disabled, we can query directly but need to filter manually
      // Fetch owned trips
      const { data: ownedTrips, error: ownedError } = await supabase
        .from("trips")
        .select("*")
        .eq("created_by", user?.id)
        .order("created_at", { ascending: false })

      console.log("✅ Owned trips:", ownedTrips?.length || 0)

      // Fetch shared trips through trip_members
      const { data: memberData, error: memberError } = await supabase
        .from("trip_members")
        .select(`
          role,
          status,
          trip_id,
          trips (*)
        `)
        .eq("user_id", user?.id)
        .eq("status", "accepted")
        .neq("role", "owner") // Exclude owned trips to avoid duplicates

      console.log("✅ Member data:", memberData?.length || 0)

      let allTrips: Trip[] = []

      // Add owned trips
      if (ownedTrips && !ownedError) {
        allTrips = ownedTrips.map((trip) => ({
          ...trip,
          user_role: "owner",
          user_status: "accepted",
        }))
      }

      // Add shared trips
      if (memberData && !memberError) {
        const sharedTrips = memberData
          .filter((member) => member.trips) // Ensure trip data exists
          .map((member) => ({
            ...member.trips,
            user_role: member.role,
            user_status: member.status,
          }))

        allTrips = [...allTrips, ...sharedTrips]
      }

      setTrips(allTrips)

      if (ownedError) console.error("❌ Error fetching owned trips:", ownedError)
      if (memberError) console.error("❌ Error fetching member data:", memberError)
    } catch (error) {
      console.error("❌ Error fetching trips:", error)
      setTrips([])
    } finally {
      setLoading(false)
    }
  }

  const deleteTrip = async (tripId: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar este viaje?")) return

    try {
      // Since RLS is disabled, we need to manually verify ownership
      const trip = trips.find((t) => t.id === tripId)
      if (!trip || trip.created_by !== user?.id) {
        alert("No tienes permisos para eliminar este viaje")
        return
      }

      const { error } = await supabase.from("trips").delete().eq("id", tripId).eq("created_by", user?.id)

      if (error) {
        console.error("Error deleting trip:", error)
        alert("Error al eliminar el viaje")
        return
      }

      setTrips(trips.filter((trip) => trip.id !== tripId))
    } catch (error) {
      console.error("Error deleting trip:", error)
      alert("Error al eliminar el viaje")
    }
  }

  const formatCurrency = (amount: number, currency = "USD") => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: currency,
    }).format(amount)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Sin fecha"
    return new Date(dateString).toLocaleDateString("es-AR")
  }

  const getDaysUntilTrip = (startDate: string | null) => {
    if (!startDate) return null
    const today = new Date()
    const tripDate = new Date(startDate)
    const diffTime = tripDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-64 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Mis Viajes</h1>
            <p className="text-gray-600 mt-2">Gestiona todos tus viajes y colaboraciones</p>
          </div>
          <Link href="/trips/new">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
              <PlusCircle className="mr-2 h-5 w-5" />
              Nuevo Viaje
            </Button>
          </Link>
        </div>

        {trips.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <MapPin className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No tienes viajes aún</h3>
              <p className="text-gray-600 mb-6">Comienza a planificar tu próxima aventura</p>
              <Link href="/trips/new">
                <Button size="lg">Crear tu primer viaje</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trips.map((trip) => {
              const daysUntil = getDaysUntilTrip(trip.start_date)
              const isUpcoming = daysUntil !== null && daysUntil > 0
              const isOngoing =
                daysUntil !== null &&
                daysUntil <= 0 &&
                getDaysUntilTrip(trip.end_date) !== null &&
                getDaysUntilTrip(trip.end_date)! >= 0

              const isOwner = trip.created_by === user?.id
              const userRole = trip.user_role || "viewer"
              const RoleIcon = roleIcons[userRole as keyof typeof roleIcons]

              return (
                <Card key={trip.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="text-xl mb-2">{trip.title}</CardTitle>
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <Badge variant="outline" className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {trip.destination}
                          </Badge>
                          {!isOwner && (
                            <Badge variant="outline" className="flex items-center gap-1">
                              <RoleIcon className="h-3 w-3" />
                              {roleLabels[userRole as keyof typeof roleLabels]}
                            </Badge>
                          )}
                          {isUpcoming && <Badge className="bg-green-100 text-green-800">En {daysUntil} días</Badge>}
                          {isOngoing && <Badge className="bg-blue-100 text-blue-800">En curso</Badge>}
                        </div>
                      </div>

                      {isOwner && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => deleteTrip(trip.id)} className="text-red-600">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>

                    {trip.description && <CardDescription className="line-clamp-2">{trip.description}</CardDescription>}
                  </CardHeader>

                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="h-4 w-4" />
                        <span>
                          {formatDate(trip.start_date)} - {formatDate(trip.end_date)}
                        </span>
                      </div>

                      {trip.budget && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <DollarSign className="h-4 w-4" />
                          <span>Presupuesto: {formatCurrency(trip.budget, trip.currency)}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 mt-6">
                      <Link href={`/trips/${trip.id}`} className="flex-1">
                        <Button className="w-full">Ver Detalles</Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
