"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { TripCollaboration } from "@/components/trip-collaboration"
import { TutorialSystem } from "@/components/tutorial-system"
import {
  ArrowLeft,
  Users,
  MapPin,
  Calendar,
  Loader2
} from "lucide-react"
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
}

interface UserRole {
  role: string
  status: string
}

export default function CollaborationPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [trip, setTrip] = useState<Trip | null>(null)
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)

  const isOwner = () => trip?.created_by === user?.id
  const canView = () => isOwner() || userRole?.status === "accepted"

  useEffect(() => {
    if (user && params.id) {
      fetchTripData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, params.id])

  const fetchTripData = async () => {
    try {
      // Fetch trip data
      const { data: tripData, error: tripError } = await supabase
        .from("trips")
        .select("*")
        .eq("id", params.id)
        .single()

      if (tripError) throw tripError

      setTrip(tripData)

      // Check user role if not owner
      if (tripData.created_by !== user?.id) {
        const { data: roleData, error: roleError } = await supabase
          .from("trip_members")
          .select("role, status")
          .eq("trip_id", params.id)
          .eq("user_id", user?.id)
          .single()

        if (!roleError && roleData) {
          setUserRole(roleData)
        }
      }
    } catch (error) {
      console.error("Error fetching trip data:", error)
      router.push("/trips")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
        <Navbar />
        <div className="flex items-center justify-center py-20 flex-1">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
        <Footer />
      </div>
    )
  }

  if (!trip || !canView()) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
        <Navbar />
        <div className="text-center py-20 flex-1">
          <h1 className="text-2xl font-bold mb-4">Acceso Denegado</h1>
          <p className="text-gray-600 mb-6">No tienes permisos para ver este viaje.</p>
          <Link href="/trips">
            <Button>Volver a Mis Viajes</Button>
          </Link>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <>
      {/* Tutorial PRIMERO - antes de cualquier verificación */}
      <TutorialSystem type="collaboration" autoStart={true} />
      
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
        <Navbar />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1">
        {/* Breadcrumbs y navegación */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
            <Link href="/trips" className="hover:text-gray-800 dark:hover:text-gray-200">
              Viajes
            </Link>
            <span>/</span>
            <Link 
              href={`/trips/${trip.id}`} 
              className="hover:text-gray-800 dark:hover:text-gray-200"
            >
              {trip.title}
            </Link>
            <span>/</span>
            <span className="text-green-600 dark:text-green-400">Colaboradores</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href={`/trips/${trip.id}`}>
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Volver al Viaje
                </Button>
              </Link>
              
              <div data-tutorial="collaboration-header">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
                  <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-lg">
                    <Users className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  Colaboradores
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  {trip.title} • {trip.destination}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {trip.start_date && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(trip.start_date).toLocaleDateString('es-ES')}
                </Badge>
              )}
              {trip.destination && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {trip.destination}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Contenido principal */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-6">
            <TripCollaboration
              tripId={trip.id}
              isOwner={isOwner()}
            />
          </div>
        </div>
      </div>
      <Footer />
    </div>
    </>
  )
} 