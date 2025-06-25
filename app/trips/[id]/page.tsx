"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TripExpenses } from "@/components/trip-expenses"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  ArrowLeft,
  MapPin,
  Calendar,
  DollarSign,
  Plus,
  Hotel,
  Car,
  Camera,
  Utensils,
  ShoppingBag,
  MoreHorizontal,
  CalendarDays,
  PlaneTakeoff,
  Edit,
  Trash2,
  Users,
  ImageIcon,
  ChevronDown,
  PieChart,
  Info,
  Sparkles,
} from "lucide-react"
import Link from "next/link"
import { AddItemDialog } from "@/components/add-item-dialog"
import { TutorialSystem } from "@/components/tutorial-system"

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

interface Activity {
  id: string
  trip_id: string
  title: string
  description: string | null
  category: string
  location: string | null
  date: string | null
  start_time: string | null
  end_time: string | null
  estimated_cost: number | null
  actual_cost: number | null
  status: "planned" | "booked" | "completed"
  image_url?: string | null
  created_by: string
  created_at: string
}

interface TripExpense {
  id: string
  trip_id: string
  category_id: string | null
  title: string
  description: string | null
  amount: number
  currency: string
  purchase_date: string | null
  location: string | null
  status: string
  receipt_url: string | null
  notes: string | null
  image_url?: string | null
  created_by: string
  created_at: string
  category_name: string | null
  category_icon: string | null
  category_color: string | null
}

interface UserRole {
  role: string
  status: string
}

const categoryIcons = {
  flight: PlaneTakeoff,
  accommodation: Hotel,
  transport: Car,
  food: Utensils,
  activity: Camera,
  shopping: ShoppingBag,
  other: MoreHorizontal,
  default: DollarSign,
}

const categoryPresentation = {
  flight: { iconBg: "bg-red-100 dark:bg-red-900/30", iconColor: "text-red-700 dark:text-red-300", name: "Vuelo" },
  accommodation: {
    iconBg: "bg-purple-100 dark:bg-purple-900/30",
    iconColor: "text-purple-700 dark:text-purple-300",
    name: "Alojamiento",
  },
  transport: {
    iconBg: "bg-green-100 dark:bg-green-900/30",
    iconColor: "text-green-700 dark:text-green-300",
    name: "Transporte",
  },
  food: {
    iconBg: "bg-orange-100 dark:bg-orange-900/30",
    iconColor: "text-orange-700 dark:text-orange-300",
    name: "Comida",
  },
  activity: {
    iconBg: "bg-blue-100 dark:bg-blue-900/30",
    iconColor: "text-blue-700 dark:text-blue-300",
    name: "Actividad",
  },
  shopping: {
    iconBg: "bg-pink-100 dark:bg-pink-900/30",
    iconColor: "text-pink-700 dark:text-pink-300",
    name: "Compras",
  },
  other: { iconBg: "bg-gray-200 dark:bg-gray-700/30", iconColor: "text-gray-700 dark:text-gray-300", name: "Otro" },
  default: { iconBg: "bg-gray-200 dark:bg-gray-700/30", iconColor: "text-gray-700 dark:text-gray-300", name: "Gasto" },
}

const expenseCategoryKeyMap: { [key: string]: keyof typeof categoryPresentation } = {
  Vuelos: "flight",
  Alojamiento: "accommodation",
  Transporte: "transport",
  Comida: "food",
  Actividades: "activity",
  Compras: "shopping",
  Entradas: "activity",
  Seguros: "other",
  Visas: "other",
  Equipaje: "transport",
  "Internet/SIM": "other",
  Propinas: "food",
  "Otro (Gasto)": "other",
}

const statusConfig = {
  planned: {
    label: "Planificado",
    color:
      "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700",
  },
  purchased: {
    label: "Comprado",
    color:
      "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700",
  },
  refunded: {
    label: "Reembolsado",
    color: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700",
  },
  booked: {
    label: "Reservado",
    color: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700",
  },
  completed: {
    label: "Completado",
    color: "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-700",
  },
}

export default function TripDetailPage() {
  const params = useParams()
  const { user } = useAuth()
  const [trip, setTrip] = useState<Trip | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [expenses, setExpenses] = useState<TripExpense[]>([])
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("planning")
  const [showAddDialog, setShowAddDialog] = useState(false)

  const isOwner = () => trip?.created_by === user?.id
  const canEdit = () => isOwner() || (userRole?.role === "editor" && userRole?.status === "accepted")
  const canView = () => isOwner() || userRole?.status === "accepted"

  useEffect(() => {
    if (user && params.id) {
      fetchTripData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, params.id])

  const fetchTripData = async () => {
    setLoading(true)
    try {
      const tripId = params.id as string
      const userId = user?.id

      if (!userId) {
        setTrip(null)
        setLoading(false)
        return
      }

      const { data: canAccess } = await supabase.rpc("verify_trip_access", { trip_uuid: tripId, user_uuid: userId })
      if (!canAccess) {
        setTrip(null)
        setLoading(false)
        return
      }

      const { data: tripData } = await supabase.from("trips").select("*").eq("id", tripId).single()
      setTrip(tripData || null)

      const { data: memberData } = await supabase
        .from("trip_members")
        .select("role, status")
        .eq("trip_id", tripId)
        .eq("user_id", userId)
        .single()
      setUserRole(memberData || null)

      const { data: activitiesData } = await supabase
        .from("activities")
        .select("*")
        .eq("trip_id", tripId)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true })
      setActivities(activitiesData || [])

      const { data: expensesData } = await supabase.rpc("get_trip_expenses", { trip_uuid: tripId, user_uuid: userId })
      setExpenses(expensesData || [])
    } catch (error) {
      console.error("Error fetching trip data:", error)
      setTrip(null)
      setActivities([])
      setExpenses([])
    } finally {
      setLoading(false)
    }
  }

  const deleteActivity = async (activityId: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar esta actividad?")) return
    try {
      const { error } = await supabase.from("activities").delete().eq("id", activityId)
      if (error) throw error
      fetchTripData() // Refetch to update list
    } catch (error) {
      console.error("Error deleting activity:", error)
      alert("Error al eliminar la actividad")
    }
  }

  const deleteExpense = async (expenseId: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar este gasto?")) return
    try {
      const { error } = await supabase.from("trip_expenses").delete().eq("id", expenseId) // Corrected table name
      if (error) throw error
      fetchTripData() // Refetch to update list
    } catch (error) {
      console.error("Error deleting expense:", error)
      alert("Error al eliminar el gasto")
    }
  }

  const formatCurrency = (amount: number | null, currency = "USD") => {
    if (amount === null || amount === undefined) return "N/A"
    return new Intl.NumberFormat("es-AR", { style: "currency", currency: currency }).format(amount)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Sin fecha"
    try {
      // Assuming dateString is YYYY-MM-DD from Supabase
      return new Date(dateString + "T00:00:00Z").toLocaleDateString("es-AR", {
        // Added T00:00:00Z for UTC
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC", // Specify timezone to avoid off-by-one day issues
      })
    } catch (e) {
      console.error("Invalid date format:", dateString, e)
      return "Fecha inválida"
    }
  }

  const formatTime = (timeString: string | null) => {
    if (!timeString) return ""
    const [hours, minutes] = timeString.split(":")
    return `${hours}:${minutes}`
  }

  const getTotalEstimatedCost = () => {
    const activitiesCost = activities.reduce((sum, activity) => sum + (activity.estimated_cost || 0), 0)
    const expensesCost = expenses.reduce((sum, expense) => sum + expense.amount, 0)
    return activitiesCost + expensesCost
  }

  const getActivitiesByDate = () => {
    const grouped: { [key: string]: Activity[] } = {}
    const withoutDate: Activity[] = []
    activities.forEach((activity) => {
      if (activity.date) {
        const dateKey = activity.date
        if (!grouped[dateKey]) grouped[dateKey] = []
        grouped[dateKey].push(activity)
      } else {
        withoutDate.push(activity)
      }
    })
    return { grouped, withoutDate }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!trip || (canView && !canView())) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <div className="container mx-auto px-4 py-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            {!trip ? "Viaje no encontrado" : "No tienes acceso a este viaje"}
          </h1>
          <Link href="/trips">
            <Button>Volver a mis viajes</Button>
          </Link>
        </div>
      </div>
    )
  }

  const { grouped: activitiesByDate, withoutDate } = getActivitiesByDate()
  const isUpcoming = () => trip?.start_date && new Date(trip.start_date) > new Date()
  const isOngoing = () =>
    trip?.start_date &&
    trip.end_date &&
    new Date() >= new Date(trip.start_date) &&
    new Date() <= new Date(trip.end_date)

  return (
    <>
      {/* Tutorial PRIMERO - antes de cualquier verificación */}
      <TutorialSystem type="trip_management" autoStart={true} />
      
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col">
        <Navbar />
      <div className="container mx-auto px-4 py-8 flex-1">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/trips">
            <Button
              variant="outline"
              size="sm"
              className="dark:text-gray-100 dark:border-gray-600 dark:hover:bg-gray-700"
            >
              <ArrowLeft className="h-4 w-4 mr-2" /> Volver
            </Button>
          </Link>
          <div className="flex-1" data-tutorial="trip-header">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className="text-3xl font-bold">{trip.title}</h1>
              <Badge variant="outline" className="flex items-center gap-1 dark:border-gray-600 dark:text-gray-300">
                <MapPin className="h-3 w-3" />
                {trip.destination}
              </Badge>
              {isUpcoming() && (
                <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">Próximo</Badge>
              )}
              {isOngoing() && (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">En curso</Badge>
              )}
              {!isOwner() && (
                <Badge variant="outline" className="flex items-center gap-1 dark:border-gray-600 dark:text-gray-300">
                  <Users className="h-3 w-3" />
                  {userRole?.role === "editor" ? "Editor" : "Visualizador"}
                </Badge>
              )}
            </div>
            {trip.description && <p className="text-gray-600 dark:text-gray-400">{trip.description}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            {
              title: "Duración",
              value:
                trip.start_date && trip.end_date
                  ? `${Math.ceil((new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1} días`
                  : "N/A",
              sub: `${formatDate(trip.start_date)} - ${formatDate(trip.end_date)}`,
              icon: Calendar,
            },
            {
              title: "Elementos",
              value: `${activities.length + expenses.length}`,
              sub: "Actividades y gastos",
              icon: Info,
            },
            {
              title: "Costo Total",
              value: formatCurrency(getTotalEstimatedCost(), trip.currency),
              sub: "Actividades y gastos",
              icon: DollarSign,
            },
            {
              title: "Presupuesto",
              value: trip.budget ? formatCurrency(trip.budget, trip.currency) : "Sin límite",
              sub:
                trip.budget && getTotalEstimatedCost() > 0
                  ? `${((getTotalEstimatedCost() / trip.budget) * 100).toFixed(1)}% planificado`
                  : "",
              icon: DollarSign,
            },
          ].map((stat) => (
            <Card key={stat.title} className="bg-white dark:bg-gray-800 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-700 dark:text-gray-300">{stat.title}</CardTitle>
                <stat.icon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{stat.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Herramientas Avanzadas - Navegación a páginas */}
        <div className="mb-8" data-tutorial="advanced-tools">
          <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Herramientas Avanzadas
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Recomendaciones IA */}
            <Link href={`/trips/${trip.id}/ai-recommendations`}>
              <Button
                variant="outline"
                className="w-full h-auto p-4 flex flex-col items-start gap-2 hover:border-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/10"
                data-tutorial="ai-card"
              >
                <div className="flex items-center gap-2 w-full">
                  <div className="bg-purple-100 dark:bg-purple-900/30 p-1.5 rounded">
                    <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <span className="font-medium text-sm">Recomendaciones IA</span>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400 text-left">
                  Sugerencias con inteligencia artificial
                </span>
              </Button>
            </Link>

            {/* Resumen */}
            <Link href={`/trips/${trip.id}/summary`}>
              <Button
                variant="outline"
                className="w-full h-auto p-4 flex flex-col items-start gap-2 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/10"
                data-tutorial="summary-card"
              >
                <div className="flex items-center gap-2 w-full">
                  <div className="bg-blue-100 dark:bg-blue-900/30 p-1.5 rounded">
                    <PieChart className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="font-medium text-sm">Resumen</span>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400 text-left">
                  Estadísticas del viaje
                </span>
              </Button>
            </Link>

            {/* Colaboradores */}
            <Link href={`/trips/${trip.id}/collaboration`}>
              <Button
                variant="outline"
                className="w-full h-auto p-4 flex flex-col items-start gap-2 hover:border-green-300 hover:bg-green-50 dark:hover:bg-green-900/10"
                data-tutorial="collaboration-card"
              >
                <div className="flex items-center gap-2 w-full">
                  <div className="bg-green-100 dark:bg-green-900/30 p-1.5 rounded">
                    <Users className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="font-medium text-sm">Colaboradores</span>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400 text-left">
                  Gestión de accesos
                </span>
              </Button>
            </Link>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6" data-tutorial="trip-tabs">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger
              value="planning"
              className="flex items-center gap-2 data-[state=active]:bg-primary/10 dark:data-[state=active]:bg-primary/30"
              data-tutorial="planning-tab"
            >
              <Edit className="h-4 w-4" />
              Planificación
            </TabsTrigger>
            <TabsTrigger
              value="itinerary"
              className="flex items-center gap-2 data-[state=active]:bg-primary/10 dark:data-[state=active]:bg-primary/30"
              data-tutorial="itinerary-tab"
            >
              <CalendarDays className="h-4 w-4" />
              Itinerario
            </TabsTrigger>
            <TabsTrigger
              value="expenses"
              className="flex items-center gap-2 data-[state=active]:bg-primary/10 dark:data-[state=active]:bg-primary/30"
              data-tutorial="expenses-tab"
            >
              <DollarSign className="h-4 w-4" />
              Gastos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="planning" className="space-y-6">
            <Card className="bg-white dark:bg-gray-800 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Planificación del Viaje</CardTitle>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Agrega vuelos, alojamiento, y otras reservas para tu viaje.
                  </p>
                </div>
                {canEdit() && (
                  <Button onClick={() => setShowAddDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar Actividad
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {activities.length === 0 && expenses.length === 0 ? (
                  <div className="text-center py-12">
                    <PlaneTakeoff className="h-16 w-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">
                      {canEdit() ? "Comienza a planificar tu viaje" : "No hay elementos planificados"}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                      {canEdit()
                        ? "Agrega vuelos, hoteles, y otras actividades para organizar tu viaje."
                        : "El propietario del viaje aún no ha agregado elementos."}
                    </p>
                    {canEdit() && (
                      <Button size="lg" onClick={() => setShowAddDialog(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Agregar Primera Actividad
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {withoutDate.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold mb-3 text-gray-700 dark:text-gray-300">
                          📝 Actividades sin fecha asignada
                        </h3>
                        <div className="space-y-3">
                          {withoutDate.map((activity) => {
                            const pres =
                              categoryPresentation[activity.category as keyof typeof categoryPresentation] ||
                              categoryPresentation.default
                            const IconComp =
                              categoryIcons[activity.category as keyof typeof categoryIcons] || categoryIcons.default
                            return (
                              <Collapsible
                                key={activity.id}
                                className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm"
                              >
                                <CollapsibleTrigger className="w-full p-3 text-left group hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors rounded-t-lg data-[state=open]:rounded-b-none">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <div className={`p-2 rounded-lg ${pres.iconBg}`}>
                                        <IconComp className={`h-5 w-5 ${pres.iconColor}`} />
                                      </div>
                                      <div>
                                        <h4 className="font-semibold text-md">{activity.title}</h4>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">{pres.name}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      {activity.estimated_cost && (
                                        <div className="font-semibold text-md text-right">
                                          {formatCurrency(activity.estimated_cost, trip.currency)}
                                          <p className="text-xs text-gray-500 dark:text-gray-400 font-normal">
                                            Estimado
                                          </p>
                                        </div>
                                      )}
                                      <ChevronDown className="h-5 w-5 text-gray-400 dark:text-gray-500 group-data-[state=open]:rotate-180 transition-transform" />
                                    </div>
                                  </div>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="px-3 pt-2 pb-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-b-lg">
                                  <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                                    {activity.description && (
                                      <p>
                                        <strong className="font-medium text-gray-600 dark:text-gray-400">
                                          Descripción:
                                        </strong>{" "}
                                        {activity.description}
                                      </p>
                                    )}
                                    {activity.location && (
                                      <p>
                                        <strong className="font-medium text-gray-600 dark:text-gray-400">
                                          Ubicación:
                                        </strong>{" "}
                                        {activity.location}
                                      </p>
                                    )}
                                    {activity.start_time && (
                                      <p>
                                        <strong className="font-medium text-gray-600 dark:text-gray-400">Hora:</strong>{" "}
                                        {formatTime(activity.start_time)}
                                        {activity.end_time && ` - ${formatTime(activity.end_time)}`}
                                      </p>
                                    )}
                                    {activity.image_url && (
                                      <Collapsible className="mt-3">
                                        <CollapsibleTrigger asChild>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="text-xs dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
                                          >
                                            <ImageIcon className="h-3 w-3 mr-1" /> Ver Imagen
                                          </Button>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent className="mt-2">
                                          <img
                                            src={activity.image_url || "/placeholder.svg"}
                                            alt={`Imagen de ${activity.title}`}
                                            className="rounded-lg max-w-full sm:max-w-xs max-h-48 object-contain border dark:border-gray-600"
                                            loading="lazy"
                                          />
                                        </CollapsibleContent>
                                      </Collapsible>
                                    )}
                                    {canEdit() && (activity.created_by === user?.id || isOwner()) && (
                                      <div className="mt-3 text-right">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            deleteActivity(activity.id)
                                          }}
                                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/50 text-xs"
                                        >
                                          <Trash2 className="h-3 w-3 mr-1" /> Eliminar
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            )
                          })}
                        </div>
                      </div>
                    )}
                    {Object.keys(activitiesByDate).length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold mb-3 text-gray-700 dark:text-gray-300">
                          📅 Actividades con fecha asignada
                        </h3>
                        {Object.keys(activitiesByDate)
                          .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
                          .map((date) => (
                            <div key={date} className="mb-4">
                              <h4 className="text-md font-medium mb-2 text-gray-600 dark:text-gray-400">
                                {formatDate(date)}
                              </h4>
                              <div className="space-y-3">
                                {activitiesByDate[date]
                                  .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""))
                                  .map((activity) => {
                                    const pres =
                                      categoryPresentation[activity.category as keyof typeof categoryPresentation] ||
                                      categoryPresentation.default
                                    const IconComp =
                                      categoryIcons[activity.category as keyof typeof categoryIcons] ||
                                      categoryIcons.default
                                    return (
                                      <Collapsible
                                        key={activity.id}
                                        className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm"
                                      >
                                        <CollapsibleTrigger className="w-full p-3 text-left group hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors rounded-t-lg data-[state=open]:rounded-b-none">
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                              <div className={`p-2 rounded-lg ${pres.iconBg}`}>
                                                <IconComp className={`h-5 w-5 ${pres.iconColor}`} />
                                              </div>
                                              <div>
                                                <h4 className="font-semibold text-md">{activity.title}</h4>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                  {pres.name}
                                                  {activity.start_time && ` • ${formatTime(activity.start_time)}`}
                                                </p>
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                              {activity.estimated_cost && (
                                                <div className="font-semibold text-md text-right">
                                                  {formatCurrency(activity.estimated_cost, trip.currency)}
                                                  <p className="text-xs text-gray-500 dark:text-gray-400 font-normal">
                                                    Estimado
                                                  </p>
                                                </div>
                                              )}
                                              <ChevronDown className="h-5 w-5 text-gray-400 dark:text-gray-500 group-data-[state=open]:rotate-180 transition-transform" />
                                            </div>
                                          </div>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent className="px-3 pt-2 pb-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-b-lg">
                                          <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                                            {activity.description && (
                                              <p>
                                                <strong className="font-medium text-gray-600 dark:text-gray-400">
                                                  Descripción:
                                                </strong>{" "}
                                                {activity.description}
                                              </p>
                                            )}
                                            {activity.location && (
                                              <p>
                                                <strong className="font-medium text-gray-600 dark:text-gray-400">
                                                  Ubicación:
                                                </strong>{" "}
                                                {activity.location}
                                              </p>
                                            )}
                                            {activity.image_url && (
                                              <Collapsible className="mt-3">
                                                <CollapsibleTrigger asChild>
                                                  <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="text-xs dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
                                                  >
                                                    <ImageIcon className="h-3 w-3 mr-1" /> Ver Imagen
                                                  </Button>
                                                </CollapsibleTrigger>
                                                <CollapsibleContent className="mt-2">
                                                  <img
                                                    src={activity.image_url || "/placeholder.svg"}
                                                    alt={`Imagen de ${activity.title}`}
                                                    className="rounded-lg max-w-full sm:max-w-xs max-h-48 object-contain border dark:border-gray-600"
                                                    loading="lazy"
                                                  />
                                                </CollapsibleContent>
                                              </Collapsible>
                                            )}
                                            {canEdit() && (activity.created_by === user?.id || isOwner()) && (
                                              <div className="mt-3 text-right">
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    deleteActivity(activity.id)
                                                  }}
                                                  className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/50 text-xs"
                                                >
                                                  <Trash2 className="h-3 w-3 mr-1" /> Eliminar
                                                </Button>
                                              </div>
                                            )}
                                          </div>
                                        </CollapsibleContent>
                                      </Collapsible>
                                    )
                                  })}
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                    {expenses.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold mb-3 text-gray-700 dark:text-gray-300">
                          💰 Gastos Generales Registrados
                        </h3>
                        <div className="space-y-3">
                          {expenses.map((expense) => {
                            const statusInfo = statusConfig[expense.status as keyof typeof statusConfig]
                            const categoryKey = expense.category_name
                              ? expenseCategoryKeyMap[expense.category_name] || "default"
                              : "default"
                            const pres = categoryPresentation[categoryKey]
                            const IconComp = categoryIcons[categoryKey] || categoryIcons.default
                            const imageUrl = expense.receipt_url || expense.image_url

                            return (
                              <Collapsible
                                key={expense.id}
                                className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm"
                              >
                                <CollapsibleTrigger className="w-full p-3 text-left group hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors rounded-t-lg data-[state=open]:rounded-b-none">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <div className={`p-2 rounded-lg ${pres.iconBg}`}>
                                        {expense.category_icon ? (
                                          <span className={`text-xl ${pres.iconColor}`}>{expense.category_icon}</span>
                                        ) : (
                                          <IconComp className={`h-5 w-5 ${pres.iconColor}`} />
                                        )}
                                      </div>
                                      <div>
                                        <h4 className="font-semibold text-md">{expense.title}</h4>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                          {expense.category_name || "Gasto General"}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <div className="font-semibold text-md text-right">
                                        {formatCurrency(expense.amount, trip.currency)}
                                        {statusInfo && (
                                          <Badge variant="outline" className={`text-xs ml-2 ${statusInfo.color}`}>
                                            {statusInfo.label}
                                          </Badge>
                                        )}
                                      </div>
                                      <ChevronDown className="h-5 w-5 text-gray-400 dark:text-gray-500 group-data-[state=open]:rotate-180 transition-transform" />
                                    </div>
                                  </div>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="px-3 pt-2 pb-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-b-lg">
                                  <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                                    {expense.description && (
                                      <p>
                                        <strong className="font-medium text-gray-600 dark:text-gray-400">
                                          Descripción:
                                        </strong>{" "}
                                        {expense.description}
                                      </p>
                                    )}
                                    {expense.location && (
                                      <p>
                                        <strong className="font-medium text-gray-600 dark:text-gray-400">Lugar:</strong>{" "}
                                        {expense.location}
                                      </p>
                                    )}
                                    {expense.purchase_date && (
                                      <p>
                                        <strong className="font-medium text-gray-600 dark:text-gray-400">
                                          Fecha Compra:
                                        </strong>{" "}
                                        {formatDate(expense.purchase_date)}
                                      </p>
                                    )}
                                    {expense.notes && (
                                      <p>
                                        <strong className="font-medium text-gray-600 dark:text-gray-400">Notas:</strong>{" "}
                                        {expense.notes}
                                      </p>
                                    )}
                                    {imageUrl && (
                                      <Collapsible className="mt-3">
                                        <CollapsibleTrigger asChild>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="text-xs dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
                                          >
                                            <ImageIcon className="h-3 w-3 mr-1" /> Ver Recibo/Imagen
                                          </Button>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent className="mt-2">
                                          <img
                                            src={imageUrl || "/placeholder.svg"}
                                            alt={`Recibo de ${expense.title}`}
                                            className="rounded-lg max-w-full sm:max-w-xs max-h-48 object-contain border dark:border-gray-600"
                                            loading="lazy"
                                          />
                                        </CollapsibleContent>
                                      </Collapsible>
                                    )}
                                    {canEdit() && (expense.created_by === user?.id || isOwner()) && (
                                      <div className="mt-3 text-right">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            deleteExpense(expense.id)
                                          }}
                                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/50 text-xs"
                                        >
                                          <Trash2 className="h-3 w-3 mr-1" /> Eliminar
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="itinerary">
            <Card className="bg-white dark:bg-gray-800 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5" />
                  Itinerario Día a Día
                </CardTitle>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {isUpcoming()
                    ? "Vista previa de tu itinerario."
                    : isOngoing()
                      ? "Tu itinerario actual."
                      : "Itinerario de tu viaje."}
                </p>
              </CardHeader>
              <CardContent>
                {Object.keys(activitiesByDate).length === 0 ? (
                  <div className="text-center py-12">
                    <CalendarDays className="h-16 w-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No hay actividades con fecha</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                      {canEdit()
                        ? "Agrega fechas a tus actividades para ver el itinerario."
                        : "Aún no hay actividades con fechas programadas."}
                    </p>
                    {canEdit() && <Button onClick={() => setActiveTab("planning")}>Ir a Planificación</Button>}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {Object.keys(activitiesByDate)
                      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
                      .map((date, index) => {
                        const dayActivities = activitiesByDate[date]
                        const dayTotal = dayActivities.reduce((sum, act) => sum + (act.estimated_cost || 0), 0)
                        return (
                          <div
                            key={date}
                            className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 bg-gray-50 dark:bg-gray-800/50 shadow-sm"
                          >
                            <div className="flex items-center justify-between mb-4">
                              <div>
                                <h3 className="text-xl font-bold">Día {index + 1}</h3>
                                <p className="text-gray-600 dark:text-gray-400">{formatDate(date)}</p>
                              </div>
                              {dayTotal > 0 && (
                                <div className="text-right">
                                  <div className="text-lg font-semibold">{formatCurrency(dayTotal, trip.currency)}</div>
                                  <div className="text-sm text-gray-600 dark:text-gray-400">Costo del día</div>
                                </div>
                              )}
                            </div>
                            <div className="space-y-3">
                              {dayActivities
                                .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""))
                                .map((activity) => {
                                  const pres =
                                    categoryPresentation[activity.category as keyof typeof categoryPresentation] ||
                                    categoryPresentation.default
                                  const IconComp =
                                    categoryIcons[activity.category as keyof typeof categoryIcons] ||
                                    categoryIcons.default
                                  return (
                                    <div
                                      key={activity.id}
                                      className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${pres.iconBg}`}>
                                          <IconComp className={`h-4 w-4 ${pres.iconColor}`} />
                                        </div>
                                        <div className="flex-1">
                                          <h4 className="font-medium">{activity.title}</h4>
                                          <p className="text-sm text-gray-600 dark:text-gray-400">
                                            {activity.start_time && `${formatTime(activity.start_time)} • `}
                                            {pres.name}
                                            {activity.location && ` • ${activity.location}`}
                                          </p>
                                        </div>
                                        {activity.estimated_cost && (
                                          <div className="text-sm font-medium">
                                            {formatCurrency(activity.estimated_cost, trip.currency)}
                                          </div>
                                        )}
                                      </div>
                                      {activity.image_url && (
                                        <Collapsible className="mt-2 pl-10">
                                          <CollapsibleTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 px-1 py-0.5 h-auto"
                                            >
                                              <ImageIcon className="h-3 w-3 mr-1" />
                                              Ver Imagen
                                            </Button>
                                          </CollapsibleTrigger>
                                          <CollapsibleContent className="mt-2">
                                            <img
                                              src={activity.image_url || "/placeholder.svg"}
                                              alt={`Imagen de ${activity.title}`}
                                              className="rounded-lg max-w-full sm:max-w-sm max-h-56 object-contain border dark:border-gray-600 shadow-sm"
                                              loading="lazy"
                                            />
                                          </CollapsibleContent>
                                        </Collapsible>
                                      )}
                                    </div>
                                  )
                                })}
                            </div>
                          </div>
                        )
                      })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="expenses">
            <TripExpenses tripId={trip.id} tripCurrency={trip.currency} canEdit={canEdit()} isOwner={isOwner()} />
          </TabsContent>
        </Tabs>
      </div>

      {canEdit() && (
        <AddItemDialog
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          tripId={trip.id}
          tripCurrency={trip.currency}
          tripStartDate={trip.start_date}
          tripEndDate={trip.end_date}
          onItemAdded={fetchTripData}
        />
      )}
      <Footer />
    </div>
    </>
  )
}
