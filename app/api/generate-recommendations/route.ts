import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { supabase } from '@/lib/supabase'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface RecommendationRequest {
  tripLocationId: string
  location: string
  city?: string | null
  country?: string | null
  tripTitle: string
  date: string
  notes?: string | null
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
}

export async function POST(request: NextRequest) {
  try {
    const {
      tripLocationId,
      location,
      city,
      country,
      tripTitle,
      date,
      notes
    }: RecommendationRequest = await request.json()

    // Validate required fields
    if (!tripLocationId || !location) {
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
      city && `en ${city}`,
      country && `${country}`,
    ].filter(Boolean).join(', ')

    // Get existing recommendations for this trip to avoid repetition
    // First, get the trip_id for this location
    const { data: currentLocation } = await supabase
      .from('trip_locations')
      .select('trip_id')
      .eq('id', tripLocationId)
      .single()

    let existingRecs: { title: string; category: string }[] = []
    if (currentLocation?.trip_id) {
      // Get all location IDs for this trip
      const { data: tripLocations } = await supabase
        .from('trip_locations')
        .select('id')
        .eq('trip_id', currentLocation.trip_id)

      if (tripLocations && tripLocations.length > 0) {
        const locationIds = tripLocations.map(loc => loc.id)
        
        // Get existing recommendations for all locations in this trip
        const { data: recs } = await supabase
          .from('ai_recommendations')
          .select('title, category')
          .in('trip_location_id', locationIds)
        
        existingRecs = recs || []
      }
    }

    const existingTitles = existingRecs.map(rec => rec.title) || []

    // Analyze the date for seasonal context
    const targetDate = new Date(date)
    const month = targetDate.getMonth() + 1 // 1-12
    const season = month >= 3 && month <= 5 ? 'primavera' :
                   month >= 6 && month <= 8 ? 'verano' :
                   month >= 9 && month <= 11 ? 'otoño' : 'invierno'
    
    const dayOfWeek = targetDate.toLocaleDateString('es-ES', { weekday: 'long' })

    // Build the prompt
    const prompt = `
Actúa como un experto guía turístico local con conocimiento actualizado. Necesito recomendaciones únicas y específicas para un día de viaje.

CONTEXTO ESPECÍFICO:
- Título del viaje: ${tripTitle}
- Fecha exacta: ${date} (${dayOfWeek} en ${season})
- Ubicación: ${locationContext}
- Mes: ${month} (considera clima, temporadas, horarios estacionales)
${notes ? `- Preferencias especiales: ${notes}` : ''}

🚫 PROHIBIDO REPETIR ESTOS LUGARES:
${existingTitles.length > 0 ? `NUNCA recomiendes estos lugares que ya están en otros días: ${existingTitles.join(', ')}. Cada recomendación DEBE ser completamente diferente.` : 'Es el primer día del viaje.'}

Genera exactamente 5 recomendaciones ÚNICAS para CADA categoría:
1. restaurants (restaurantes)
2. attractions (atracciones turísticas)  
3. activities (actividades)
4. museums (museos)
5. nightlife (vida nocturna)
6. shopping (compras)

CONSIDERACIONES IMPORTANTES:
- Fecha ${date}: Verifica si es temporada alta/baja, si hace frío/calor
- ${dayOfWeek}: Considera horarios especiales de fin de semana/días laborables
- ${season}: Recomienda actividades apropiadas para la estación
- Si es invierno, avisa sobre el frío y recomienda lugares cerrados/calefaccionados
- Si es verano, prioriza lugares con aire acondicionado o actividades al aire libre
- Verifica horarios reales (algunos museos cierran lunes, etc.)
- Considera festivales o eventos especiales de la época

Para cada recomendación:
- title: Nombre exacto del lugar
- description: Descripción breve (máximo 80 caracteres)
- address: Dirección específica y real
- rating: Puntuación realista del 1 al 5
- price_level: 1=económico, 2=moderado, 3=caro, 4=muy caro
- opening_hours: Horarios reales para ${dayOfWeek}s en ${season}
- website: URL real si existe
- phone: Teléfono real si lo conoces
- recommendation_reason: Por qué es perfecto para ${date} en ${locationContext}

Responde SOLO con JSON válido:
{
  "recommendations": [
    {
      "category": "restaurants",
      "title": "Nombre real del lugar",
      "description": "Breve descripción",
      "address": "Dirección real",
      "rating": 4.2,
      "price_level": 2,
      "opening_hours": "Horario real para ${dayOfWeek}",
      "website": "URL real o null",
      "phone": "Teléfono real o null",
      "recommendation_reason": "Por qué es ideal para ${date}"
    }
  ],
  "seasonal_note": "Aviso sobre clima/temporada si es relevante"
}
`

    // Generate recommendations with OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Eres un experto guía turístico local con conocimiento detallado de destinos turísticos mundiales. NUNCA repitas lugares que ya han sido recomendados. Tu especialidad es encontrar alternativas únicas y diferentes para cada día del viaje. Siempre respondes con JSON válido y proporciones información precisa y útil.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.9,
      max_tokens: 4000,
    })

    const responseText = completion.choices[0]?.message?.content
    if (!responseText) {
      throw new Error('No response from OpenAI')
    }

    // Parse the JSON response (handle markdown formatting)
    let parsedResponse: { recommendations: AIRecommendation[], seasonal_note?: string }
    try {
      // Remove markdown code blocks if present
      let cleanedResponse = responseText.trim()
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '')
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '')
      }
      
      parsedResponse = JSON.parse(cleanedResponse)
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError)
      console.error('Raw response:', responseText)
      throw new Error('Invalid JSON response from AI')
    }

    if (!parsedResponse.recommendations || !Array.isArray(parsedResponse.recommendations)) {
      throw new Error('Invalid response format from AI')
    }

    // Verify no duplicates with existing recommendations
    const newTitles = parsedResponse.recommendations.map(rec => rec.title)
    const duplicates = newTitles.filter(title => existingTitles.includes(title))
    
    if (duplicates.length > 0) {
      console.warn('AI generated duplicate recommendations:', duplicates)
      // Filter out duplicates
      parsedResponse.recommendations = parsedResponse.recommendations.filter(
        rec => !existingTitles.includes(rec.title)
      )
      
      // If we have too few recommendations after filtering, throw error to retry
      if (parsedResponse.recommendations.length < 10) {
        throw new Error(`AI generated duplicates: ${duplicates.join(', ')}. Retrying...`)
      }
    }

    // Delete existing recommendations for this location
    const { error: deleteError } = await supabase
      .from('ai_recommendations')
      .delete()
      .eq('trip_location_id', tripLocationId)

    if (deleteError) {
      console.error('Error deleting existing recommendations:', deleteError)
    }

    // Save new recommendations to database
    const recommendationsToInsert = parsedResponse.recommendations.map(rec => ({
      trip_location_id: tripLocationId,
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

    const { data: savedRecommendations, error: insertError } = await supabase
      .from('ai_recommendations')
      .insert(recommendationsToInsert)
      .select('*')

    if (insertError) {
      console.error('Error saving recommendations:', insertError)
      throw insertError
    }

    return NextResponse.json({
      success: true,
      recommendations: savedRecommendations,
      seasonal_note: parsedResponse.seasonal_note,
      message: `Generated ${savedRecommendations?.length || 0} recommendations`
    })

  } catch (error) {
    console.error('Error in generate-recommendations API:', error)
    
    return NextResponse.json(
      {
        error: 'Failed to generate recommendations',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
} 