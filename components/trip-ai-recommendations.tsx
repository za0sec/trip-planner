"use client"

import { useEffect, useState, useCallback } from "react"
import { useAuth } from "@/components/auth-provider"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  MapPin,
  Calendar,
  Loader2,
  Sparkles,
  ChevronDown,
  Utensils,
  Camera,
  ShoppingBag,
  Building,
  Star,
  ExternalLink,
  Phone,
  Clock,

  Trash2,
  Edit,
  Save,
  X,
  AlertTriangle
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

export function TripAIRecommendations({ 
  tripId, 
  canEdit, 
  tripTitle, 
  startDate, 
  endDate 
}: TripAIRecommendationsProps) {
  const { user } = useAuth()
  const [locations, setLocations] = useState<TripLocation[]>([])
  const [recommendations, setRecommendations] = useState<{ [key: string]: AIRecommendation[] }>({})
  const [loading, setLoading] = useState(true)
  const [generatingRecommendations, setGeneratingRecommendations] = useState<Set<string>>(new Set())
  const [seasonalNotes, setSeasonalNotes] = useState<Record<string, string>>({})
  const [editingLocation, setEditingLocation] = useState<string | null>(null)
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set())
  const [locationGroups, setLocationGroups] = useState<{ [key: string]: TripLocation[] }>({})

  // Load expanded state from localStorage on component mount
  useEffect(() => {
    const savedExpanded = localStorage.getItem(`expandedLocations_${tripId}`)
    if (savedExpanded) {
      try {
        const expandedArray = JSON.parse(savedExpanded)
        setExpandedLocations(new Set(expandedArray))
      } catch (error) {
        console.error('Error loading expanded locations:', error)
      }
    }
  }, [tripId])

  // Save expanded state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(`expandedLocations_${tripId}`, JSON.stringify(Array.from(expandedLocations)))
  }, [expandedLocations, tripId])

  const [bulkGeneration, setBulkGeneration] = useState({
    startDate: '',
    endDate: '',
    location: '',
    city: '',
    country: '',
    notes: ''
  })
  const [showBulkGenerationDialog, setShowBulkGenerationDialog] = useState(false)
  const [generatingBulk, setGeneratingBulk] = useState(false)

  const fetchLocations = useCallback(async () => {
    try {
      const { data: locationsData, error } = await supabase
        .from('trip_locations')
        .select('*')
        .eq('trip_id', tripId)
        .order('date', { ascending: true })

      if (error) throw error

      setLocations(locationsData || [])

      // Group locations by base location
      const groups: { [key: string]: TripLocation[] } = {}
      ;(locationsData || []).forEach(location => {
        const key = `${location.location}-${location.city || ''}-${location.country || ''}`
        if (!groups[key]) {
          groups[key] = []
        }
        groups[key].push(location)
      })
      setLocationGroups(groups)

      // Fetch recommendations for each location
      const recommendationsPromises = (locationsData || []).map(async (location: TripLocation) => {
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
    } catch (error) {
      console.error('Error fetching locations:', error)
    } finally {
      setLoading(false)
    }
  }, [tripId])

  useEffect(() => {
    fetchLocations()
  }, [tripId, fetchLocations])


  const updateLocation = async (locationId: string, updates: Partial<TripLocation>) => {
    try {
      const { data, error } = await supabase
        .from('trip_locations')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', locationId)
        .select()
        .single()

      if (error) throw error

      setLocations(prev => prev.map(loc => loc.id === locationId ? data : loc))
      setEditingLocation(null)
    } catch (error) {
      console.error('Error updating location:', error)
    }
  }

  const deleteLocation = async (locationId: string) => {
    try {
      const { error } = await supabase
        .from('trip_locations')
        .delete()
        .eq('id', locationId)

      if (error) throw error

      setLocations(prev => prev.filter(loc => loc.id !== locationId))
      setRecommendations(prev => {
        const updated = { ...prev }
        delete updated[locationId]
        return updated
      })
    } catch (error) {
      console.error('Error deleting location:', error)
    }
  }

  const generateRecommendations = async (location: TripLocation) => {
    if (!user) return

    setGeneratingRecommendations(prev => new Set(Array.from(prev).concat(location.id)))

    // Generate in background without blocking UI
    try {
      const response = await fetch('/api/generate-recommendations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tripLocationId: location.id,
          location: location.location,
          city: location.city,
          country: location.country,
          tripTitle: tripTitle,
          date: location.date,
          notes: location.notes
        })
      })

      if (!response.ok) throw new Error('Failed to generate recommendations')

      const data = await response.json()
      
      // Update recommendations state
      setRecommendations(prev => ({
        ...prev,
        [location.id]: data.recommendations
      }))

      // Update seasonal note if provided
      if (data.seasonal_note) {
        setSeasonalNotes(prev => ({
          ...prev,
          [location.id]: data.seasonal_note
        }))
      }

    } catch (error) {
      console.error('Error generating recommendations:', error)
    } finally {
      setGeneratingRecommendations(prev => {
        const newSet = new Set(prev)
        newSet.delete(location.id)
        return newSet
      })
    }
  }

  const generateBulkRecommendations = async () => {
    if (!user || !bulkGeneration.startDate || !bulkGeneration.endDate || !bulkGeneration.location) {
      alert('Por favor completa todos los campos requeridos')
      return
    }

    setGeneratingBulk(true)

    try {
      // Generate date range
      const start = new Date(bulkGeneration.startDate)
      const end = new Date(bulkGeneration.endDate)
      const dates: string[] = []
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(new Date(d).toISOString().split('T')[0])
      }

      // Check which dates already have locations
      const existingDates = new Set(locations.map(loc => loc.date))
      const newDates = dates.filter(date => !existingDates.has(date))
      const existingLocationsForDates = locations.filter(loc => dates.includes(loc.date))

      // Create locations only for new dates
      const newLocations = []
      if (newDates.length > 0) {
        const locationPromises = newDates.map(async (date) => {
          const { data, error } = await supabase
            .from('trip_locations')
            .insert({
              trip_id: tripId,
              date: date,
              location: bulkGeneration.location,
              city: bulkGeneration.city || null,
              country: bulkGeneration.country || null,
              notes: bulkGeneration.notes || null,
              created_by: user.id
            })
            .select()
            .single()

          if (error) throw error
          return data
        })

        const createdLocations = await Promise.all(locationPromises)
        newLocations.push(...createdLocations)
        
        // Update locations state with new locations
        setLocations(prev => [...prev, ...createdLocations])
      }

      // Show success message
      const totalCreated = newLocations.length
      const totalExisting = existingLocationsForDates.length
      
      let message = ''
      if (totalCreated > 0 && totalExisting > 0) {
        message = `Se crearon ${totalCreated} nuevas ubicaciones y se encontraron ${totalExisting} existentes. Ahora puedes generar recomendaciones individualmente desde cada tarjeta.`
      } else if (totalCreated > 0) {
        message = `Se crearon ${totalCreated} nuevas ubicaciones. Ahora puedes generar recomendaciones individualmente desde cada tarjeta.`
      } else {
        message = `Se encontraron ${totalExisting} ubicaciones existentes para estas fechas. Puedes generar recomendaciones desde cada tarjeta.`
      }
      
      alert(message)

      // Reset form and close dialog
      setBulkGeneration({
        startDate: '',
        endDate: '',
        location: '',
        city: '',
        country: '',
        notes: ''
      })
      setShowBulkGenerationDialog(false)

    } catch (error) {
      console.error('Error generating bulk recommendations:', error)
      alert('Error al generar recomendaciones en lote. Por favor, intenta de nuevo.')
    } finally {
      setGeneratingBulk(false)
    }
  }

  const toggleLocationExpansion = (locationId: string) => {
    setExpandedLocations(prev => {
      const newSet = new Set(prev)
      if (newSet.has(locationId)) {
        newSet.delete(locationId)
      } else {
        newSet.add(locationId)
      }
      return newSet
    })
  }

  const toggleGroupExpansion = (groupKey: string) => {
    const groupLocations = locationGroups[groupKey] || []
    const allExpanded = groupLocations.every(loc => expandedLocations.has(loc.id))
    
    setExpandedLocations(prev => {
      const newSet = new Set(prev)
      groupLocations.forEach(loc => {
        if (allExpanded) {
          newSet.delete(loc.id)
        } else {
          newSet.add(loc.id)
        }
      })
      return newSet
    })
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatDateShort = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  const getPriceLevel = (level: number | null) => {
    if (!level) return ''
    return '€'.repeat(level)
  }

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

  const renderLocationContent = (location: TripLocation) => {
    const isEditing = editingLocation === location.id
    const locationRecommendations = recommendations[location.id] || []
    const isGenerating = generatingRecommendations.has(location.id)

    return (
      <div className="space-y-4">
        {isEditing ? (
          <div className="space-y-3 border-t pt-4">
            <Input
              value={location.location}
              onChange={(e) => setLocations(prev => 
                prev.map(loc => loc.id === location.id 
                  ? { ...loc, location: e.target.value }
                  : loc
                )
              )}
              placeholder="Ubicación"
            />
            <div className="flex gap-2">
              <Input
                value={location.city || ''}
                onChange={(e) => setLocations(prev => 
                  prev.map(loc => loc.id === location.id 
                    ? { ...loc, city: e.target.value }
                    : loc
                  )
                )}
                placeholder="Ciudad"
                className="flex-1"
              />
              <Input
                value={location.country || ''}
                onChange={(e) => setLocations(prev => 
                  prev.map(loc => loc.id === location.id 
                    ? { ...loc, country: e.target.value }
                    : loc
                  )
                )}
                placeholder="País"
                className="flex-1"
              />
            </div>
            <Textarea
              value={location.notes || ''}
              onChange={(e) => setLocations(prev => 
                prev.map(loc => loc.id === location.id 
                  ? { ...loc, notes: e.target.value }
                  : loc
                )
              )}
              placeholder="Notas"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => updateLocation(location.id, {
                  location: location.location,
                  city: location.city,
                  country: location.country,
                  notes: location.notes
                })}
              >
                <Save className="h-4 w-4 mr-2" />
                Guardar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingLocation(null)
                  fetchLocations() // Reset changes
                }}
              >
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <>
            {location.notes && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {location.notes}
              </p>
            )}
            
            {locationRecommendations.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Recomendaciones</h4>
                  {canEdit && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => generateRecommendations(location)}
                      disabled={isGenerating}
                    >
                      {isGenerating ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-2" />
                      )}
                      Regenerar
                    </Button>
                  )}
                </div>
                
                {seasonalNotes[location.id] && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-amber-800 dark:text-amber-200">
                        <strong>Aviso temporal:</strong> {seasonalNotes[location.id]}
                      </p>
                    </div>
                  </div>
                )}
                
                <Tabs defaultValue="restaurants" className="w-full" data-tutorial="recommendation-tabs">
                  <TabsList className="grid w-full grid-cols-6">
                    {Object.entries(categoryNames).map(([key, name]) => (
                      <TabsTrigger key={key} value={key} className="text-xs">
                        {name}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  
                  {Object.entries(categoryNames).map(([category, categoryName]) => {
                    const categoryRecs = locationRecommendations.filter(rec => rec.category === category)
                    const IconComponent = categoryIcons[category as keyof typeof categoryIcons]
                    
                    return (
                      <TabsContent key={category} value={category} className="mt-4">
                        <div className="space-y-3">
                          {categoryRecs.length > 0 ? (
                            categoryRecs.map((rec) => (
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
                                
                                <div className="space-y-1 text-xs text-gray-500">
                                  {rec.address && (
                                    <div className="flex items-center gap-1">
                                      <MapPin className="h-3 w-3" />
                                      <span>{rec.address}</span>
                                    </div>
                                  )}
                                  {rec.opening_hours && (
                                    <div className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      <span>{rec.opening_hours}</span>
                                    </div>
                                  )}
                                  {rec.phone && (
                                    <div className="flex items-center gap-1">
                                      <Phone className="h-3 w-3" />
                                      <span>{rec.phone}</span>
                                    </div>
                                  )}
                                </div>
                                
                                {rec.recommendation_reason && (
                                  <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs">
                                    <strong>Por qué lo recomendamos:</strong> {rec.recommendation_reason}
                                  </div>
                                )}
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-8 text-gray-500">
                              <IconComponent className="h-12 w-12 mx-auto mb-2 opacity-50" />
                              <p>No hay recomendaciones de {categoryName.toLowerCase()}</p>
                            </div>
                          )}
                        </div>
                      </TabsContent>
                    )
                  })}
                </Tabs>
              </div>
            ) : (
              <div className="text-center py-8">
                {isGenerating ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                    <p className="text-sm text-gray-600">Generando recomendaciones...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <Sparkles className="h-12 w-12 text-gray-400" />
                    <div>
                      <h4 className="font-medium mb-1">Sin recomendaciones</h4>
                      <p className="text-sm text-gray-600 mb-4">
                        Genera recomendaciones personalizadas con IA para este día
                      </p>
                      {canEdit && (
                        <Button onClick={() => generateRecommendations(location)} data-tutorial="generate-recommendations">
                          <Sparkles className="h-4 w-4 mr-2" />
                          Generar Recomendaciones
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              Recomendaciones con IA
            </CardTitle>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Especifica dónde estarás cada día y obtén recomendaciones personalizadas con inteligencia artificial.
            </p>
          </div>
          {canEdit && (
            <div className="flex gap-2">
              <Dialog open={showBulkGenerationDialog} onOpenChange={setShowBulkGenerationDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" data-tutorial="location-form">
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generar Rango
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Generar Recomendaciones por Rango</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="startDate">Fecha Inicio</Label>
                        <Input
                          id="startDate"
                          type="date"
                          value={bulkGeneration.startDate}
                          onChange={(e) => setBulkGeneration(prev => ({ ...prev, startDate: e.target.value }))}
                          min={startDate || undefined}
                          max={endDate || undefined}
                        />
                      </div>
                      <div>
                        <Label htmlFor="endDate">Fecha Fin</Label>
                        <Input
                          id="endDate"
                          type="date"
                          value={bulkGeneration.endDate}
                          onChange={(e) => setBulkGeneration(prev => ({ ...prev, endDate: e.target.value }))}
                          min={bulkGeneration.startDate || startDate || undefined}
                          max={endDate || undefined}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="bulkLocation">Ubicación Base</Label>
                      <Input
                        id="bulkLocation"
                        placeholder="ej. Nueva York, París..."
                        value={bulkGeneration.location}
                        onChange={(e) => setBulkGeneration(prev => ({ ...prev, location: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="bulkCity">Ciudad (opcional)</Label>
                      <Input
                        id="bulkCity"
                        placeholder="ej. Nueva York"
                        value={bulkGeneration.city}
                        onChange={(e) => setBulkGeneration(prev => ({ ...prev, city: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="bulkCountry">País (opcional)</Label>
                      <Input
                        id="bulkCountry"
                        placeholder="ej. Estados Unidos"
                        value={bulkGeneration.country}
                        onChange={(e) => setBulkGeneration(prev => ({ ...prev, country: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="bulkNotes">Preferencias (opcional)</Label>
                      <Textarea
                        id="bulkNotes"
                        placeholder="Tipo de comida, presupuesto, intereses..."
                        value={bulkGeneration.notes}
                        onChange={(e) => setBulkGeneration(prev => ({ ...prev, notes: e.target.value }))}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        onClick={generateBulkRecommendations} 
                        disabled={!bulkGeneration.startDate || !bulkGeneration.endDate || !bulkGeneration.location || generatingBulk}
                        data-tutorial="generate-recommendations"
                      >
                        {generatingBulk ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Generando...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-2" />
                            Generar Todo
                          </>
                        )}
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setShowBulkGenerationDialog(false)
                          setBulkGeneration({
                            startDate: '',
                            endDate: '',
                            location: '',
                            city: '',
                            country: '',
                            notes: ''
                          })
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {locations.length === 0 ? (
            <div className="text-center py-12">
              <MapPin className="h-16 w-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No hay ubicaciones definidas</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {canEdit 
                  ? "Agrega las ubicaciones donde estarás cada día para obtener recomendaciones personalizadas."
                  : "El organizador del viaje aún no ha agregado ubicaciones por día."
                }
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(locationGroups).map(([groupKey, groupLocations]) => {
                const isGrouped = groupLocations.length > 1
                const firstLocation = groupLocations[0]
                const allGenerating = groupLocations.some(loc => generatingRecommendations.has(loc.id))
                const hasRecommendations = groupLocations.some(loc => recommendations[loc.id]?.length > 0)

                if (isGrouped) {
                  // Render grouped locations
                  return (
                    <Card key={groupKey} className="border-l-4 border-l-blue-500">
                      <Collapsible>
                        <CollapsibleTrigger asChild>
                          <CardHeader className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg">
                                  <MapPin className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                  <h3 className="text-lg font-semibold">{firstLocation.location}</h3>
                                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                    {firstLocation.city && <Badge variant="secondary">{firstLocation.city}</Badge>}
                                    {firstLocation.country && <Badge variant="outline">{firstLocation.country}</Badge>}
                                    <span>• {groupLocations.length} días</span>
                                    {allGenerating && <Badge variant="secondary" className="animate-pulse">Generando...</Badge>}
                                    {hasRecommendations && <Badge variant="secondary" className="bg-green-100 text-green-800">✓ Con recomendaciones</Badge>}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {formatDateShort(groupLocations[0].date)} - {formatDateShort(groupLocations[groupLocations.length - 1].date)}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    toggleGroupExpansion(groupKey)
                                  }}
                                  className="text-xs"
                                >
                                  {groupLocations.every(loc => expandedLocations.has(loc.id)) ? 'Colapsar Todo' : 'Expandir Todo'}
                                </Button>
                                {canEdit && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      groupLocations.forEach(loc => generateRecommendations(loc))
                                    }}
                                    disabled={allGenerating}
                                  >
                                    {allGenerating ? (
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                      <Sparkles className="h-4 w-4 mr-2" />
                                    )}
                                    Generar Todas
                                  </Button>
                                )}
                                <ChevronDown className="h-4 w-4" />
                              </div>
                            </div>
                          </CardHeader>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="px-6 pb-6 space-y-4">
                            {groupLocations.map((location, index) => (
                              <div key={location.id} className="border rounded-lg bg-gray-50 dark:bg-gray-800/50">
                                <Collapsible open={expandedLocations.has(location.id)} onOpenChange={() => toggleLocationExpansion(location.id)}>
                                  <CollapsibleTrigger asChild>
                                    <div className="p-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-t-lg">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <Calendar className="h-4 w-4 text-gray-500" />
                                          <span className="font-medium">Día {index + 1}</span>
                                          <span className="text-sm text-gray-600">{formatDate(location.date)}</span>
                                          {generatingRecommendations.has(location.id) && (
                                            <Badge variant="secondary" className="animate-pulse">
                                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                              Generando...
                                            </Badge>
                                          )}
                                          {recommendations[location.id]?.length > 0 && (
                                            <Badge variant="secondary" className="bg-green-100 text-green-800">
                                              ✓ {recommendations[location.id].length} recomendaciones
                                            </Badge>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                          {canEdit && (
                                            <>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  setEditingLocation(editingLocation === location.id ? null : location.id)
                                                }}
                                              >
                                                <Edit className="h-3 w-3" />
                                              </Button>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  deleteLocation(location.id)
                                                }}
                                              >
                                                <Trash2 className="h-3 w-3 text-red-600" />
                                              </Button>
                                            </>
                                          )}
                                          <ChevronDown className="h-4 w-4 text-gray-400" />
                                        </div>
                                      </div>
                                    </div>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent>
                                    <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-600">
                                      {renderLocationContent(location)}
                                    </div>
                                  </CollapsibleContent>
                                </Collapsible>
                              </div>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </Card>
                  )
                } else {
                  // Render single location
                  const location = groupLocations[0]
                  return (
                    <Card key={location.id} className="border-l-4 border-l-purple-500">
                      <Collapsible open={expandedLocations.has(location.id)} onOpenChange={() => toggleLocationExpansion(location.id)}>
                        <CollapsibleTrigger asChild>
                          <CardHeader className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-lg">
                                  <Calendar className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                </div>
                                <div>
                                  <h3 className="text-lg font-semibold">{formatDate(location.date)}</h3>
                                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                    <MapPin className="h-3 w-3" />
                                    <span>{location.location}</span>
                                    {location.city && <Badge variant="secondary">{location.city}</Badge>}
                                    {location.country && <Badge variant="outline">{location.country}</Badge>}
                                    {generatingRecommendations.has(location.id) && <Badge variant="secondary" className="animate-pulse">Generando...</Badge>}
                                    {recommendations[location.id]?.length > 0 && <Badge variant="secondary" className="bg-green-100 text-green-800">✓ Recomendaciones</Badge>}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {canEdit && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setEditingLocation(editingLocation === location.id ? null : location.id)
                                    }}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                )}
                                <ChevronDown className="h-4 w-4" />
                              </div>
                            </div>
                          </CardHeader>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <CardContent>
                            {renderLocationContent(location)}
                          </CardContent>
                        </CollapsibleContent>
                      </Collapsible>
                    </Card>
                  )
                }
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
 