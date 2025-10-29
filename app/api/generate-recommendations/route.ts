import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { supabase } from '@/lib/supabase'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface RecommendationRequest {
  tripId: string
  segmentId: string
  location: string
  city?: string | null
  country?: string | null
  startDay: number
  endDay: number
  notes?: string | null
  tripTitle: string
  startDate: string
  endDate: string
}

interface AIRecommendation {
  category: string
  title: string
  description: string
  address?: string
  rating?: number
  price_level?: number
  opening_hours?: string
  website?: string
  phone?: string
  recommendation_reason: string
  best_time?: string
  estimated_duration?: string
}

interface DayRecommendations {
  dayNumber: number
  date: string
  recommendations: AIRecommendation[]
}

export async function POST(request: NextRequest) {
  try {
    const {
      tripId,
      segmentId,
      location,
      city,
      country,
      startDay,
      endDay,
      notes,
      tripTitle,
      startDate,
    }: RecommendationRequest = await request.json()

    console.log('🚀 Generating recommendations for segment:', { segmentId, location, startDay, endDay })

    // Validate required fields
    if (!tripId || !segmentId || !location) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    // Build the location context
    const locationContext = [
      location,
      city && city,
      country,
    ].filter(Boolean).join(', ')

    // Get trip locations for this segment
    const { data: tripLocations, error: locationsError } = await supabase
      .from('trip_locations')
      .select('id, date')
      .eq('trip_id', tripId)
      .gte('date', new Date(startDate).toISOString().split('T')[0])
      .order('date', { ascending: true })

    if (locationsError) {
      console.error('Error fetching trip locations:', locationsError)
      throw locationsError
    }

    if (!tripLocations || tripLocations.length === 0) {
      return NextResponse.json(
        { error: 'No trip locations found for this segment' },
        { status: 404 }
      )
    }

    // Filter locations for this segment
    const segmentLocations = tripLocations.slice(startDay - 1, endDay)
    console.log('📍 Segment locations:', segmentLocations.length)

    // Get ALL existing recommendations for the entire trip to avoid repetition
    const { data: existingRecs } = await supabase
      .from('ai_recommendations')
      .select('title, category, trip_location_id')
      .in('trip_location_id', tripLocations.map(l => l.id))

    const existingByCategory = new Map<string, Set<string>>()
    const existingTitles: string[] = []
    
    if (existingRecs) {
      existingRecs.forEach(rec => {
        existingTitles.push(rec.title)
        if (!existingByCategory.has(rec.category)) {
          existingByCategory.set(rec.category, new Set())
        }
        existingByCategory.get(rec.category)?.add(rec.title)
      })
    }
    
    console.log('🔍 Existing recommendations:', existingTitles.length)
    console.log('📊 By category:', Object.fromEntries(
      Array.from(existingByCategory.entries()).map(([k, v]) => [k, v.size])
    ))

    // Get the month and season for context
    const tripStartDate = new Date(startDate)
    const month = tripStartDate.getMonth() + 1
    const season = month >= 3 && month <= 5 ? 'primavera' :
                   month >= 6 && month <= 8 ? 'verano' :
                   month >= 9 && month <= 11 ? 'otoño' : 'invierno'

    const numberOfDays = endDay - startDay + 1

    // Build detailed forbidden list by category
    let forbiddenSection = ''
    if (existingTitles.length > 0) {
      forbiddenSection = '\n🚫 LUGARES ABSOLUTAMENTE PROHIBIDOS - NO REPETIR BAJO NINGUNA CIRCUNSTANCIA:\n'
      
      if (existingByCategory.size > 0) {
        existingByCategory.forEach((titles, category) => {
          const categoryName = category === 'restaurants' ? 'Restaurantes' :
                              category === 'attractions' ? 'Atracciones' :
                              category === 'activities' ? 'Actividades' :
                              category === 'museums' ? 'Museos' :
                              category === 'nightlife' ? 'Vida Nocturna' : 'Compras'
          forbiddenSection += `\n${categoryName}: ${Array.from(titles).join(' | ')}`
        })
      } else {
        forbiddenSection += existingTitles.join(' | ')
      }
      
      forbiddenSection += '\n\n⚠️ IMPORTANTE: Cada recomendación debe ser un lugar COMPLETAMENTE DIFERENTE. Si no conoces suficientes lugares distintos, inventa nombres realistas pero asegúrate de que sean únicos.\n'
    }

    // Build an improved prompt
    const prompt = `
Eres un experto planificador de viajes con conocimiento profundo de ${locationContext}. Tu tarea es crear un itinerario completo y realista para ${numberOfDays} ${numberOfDays === 1 ? 'día' : 'días'}.

🗺️ CONTEXTO DEL VIAJE:
- Destino: ${locationContext}
- Período: Días ${startDay} a ${endDay} del viaje "${tripTitle}"
- Fecha de inicio: ${startDate}
- Temporada: ${season}
- Duración del segmento: ${numberOfDays} ${numberOfDays === 1 ? 'día' : 'días'}
${notes ? `- Notas especiales: ${notes}` : ''}
${forbiddenSection}

📋 INSTRUCCIONES:
Genera ${numberOfDays === 1 ? 'UN conjunto completo' : `${numberOfDays} conjuntos completos`} de recomendaciones, uno para cada día. Cada conjunto debe incluir:

- 4 restaurantes (desayuno, almuerzo, cena, y una opción especial)
- 3 atracciones principales (monumentos, lugares icónicos)
- 3 actividades (experiencias, tours, deportes)
- 2 museos o galerías
- 2 opciones de vida nocturna (bares, clubs, espectáculos)
- 2 lugares de compras (mercados, tiendas especiales)

TOTAL: 16 recomendaciones únicas por día

🎯 REQUISITOS IMPORTANTES:
1. Distribución geográfica inteligente - agrupa lugares cercanos para optimizar desplazamientos
2. Horarios realistas - considera tiempos de apertura/cierre
3. Variedad de precios - mezcla opciones económicas, moderadas y premium
4. Experiencias auténticas - prioriza lugares locales sobre cadenas internacionales
5. Temporada y clima - adapta las recomendaciones al ${season}
6. CERO repeticiones - cada lugar debe ser completamente diferente

📝 FORMATO REQUERIDO (JSON):
Para CADA recomendación incluye:
- category: "restaurants", "attractions", "activities", "museums", "nightlife", o "shopping"
- title: Nombre real y completo del establecimiento
- description: Descripción atractiva (70-100 caracteres)
- address: Dirección completa y real
- rating: Calificación realista (3.5-5.0)
- price_level: 1=€, 2=€€, 3=€€€, 4=€€€€
- opening_hours: Horario específico (ej: "Lun-Vie 9:00-22:00")
- website: URL real si existe
- phone: Número de teléfono local
- recommendation_reason: Por qué es perfecto para este viaje (40-60 caracteres)
- best_time: Mejor momento para visitar (ej: "Mañana", "Tarde", "Noche")
- estimated_duration: Tiempo estimado (ej: "1-2 horas", "Toda la tarde")

🌤️ NOTA ESTACIONAL:
Incluye una nota sobre el clima y recomendaciones especiales para ${season} en ${locationContext}.

Responde ÚNICAMENTE con JSON válido en este formato:
{
  "recommendations": [
    {
      "category": "restaurants",
      "title": "Nombre del restaurante",
      "description": "Cocina local auténtica con vistas panorámicas",
      "address": "Calle Real 123, Ciudad",
      "rating": 4.5,
      "price_level": 2,
      "opening_hours": "Lun-Dom 12:00-23:00",
      "website": "https://...",
      "phone": "+34...",
      "recommendation_reason": "Ideal para almuerzo con menú local",
      "best_time": "Mediodía",
      "estimated_duration": "1.5-2 horas"
    }
  ],
  "seasonal_note": "En ${season}, ${locationContext} tiene..."
}
`

    console.log('🤖 Calling OpenAI...')

    // Generate recommendations with OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Eres un experto guía turístico local de ${locationContext} con 20 años de experiencia. Conoces CIENTOS de restaurantes, museos, atracciones y rincones secretos diferentes. Tu especialidad es crear itinerarios perfectamente equilibrados que combinan lugares icónicos con joyas escondidas.

REGLA CRÍTICA: NUNCA, BAJO NINGUNA CIRCUNSTANCIA, repitas un lugar que ya ha sido recomendado. Si recibes una lista de lugares prohibidos, es OBLIGATORIO que cada recomendación sea un establecimiento COMPLETAMENTE DIFERENTE. Prefieres recomendar lugares menos conocidos antes que repetir uno ya mencionado.

Tienes acceso a un catálogo mental extenso de alternativas para cada tipo de lugar. Por ejemplo:
- Para restaurantes: conoces desde los más famosos hasta bistros locales escondidos
- Para atracciones: desde monumentos icónicos hasta parques y miradores menos conocidos
- Para museos: desde los grandes museos hasta galerías pequeñas y espacios culturales
- Para vida nocturna: desde clubs famosos hasta bares de barrio auténticos
- Para compras: desde grandes tiendas hasta mercados locales y boutiques únicas
- Para actividades: desde tours populares hasta experiencias locales auténticas`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.9,
      max_tokens: 8000,
    })

    const responseText = completion.choices[0]?.message?.content
    if (!responseText) {
      throw new Error('No response from OpenAI')
    }

    console.log('📥 OpenAI response received')

    // Parse the JSON response
    let parsedResponse: { recommendations: AIRecommendation[], seasonal_note?: string }
    try {
      let cleanedResponse = responseText.trim()
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '')
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '')
      }
      
      parsedResponse = JSON.parse(cleanedResponse)
    } catch (parseError) {
      console.error('❌ Error parsing OpenAI response:', parseError)
      console.error('Raw response:', responseText)
      throw new Error('Invalid JSON response from AI')
    }

    if (!parsedResponse.recommendations || !Array.isArray(parsedResponse.recommendations)) {
      throw new Error('Invalid response format from AI')
    }

    console.log('✅ Generated', parsedResponse.recommendations.length, 'recommendations')

    // Verify no duplicates with existing recommendations
    const newTitles = parsedResponse.recommendations.map(rec => rec.title)
    const duplicates = newTitles.filter(title => 
      existingTitles.some(existing => 
        existing.toLowerCase().trim() === title.toLowerCase().trim()
      )
    )
    
    if (duplicates.length > 0) {
      console.error('❌ AI GENERATED DUPLICATES:', duplicates)
      console.error('This should not happen. The AI was explicitly told to avoid these places.')
      
      // Filter out duplicates (case-insensitive)
      parsedResponse.recommendations = parsedResponse.recommendations.filter(
        rec => !existingTitles.some(existing => 
          existing.toLowerCase().trim() === rec.title.toLowerCase().trim()
        )
      )
      
      console.log('🔄 After filtering:', parsedResponse.recommendations.length, 'recommendations remain')
      
      // If we have too few recommendations after filtering, we need to regenerate
      const minRecommendations = numberOfDays * 10 // At least 10 per day
      if (parsedResponse.recommendations.length < minRecommendations) {
        throw new Error(
          `AI generated too many duplicates (${duplicates.length}). ` +
          `Only ${parsedResponse.recommendations.length} unique recommendations remain, ` +
          `but we need at least ${minRecommendations}. Please try again.`
        )
      }
    }
    
    // Check for internal duplicates (within the new recommendations)
    const titleCounts = new Map<string, number>()
    newTitles.forEach(title => {
      const normalized = title.toLowerCase().trim()
      titleCounts.set(normalized, (titleCounts.get(normalized) || 0) + 1)
    })
    
    const internalDuplicates = Array.from(titleCounts.entries())
      .filter(([_, count]) => count > 1)
      .map(([title]) => title)
    
    if (internalDuplicates.length > 0) {
      console.error('❌ AI GENERATED INTERNAL DUPLICATES:', internalDuplicates)
      
      // Remove internal duplicates, keeping only the first occurrence
      const seen = new Set<string>()
      parsedResponse.recommendations = parsedResponse.recommendations.filter(rec => {
        const normalized = rec.title.toLowerCase().trim()
        if (seen.has(normalized)) {
          return false
        }
        seen.add(normalized)
        return true
      })
      
      console.log('🔄 After removing internal duplicates:', parsedResponse.recommendations.length)
    }

    // Delete existing recommendations for this segment
    const segmentLocationIds = segmentLocations.map(l => l.id)
    const { error: deleteError } = await supabase
      .from('ai_recommendations')
      .delete()
      .in('trip_location_id', segmentLocationIds)

    if (deleteError) {
      console.error('Error deleting existing recommendations:', deleteError)
    }

    // Distribute recommendations across days in the segment
    const recsPerDay = Math.ceil(parsedResponse.recommendations.length / segmentLocations.length)
    const allSavedRecommendations: any[] = []

    for (let i = 0; i < segmentLocations.length; i++) {
      const dayLocation = segmentLocations[i]
      const startIdx = i * recsPerDay
      const endIdx = Math.min(startIdx + recsPerDay, parsedResponse.recommendations.length)
      const dayRecommendations = parsedResponse.recommendations.slice(startIdx, endIdx)

      if (dayRecommendations.length === 0) continue

      const recommendationsToInsert = dayRecommendations.map(rec => ({
        trip_location_id: dayLocation.id,
        category: rec.category,
        title: rec.title,
        description: rec.description || null,
        address: rec.address || null,
        rating: rec.rating || null,
        price_level: rec.price_level || null,
        opening_hours: rec.opening_hours || null,
        website: rec.website || null,
        phone: rec.phone || null,
        recommendation_reason: rec.recommendation_reason || null,
        ai_generated: true,
      }))

      const { data: savedRecs, error: insertError } = await supabase
        .from('ai_recommendations')
        .insert(recommendationsToInsert)
        .select('*')

      if (insertError) {
        console.error(`Error saving recommendations for day ${i + 1}:`, insertError)
      } else {
        allSavedRecommendations.push(...(savedRecs || []))
      }
    }

    console.log('💾 Saved', allSavedRecommendations.length, 'recommendations to database')

    return NextResponse.json({
      success: true,
      recommendations: allSavedRecommendations,
      seasonal_note: parsedResponse.seasonal_note,
      message: `Generated ${allSavedRecommendations.length} recommendations for ${numberOfDays} day(s)`,
      stats: {
        totalGenerated: parsedResponse.recommendations.length,
        duplicatesRemoved: duplicates.length,
        saved: allSavedRecommendations.length,
        daysProcessed: segmentLocations.length
      }
    })

  } catch (error) {
    console.error('❌ Error in generate-recommendations API:', error)
    
    return NextResponse.json(
      {
        error: 'Failed to generate recommendations',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
