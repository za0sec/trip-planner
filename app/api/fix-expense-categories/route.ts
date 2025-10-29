import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { tripId } = await request.json()

    if (!tripId) {
      return NextResponse.json(
        { error: 'Trip ID is required' },
        { status: 400 }
      )
    }

    console.log('🔧 Fixing expense categories for trip:', tripId)

    // Mapeo de categorías de actividad a categorías de gasto
    const activityToCategoryMap: { [key: string]: string } = {
      flight: 'Vuelos',
      accommodation: 'Alojamiento',
      transport: 'Transporte',
      food: 'Comida',
      activity: 'Actividades',
      shopping: 'Compras',
      other: 'Otros'
    }

    // Obtener todas las actividades del viaje
    const { data: activities, error: activitiesError } = await supabase
      .from('activities')
      .select('id, title, category')
      .eq('trip_id', tripId)

    if (activitiesError) {
      console.error('Error fetching activities:', activitiesError)
      throw activitiesError
    }

    console.log(`📋 Found ${activities?.length || 0} activities`)

    // Obtener todos los gastos sin categoría
    const { data: expenses, error: expensesError } = await supabase
      .from('trip_expenses')
      .select('id, title')
      .eq('trip_id', tripId)
      .is('category_id', null)

    if (expensesError) {
      console.error('Error fetching expenses:', expensesError)
      throw expensesError
    }

    console.log(`💰 Found ${expenses?.length || 0} expenses without category`)

    if (!activities || !expenses || expenses.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No expenses need fixing',
        fixed: 0
      })
    }

    // Obtener todas las categorías
    const { data: categories, error: categoriesError } = await supabase
      .from('categories')
      .select('id, name')

    if (categoriesError) {
      console.error('Error fetching categories:', categoriesError)
      throw categoriesError
    }

    const categoryMap = new Map(categories?.map(c => [c.name, c.id]) || [])
    console.log('📚 Available categories:', Array.from(categoryMap.keys()))

    // Procesar cada gasto
    let fixed = 0
    const updates: Promise<any>[] = []

    for (const expense of expenses) {
      // Buscar la actividad correspondiente
      let matchedActivity = null
      
      // Intentar con "(Planificación)"
      if (expense.title.includes('(Planificación)')) {
        const activityTitle = expense.title.replace(' (Planificación)', '')
        matchedActivity = activities.find(a => a.title === activityTitle)
      }
      
      // Intentar con "(Dividido)"
      if (!matchedActivity && expense.title.includes('(Dividido)')) {
        const activityTitle = expense.title.replace(' (Dividido)', '')
        matchedActivity = activities.find(a => a.title === activityTitle)
      }

      if (matchedActivity && matchedActivity.category) {
        const categoryName = activityToCategoryMap[matchedActivity.category]
        const categoryId = categoryMap.get(categoryName)

        if (categoryId) {
          console.log(`✅ Fixing expense "${expense.title}" → ${categoryName}`)
          
          updates.push(
            supabase
              .from('trip_expenses')
              .update({ category_id: categoryId })
              .eq('id', expense.id)
          )
          
          fixed++
        } else {
          console.warn(`⚠️ Category not found in DB: ${categoryName}`)
        }
      } else {
        console.log(`⏭️ Skipping "${expense.title}" - no matching activity found`)
      }
    }

    // Ejecutar todas las actualizaciones
    await Promise.all(updates)

    console.log(`🎉 Fixed ${fixed} expenses`)

    return NextResponse.json({
      success: true,
      message: `Successfully fixed ${fixed} expense${fixed !== 1 ? 's' : ''}`,
      fixed,
      total: expenses.length
    })

  } catch (error) {
    console.error('❌ Error fixing expense categories:', error)
    
    return NextResponse.json(
      {
        error: 'Failed to fix expense categories',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

