"use client"

import { useState, useEffect } from "react"
import Joyride, { CallBackProps, STATUS, Step } from "react-joyride"
import { useAuth } from "@/components/auth-provider"
import { supabase } from "@/lib/supabase"

export type TutorialType = 
  | "dashboard" 
  | "create_trip" 
  | "trip_management" 
  | "ai" 
  | "collaboration"
  | "summary"

interface TutorialSystemProps {
  type: TutorialType
  onComplete?: () => void
  trigger?: boolean // Para activar manualmente el tutorial
  autoStart?: boolean // Para activar automáticamente en primera visita
}

const tutorialSteps: Record<TutorialType, Step[]> = {
  dashboard: [
    {
      target: '[data-tutorial="welcome"]',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">¡Bienvenido a Trip Planner! 🎉</h3>
          <p>Te voy a mostrar cómo usar la aplicación para planificar tus viajes perfectos.</p>
        </div>
      ),
      placement: "center",
      disableBeacon: true,
    },
    {
      target: '[data-tutorial="create-trip"]',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">Crear tu primer viaje ✈️</h3>
          <p>Haz clic aquí para crear un nuevo viaje. Podrás agregar destino, fechas y presupuesto.</p>
        </div>
      ),
      placement: "bottom",
    },
    {
      target: '[data-tutorial="trips-list"]',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">Tus viajes 📋</h3>
          <p>Aquí aparecerán todos tus viajes. Podrás ver el destino, fechas, presupuesto y tu rol en cada viaje.</p>
        </div>
      ),
      placement: "top",
    },
    {
      target: '[data-tutorial="pending-invitations"]',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">Invitaciones pendientes 📬</h3>
          <p>Cuando otros usuarios te inviten a sus viajes, las invitaciones aparecerán aquí. Podrás aceptarlas o rechazarlas.</p>
        </div>
      ),
      placement: "top",
    },
    {
      target: '[data-tutorial="profile"]',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">Tu perfil 👤</h3>
          <p>Haz clic en tu avatar para acceder a tu perfil y configurar tu información personal.</p>
        </div>
      ),
      placement: "bottom-start",
    },
  ],

  create_trip: [
    {
      target: '[data-tutorial="trip-form"]',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">Formulario de viaje ✈️</h3>
          <p>Completa la información básica de tu viaje: título, destino, fechas y presupuesto.</p>
        </div>
      ),
      placement: "right",
      disableBeacon: true,
    },
    {
      target: '[data-tutorial="trip-title"]',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">Título del viaje 📝</h3>
          <p>Dale un nombre descriptivo a tu viaje. Por ejemplo: &ldquo;Vacaciones en París&rdquo; o &ldquo;Aventura en Patagonia&rdquo;.</p>
        </div>
      ),
      placement: "bottom",
    },
    {
      target: '[data-tutorial="trip-destination"]',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">Destino 🌍</h3>
          <p>Especifica el destino principal de tu viaje. Puedes ser específico como &ldquo;París, Francia&rdquo; o general como &ldquo;Europa&rdquo;.</p>
        </div>
      ),
      placement: "bottom",
    },
    {
      target: '[data-tutorial="trip-dates"]',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">Fechas del viaje 📅</h3>
          <p>Selecciona las fechas de inicio y fin de tu viaje. Esto te ayudar&aacute; a planificar mejor tus actividades.</p>
        </div>
      ),
      placement: "bottom",
    },
    {
      target: '[data-tutorial="trip-budget"]',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">Presupuesto 💰</h3>
          <p>Define tu presupuesto total para el viaje. Esto te ayudar&aacute; a controlar tus gastos y planificar mejor.</p>
        </div>
      ),
      placement: "bottom",
    },
    {
      target: '[data-tutorial="create-button"]',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">¡Crear tu viaje! 🚀</h3>
          <p>Una vez completado el formulario, haz clic aquí para crear tu viaje y comenzar a planificar.</p>
        </div>
      ),
      placement: "top",
    },
  ],

  trip_management: [
    {
      target: '[data-tutorial="trip-header"]',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">¡Bienvenido a tu viaje! ✈️</h3>
          <p>Esta es la página principal de tu viaje. Aquí puedes ver toda la información: destino, fechas, presupuesto y estadísticas.</p>
        </div>
      ),
      placement: "bottom",
      disableBeacon: true,
    },
    {
      target: '[data-tutorial="trip-tabs"]',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">Pestañas principales 🗂️</h3>
          <p>Estas son las funciones principales para gestionar tu viaje:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li><strong>Planificación:</strong> Agrega vuelos, hoteles, actividades</li>
            <li><strong>Itinerario:</strong> Cronograma día a día</li>
            <li><strong>Gastos:</strong> Control de presupuesto y gastos</li>
          </ul>
        </div>
      ),
      placement: "bottom",
    },
    {
      target: '[data-tutorial="planning-tab"]',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">Pestaña Planificación 📝</h3>
          <p>Aquí puedes agregar y organizar todos los elementos de tu viaje:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Vuelos y transportes</li>
            <li>Hoteles y alojamientos</li>
            <li>Actividades y tours</li>
            <li>Restaurantes y comidas</li>
          </ul>
        </div>
      ),
      placement: "bottom",
    },
    {
      target: '[data-tutorial="itinerary-tab"]',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">Pestaña Itinerario 📅</h3>
          <p>Ve tu viaje organizado día por día con:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Cronograma detallado</li>
            <li>Actividades por día</li>
            <li>Horarios y ubicaciones</li>
          </ul>
        </div>
      ),
      placement: "bottom",
    },
    {
      target: '[data-tutorial="expenses-tab"]',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">Pestaña Gastos 💰</h3>
          <p>Controla tu presupuesto con:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Registro de todos los gastos</li>
            <li>Categorías organizadas</li>
            <li>Seguimiento del presupuesto</li>
            <li>Reportes y estadísticas</li>
          </ul>
        </div>
      ),
      placement: "bottom",
    },
    {
      target: '[data-tutorial="advanced-tools"]',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">Herramientas avanzadas 🛠️</h3>
          <p>Estas herramientas especiales te ayudarán a planificar mejor:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li><strong>IA:</strong> Recomendaciones personalizadas</li>
            <li><strong>Resumen:</strong> Estadísticas y análisis</li>
            <li><strong>Colaboradores:</strong> Invita amigos y familia</li>
          </ul>
        </div>
      ),
      placement: "top",
    },
    {
      target: '[data-tutorial="ai-card"]',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">Recomendaciones con IA 🤖</h3>
          <p>¡La joya de la corona! Obtén recomendaciones personalizadas de:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Restaurantes locales</li>
            <li>Atracciones turísticas</li>
            <li>Actividades únicas</li>
            <li>Vida nocturna</li>
            <li>Lugares de compras</li>
          </ul>
          <p className="mt-2 font-medium">¡Haz clic para probarlo!</p>
        </div>
      ),
      placement: "top",
    },
    {
      target: '[data-tutorial="summary-card"]',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">Resumen del viaje 📊</h3>
          <p>Ve estadísticas completas de tu viaje:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Gastos por categoría</li>
            <li>Actividades planificadas</li>
            <li>Progreso del presupuesto</li>
            <li>Análisis de costos</li>
          </ul>
        </div>
      ),
      placement: "top",
    },
    {
      target: '[data-tutorial="collaboration-card"]',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">Colaboración 👥</h3>
          <p>¡Planifica en equipo! Invita a otros para que:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Vean el viaje (Visualizadores)</li>
            <li>Agreguen actividades (Editores)</li>
            <li>Colaboren en la planificación</li>
          </ul>
          <p className="mt-2 font-medium">¡Perfecto para viajes en grupo!</p>
        </div>
      ),
      placement: "top",
    },
  ],

  ai: [
    {
      target: '[data-tutorial="ai-header"]',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">Recomendaciones con IA 🤖</h3>
          <p>¡Bienvenido a la herramienta más poderosa! Nuestra IA te ayudará a descubrir los mejores lugares y actividades para tu viaje.</p>
        </div>
      ),
      placement: "bottom",
      disableBeacon: true,
    },
    {
      target: '[data-tutorial="location-form"]',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">Generar por rango de fechas 📅</h3>
          <p>Haz clic aquí para generar recomendaciones para un rango completo de fechas. Solo necesitas:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Fecha de inicio y fin</li>
            <li>Ubicación base (ciudad o región)</li>
            <li>Tus preferencias (opcional)</li>
          </ul>
          <p className="mt-2 font-medium">¡Es la forma más rápida de obtener recomendaciones!</p>
        </div>
      ),
      placement: "bottom",
    },
    {
      target: '[data-tutorial="generate-recommendations"]',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">Generar recomendaciones ✨</h3>
          <p>Una vez completado el formulario, haz clic aquí para que la IA genere recomendaciones personalizadas para todos los días de tu viaje.</p>
          <p className="mt-2 text-sm text-gray-600">La IA considerará tus fechas, ubicación y preferencias para crear sugerencias únicas.</p>
        </div>
      ),
      placement: "top",
    },
    {
      target: '[data-tutorial="recommendation-tabs"]',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">Explora por categorías 🏷️</h3>
          <p>Las recomendaciones se organizan en pestañas por tipo:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li><strong>Restaurantes:</strong> Lugares para comer y cenar</li>
            <li><strong>Atracciones:</strong> Sitios turísticos imperdibles</li>
            <li><strong>Actividades:</strong> Experiencias y tours</li>
            <li><strong>Museos:</strong> Cultura e historia</li>
            <li><strong>Vida nocturna:</strong> Bares y entretenimiento</li>
            <li><strong>Compras:</strong> Tiendas y mercados</li>
          </ul>
          <p className="mt-2 font-medium">¡Cada recomendación incluye detalles, horarios y razones de por qué te la sugerimos!</p>
        </div>
      ),
      placement: "top",
    },
  ],

  collaboration: [
    {
      target: '[data-tutorial="collaboration-header"]',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">Colaboración en viajes 👥</h3>
          <p>Invita a amigos y familiares para planificar el viaje juntos.</p>
        </div>
      ),
      placement: "bottom",
      disableBeacon: true,
    },
    {
      target: '[data-tutorial="invite-form"]',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">Invitar colaboradores ✉️</h3>
          <p>Ingresa el email de la persona que quieres invitar y selecciona su rol en el viaje.</p>
        </div>
      ),
      placement: "right",
    },
    {
      target: '[data-tutorial="member-roles"]',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">Roles de colaboradores 🎭</h3>
          <p>Existen diferentes roles:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li><strong>Propietario:</strong> Control total del viaje</li>
            <li><strong>Editor:</strong> Puede modificar el viaje</li>
            <li><strong>Visualizador:</strong> Solo puede ver el viaje</li>
          </ul>
        </div>
      ),
      placement: "top",
    },
    {
      target: '[data-tutorial="members-list"]',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">Lista de miembros 📋</h3>
          <p>Aquí puedes ver todos los miembros del viaje, sus roles y el estado de sus invitaciones.</p>
        </div>
      ),
      placement: "top",
    },
  ],

  summary: [
    {
      target: '[data-tutorial="summary-header"]',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">Resumen del viaje 📊</h3>
          <p>¡Bienvenido al resumen! Aquí puedes ver un análisis completo de todos los costos y gastos de tu viaje.</p>
        </div>
      ),
      placement: "bottom",
      disableBeacon: true,
    },
    {
      target: '[data-tutorial="cost-chart"]',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">Gráfico de distribución 🥧</h3>
          <p>Este gráfico circular te muestra cómo se distribuyen tus gastos por categoría:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Cada color representa una categoría diferente</li>
            <li>El tamaño de cada sección indica el porcentaje del gasto</li>
            <li>Puedes ver los porcentajes exactos en las etiquetas</li>
          </ul>
        </div>
      ),
      placement: "right",
    },
    {
      target: '[data-tutorial="total-cost"]',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">Costo total 💰</h3>
          <p>Aquí se muestra el costo total planificado para tu viaje, sumando:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Costos estimados de actividades</li>
            <li>Gastos reales registrados</li>
            <li>Todas las categorías combinadas</li>
          </ul>
        </div>
      ),
      placement: "left",
    },
    {
      target: '[data-tutorial="category-breakdown"]',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">Desglose por categoría 📋</h3>
          <p>Esta lista detalla cada categoría de gasto:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Cada categoría tiene su color distintivo</li>
            <li>Se muestra el monto exacto por categoría</li>
            <li>Ordenadas de mayor a menor gasto</li>
          </ul>
          <p className="mt-2 font-medium">¡Perfecto para identificar dónde gastas más!</p>
        </div>
      ),
      placement: "left",
    },
  ],
}

export function TutorialSystem({ type, onComplete, trigger, autoStart = false }: TutorialSystemProps) {
  const { user } = useAuth()
  const [run, setRun] = useState(false)
  const [tutorialCompleted, setTutorialCompleted] = useState(true)

  const getFieldName = (type: TutorialType): string => {
    return `${type}_tutorial_completed`
  }

  // Check if user has completed this specific tutorial
  useEffect(() => {
    const checkTutorialStatus = async () => {
      if (!user) return

      try {
        const fieldName = getFieldName(type)
        const { data, error } = await supabase
          .from("profiles")
          .select(fieldName)
          .eq("id", user.id)
          .single()

        if (error) {
          console.error(`Error checking ${type} tutorial status:`, error)
          return
        }

        const completed = (data as unknown as Record<string, unknown>)?.[fieldName] as boolean ?? false
        setTutorialCompleted(completed)
        
        // Debug logging
        console.log(`🎯 Tutorial ${type}:`, {
          completed,
          trigger,
          autoStart,
          fieldName,
          data: (data as unknown as Record<string, unknown>)?.[fieldName] as boolean
        })
        
        // Start tutorial if not completed
        const shouldAutoStart = trigger || autoStart
        
        if (!completed && shouldAutoStart) {
          console.log(`🚀 Starting tutorial ${type}`)
          setTimeout(() => {
            setRun(true)
          }, 1500) // Increased delay to ensure DOM is ready
        }
      } catch (error) {
        console.error(`Error in checkTutorialStatus for ${type}:`, error)
      }
    }

    checkTutorialStatus()
  }, [user, type, trigger, autoStart])

  // Handle manual trigger
  useEffect(() => {
    if (trigger && !tutorialCompleted) {
      setRun(true)
    }
  }, [trigger, tutorialCompleted])

  const handleJoyrideCallback = async (data: CallBackProps) => {
    const { status } = data

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRun(false)
      
      // Mark tutorial as completed in database
      if (user) {
        try {
          const fieldName = getFieldName(type)
          const { error } = await supabase
            .from("profiles")
            .update({ [fieldName]: true })
            .eq("id", user.id)

          if (error) {
            console.error(`Error updating ${type} tutorial status:`, error)
          } else {
            setTutorialCompleted(true)
            onComplete?.()
          }
        } catch (error) {
          console.error(`Error in handleJoyrideCallback for ${type}:`, error)
        }
      }
    }
  }

  // Don't render if tutorial is completed and not manually triggered
  if (!user || (tutorialCompleted && !trigger)) {
    return null
  }

  return (
    <Joyride
      steps={tutorialSteps[type]}
      run={run}
      continuous
      showProgress
      showSkipButton
      callback={handleJoyrideCallback}
      styles={{
        options: {
          primaryColor: "#2563eb",
          textColor: "#374151",
          backgroundColor: "#ffffff",
          overlayColor: "rgba(0, 0, 0, 0.4)",
          arrowColor: "#ffffff",
          zIndex: 10000,
        },
        tooltip: {
          borderRadius: 8,
          fontSize: 14,
        },
        tooltipContainer: {
          textAlign: "left",
        },
        tooltipTitle: {
          fontSize: 16,
          fontWeight: 600,
        },
        buttonNext: {
          backgroundColor: "#2563eb",
          borderRadius: 6,
          fontSize: 14,
          fontWeight: 500,
          padding: "8px 16px",
        },
        buttonBack: {
          color: "#6b7280",
          fontSize: 14,
          fontWeight: 500,
          marginRight: 8,
        },
        buttonSkip: {
          color: "#6b7280",
          fontSize: 14,
          fontWeight: 500,
        },
        buttonClose: {
          height: 14,
          width: 14,
          right: 8,
          top: 8,
        },
      }}
      locale={{
        back: "Anterior",
        close: "Cerrar",
        last: "Finalizar",
        next: "Siguiente",
        skip: "Saltar tutorial",
      }}
    />
  )
}

// Hook para activar tutoriales manualmente
export function useTutorial() {
  const [activeTutorial, setActiveTutorial] = useState<TutorialType | null>(null)
  const [triggerTutorial, setTriggerTutorial] = useState(false)

  const startTutorial = (type: TutorialType) => {
    setActiveTutorial(type)
    setTriggerTutorial(true)
  }

  const completeTutorial = () => {
    setActiveTutorial(null)
    setTriggerTutorial(false)
  }

  return {
    activeTutorial,
    triggerTutorial,
    startTutorial,
    completeTutorial,
  }
} 