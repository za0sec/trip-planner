"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useAuth } from "@/components/auth-provider"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  MapPin,
  Calendar,
  Loader2,
  Sparkles,
  Utensils,
  Camera,
  ShoppingBag,
  Building,
  Star,
  ExternalLink,
  Phone,
  Clock,
  AlertTriangle,
  Check,
  Plus,
  Trash2
} from "lucide-react"

interface TripLocation {
  id: string
  trip_id: string
  date: string
  location: string
  city: string | null
  country: string | null
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
}

interface AIRecommendation {
  id: string
  trip_location_id: string
  category: string
  title: string
  description: string | null
  address: string | null
  rating: number | null
  price_level: number | null
  opening_hours: string | null
  website: string | null
  phone: string | null
  recommendation_reason: string | null
  ai_generated: boolean
  created_at: string
}

interface TripAIRecommendationsProps {
  tripId: string
  canEdit: boolean
  tripTitle: string
  startDate?: string | null
  endDate?: string | null
}

interface DayInfo {
  date: string
  dayNumber: number
  dayName: string
  formattedDate: string
}

interface LocationSegment {
  id: string
  startDay: number
  endDay: number
  location: string
  city: string
  country: string
  notes: string
  days: DayInfo[]
  isConfigured: boolean
  tripLocationIds: string[]
  color: string
}

const categoryIcons = {
  restaurants: Utensils,
  attractions: Camera,
  activities: Building,
  museums: Building,
  nightlife: Building,
  shopping: ShoppingBag,
} as const

const categoryNames = {
  restaurants: "Restaurantes",
  attractions: "Atracciones", 
  activities: "Actividades",
  museums: "Museos",
  nightlife: "Vida Nocturna",
  shopping: "Compras",
} as const

// Colores para los segmentos
const segmentColors = [
  'bg-blue-500',
  'bg-green-500', 
  'bg-purple-500',
  'bg-red-500',
  'bg-yellow-500',
  'bg-pink-500',
  'bg-indigo-500',
  'bg-orange-500'
]

export function TripAIRecommendations({ 
  tripId, 
  canEdit, 
  tripTitle, 
  startDate, 
  endDate 
}: TripAIRecommendationsProps) {
  const { user } = useAuth()
  const [allDays, setAllDays] = useState<DayInfo[]>([])
  const [segments, setSegments] = useState<LocationSegment[]>([])
  const [recommendations, setRecommendations] = useState<{ [segmentId: string]: AIRecommendation[] }>({})
  const [loading, setLoading] = useState(true)
  const [generatingRecommendations, setGeneratingRecommendations] = useState<Set<string>>(new Set())
  const [seasonalNotes, setSeasonalNotes] = useState<Record<string, string>>({})
  const [isGeneratingAll, setIsGeneratingAll] = useState(false)
  const [expandedSegments, setExpandedSegments] = useState<Set<string>>(new Set())
  const [editingSegments, setEditingSegments] = useState<Set<string>>(new Set())
  
  // Estados para la selección por arrastre
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectionStart, setSelectionStart] = useState<number | null>(null)
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null)
  const [dragPreview, setDragPreview] = useState<{start: number, end: number} | null>(null)
  const timelineRef = useRef<HTMLDivElement>(null)

  // Generar todos los días del viaje
  const generateAllDays = useCallback(() => {
    if (!startDate || !endDate) return []

    const start = new Date(startDate)
    const end = new Date(endDate)
    const days: DayInfo[] = []
    
    const currentDate = new Date(start)
    let dayNumber = 1

    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().split('T')[0]
      days.push({
        date: dateStr,
        dayNumber,
        dayName: currentDate.toLocaleDateString('es-ES', { weekday: 'short' }),
        formattedDate: currentDate.toLocaleDateString('es-ES', { 
          day: 'numeric', 
          month: 'short' 
        })
      })
      
      currentDate.setDate(currentDate.getDate() + 1)
      dayNumber++
    }

    return days
  }, [startDate, endDate])

  // Cargar ubicaciones existentes
  const loadExistingData = useCallback(async () => {
    try {
      const days = generateAllDays()
      setAllDays(days)

      if (days.length === 0) {
        setLoading(false)
        return
      }

      const { data: locationsData, error } = await supabase
        .from('trip_locations')
        .select('*')
        .eq('trip_id', tripId)
        .order('date', { ascending: true })

      if (error) throw error

      // Si hay ubicaciones existentes, inferir segmentos
      if (locationsData && locationsData.length > 0) {
        // Agrupar ubicaciones consecutivas por ubicación base
        const inferredSegments: LocationSegment[] = []
        let currentSegment: LocationSegment | null = null
        let segmentIndex = 0

        locationsData.forEach((loc) => {
          const dayNum = days.findIndex(d => d.date === loc.date) + 1
          const locationKey = `${loc.location}-${loc.city || ''}-${loc.country || ''}`
          
          if (!currentSegment || 
              `${currentSegment.location}-${currentSegment.city}-${currentSegment.country}` !== locationKey) {
            // Nuevo segmento
            if (currentSegment) {
              inferredSegments.push(currentSegment)
              segmentIndex++
            }
            
            currentSegment = {
              id: `segment-${Date.now()}-${segmentIndex}`,
              startDay: dayNum,
              endDay: dayNum,
              location: loc.location,
              city: loc.city || '',
              country: loc.country || '',
              notes: loc.notes || '',
              days: [days[dayNum - 1]],
              isConfigured: true,
              tripLocationIds: [loc.id],
              color: segmentColors[segmentIndex % segmentColors.length]
            }
          } else {
            // Extender segmento actual
            currentSegment.endDay = dayNum
            currentSegment.days.push(days[dayNum - 1])
            currentSegment.tripLocationIds.push(loc.id)
          }
        })

        if (currentSegment) {
          inferredSegments.push(currentSegment)
        }

        setSegments(inferredSegments)

        // Cargar recomendaciones
        const recommendationsPromises = locationsData.map(async (location: TripLocation) => {
          const { data: recData, error: recError } = await supabase
            .from('ai_recommendations')
            .select('*')
            .eq('trip_location_id', location.id)

          if (recError) {
            console.error('Error fetching recommendations:', recError)
            return { locationId: location.id, recommendations: [] }
          }

          return { locationId: location.id, recommendations: recData || [] }
        })

        const recommendationsResults = await Promise.all(recommendationsPromises)
        const recommendationsMap: { [key: string]: AIRecommendation[] } = {}
        
        recommendationsResults.forEach(({ locationId, recommendations: recs }) => {
          recommendationsMap[locationId] = recs
        })

        setRecommendations(recommendationsMap)
      }

    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }, [tripId, generateAllDays])

  useEffect(() => {
    loadExistingData()
  }, [loadExistingData])

  // Verificar si un día está ocupado por algún segmento
  const isDayOccupied = (dayNumber: number) => {
    return segments.some(segment => 
      dayNumber >= segment.startDay && dayNumber <= segment.endDay
    )
  }

  // Obtener el segmento que ocupa un día específico
  const getSegmentForDay = (dayNumber: number) => {
    return segments.find(segment => 
      dayNumber >= segment.startDay && dayNumber <= segment.endDay
    )
  }

  // Manejar inicio de selección
  const handleSelectionStart = (dayNumber: number, event: React.MouseEvent) => {
    if (!canEdit) return
    
    event.preventDefault()
    
    // Si el día ya está ocupado, no permitir selección
    if (isDayOccupied(dayNumber)) return
    
    setIsSelecting(true)
    setSelectionStart(dayNumber)
    setSelectionEnd(dayNumber)
    setDragPreview({ start: dayNumber, end: dayNumber })
  }

  // Manejar movimiento durante selección
  const handleSelectionMove = (dayNumber: number) => {
    if (!isSelecting || !selectionStart) return
    
    const start = Math.min(selectionStart, dayNumber)
    const end = Math.max(selectionStart, dayNumber)
    
    // Verificar que el rango no incluya días ocupados
    let validRange = true
    for (let i = start; i <= end; i++) {
      if (isDayOccupied(i)) {
        validRange = false
        break
      }
    }
    
    if (validRange) {
      setSelectionEnd(dayNumber)
      setDragPreview({ start, end })
    }
  }

  // Finalizar selección
  const handleSelectionEnd = () => {
    if (!isSelecting || !selectionStart || !selectionEnd) {
      setIsSelecting(false)
      setSelectionStart(null)
      setSelectionEnd(null)
      setDragPreview(null)
      return
    }
    
    const start = Math.min(selectionStart, selectionEnd)
    const end = Math.max(selectionStart, selectionEnd)
    
    // Crear nuevo segmento
    createSegment(start, end)
    
    setIsSelecting(false)
    setSelectionStart(null)
    setSelectionEnd(null)
    setDragPreview(null)
  }

  // Crear nuevo segmento
  const createSegment = (startDay: number, endDay: number) => {
    const segmentDays = allDays.filter(day => 
      day.dayNumber >= startDay && day.dayNumber <= endDay
    )
    
    const newSegment: LocationSegment = {
      id: `segment-${Date.now()}`,
      startDay,
      endDay,
      location: '',
      city: '',
      country: '',
      notes: '',
      days: segmentDays,
      isConfigured: false,
      tripLocationIds: [],
      color: segmentColors[segments.length % segmentColors.length]
    }
    
    setSegments(prev => [...prev, newSegment])
  }

  // Eliminar segmento
  const deleteSegment = async (segmentId: string) => {
    const segment = segments.find(s => s.id === segmentId)
    if (!segment) return

    try {
      // Eliminar ubicaciones de la base de datos
      if (segment.tripLocationIds.length > 0) {
        await supabase
          .from('trip_locations')
          .delete()
          .in('id', segment.tripLocationIds)
      }

      // Eliminar del estado
      setSegments(prev => prev.filter(s => s.id !== segmentId))
      
      // Limpiar recomendaciones
      segment.tripLocationIds.forEach(locationId => {
        setRecommendations(prev => {
          const updated = { ...prev }
          delete updated[locationId]
          return updated
        })
      })

    } catch (error) {
      console.error('Error deleting segment:', error)
    }
  }

  // Actualizar segmento
  const updateSegment = (segmentId: string, field: keyof LocationSegment, value: string) => {
    setSegments(prev => prev.map(segment => 
      segment.id === segmentId 
        ? { ...segment, [field]: value, isConfigured: false }
        : segment
    ))
  }

  // Guardar segmento
  const saveSegment = async (segmentId: string) => {
    const segment = segments.find(s => s.id === segmentId)
    if (!segment || !segment.location.trim()) return

    try {
      // Eliminar ubicaciones existentes para este segmento
      if (segment.tripLocationIds.length > 0) {
        await supabase
          .from('trip_locations')
          .delete()
          .in('id', segment.tripLocationIds)
      }

      // Crear nuevas ubicaciones para cada día del segmento
      const locationPromises = segment.days.map(day => 
        supabase
          .from('trip_locations')
          .insert({
            trip_id: tripId,
            date: day.date,
            location: segment.location,
            city: segment.city || null,
            country: segment.country || null,
            notes: segment.notes || null,
            created_by: user?.id || ''
          })
          .select()
          .single()
      )

      const results = await Promise.all(locationPromises)
      const newLocationIds = results.map(result => result.data?.id).filter(Boolean) as string[]

      // Actualizar segmento
      setSegments(prev => prev.map(s => 
        s.id === segmentId 
          ? { ...s, isConfigured: true, tripLocationIds: newLocationIds }
          : s
      ))

    } catch (error) {
      console.error('Error saving segment:', error)
    }
  }

  // Generar recomendaciones para todos los segmentos
  const generateAllRecommendations = async () => {
    setIsGeneratingAll(true)
    try {
      console.log('🎯 Generando recomendaciones para todos los segmentos configurados')
      
      // Generar recomendaciones solo para segmentos configurados que no las tengan
      const segmentsToGenerate = segments.filter(segment => {
        if (!segment.isConfigured) return false
        
        // Verificar si el segmento ya tiene recomendaciones
        const hasRecommendations = segment.tripLocationIds.some(id => 
          recommendations[id] && recommendations[id].length > 0
        )
        
        return !hasRecommendations
      })
      
      console.log(`📝 ${segmentsToGenerate.length} segmentos por generar de ${segments.length} totales`)
      
      for (const segment of segmentsToGenerate) {
        console.log(`⏳ Generando segmento ${segment.id}: ${segment.location}`)
        await generateSegmentRecommendations(segment.id)
        // Pequeña pausa entre segmentos para no sobrecargar la API
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
      
      console.log('✅ Todas las recomendaciones generadas')
    } catch (error) {
      console.error('❌ Error generating all recommendations:', error)
    } finally {
      setIsGeneratingAll(false)
    }
  }
  
  // Función para limpiar recomendaciones de un segmento (para poder regenerar)
  const clearSegmentRecommendations = async (segmentId: string) => {
    const segment = segments.find(s => s.id === segmentId)
    if (!segment) return
    
    try {
      // Eliminar de la base de datos
      const { error } = await supabase
        .from('ai_recommendations')
        .delete()
        .in('trip_location_id', segment.tripLocationIds)
      
      if (error) throw error
      
      // Limpiar del estado local
      setRecommendations(prev => {
        const newRecs = { ...prev }
        segment.tripLocationIds.forEach(id => {
          delete newRecs[id]
        })
        return newRecs
      })
      
      console.log('🗑️ Recomendaciones eliminadas para el segmento:', segmentId)
    } catch (error) {
      console.error('Error clearing recommendations:', error)
    }
  }

  // Toggle expansión de segmento
  const toggleSegmentExpansion = (segmentId: string) => {
    setExpandedSegments(prev => {
      const newSet = new Set(prev)
      if (newSet.has(segmentId)) {
        newSet.delete(segmentId)
      } else {
        newSet.add(segmentId)
      }
      return newSet
    })
  }

  const toggleSegmentEditing = (segmentId: string) => {
    setEditingSegments(prev => {
      const newSet = new Set(prev)
      if (newSet.has(segmentId)) {
        newSet.delete(segmentId)
      } else {
        newSet.add(segmentId)
      }
      return newSet
    })
  }

  // Componente para renderizar estrellas de rating
  const getRatingStars = (rating: number | null) => {
    if (!rating) return null
    return (
      <div className="flex items-center gap-1">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`h-4 w-4 ${
              i < Math.floor(rating) 
                ? 'text-yellow-400 fill-current' 
                : 'text-gray-300'
            }`}
          />
        ))}
        <span className="text-sm text-gray-600 ml-1">{rating}</span>
      </div>
    )
  }

  // Obtener nivel de precio
  const getPriceLevel = (level: number | null) => {
    if (!level) return ''
    return '€'.repeat(level)
  }

  // Generar recomendaciones para un segmento específico
  const generateSegmentRecommendations = async (segmentId: string, forceRegenerate: boolean = false) => {
    const segment = segments.find(s => s.id === segmentId)
    if (!segment || !segment.isConfigured) return

    // Verificar si ya tiene recomendaciones
    const existingRecommendations = segment.tripLocationIds.flatMap(id => 
      recommendations[id] || []
    )
    
    if (existingRecommendations.length > 0 && !forceRegenerate) {
      console.log(`⏭️ Segmento ${segmentId} ya tiene ${existingRecommendations.length} recomendaciones, saltando`)
      console.log('💡 Tip: Para regenerar, elimina las recomendaciones existentes primero')
      return
    }

    console.log('🚀 Generando recomendaciones para segmento:', {
      segmentId,
      location: segment.location,
      days: `${segment.startDay} - ${segment.endDay}`,
      forceRegenerate
    })

    setGeneratingRecommendations(prev => {
      const newSet = new Set(prev)
      newSet.add(segmentId)
      return newSet
    })
    
    try {
      const response = await fetch('/api/generate-recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId,
          segmentId,
          location: segment.location,
          city: segment.city,
          country: segment.country,
          startDay: segment.startDay,
          endDay: segment.endDay,
          notes: segment.notes,
          tripTitle,
          startDate,
          endDate
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.details || 'Error generando recomendaciones')
      }

      const data = await response.json()
      
      console.log('✅ Recomendaciones recibidas:', data.stats)
      
      // Limpiar recomendaciones viejas del estado local para este segmento
      setRecommendations(prev => {
        const newRecommendations = { ...prev }
        
        // Limpiar recomendaciones antiguas
        segment.tripLocationIds.forEach(locationId => {
          delete newRecommendations[locationId]
        })
        
        // Agrupar nuevas recomendaciones por trip_location_id
        const groupedRecs: { [key: string]: AIRecommendation[] } = {}
        data.recommendations.forEach((rec: AIRecommendation) => {
          if (!groupedRecs[rec.trip_location_id]) {
            groupedRecs[rec.trip_location_id] = []
          }
          groupedRecs[rec.trip_location_id].push(rec)
        })
        
        // Asignar las nuevas recomendaciones
        Object.keys(groupedRecs).forEach(locationId => {
          newRecommendations[locationId] = groupedRecs[locationId]
        })
        
        return newRecommendations
      })

      if (data.seasonal_note) {
        setSeasonalNotes(prev => ({
          ...prev,
          [segmentId]: data.seasonal_note
        }))
      }
      
      // Auto-expandir el segmento para ver los resultados
      setExpandedSegments(prev => {
        const newSet = new Set(prev)
        newSet.add(segmentId)
        return newSet
      })
      
    } catch (error) {
      console.error('❌ Error generando recomendaciones:', error)
      alert(`Error: ${error instanceof Error ? error.message : 'No se pudieron generar recomendaciones'}`)
    } finally {
      setGeneratingRecommendations(prev => {
        const newSet = new Set(prev)
        newSet.delete(segmentId)
        return newSet
      })
    }
  }

  // Obtener todas las recomendaciones de un segmento agrupadas por categoría
  const getSegmentRecommendationsByCategory = (segmentId: string) => {
    // Encontrar el segmento por ID
    const segment = segments.find(s => s.id === segmentId)
    if (!segment) return {}
    
    // Obtener todas las recomendaciones de todos los tripLocationIds del segmento
    const segmentRecommendations = segment.tripLocationIds.flatMap(locationId => 
      recommendations[locationId] || []
    )
    
    // Debug: logs de recomendaciones si es necesario
    
    const grouped: { [key: string]: AIRecommendation[] } = {}
    
    Object.keys(categoryNames).forEach(category => {
      grouped[category] = segmentRecommendations.filter(rec => rec.category === category)
    })
    
    return grouped
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  const allSegmentsConfigured = segments.length > 0 && segments.every(s => s.isConfigured)
  const configuredSegments = segments.filter(s => s.isConfigured).length
  const totalDaysInSegments = segments.reduce((total, segment) => total + segment.days.length, 0)
  const unassignedDays = allDays.length - totalDaysInSegments

  return (
    <div className="space-y-6">
      <Card data-tutorial="ai-header">
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              Recomendaciones con IA
            </CardTitle>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Selecciona y arrastra para crear segmentos de días por ubicación. Luego obtén recomendaciones personalizadas.
            </p>
          </div>
          {canEdit && allSegmentsConfigured && (
            <div className="flex gap-2">
              <Button 
                onClick={generateAllRecommendations}
                disabled={isGeneratingAll}
                data-tutorial="generate-recommendations"
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                {isGeneratingAll ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generando recomendaciones...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generar Todas las Recomendaciones
                  </>
                )}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {!startDate || !endDate ? (
            <div className="text-center py-12">
              <Calendar className="h-16 w-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Fechas del viaje no definidas</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Define las fechas de inicio y fin del viaje para poder organizar los días.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Información del progreso */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4" data-tutorial="progress-info">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                    Tu viaje: {allDays.length} días, {segments.length} segmentos
                  </h3>
                </div>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Haz clic y arrastra sobre los días para crear segmentos de ubicación.
                </p>
                <div className="flex items-center gap-4 mt-2">
                  {configuredSegments > 0 && (
                    <Badge variant="secondary" className={
                      allSegmentsConfigured 
                        ? "bg-green-100 text-green-800" 
                        : "bg-yellow-100 text-yellow-800"
                    }>
                      {allSegmentsConfigured ? "✓" : "⏳"} {configuredSegments} de {segments.length} segmentos configurados
                    </Badge>
                  )}
                  {unassignedDays > 0 && (
                    <Badge variant="secondary" className="bg-gray-100 text-gray-800">
                      {unassignedDays} días sin asignar
                    </Badge>
                  )}
                </div>
              </div>

              {/* Timeline visual de días con selección por arrastre */}
              <div 
                className="bg-white dark:bg-gray-800 border rounded-lg p-4 select-none" 
                data-tutorial="timeline"
                ref={timelineRef}
                onMouseLeave={handleSelectionEnd}
              >
                <h4 className="font-medium mb-4 flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Timeline del Viaje - Selecciona y arrastra para crear segmentos
                </h4>
                <div className="grid grid-cols-7 gap-2 mb-4">
                  {allDays.map((day) => {
                    const isOccupied = isDayOccupied(day.dayNumber)
                    const segment = getSegmentForDay(day.dayNumber)
                    const isInDragPreview = dragPreview && 
                      day.dayNumber >= dragPreview.start && 
                      day.dayNumber <= dragPreview.end
                    
                    return (
                      <div 
                        key={day.date} 
                        className={`relative p-2 text-center border rounded cursor-pointer transition-all ${
                          isOccupied 
                            ? `${segment?.color} bg-opacity-20 border-current text-gray-900 dark:text-gray-100`
                            : isInDragPreview
                            ? 'bg-blue-200 border-blue-400 dark:bg-blue-800 dark:border-blue-600'
                            : 'border-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                        onMouseDown={(e) => !isOccupied && handleSelectionStart(day.dayNumber, e)}
                        onMouseEnter={() => handleSelectionMove(day.dayNumber)}
                        onMouseUp={handleSelectionEnd}
                      >
                        <div className="text-xs font-medium">{day.dayName}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">{day.formattedDate}</div>
                        <div className="text-xs text-gray-500">Día {day.dayNumber}</div>
                        
                        {isOccupied && segment && (
                          <div className="absolute top-0 right-0 -mt-1 -mr-1">
                            <div className={`w-3 h-3 ${segment.color} rounded-full border border-white`} />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                <p className="text-xs text-gray-500 text-center">
                  💡 Haz clic y arrastra desde el día inicial hasta el día final para crear un segmento
                </p>
              </div>

              {/* Segmentos */}
              <div className="space-y-4" data-tutorial="segments-area">
                {segments.map((segment, segmentIndex) => {
                  // Verificar si el segmento tiene recomendaciones buscando en todos los tripLocationIds
                  const segmentRecommendations = segment.tripLocationIds.flatMap(locationId => 
                    recommendations[locationId] || []
                  )
                  const hasRecommendations = segmentRecommendations.length > 0
                  const isGenerating = generatingRecommendations.has(segment.id)
                  const isEditing = editingSegments.has(segment.id)
                  const isExpanded = expandedSegments.has(segment.id)
                  
                  // Debug: console.log para segmento si es necesario

                  return (
                    <Card 
                      key={segment.id}
                      className="border-l-4 transition-all duration-200"
                      style={{ borderLeftColor: segment.color.replace('bg-', '#') }}
                    >
                      <div className="p-4">
                        {/* Header clickeable para expandir/colapsar */}
                        <div 
                          className={`${
                            hasRecommendations ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg -m-2 p-2 mb-1' : ''
                          }`}
                          onClick={() => {
                            if (hasRecommendations) {
                              toggleSegmentExpansion(segment.id)
                            }
                          }}
                        >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div 
                              className={`p-2 rounded-lg ${segment.color} bg-opacity-20`}
                            >
                              <MapPin className={`h-4 w-4 text-gray-700 dark:text-gray-300`} />
                            </div>
                            <div>
                              <h3 className="font-semibold">
                                Segmento {segmentIndex + 1}
                                {segment.location && ` - ${segment.location}`}
                              </h3>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                Días {segment.startDay} al {segment.endDay} ({segment.days.length} días)
                                {hasRecommendations && (
                                  <span className="ml-2 text-purple-600 text-xs">
                                    {isExpanded ? '▼ Click para ocultar' : '▶ Click para ver recomendaciones'}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {segment.isConfigured ? (
                              <Badge variant="secondary" className="bg-green-100 text-green-800">
                                <Check className="h-3 w-3 mr-1" />
                                Configurado
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                                ⏳ Pendiente
                              </Badge>
                            )}
                            {hasRecommendations && (
                              <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                                ✨ Con recomendaciones
                              </Badge>
                            )}
                            {isGenerating && (
                              <Badge variant="secondary" className="animate-pulse">
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                Generando...
                              </Badge>
                            )}
                            
                            {/* Botones de acción - con stopPropagation para evitar expandir */}
                            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                              {canEdit && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleSegmentEditing(segment.id)}
                                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                >
                                  {isEditing ? 'Cancelar' : 'Editar'}
                                </Button>
                              )}
                              
                              {segment.isConfigured && !hasRecommendations && canEdit && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => generateSegmentRecommendations(segment.id)}
                                  disabled={isGenerating}
                                  className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                                  title="Generar recomendaciones IA"
                                >
                                  {isGenerating ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Sparkles className="h-4 w-4" />
                                  )}
                                </Button>
                              )}
                              
                              {segment.isConfigured && hasRecommendations && canEdit && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={async () => {
                                      await clearSegmentRecommendations(segment.id)
                                      await generateSegmentRecommendations(segment.id, true)
                                    }}
                                    disabled={isGenerating}
                                    className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                                    title="Regenerar recomendaciones"
                                  >
                                    {isGenerating ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <>
                                        <Sparkles className="h-4 w-4 mr-1" />
                                        Regenerar
                                      </>
                                    )}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => clearSegmentRecommendations(segment.id)}
                                    disabled={isGenerating}
                                    className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                    title="Limpiar recomendaciones"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              
                              {canEdit && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteSegment(segment.id)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                        </div>
                        {/* Fin del header clickeable */}

                        {/* Formulario de edición */}
                        {isEditing && (
                          <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <Label htmlFor={`location-${segment.id}`}>Ubicación principal *</Label>
                                <Input
                                  id={`location-${segment.id}`}
                                  placeholder="ej. París, Manhattan, Centro Histórico"
                                  value={segment.location}
                                  onChange={(e) => updateSegment(segment.id, 'location', e.target.value)}
                                />
                              </div>
                              <div>
                                <Label htmlFor={`city-${segment.id}`}>Ciudad</Label>
                                <Input
                                  id={`city-${segment.id}`}
                                  placeholder="ej. París, Nueva York"
                                  value={segment.city}
                                  onChange={(e) => updateSegment(segment.id, 'city', e.target.value)}
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <Label htmlFor={`country-${segment.id}`}>País</Label>
                                <Input
                                  id={`country-${segment.id}`}
                                  placeholder="ej. Francia"
                                  value={segment.country}
                                  onChange={(e) => updateSegment(segment.id, 'country', e.target.value)}
                                />
                              </div>
                              <div className="flex items-end">
                                <Button
                                  onClick={() => {
                                    saveSegment(segment.id)
                                    toggleSegmentEditing(segment.id)
                                  }}
                                  disabled={!segment.location.trim()}
                                  className="w-full"
                                >
                                  <Check className="h-4 w-4 mr-2" />
                                  {segment.isConfigured ? 'Actualizar' : 'Configurar'} Segmento
                                </Button>
                              </div>
                            </div>
                            <div>
                              <Label htmlFor={`notes-${segment.id}`}>Preferencias (opcional)</Label>
                              <Textarea
                                id={`notes-${segment.id}`}
                                placeholder="ej. Comida local, museos, vida nocturna..."
                                value={segment.notes}
                                onChange={(e) => updateSegment(segment.id, 'notes', e.target.value)}
                                rows={2}
                              />
                            </div>
                          </div>
                        )}

                        {/* Mostrar recomendaciones agrupadas por categoría con animación */}
                        {hasRecommendations && (
                          <div 
                            className={`border-t mt-4 overflow-hidden transition-all duration-300 ease-in-out ${
                              isExpanded ? 'max-h-[2000px] pt-4 opacity-100' : 'max-h-0 pt-0 opacity-0'
                            }`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {seasonalNotes[segment.id] && (
                              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg mb-4">
                                <div className="flex items-start gap-2">
                                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                                  <p className="text-sm text-amber-800 dark:text-amber-200">
                                    <strong>Aviso temporal:</strong> {seasonalNotes[segment.id]}
                                  </p>
                                </div>
                              </div>
                            )}

                            <Tabs defaultValue="restaurants" className="w-full" data-tutorial="recommendation-tabs">
                              <TabsList className="grid w-full grid-cols-6" onClick={(e) => e.stopPropagation()}>
                                {Object.entries(categoryNames).map(([key, name]) => (
                                  <TabsTrigger 
                                    key={key} 
                                    value={key} 
                                    className="text-xs"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {name}
                                  </TabsTrigger>
                                ))}
                              </TabsList>
                              
                              {Object.entries(categoryNames).map(([category, categoryName]) => {
                                const categoryRecommendations = getSegmentRecommendationsByCategory(segment.id)[category] || []
                                const IconComponent = categoryIcons[category as keyof typeof categoryIcons]
                                
                                return (
                                  <TabsContent 
                                    key={category} 
                                    value={category} 
                                    className="mt-4"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                                      {categoryRecommendations.length > 0 ? (
                                        categoryRecommendations.map((rec) => (
                                          <div 
                                            key={rec.id} 
                                            className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                                            onClick={() => {
                                              if (rec.website) {
                                                window.open(rec.website, '_blank', 'noopener,noreferrer')
                                              }
                                            }}
                                          >
                                            <div className="flex items-start justify-between mb-2">
                                              <div className="flex items-center gap-2">
                                                <IconComponent className="h-4 w-4 text-gray-500" />
                                                <h5 className="font-medium">{rec.title}</h5>
                                                {rec.price_level && (
                                                  <span className="text-sm text-gray-500">
                                                    {getPriceLevel(rec.price_level)}
                                                  </span>
                                                )}
                                              </div>
                                              <div className="flex items-center gap-2">
                                                {rec.rating && getRatingStars(rec.rating)}
                                                {rec.website && (
                                                  <ExternalLink className="h-4 w-4 text-gray-400" />
                                                )}
                                              </div>
                                            </div>
                                            
                                            {rec.description && (
                                              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                                {rec.description}
                                              </p>
                                            )}
                                            
                                            {rec.recommendation_reason && (
                                              <p className="text-xs text-blue-600 dark:text-blue-400 mb-2 italic">
                                                💡 {rec.recommendation_reason}
                                              </p>
                                            )}
                                            
                                            <div className="flex items-center gap-4 text-xs text-gray-500">
                                              {rec.address && (
                                                <div className="flex items-center gap-1">
                                                  <MapPin className="h-3 w-3" />
                                                  <span>{rec.address}</span>
                                                </div>
                                              )}
                                              {rec.phone && (
                                                <div className="flex items-center gap-1">
                                                  <Phone className="h-3 w-3" />
                                                  <span>{rec.phone}</span>
                                                </div>
                                              )}
                                              {rec.opening_hours && (
                                                <div className="flex items-center gap-1">
                                                  <Clock className="h-3 w-3" />
                                                  <span>{rec.opening_hours}</span>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        ))
                                      ) : (
                                        <div className="text-center py-8">
                                          <IconComponent className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                                          <p className="text-gray-500">No hay recomendaciones de {categoryName.toLowerCase()} para este segmento</p>
                                        </div>
                                      )}
                                    </div>
                                  </TabsContent>
                                )
                              })}
                            </Tabs>
                          </div>
                        )}
                      </div>
                    </Card>
                  )
                })}
              </div>

              {/* Botón para agregar segmento manualmente si quedan días sin asignar */}
              {canEdit && unassignedDays > 0 && (
                <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                  <Plus className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600 mb-4">
                    Tienes {unassignedDays} días sin asignar a ningún segmento
                  </p>
                  <p className="text-sm text-gray-500">
                    Selecciona y arrastra en el timeline para crear más segmentos
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
 
 