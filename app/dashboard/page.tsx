"use client"

import { useEffect, useState, useCallback } from "react"
import { useAuth } from "@/components/auth-provider"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import {
  PlusCircle,
  MapPin,
  Calendar,
  DollarSign,
  Users,
  TrendingUp,
  Plane,
  Crown,
  Edit,
  Eye,
  Check,
  X,
  Clock,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { TutorialSystem } from "@/components/tutorial-system"
import { DollarRatesArgentina } from "@/components/dollar-rates-argentina"
// Agregar el import al inicio del archivo
// import { CreateTestInvitation } from "@/components/create-test-invitation"

interface Trip {
  id: string
  title: string
  destination: string
  start_date: string | null
  end_date: string | null
  budget: number | null
  currency: string
  created_by: string
  trip_members?: {
    role: string
    status: string
  }[]
}

interface PendingInvitation {
  id: string
  trip_id: string
  role: string
  invited_by: string
  created_at: string
  trips: {
    id: string
    title: string
    destination: string
    description: string | null
    start_date: string | null
    end_date: string | null
    profiles: {
      full_name: string | null
      email: string
    }
  }
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

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [trips, setTrips] = useState<Trip[]>([])
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([])
  const [loading, setLoading] = useState(true)
  const [joiningInvitation, setJoiningInvitation] = useState<string | null>(null)

  const fetchDashboardData = useCallback(async () => {
    if (!user) return

    try {
      console.log("🔍 Fetching trips for user:", user.id, user.email)

      // Fetch accepted trips by starting from trip_members
      const { data: memberData, error: tripsError } = await supabase
        .from("trip_members")
        .select(`
        role,
        status,
        trips (
          id, 
          title, 
          destination, 
          start_date, 
          end_date, 
          budget, 
          currency,
          created_by,
          created_at 
        )
      `)
        .eq("user_id", user.id)
        .eq("status", "accepted")
        // Order by trip's creation date. Need to specify referencedTable for Supabase.
        // Ensure 'created_at' exists on your 'trips' table for this ordering.
        // If 'created_at' on 'trips' is what you want to order by:
        .order("created_at", { referencedTable: "trips", ascending: false })
        .limit(6)

      if (tripsError) {
        console.error("❌ Error fetching trips:", tripsError)
        setTrips([])
      } else {
        const formattedTrips: Trip[] =
          memberData
            ?.map((member) => {
              if (!member.trips) return null // Should not happen with an inner join equivalent
              return {
                ...member.trips, // Spread all properties of the trip object
                trip_members: [{ role: member.role, status: member.status }], // Add member info
              } as unknown as Trip
            })
            .filter((trip): trip is Trip => trip !== null) || [] // Filter out any nulls with type guard

        console.log("✅ Trips fetched:", formattedTrips.length || 0, formattedTrips)
        setTrips(formattedTrips)
      }

      // DEBUG: Fetch ALL trip_members for this user first
      const { data: allMembersDebug, error: allMembersError } = await supabase
        .from("trip_members")
        .select("*")
        .eq("user_id", user.id)

      console.log("🔍 DEBUG - All trip_members for user:", allMembersDebug)
      console.log("🔍 DEBUG - All members error:", allMembersError)

      // Fetch pending invitations (both trip_members and trip_invitations)
      const { data: memberInvitations, error: memberError } = await supabase
        .from("trip_members")
        .select(`
        id,
        trip_id,
        role,
        invited_by,
        created_at,
        status,
        trips (
          id,
          title,
          destination,
          description,
          start_date,
          end_date,
          profiles (
            full_name,
            email
          )
        )
      `)
        .eq("user_id", user.id)
        .eq("status", "pending")

      console.log("🔍 DEBUG - Member invitations query result:", memberInvitations)
      console.log("🔍 DEBUG - Member invitations error:", memberError)

      if (memberError) {
        console.error("❌ Error fetching member invitations:", memberError)
        setPendingInvitations([])
      } else {
        console.log("✅ Member invitations fetched:", memberInvitations?.length || 0, memberInvitations)
        setPendingInvitations((memberInvitations || []) as unknown as PendingInvitation[])
      }
    } catch (error) {
      console.error("❌ Error in fetchDashboardData:", error)
      setTrips([])
      setPendingInvitations([])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    // Redirect to home if not authenticated and not loading
    if (!authLoading && !user) {
      console.log("📍 No user found, redirecting to home")
      router.push("/")
      return
    }

    // Fetch trips if user is authenticated
    if (!authLoading && user) {
      console.log("📊 Fetching dashboard data for:", user.email)
      fetchDashboardData()
    }
  }, [user, authLoading, router, fetchDashboardData])

  const joinTrip = async (invitationId: string, tripId: string) => {
    if (!user) return

    setJoiningInvitation(invitationId)

    try {
      console.log("🤝 Joining trip:", tripId)

      // Update trip_members status to 'accepted'
      const { error: updateError } = await supabase
        .from("trip_members")
        .update({
          status: "accepted",
          joined_at: new Date().toISOString(),
        })
        .eq("id", invitationId)
        .eq("user_id", user.id)

      if (updateError) {
        console.error("❌ Error updating invitation:", updateError)
        alert("Error al unirse al viaje")
        return
      }

      console.log("✅ Successfully joined trip")

      // Remove from pending invitations
      setPendingInvitations((prev) => prev.filter((inv) => inv.id !== invitationId))

      // Refresh trips data to include the new trip
      fetchDashboardData()

      // Show success message
      alert("¡Te has unido al viaje exitosamente!")
    } catch (error) {
      console.error("❌ Error joining trip:", error)
      alert("Error al unirse al viaje")
    } finally {
      setJoiningInvitation(null)
    }
  }

  const declineInvitation = async (invitationId: string) => {
    if (!user) return

    try {
      console.log("❌ Declining invitation:", invitationId)

      // Update trip_members status to 'declined'
      const { error } = await supabase
        .from("trip_members")
        .update({ status: "declined" })
        .eq("id", invitationId)
        .eq("user_id", user.id)

      if (error) {
        console.error("❌ Error declining invitation:", error)
        alert("Error al rechazar la invitación")
        return
      }

      console.log("✅ Successfully declined invitation")

      // Remove from pending invitations
      setPendingInvitations((prev) => prev.filter((inv) => inv.id !== invitationId))
    } catch (error) {
      console.error("❌ Error declining invitation:", error)
      alert("Error al rechazar la invitación")
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

  const getUserRole = (trip: Trip) => {
    return trip.trip_members?.[0]?.role || "viewer"
  }

  // Show loading while auth is loading
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Tutorial PRIMERO - antes de cualquier verificación */}
      <TutorialSystem type="dashboard" autoStart={true} />
      
      {!user ? (
        // Mientras redirige, mostrar loading
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando...</p>
          </div>
        </div>
      ) : (
        <div className="min-h-screen bg-gray-50 flex flex-col" data-tutorial="welcome">
          <Navbar />
          <DollarRatesArgentina />

        <div className="container mx-auto px-4 py-8 flex-1">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              ¡Hola, {user?.user_metadata?.full_name?.split(" ")[0] || "Viajero"}! 👋
            </h1>
            <p className="text-gray-600 mt-2">Aquí tienes un resumen de tus viajes</p>
          </div>
          <Link href="/trips/new">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700" data-tutorial="create-trip">
              <PlusCircle className="mr-2 h-5 w-5" />
              Nuevo Viaje
            </Button>
          </Link>
        </div>


        {/* Pending Invitations */}
        {pendingInvitations.length > 0 && (
          <Card className="mb-8 border-blue-200 bg-blue-50" data-tutorial="invitations">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <Clock className="h-5 w-5" />
                Invitaciones Pendientes ({pendingInvitations.length})
              </CardTitle>
              <CardDescription className="text-blue-700">Te han invitado a colaborar en estos viajes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pendingInvitations.map((invitation) => {
                  const RoleIcon = roleIcons[invitation.role as keyof typeof roleIcons]
                  const isJoining = joiningInvitation === invitation.id

                  return (
                    <div
                      key={invitation.id}
                      className="flex items-center justify-between p-4 bg-white rounded-lg border border-blue-200 shadow-sm"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-100 rounded-lg">
                          <Plane className="h-6 w-6 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-lg text-gray-900">{invitation.trips.title}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <MapPin className="h-4 w-4 text-gray-500" />
                            <span className="text-gray-600">{invitation.trips.destination}</span>
                            {invitation.trips.start_date && (
                              <>
                                <span className="text-gray-400">•</span>
                                <Calendar className="h-4 w-4 text-gray-500" />
                                <span className="text-gray-600">{formatDate(invitation.trips.start_date)}</span>
                              </>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            Invitado por{" "}
                            <span className="font-medium">
                              {invitation.trips.profiles.full_name || invitation.trips.profiles.email}
                            </span>
                          </p>
                          {invitation.trips.description && (
                            <p className="text-sm text-gray-500 mt-2 line-clamp-2">{invitation.trips.description}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-center">
                          <Badge variant="outline" className="flex items-center gap-1 mb-2">
                            <RoleIcon className="h-3 w-3" />
                            {roleLabels[invitation.role as keyof typeof roleLabels]}
                          </Badge>
                          <p className="text-xs text-gray-500">
                            {new Date(invitation.created_at).toLocaleDateString("es-AR")}
                          </p>
                        </div>

                        <div className="flex flex-col gap-2">
                          <Button
                            size="sm"
                            onClick={() => joinTrip(invitation.id, invitation.trip_id)}
                            disabled={isJoining}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            {isJoining ? (
                              <>
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                                Uniéndose...
                              </>
                            ) : (
                              <>
                                <Check className="h-3 w-3 mr-1" />
                                Unirme
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => declineInvitation(invitation.id)}
                            disabled={isJoining}
                            className="text-red-600 border-red-200 hover:bg-red-50"
                          >
                            <X className="h-3 w-3 mr-1" />
                            Rechazar
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Viajes</CardTitle>
              <Plane className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{trips.length}</div>
              <p className="text-xs text-muted-foreground">Viajes accesibles</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Próximos Viajes</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {
                  trips.filter((trip) => {
                    if (!trip.start_date) return false
                    const today = new Date()
                    const tripDate = new Date(trip.start_date)
                    return tripDate > today
                  }).length
                }
              </div>
              <p className="text-xs text-muted-foreground">Viajes pendientes</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Presupuesto Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(trips.reduce((sum, trip) => sum + (trip.budget || 0), 0))}
              </div>
              <p className="text-xs text-muted-foreground">Presupuesto planificado</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Invitaciones</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingInvitations.length}</div>
              <p className="text-xs text-muted-foreground">Pendientes de respuesta</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Trips */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card data-tutorial="trips-list">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Viajes Recientes
              </CardTitle>
              <CardDescription>Tus últimos viajes y colaboraciones</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : trips.length === 0 ? (
                <div className="text-center py-8">
                  <Plane className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">No tienes viajes aún</p>
                  <Link href="/trips/new">
                    <Button>Crear tu primer viaje</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {trips.map((trip) => {
                    const userRole = getUserRole(trip)
                    const RoleIcon = roleIcons[userRole as keyof typeof roleIcons]
                    const isOwner = trip.created_by === user.id

                    return (
                      <Link key={trip.id} href={`/trips/${trip.id}`}>
                        <div className="p-4 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="font-semibold text-lg">{trip.title}</h3>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{trip.destination}</Badge>
                              {!isOwner && (
                                <Badge variant="outline" className="flex items-center gap-1">
                                  <RoleIcon className="h-3 w-3" />
                                  {roleLabels[userRole as keyof typeof roleLabels]}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {formatDate(trip.start_date)} - {formatDate(trip.end_date)}
                            </div>
                            {trip.budget && (
                              <div className="flex items-center gap-1">
                                <DollarSign className="h-4 w-4" />
                                {formatCurrency(trip.budget, trip.currency)}
                              </div>
                            )}
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                  <Link href="/trips">
                    <Button variant="outline" className="w-full">
                      Ver todos los viajes
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Resumen Rápido
              </CardTitle>
              <CardDescription>Información importante sobre tus viajes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-600" />
                    <span className="font-medium">Viajes Colaborativos</span>
                  </div>
                  <span className="text-blue-600 font-semibold">
                    {trips.filter((trip) => trip.created_by !== user.id).length}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Crown className="h-5 w-5 text-green-600" />
                    <span className="font-medium">Viajes Propios</span>
                  </div>
                  <span className="text-green-600 font-semibold">
                    {trips.filter((trip) => trip.created_by === user.id).length}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-orange-600" />
                    <span className="font-medium">Invitaciones Pendientes</span>
                  </div>
                  <span className="text-orange-600 font-semibold">{pendingInvitations.length}</span>
                </div>

                <div className="pt-4 border-t">
                  <p className="text-sm text-gray-600 mb-3">
                    💡 <strong>Tip:</strong> Invita a amigos y familiares para planificar viajes juntos
                  </p>
                  <Link href="/trips/new">
                    <Button className="w-full">Crear nuevo viaje</Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    </div>
      )}
    </>
  )
}
