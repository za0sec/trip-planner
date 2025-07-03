"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/components/auth-provider"
import { supabase } from "@/lib/supabase"
import { useParams, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { TripExpensesSplitting } from "@/components/trip-expenses-splitting"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Calendar, MapPin, DollarSign } from "lucide-react"

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

export default function TripExpensesPage() {
  const { user } = useAuth()
  const params = useParams()
  const searchParams = useSearchParams()
  const tripId = params.id as string
  const highlightExpense = searchParams.get('highlight')
  
  const [trip, setTrip] = useState<Trip | null>(null)
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<string>("")

  useEffect(() => {
    if (user?.id && tripId) {
      fetchTripData()
    }
  }, [user?.id, tripId])

  const fetchTripData = async () => {
    try {
      // Fetch trip details
      const { data: tripData, error: tripError } = await supabase
        .from("trips")
        .select("*")
        .eq("id", tripId)
        .single()

      if (tripError) {
        console.error("Error fetching trip:", tripError)
        return
      }

      setTrip(tripData)

      // Determine user role in the trip
      if (tripData.created_by === user?.id) {
        setUserRole("owner")
      } else {
        const { data: memberData } = await supabase
          .from("trip_members")
          .select("role, status")
          .eq("trip_id", tripId)
          .eq("user_id", user?.id)
          .eq("status", "accepted")
          .single()

        if (memberData) {
          setUserRole(memberData.role)
        }
      }
    } catch (error) {
      console.error("Error fetching trip data:", error)
    } finally {
      setLoading(false)
    }
  }

  const canView = () => {
    return trip?.created_by === user?.id || userRole !== ""
  }

  const canEdit = () => {
    return trip?.created_by === user?.id || userRole === "editor" || userRole === "owner"
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-center">
            <div className="h-8 bg-gray-200 rounded w-48 mx-auto mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-32 mx-auto"></div>
          </div>
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
        <Navbar />
      
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1">
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
              <span className="text-green-600 dark:text-green-400">División de Gastos</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href={`/trips/${trip.id}`}>
                  <Button variant="outline" size="sm">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Volver al Viaje
                  </Button>
                </Link>
                
                <div data-tutorial="expenses-header">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
                    <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-lg">
                      <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                    División de Gastos
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
                {trip.budget && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    Presupuesto: {new Intl.NumberFormat("es-AR", {
                      style: "currency",
                      currency: trip.currency,
                    }).format(trip.budget)}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Información contextual */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">💡 ¿Cómo funciona la división de gastos?</h3>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <li>• <strong>Balances:</strong> Muestra cuánto ha pagado cada persona vs cuánto debe</li>
              <li>• <strong>Deudas Pendientes:</strong> Resume quién debe dinero a quién para equilibrar las cuentas</li>
              <li>• <strong>Gastos Divididos:</strong> Historial de todos los gastos compartidos con sus divisiones</li>
              <li>• <strong>Liquidaciones:</strong> Puedes marcar deudas como pagadas para actualizar los balances</li>
            </ul>
          </div>

          {/* Contenido principal */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-x-auto">
            <div className="p-6" style={{minWidth: '900px'}}>
              <TripExpensesSplitting
                tripId={trip.id}
                tripCurrency={trip.currency}
                canEdit={canEdit()}
                highlightExpense={highlightExpense}
              />
            </div>
          </div>

          {/* Enlaces de navegación adicionales */}
          <div className="mt-6 flex justify-center gap-4">
            <Link href={`/trips/${trip.id}`}>
              <Button variant="outline">
                Ver Itinerario Completo
              </Button>
            </Link>
            <Link href={`/trips/${trip.id}/collaboration`}>
              <Button variant="outline">
                Gestionar Colaboradores
              </Button>
            </Link>
            <Link href={`/trips/${trip.id}/summary`}>
              <Button variant="outline">
                Resumen del Viaje
              </Button>
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    )
} 