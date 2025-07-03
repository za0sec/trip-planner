"use client"

import { useState, useEffect } from "react"
import Joyride, { CallBackProps, STATUS, Step, EVENTS, ACTIONS } from "react-joyride"
import { useAuth } from "@/components/auth-provider"
import { supabase } from "@/lib/supabase"
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export type TutorialType = 
  | "dashboard" 
  | "create_trip" 
  | "trip_management" 
  | "ai" 
  | "collaboration"
  | "summary"
  | "expense-splitting"

interface TutorialSystemProps {
  type: TutorialType
  autoStart?: boolean
}

interface SpotlightPosition {
  x: number
  y: number
  width: number
  height: number
}

const tutorialSteps: { [key in TutorialType]: Step[] } = {
  dashboard: [
    {
      target: 'body',
      content: (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900">¡Bienvenido a Trip Planner! 🎉</h2>
          <p className="text-gray-700">
            Te voy a enseñar cómo usar esta poderosa herramienta para planificar viajes increíbles. 
            Este tutorial te mostrará todas las funcionalidades paso a paso.
          </p>
          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-sm text-blue-800">
              💡 <strong>Tip:</strong> Puedes pausar este tutorial en cualquier momento y retomarlo desde tu perfil.
            </p>
          </div>
        </div>
      ),
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '[data-tutorial="create-trip"]',
      content: (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">Crear tu primer viaje ✈️</h3>
          <p className="text-gray-700">
            Aquí es donde comienza la magia. Al crear un viaje podrás:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
            <li>Definir destino, fechas y presupuesto</li>
            <li>Invitar amigos y familiares</li>
            <li>Obtener recomendaciones con IA</li>
            <li>Controlar gastos en tiempo real</li>
            <li>Generar itinerarios automáticos</li>
          </ul>
          <div className="bg-green-50 p-2 rounded">
            <p className="text-xs text-green-700">🚀 ¡Haz clic aquí para empezar tu aventura!</p>
          </div>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-tutorial="trips-list"]',
      content: (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">Centro de control de viajes 📋</h3>
          <p className="text-gray-700">
            Esta sección es tu centro de comando. Aquí verás:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
            <li><strong>Tus viajes:</strong> Como organizador principal</li>
            <li><strong>Viajes compartidos:</strong> Donde eres colaborador</li>
            <li><strong>Estado del presupuesto:</strong> Gastado vs planificado</li>
            <li><strong>Fechas importantes:</strong> Próximos viajes destacados</li>
            <li><strong>Progreso:</strong> Qué tan completa está la planificación</li>
          </ul>
        </div>
      ),
      placement: 'top',
    },
    {
      target: '[data-tutorial="invitations"]',
      content: (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">Invitaciones de viaje 📬</h3>
          <p className="text-gray-700">
            Cuando otros usuarios te inviten a sus viajes, aparecerán aquí. Podrás:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
            <li><strong>Aceptar:</strong> Unirte como colaborador</li>
            <li><strong>Rechazar:</strong> Declinar educadamente</li>
            <li><strong>Ver detalles:</strong> Destino, fechas, organizador</li>
            <li><strong>Roles:</strong> Ver si serás editor o solo visualizador</li>
          </ul>
          <div className="bg-yellow-50 p-2 rounded">
            <p className="text-xs text-yellow-700">🤝 ¡Los viajes en grupo son más divertidos!</p>
          </div>
        </div>
      ),
      placement: 'top',
    },
    {
      target: '[data-tutorial="profile"]',
      content: (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">Tu perfil personal 👤</h3>
          <p className="text-gray-700">
            Desde tu perfil puedes:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
            <li><strong>Personalizar información:</strong> Nombre, avatar, preferencias</li>
            <li><strong>Gestionar tutoriales:</strong> Reiniciar o saltar cualquier tutorial</li>
            <li><strong>Configurar notificaciones:</strong> Cómo quieres ser notificado</li>
            <li><strong>Historial:</strong> Todos tus viajes pasados</li>
          </ul>
          <div className="bg-purple-50 p-2 rounded">
            <p className="text-xs text-purple-700">⚙️ ¡Personaliza tu experiencia!</p>
          </div>
        </div>
      ),
      placement: 'bottom',
    },
  ],
  create_trip: [
    {
      target: '[data-tutorial="create-form"]',
      content: (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900">Creando tu viaje perfecto 🌟</h2>
          <p className="text-gray-700">
            Este formulario es la base de todo tu viaje. Cada campo es importante porque:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
            <li><strong>La IA usa esta info</strong> para recomendaciones personalizadas</li>
            <li><strong>Las fechas generan</strong> el timeline día por día automáticamente</li>
            <li><strong>El presupuesto controla</strong> los gastos en tiempo real</li>
            <li><strong>El destino influye</strong> en las sugerencias de actividades</li>
          </ul>
        </div>
      ),
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '[data-tutorial="trip-title"]',
      content: (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">Título memorable 📝</h3>
          <p className="text-gray-700">
            El título aparecerá en todas partes, así que hazlo descriptivo y emocionante:
          </p>
          <div className="bg-blue-50 p-3 rounded">
            <p className="text-sm text-blue-800 mb-2"><strong>Ejemplos geniales:</strong></p>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>🇫🇷 &ldquo;Aventura romántica en París&rdquo;</li>
              <li>🏔️ &ldquo;Escapada familiar a los Alpes&rdquo;</li>
              <li>🏖️ &ldquo;Vacaciones de verano en Bali&rdquo;</li>
              <li>🌆 &ldquo;Viaje de negocios a Nueva York&rdquo;</li>
            </ul>
          </div>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-tutorial="trip-destination"]',
      content: (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">Destino inteligente 🌍</h3>
          <p className="text-gray-700">
            El destino es crucial porque nuestra IA lo usa para:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
            <li><strong>Clima y temporada:</strong> Recomendaciones según el tiempo</li>
            <li><strong>Cultura local:</strong> Actividades auténticas del lugar</li>
            <li><strong>Precios regionales:</strong> Estimaciones de costos reales</li>
            <li><strong>Eventos especiales:</strong> Festivales y celebraciones locales</li>
          </ul>
          <div className="bg-green-50 p-2 rounded">
            <p className="text-xs text-green-700">🎯 Sé específico: &ldquo;París, Francia&rdquo; vs &ldquo;Europa&rdquo;</p>
          </div>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-tutorial="trip-dates"]',
      content: (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">Fechas mágicas 📅</h3>
          <p className="text-gray-700">
            Las fechas son súper importantes porque automáticamente:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
            <li><strong>Generan el timeline:</strong> Cada día aparece en recomendaciones IA</li>
            <li><strong>Calculan temporada:</strong> Alta/baja temporada, clima esperado</li>
            <li><strong>Detectan eventos:</strong> Navidad, festivales, temporada alta</li>
            <li><strong>Ajustan precios:</strong> Hoteles y vuelos según demanda</li>
          </ul>
          <div className="bg-amber-50 p-2 rounded">
            <p className="text-xs text-amber-700">⚠️ Cambiar fechas después regenera todo el timeline</p>
          </div>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-tutorial="trip-budget"]',
      content: (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">Presupuesto inteligente 💰</h3>
          <p className="text-gray-700">
            El presupuesto no es solo un número, es tu guía financiera:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
            <li><strong>Control en tiempo real:</strong> Alertas cuando te acercas al límite</li>
            <li><strong>Recomendaciones ajustadas:</strong> La IA sugiere según tu rango</li>
            <li><strong>División automática:</strong> Entre todos los participantes</li>
            <li><strong>Categorización:</strong> Comida, transporte, actividades, etc.</li>
          </ul>
          <div className="bg-green-50 p-2 rounded">
            <p className="text-xs text-green-700">💡 Incluye un 15-20% extra para imprevistos</p>
          </div>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-tutorial="create-button"]',
      content: (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">¡Momento de crear! 🚀</h3>
          <p className="text-gray-700">
            Al hacer clic aquí, el sistema automáticamente:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
            <li><strong>Crea tu viaje</strong> con toda la información</li>
            <li><strong>Genera el timeline</strong> día por día</li>
            <li><strong>Prepara las herramientas</strong> de IA y colaboración</li>
            <li><strong>Te lleva al dashboard</strong> del viaje</li>
          </ul>
          <div className="bg-purple-50 p-2 rounded">
            <p className="text-xs text-purple-700">✨ ¡Tu aventura está a un clic de distancia!</p>
          </div>
        </div>
      ),
      placement: 'top',
    },
  ],
  trip_management: [
    {
      target: '[data-tutorial="trip-header"]',
      content: (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900">Centro de comando del viaje 🎮</h2>
          <p className="text-gray-700">
            ¡Bienvenido al corazón de tu viaje! Desde aquí controlas todo:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
            <li><strong>Información clave:</strong> Destino, fechas, presupuesto</li>
            <li><strong>Estadísticas en vivo:</strong> Gastos, días restantes, progreso</li>
            <li><strong>Acceso rápido:</strong> A todas las herramientas especializadas</li>
            <li><strong>Estado del viaje:</strong> Qué falta por planificar</li>
          </ul>
          <div className="bg-blue-50 p-2 rounded">
            <p className="text-xs text-blue-700">🎯 Este es tu punto de partida para todo</p>
          </div>
        </div>
      ),
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '[data-tutorial="trip-header"]',
      content: (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">Información del viaje 📋</h3>
          <p className="text-gray-700">
            El encabezado muestra datos cruciales que se actualizan automáticamente:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
            <li><strong>Título y destino:</strong> Información básica siempre visible</li>
            <li><strong>Badges de estado:</strong> &ldquo;Próximo&rdquo;, &ldquo;En curso&rdquo; según fechas</li>
            <li><strong>Tu rol:</strong> Si eres organizador, editor o visualizador</li>
            <li><strong>Descripción:</strong> Detalles adicionales del viaje</li>
          </ul>
          <div className="bg-green-50 p-2 rounded">
            <p className="text-xs text-green-700">💡 Los badges cambian de color según el estado del viaje</p>
          </div>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-4.gap-6.mb-8',
      content: (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">Estadísticas en tiempo real 📊</h3>
          <p className="text-gray-700">
            Estas tarjetas te dan una visión instantánea del estado de tu viaje:
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-blue-50 p-2 rounded">
              <strong className="text-blue-800">📅 Duración:</strong>
              <p className="text-blue-700">Días totales y fechas exactas</p>
            </div>
            <div className="bg-green-50 p-2 rounded">
              <strong className="text-green-800">📝 Elementos:</strong>
              <p className="text-green-700">Total de actividades y gastos</p>
            </div>
            <div className="bg-purple-50 p-2 rounded">
              <strong className="text-purple-800">💰 Costo Total:</strong>
              <p className="text-purple-700">Suma de todo lo planificado</p>
            </div>
            <div className="bg-yellow-50 p-2 rounded">
              <strong className="text-yellow-800">🎯 Presupuesto:</strong>
              <p className="text-yellow-700">Límite y % usado</p>
            </div>
          </div>
          <div className="bg-amber-50 p-2 rounded">
            <p className="text-xs text-amber-700">⚡ Se actualizan automáticamente cuando agregas gastos o actividades</p>
          </div>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-tutorial="advanced-tools"]',
      content: (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">Herramientas avanzadas 🛠️</h3>
          <p className="text-gray-700">
            Estas tarjetas te dan acceso directo a funciones poderosas:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
            <li><strong>Acceso rápido:</strong> Sin navegar por menús</li>
            <li><strong>Estado visual:</strong> Verde = configurado, Naranja = pendiente</li>
            <li><strong>Información clave:</strong> Progreso y estadísticas importantes</li>
            <li><strong>Llamadas a la acción:</strong> Qué hacer siguiente</li>
          </ul>
          <div className="bg-purple-50 p-2 rounded">
            <p className="text-xs text-purple-700">🚀 Cada herramienta tiene su propio tutorial especializado</p>
          </div>
        </div>
      ),
      placement: 'top',
    },
    {
      target: '[data-tutorial="ai-card"]',
      content: (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">La joya de la corona: IA 🤖✨</h3>
          <p className="text-gray-700">
            Esta es nuestra funcionalidad más avanzada. La IA considera:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
            <li><strong>Tu ubicación exacta</strong> cada día del viaje</li>
            <li><strong>El clima esperado</strong> según fechas y destino</li>
            <li><strong>Temporada turística</strong> y eventos locales</li>
            <li><strong>Tu presupuesto</strong> para sugerencias apropiadas</li>
            <li><strong>Preferencias</strong> que especifiques (comida, cultura, etc.)</li>
            <li><strong>Horarios</strong> y distancias entre actividades</li>
          </ul>
          <div className="bg-purple-50 p-2 rounded">
            <p className="text-xs text-purple-700">🎯 ¡Haz clic para descubrir lugares increíbles!</p>
          </div>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-tutorial="summary-card"]',
      content: (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">Resumen inteligente 📊</h3>
          <p className="text-gray-700">
            El centro de análisis financiero de tu viaje:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
            <li><strong>Gráficos visuales:</strong> Distribución de gastos por persona</li>
            <li><strong>Control de presupuesto:</strong> Gastado vs planificado</li>
            <li><strong>Categorización:</strong> Comida, transporte, actividades</li>
            <li><strong>División justa:</strong> Cuánto debe cada participante</li>
            <li><strong>Estadísticas:</strong> Promedios, totales, proyecciones</li>
          </ul>
          <div className="bg-blue-50 p-2 rounded">
            <p className="text-xs text-blue-700">💰 Perfecto para liquidar gastos al final del viaje</p>
          </div>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-tutorial="collaboration-card"]',
      content: (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">Colaboración en tiempo real 👥</h3>
          <p className="text-gray-700">
            Gestiona tu equipo de viaje de forma profesional:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
            <li><strong>Sistema de invitaciones:</strong> Por email automático</li>
            <li><strong>Control de permisos:</strong> Organizador, Editor, Visualizador</li>
            <li><strong>Estado en tiempo real:</strong> Quién está activo</li>
            <li><strong>Gestión de accesos:</strong> Agregar/remover personas</li>
            <li><strong>Historial:</strong> Quién hizo qué y cuándo</li>
          </ul>
          <div className="bg-green-50 p-2 rounded">
            <p className="text-xs text-green-700">🤝 Los mejores viajes se planifican en equipo</p>
          </div>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-tutorial="trip-tabs"]',
      content: (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">Navegación inteligente 🗂️</h3>
          <p className="text-gray-700">
            Cada pestaña es una herramienta especializada:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
            <li><strong>Planificación:</strong> Agregar actividades, vuelos, hoteles</li>
            <li><strong>Itinerario:</strong> Vista día por día con horarios</li>
            <li><strong>Gastos:</strong> Control financiero total, categorías, alertas</li>
          </ul>
          <div className="bg-green-50 p-2 rounded">
            <p className="text-xs text-green-700">⚡ Cada pestaña mantiene su estado independiente</p>
          </div>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-tutorial="planning-tab"]',
      content: (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">Pestaña de Planificación 📝</h3>
          <p className="text-gray-700">
            Aquí organizas todas las actividades de tu viaje:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
            <li><strong>Categorías inteligentes:</strong> Vuelos, hoteles, restaurantes, actividades</li>
            <li><strong>Información completa:</strong> Horarios, ubicaciones, costos</li>
            <li><strong>Estados de reserva:</strong> Planificado, reservado, completado</li>
            <li><strong>Imágenes:</strong> Sube fotos de confirmaciones</li>
            <li><strong>Notas:</strong> Detalles importantes para recordar</li>
          </ul>
          <div className="bg-blue-50 p-2 rounded">
            <p className="text-xs text-blue-700">📋 Todo lo que necesitas en un solo lugar</p>
          </div>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-tutorial="itinerary-tab"]',
      content: (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">Itinerario día por día 📅</h3>
          <p className="text-gray-700">
            Vista cronológica perfecta para seguir tu viaje:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
            <li><strong>Organización automática:</strong> Por fechas y horarios</li>
            <li><strong>Costo por día:</strong> Presupuesto diario calculado</li>
            <li><strong>Actividades ordenadas:</strong> Por hora de inicio</li>
            <li><strong>Vista limpia:</strong> Fácil de seguir durante el viaje</li>
            <li><strong>Información esencial:</strong> Horarios, ubicaciones, costos</li>
          </ul>
          <div className="bg-green-50 p-2 rounded">
            <p className="text-xs text-green-700">⏰ Perfecto para usar durante el viaje real</p>
          </div>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-tutorial="expenses-tab"]',
      content: (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">Control de gastos avanzado 💰</h3>
          <p className="text-gray-700">
            Sistema financiero completo para tu viaje:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
            <li><strong>Categorización automática:</strong> Comida, transporte, alojamiento</li>
            <li><strong>Recibos digitales:</strong> Sube fotos para respaldo</li>
            <li><strong>División de gastos:</strong> Entre todos los participantes</li>
            <li><strong>Alertas de presupuesto:</strong> Cuando te acercas al límite</li>
            <li><strong>Conversión de moneda:</strong> Automática según destino</li>
            <li><strong>Reportes:</strong> Exporta para reembolsos</li>
          </ul>
          <div className="bg-red-50 p-2 rounded">
            <p className="text-xs text-red-700">📊 Control total de las finanzas del viaje</p>
          </div>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: 'body',
      content: (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900">¡Dominas el centro de comando! 🎉</h2>
          <p className="text-gray-700">
            Ahora conoces todas las herramientas para gestionar tu viaje como un profesional:
          </p>
          <div className="bg-gradient-to-r from-green-50 to-blue-50 p-3 rounded-lg">
            <h4 className="font-semibold text-gray-900 mb-2">Próximos pasos recomendados:</h4>
            <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1">
              <li><strong>Explora las herramientas avanzadas</strong> (IA, Resumen, Colaboración)</li>
              <li><strong>Agrega tus primeras actividades</strong> en la pestaña Planificación</li>
              <li><strong>Invita a tu equipo</strong> para planificar juntos</li>
              <li><strong>Usa la IA</strong> para descubrir lugares increíbles</li>
              <li><strong>Controla gastos</strong> en tiempo real</li>
            </ol>
          </div>
          <div className="bg-purple-50 p-2 rounded">
            <p className="text-xs text-purple-700">✨ ¡Cada herramienta tiene su propio tutorial detallado!</p>
          </div>
        </div>
      ),
      placement: 'center',
    },
  ],
  ai: [
    {
      target: '[data-tutorial="ai-header"]',
      content: (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900">¡Bienvenido a las Recomendaciones IA! 🤖✨</h2>
          <p className="text-gray-700">
            Esta es la sección más inteligente de tu planificador de viajes. Aquí la IA te ayudará a descubrir lugares increíbles.
          </p>
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-3 rounded-lg">
            <h4 className="font-semibold text-purple-900 mb-2">¿Cómo funciona?</h4>
            <ol className="list-decimal list-inside text-sm text-purple-800 space-y-1">
              <li><strong>Organizas tus días</strong> en segmentos por ubicación</li>
              <li><strong>Configuras cada segmento</strong> con detalles del lugar</li>
              <li><strong>La IA genera recomendaciones</strong> personalizadas</li>
              <li><strong>Exploras categorías</strong> de restaurantes, atracciones, etc.</li>
            </ol>
          </div>
        </div>
      ),
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '[data-tutorial="progress-info"]',
      content: (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">Panel de información 📊</h3>
          <p className="text-gray-700">
            Este panel te muestra el estado actual de tu organización:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
            <li><strong>Días totales:</strong> Cuántos días dura tu viaje</li>
            <li><strong>Segmentos creados:</strong> Cuántos grupos de días has hecho</li>
            <li><strong>Progreso:</strong> Cuántos segmentos están configurados</li>
            <li><strong>Días sin asignar:</strong> Qué días necesitan ser organizados</li>
          </ul>
          <div className="bg-blue-50 p-2 rounded">
            <p className="text-xs text-blue-700">💡 Los badges de colores te muestran el estado actual</p>
          </div>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-tutorial="timeline"]',
      content: (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">Timeline interactivo 📅</h3>
          <p className="text-gray-700">
            Aquí es donde organizas tus días. Es súper fácil:
          </p>
          <div className="bg-green-50 p-3 rounded">
            <h4 className="font-semibold text-green-900 mb-2">Cómo crear segmentos:</h4>
            <ol className="list-decimal list-inside text-sm text-green-800 space-y-1">
              <li><strong>Haz clic</strong> en el primer día (ej: Día 1)</li>
              <li><strong>Mantén presionado</strong> y arrastra hasta el último día (ej: Día 3)</li>
              <li><strong>Suelta</strong> para crear un segmento de &ldquo;Días 1-3&rdquo;</li>
              <li><strong>Repite</strong> para diferentes ciudades o ubicaciones</li>
            </ol>
          </div>
          <div className="bg-amber-50 p-2 rounded">
            <p className="text-xs text-amber-700">🎨 Cada segmento tendrá un color único para identificarlo</p>
          </div>
        </div>
      ),
      placement: 'top',
    },
    {
      target: '[data-tutorial="segments-area"]',
      content: (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">Área de segmentos 🎯</h3>
          <p className="text-gray-700">
            Aquí aparecerán los segmentos que crees. Cada segmento representa días consecutivos en la misma ubicación:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
            <li><strong>Información del segmento:</strong> Qué días incluye</li>
            <li><strong>Formulario de configuración:</strong> Ubicación, ciudad, país</li>
            <li><strong>Estado visual:</strong> Configurado, pendiente, con recomendaciones</li>
            <li><strong>Recomendaciones generadas:</strong> Se muestran aquí cuando estén listas</li>
          </ul>
          <div className="bg-purple-50 p-2 rounded">
            <p className="text-xs text-purple-700">✨ Una vez configurado, podrás generar recomendaciones IA</p>
          </div>
        </div>
      ),
      placement: 'top',
    },
    {
      target: '[data-tutorial="generate-recommendations"]',
      content: (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">Botón mágico de generación ✨</h3>
          <p className="text-gray-700">
            Este botón aparece cuando todos tus segmentos están configurados. Al hacer clic:
          </p>
          <div className="bg-purple-50 p-3 rounded">
            <h4 className="font-semibold text-purple-900 mb-2">La IA analiza:</h4>
            <ul className="list-disc list-inside text-sm text-purple-800 space-y-1">
              <li><strong>Ubicaciones exactas</strong> de cada segmento</li>
              <li><strong>Fechas específicas</strong> para clima y eventos</li>
              <li><strong>Preferencias</strong> que hayas mencionado</li>
              <li><strong>Presupuesto del viaje</strong> para opciones adecuadas</li>
            </ul>
          </div>
          <div className="bg-green-50 p-2 rounded">
            <p className="text-xs text-green-700">🚀 ¡Prepárate para recomendaciones increíbles!</p>
          </div>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-tutorial="recommendation-tabs"]',
      content: (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">Categorías de recomendaciones 🏷️</h3>
          <p className="text-gray-700">
            Una vez generadas, las recomendaciones se organizan en categorías especializadas:
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-red-50 p-2 rounded">
              <strong className="text-red-800">🍽️ Restaurantes:</strong>
              <p className="text-red-700">Comida local, horarios, precios</p>
            </div>
            <div className="bg-blue-50 p-2 rounded">
              <strong className="text-blue-800">📸 Atracciones:</strong>
              <p className="text-blue-700">Lugares icónicos y vistas</p>
            </div>
            <div className="bg-green-50 p-2 rounded">
              <strong className="text-green-800">🎯 Actividades:</strong>
              <p className="text-green-700">Tours, deportes, aventuras</p>
            </div>
            <div className="bg-purple-50 p-2 rounded">
              <strong className="text-purple-800">🏛️ Museos:</strong>
              <p className="text-purple-700">Arte, historia, cultura</p>
            </div>
            <div className="bg-yellow-50 p-2 rounded">
              <strong className="text-yellow-800">🌙 Vida nocturna:</strong>
              <p className="text-yellow-700">Bares, clubs, entretenimiento</p>
            </div>
            <div className="bg-pink-50 p-2 rounded">
              <strong className="text-pink-800">🛍️ Compras:</strong>
              <p className="text-pink-700">Mercados, tiendas, souvenirs</p>
            </div>
          </div>
          <div className="bg-blue-50 p-2 rounded mt-2">
            <p className="text-xs text-blue-700">📋 Cada recomendación incluye detalles, horarios, contacto y razón de la sugerencia</p>
          </div>
        </div>
      ),
      placement: 'top',
    },
  ],
  collaboration: [
    {
      target: '[data-tutorial="collaboration-header"]',
      content: (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900">Colaboración en tiempo real 👥</h2>
          <p className="text-gray-700">
            ¡Los mejores viajes se planifican en equipo! Este sistema te permite:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
            <li><strong>Invitar a cualquiera</strong> con solo su email</li>
            <li><strong>Controlar permisos</strong> precisamente</li>
            <li><strong>Colaborar en tiempo real</strong> sin conflictos</li>
            <li><strong>Mantener historial</strong> de todos los cambios</li>
          </ul>
          <div className="bg-blue-50 p-2 rounded">
            <p className="text-xs text-blue-700">🤝 ¡Los viajes en grupo son más divertidos y organizados!</p>
          </div>
        </div>
      ),
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '[data-tutorial="invite-form"]',
      content: (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">Sistema de invitaciones ✉️</h3>
          <p className="text-gray-700">
            Invitar es súper fácil y seguro:
          </p>
          <div className="bg-green-50 p-3 rounded">
            <h4 className="font-semibold text-green-900 mb-2">Proceso automático:</h4>
            <ol className="list-decimal list-inside text-sm text-green-800 space-y-1">
              <li><strong>Escribes el email</strong> de tu amigo/familiar</li>
              <li><strong>Seleccionas el rol</strong> que tendrá</li>
              <li><strong>Sistema envía invitación</strong> automáticamente</li>
              <li><strong>Ellos reciben email</strong> con enlace seguro</li>
              <li><strong>Hacen clic y se unen</strong> instantáneamente</li>
            </ol>
          </div>
          <div className="bg-yellow-50 p-2 rounded">
            <p className="text-xs text-yellow-700">🔒 Solo personas invitadas pueden ver tu viaje</p>
          </div>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-tutorial="member-roles"]',
      content: (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">Control de permisos 🎭</h3>
          <p className="text-gray-700">
            Cada rol tiene permisos específicos para mantener orden:
          </p>
          <div className="space-y-2">
            <div className="bg-purple-50 p-2 rounded">
              <strong className="text-purple-800">👑 Organizador:</strong>
              <ul className="text-xs text-purple-700 mt-1 space-y-1">
                <li>• Control total del viaje</li>
                <li>• Invitar/remover personas</li>
                <li>• Cambiar información básica</li>
                <li>• Eliminar el viaje</li>
              </ul>
            </div>
            <div className="bg-blue-50 p-2 rounded">
              <strong className="text-blue-800">✏️ Colaborador:</strong>
              <ul className="text-xs text-blue-700 mt-1 space-y-1">
                <li>• Agregar/editar gastos</li>
                <li>• Usar recomendaciones IA</li>
                <li>• Ver toda la información</li>
                <li>• Comentar y sugerir</li>
              </ul>
            </div>
          </div>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-tutorial="members-list"]',
      content: (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">Gestión de equipo 📋</h3>
          <p className="text-gray-700">
            Aquí controlas todo tu equipo de viaje:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
            <li><strong>Estado de invitaciones:</strong> Pendiente, aceptada, rechazada</li>
            <li><strong>Roles actuales:</strong> Quién puede hacer qué</li>
            <li><strong>Fecha de unión:</strong> Cuándo se unió cada persona</li>
            <li><strong>Acciones rápidas:</strong> Cambiar rol, remover, reenviar invitación</li>
          </ul>
          <div className="bg-green-50 p-2 rounded">
            <p className="text-xs text-green-700">👥 Perfecto para familias, grupos de amigos, viajes de trabajo</p>
          </div>
        </div>
      ),
      placement: 'top',
    },
  ],
  summary: [
    {
      target: '[data-tutorial="summary-header"]',
      content: (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900">Resumen inteligente del viaje 📊</h2>
          <p className="text-gray-700">
            ¡El centro de análisis de tu viaje! Aquí ves todo desde una perspectiva financiera:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
            <li><strong>Análisis visual:</strong> Gráficos y estadísticas claras</li>
            <li><strong>Control de presupuesto:</strong> Gastado vs planificado</li>
            <li><strong>División justa:</strong> Cuánto debe cada persona</li>
            <li><strong>Categorización:</strong> Dónde va cada euro</li>
          </ul>
          <div className="bg-blue-50 p-2 rounded">
            <p className="text-xs text-blue-700">💰 Perfecto para mantener las finanzas bajo control</p>
          </div>
        </div>
      ),
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '[data-tutorial="cost-chart"]',
      content: (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">Gráfico de distribución 🥧</h3>
          <p className="text-gray-700">
            Este gráfico circular es súper útil para entender tus gastos:
          </p>
          <div className="bg-green-50 p-3 rounded">
            <h4 className="font-semibold text-green-900 mb-2">Lo que muestra:</h4>
            <ul className="list-disc list-inside text-sm text-green-800 space-y-1">
              <li><strong>Distribución por persona:</strong> Quién gastó cuánto</li>
              <li><strong>Porcentajes exactos:</strong> Para división justa</li>
              <li><strong>Colores distintivos:</strong> Fácil identificación visual</li>
              <li><strong>Totales claros:</strong> Suma total por participante</li>
            </ul>
          </div>
          <div className="bg-yellow-50 p-2 rounded">
            <p className="text-xs text-yellow-700">📊 Perfecto para liquidar gastos al final del viaje</p>
          </div>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-tutorial="total-cost"]',
      content: (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">Control financiero total 💰</h3>
          <p className="text-gray-700">
            Aquí ves el estado financiero completo:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
            <li><strong>Costo total real:</strong> Todo lo que se ha gastado</li>
            <li><strong>Presupuesto original:</strong> Lo que habías planificado</li>
            <li><strong>Diferencia:</strong> Si estás dentro o fuera del presupuesto</li>
            <li><strong>Costo por persona:</strong> División equitativa automática</li>
          </ul>
          <div className="bg-red-50 p-2 rounded">
            <p className="text-xs text-red-700">⚠️ Alertas automáticas si te acercas al límite</p>
          </div>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-tutorial="expense-details"]',
      content: (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">Desglose inteligente 📋</h3>
          <p className="text-gray-700">
            La categorización automática te ayuda a entender tus patrones de gasto:
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-blue-50 p-2 rounded">
              <strong className="text-blue-800">🍽️ Comida:</strong>
              <p className="text-blue-700">Restaurantes, supermercado, snacks</p>
            </div>
            <div className="bg-green-50 p-2 rounded">
              <strong className="text-green-800">🚗 Transporte:</strong>
              <p className="text-green-700">Vuelos, taxis, metro, gasolina</p>
            </div>
            <div className="bg-purple-50 p-2 rounded">
              <strong className="text-purple-800">🏨 Alojamiento:</strong>
              <p className="text-purple-700">Hoteles, Airbnb, hostales</p>
            </div>
            <div className="bg-yellow-50 p-2 rounded">
              <strong className="text-yellow-800">🎯 Actividades:</strong>
              <p className="text-yellow-700">Museos, tours, entretenimiento</p>
            </div>
          </div>
          <div className="bg-green-50 p-2 rounded mt-2">
            <p className="text-xs text-green-700">💡 Perfecto para planificar futuros viajes con datos reales</p>
          </div>
        </div>
      ),
      placement: 'top',
    },
  ],
  "expense-splitting": [
    {
      target: 'body',
      content: (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900">División de Gastos 💰</h2>
          <p className="text-gray-700">
            Bienvenido al sistema de división de gastos tipo Splitwise. Aquí podrás gestionar fácilmente quién debe qué a quién en tu viaje.
          </p>
        </div>
      ),
      placement: 'center',
      disableBeacon: true,
    },
  ],
}

export function TutorialSystem({ type, autoStart = true }: TutorialSystemProps) {
  const { user } = useAuth()
  const [run, setRun] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [spotlightPosition, setSpotlightPosition] = useState<SpotlightPosition | null>(null)
  const [isChecking, setIsChecking] = useState(true)
  const supabase = createClientComponentClient()

  console.log(`🎯 TutorialSystem iniciado - type: ${type}, autoStart: ${autoStart}, user: ${user?.id || 'null'}`)

  useEffect(() => {
    const checkTutorialCompletion = async () => {
      setIsChecking(true)
      try {
        if (!user) {
          console.log(`👤 No hay usuario logueado, no iniciando tutorial ${type}`)
          setRun(false)
          setIsChecking(false)
          return
        }

        console.log(`🔍 Verificando estado del tutorial ${type} para usuario ${user.id}`)

        const { data: profile, error } = await supabase
          .from('profiles')
          .select(`${type}_tutorial_completed`)
          .eq('id', user.id)
          .single()

        if (error) {
          console.error('Error fetching profile:', error)
          // Si hay error, asumir que no está completado e iniciar si autoStart
          if (autoStart) {
            console.log(`⚠️ Error en BD pero autoStart=true, iniciando tutorial ${type}`)
            setRun(true)
          } else {
            setRun(false)
          }
          setIsChecking(false)
          return
        }

        const isCompleted = profile?.[`${type}_tutorial_completed` as keyof typeof profile]
        console.log(`📊 Tutorial ${type} completado: ${isCompleted}`)
        
        if (isCompleted) {
          console.log(`✅ Tutorial ${type} ya completado, no iniciando`)
          setRun(false)
        } else if (autoStart) {
          console.log(`🚀 Tutorial ${type} iniciando porque no está completado y autoStart=true`)
          setRun(true)
        } else {
          console.log(`⏸️ Tutorial ${type} no completado pero autoStart=false`)
          setRun(false)
        }
      } catch (error) {
        console.error('Error checking tutorial completion:', error)
        // En caso de error, iniciar si autoStart es true
        if (autoStart) {
          setRun(true)
        } else {
          setRun(false)
        }
      } finally {
        setIsChecking(false)
      }
    }

    checkTutorialCompletion()
  }, [type, autoStart, user])

  // Inicializar posición del spotlight cuando el tutorial comience
  useEffect(() => {
    if (run && tutorialSteps[type] && tutorialSteps[type].length > 0) {
      setTimeout(() => {
        const firstStep = tutorialSteps[type][0]
        const element = document.querySelector(firstStep.target as string)
        if (element) {
          const rect = element.getBoundingClientRect()
          setSpotlightPosition({
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height
          })
        }
      }, 100)
    }
  }, [run, type])

  // Bloquear scroll durante el tutorial
  useEffect(() => {
    if (run) {
      // Guardar el scroll actual
      const originalOverflow = document.body.style.overflow
      const originalPosition = document.body.style.position
      
      // Bloquear scroll manual pero permitir scroll programático
      document.body.style.overflow = 'hidden'
      document.body.style.userSelect = 'none'
      
      // Prevenir scroll con eventos
      const preventScroll = (e: Event) => {
        if (e.target === document.body || e.target === document.documentElement) {
          e.preventDefault()
          e.stopPropagation()
        }
      }
      
      const preventKeyScroll = (e: KeyboardEvent) => {
        const scrollKeys = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ']
        if (scrollKeys.includes(e.key)) {
          e.preventDefault()
        }
      }
      
      const preventWheelScroll = (e: WheelEvent) => {
        e.preventDefault()
      }
      
      // Agregar event listeners
      document.addEventListener('wheel', preventWheelScroll, { passive: false })
      document.addEventListener('keydown', preventKeyScroll)
      document.addEventListener('touchmove', preventScroll, { passive: false })
      
      return () => {
        // Restaurar todo cuando termine el tutorial
        document.body.style.overflow = originalOverflow
        document.body.style.position = originalPosition
        document.body.style.userSelect = ''
        
        // Remover event listeners
        document.removeEventListener('wheel', preventWheelScroll)
        document.removeEventListener('keydown', preventKeyScroll)
        document.removeEventListener('touchmove', preventScroll)
      }
    }
  }, [run])

  const handleJoyrideCallback = async (data: CallBackProps) => {
    const { action, index, status, type: eventType, step } = data

    // Capturar posición del spotlight cuando el paso es visible
    if (eventType === EVENTS.STEP_AFTER || eventType === EVENTS.BEACON || eventType === EVENTS.TOOLTIP) {
      const target = step.target as string
      const element = document.querySelector(target)
      if (element) {
        const rect = element.getBoundingClientRect()
        setSpotlightPosition({
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height
        })
      }
    }

    if (eventType === EVENTS.STEP_AFTER || eventType === EVENTS.TARGET_NOT_FOUND) {
      const nextStepIndex = index + (action === ACTIONS.PREV ? -1 : 1)
      setStepIndex(nextStepIndex)
      
      // Actualizar posición para el siguiente paso
      setTimeout(() => {
        if (nextStepIndex < tutorialSteps[type].length) {
          const nextStep = tutorialSteps[type][nextStepIndex]
          const nextElement = document.querySelector(nextStep.target as string)
          if (nextElement) {
            const rect = nextElement.getBoundingClientRect()
            setSpotlightPosition({
              x: rect.left,
              y: rect.top,
              width: rect.width,
              height: rect.height
            })
          }
        }
      }, 100)
    } else if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      console.log(`🏁 Tutorial ${type} terminado con status: ${status}`)
      setRun(false)
      setSpotlightPosition(null)
      
      try {
        if (user) {
          const updateField = `${type}_tutorial_completed`
          console.log(`💾 Marcando tutorial ${type} como completado en base de datos`)
          
          const { error } = await supabase
            .from('profiles')
            .update({ [updateField]: true })
            .eq('id', user.id)
            
          if (error) {
            console.error('Error updating tutorial completion:', error)
          } else {
            console.log(`✅ Tutorial ${type} marcado como completado exitosamente`)
          }
        } else {
          console.log(`⚠️ No hay usuario para marcar tutorial ${type} como completado`)
        }
      } catch (error) {
        console.error('Error updating tutorial completion:', error)
      }
    }
  }

  if (isChecking || !run) return null

  return (
    <>
      {/* Overlay que cubre toda la pantalla EXCEPTO el área del spotlight */}
      {run && spotlightPosition && (
        <>
          {/* Top overlay - desde arriba hasta el spotlight */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              height: Math.max(0, spotlightPosition.y - 12),
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              zIndex: 9999,
              pointerEvents: 'all',
            }}
          />
          
          {/* Bottom overlay - desde el spotlight hasta abajo */}
          <div
            style={{
              position: 'fixed',
              top: spotlightPosition.y + spotlightPosition.height + 12,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              zIndex: 9999,
              pointerEvents: 'all',
            }}
          />
          
          {/* Left overlay - lado izquierdo del spotlight */}
          <div
            style={{
              position: 'fixed',
              top: Math.max(0, spotlightPosition.y - 12),
              left: 0,
              width: Math.max(0, spotlightPosition.x - 12),
              height: spotlightPosition.height + 24,
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              zIndex: 9999,
              pointerEvents: 'all',
            }}
          />
          
          {/* Right overlay - lado derecho del spotlight */}
          <div
            style={{
              position: 'fixed',
              top: Math.max(0, spotlightPosition.y - 12),
              left: spotlightPosition.x + spotlightPosition.width + 12,
              right: 0,
              height: spotlightPosition.height + 24,
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              zIndex: 9999,
              pointerEvents: 'all',
            }}
          />
          
          {/* EL ÁREA DEL SPOTLIGHT QUEDA COMPLETAMENTE LIBRE - SIN OVERLAY */}
          
          {/* Bloqueador de clicks transparente sobre el spotlight */}
          <div
            style={{
              position: 'fixed',
              left: spotlightPosition.x - 12,
              top: spotlightPosition.y - 12,
              width: spotlightPosition.width + 24,
              height: spotlightPosition.height + 24,
              zIndex: 10000,
              pointerEvents: 'all', // Bloquea clicks pero es invisible
              backgroundColor: 'transparent',
            }}
          />
          
          {/* Borde decorativo alrededor del elemento destacado */}
          <div
            style={{
              position: 'fixed',
              left: spotlightPosition.x - 12,
              top: spotlightPosition.y - 12,
              width: spotlightPosition.width + 24,
              height: spotlightPosition.height + 24,
              border: '3px solid #7c3aed',
              zIndex: 10001,
              pointerEvents: 'none',
              backgroundColor: 'transparent',
              boxShadow: `
                0 0 0 2px rgba(124, 58, 237, 0.3),
                0 0 20px rgba(124, 58, 237, 0.4)
              `,
            }}
          />
          
          {/* Efecto de brillo sutil alrededor */}
          <div
            style={{
              position: 'fixed',
              left: spotlightPosition.x - 20,
              top: spotlightPosition.y - 20,
              width: spotlightPosition.width + 40,
              height: spotlightPosition.height + 40,
              borderRadius: '24px',
              zIndex: 9998,
              pointerEvents: 'none',
              boxShadow: '0 0 40px rgba(124, 58, 237, 0.4)',
              backgroundColor: 'transparent',
            }}
          />
        </>
      )}
      
      <Joyride
        steps={tutorialSteps[type]}
        run={run}
        stepIndex={stepIndex}
        callback={handleJoyrideCallback}
        continuous={true}
        showProgress={true}
        showSkipButton={true}
        disableOverlayClose={true}
        disableCloseOnEsc={true}
        hideCloseButton={false}
        spotlightClicks={false}
        spotlightPadding={12}
        disableScrollParentFix={true}
        disableOverlay={true}
        scrollToFirstStep={true}
        scrollOffset={100}
        disableScrolling={false}
        floaterProps={{
          disableAnimation: false,
          options: {
            preventOverflow: {
              boundariesElement: 'viewport',
              padding: 20,
            },
            flip: {
              enabled: true,
              behavior: ['top', 'bottom', 'right', 'left'],
            },
            offset: {
              enabled: true,
              offset: '0, 10px',
            },
          },
        }}
        styles={{
          options: {
            primaryColor: '#7c3aed',
            width: 400,
            zIndex: 10002,
          },
          spotlight: {
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: '16px',
            boxShadow: 'none',
            outline: 'none',
          },
          tooltip: {
            borderRadius: '16px',
            padding: '24px',
            fontSize: '14px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)',
            border: 'none',
            backgroundColor: 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(12px)',
            maxWidth: '400px',
            minWidth: '300px',
          },
          tooltipContainer: {
            textAlign: 'left',
          },
          tooltipTitle: {
            fontSize: '20px',
            fontWeight: 'bold',
            marginBottom: '12px',
            color: '#1f2937',
            background: 'linear-gradient(135deg, #7c3aed, #3b82f6)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          },
          buttonNext: {
            backgroundColor: '#7c3aed',
            borderRadius: '12px',
            padding: '12px 20px',
            fontSize: '14px',
            fontWeight: '600',
            boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)',
            border: 'none',
            color: 'white',
            transition: 'all 0.2s ease',
          },
          buttonBack: {
            color: '#6b7280',
            marginRight: '12px',
            padding: '12px 20px',
            fontSize: '14px',
            border: '2px solid #e5e7eb',
            borderRadius: '12px',
            backgroundColor: 'white',
            fontWeight: '500',
            transition: 'all 0.2s ease',
          },
          buttonSkip: {
            color: '#ef4444',
            fontSize: '14px',
            fontWeight: '600',
            border: '2px solid #fecaca',
            borderRadius: '12px',
            padding: '8px 16px',
            backgroundColor: 'rgba(254, 202, 202, 0.1)',
            transition: 'all 0.2s ease',
          },
        }}
        locale={{
          back: 'Anterior',
          close: 'Cerrar',
          last: 'Finalizar',
          next: 'Siguiente',
          skip: 'Saltar tutorial',
        }}
      />
    </>
  )
}

export function useTutorial() {
  const { user } = useAuth()

  const startTutorial = async (type: TutorialType) => {
    if (!user) return

    try {
      await supabase
        .from('profiles')
        .update({ [`${type}_tutorial_completed`]: false })
        .eq('id', user.id)
      
      window.location.reload()
    } catch (error) {
      console.error('Error starting tutorial:', error)
    }
  }

  const resetTutorial = async (type: TutorialType) => {
    if (!user) return

    try {
      await supabase
        .from('profiles')
        .update({ [`${type}_tutorial_completed`]: false })
        .eq('id', user.id)
      
      // No recargar la página para tutoriales individuales
      // window.location.reload()
    } catch (error) {
      console.error('Error resetting tutorial:', error)
      throw error
    }
  }

  const resetAllTutorials = async () => {
    if (!user) return

    try {
      await supabase
        .from('profiles')
        .update({
          dashboard_tutorial_completed: false,
          create_trip_tutorial_completed: false,
          trip_management_tutorial_completed: false,
          ai_tutorial_completed: false,
          collaboration_tutorial_completed: false,
          summary_tutorial_completed: false,
        })
        .eq('id', user.id)
      
      // No recargar la página para permitir que la UI se actualice
      // window.location.reload()
    } catch (error) {
      console.error('Error resetting tutorials:', error)
      throw error
    }
  }

  return {
    startTutorial,
    resetTutorial,
    resetAllTutorials,
  }
} 