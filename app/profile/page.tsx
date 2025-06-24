"use client"

import ProfileForm from "@/components/profile-form"
import { useAuth } from "@/components/auth-provider"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Navbar } from "@/components/navbar"
import { useState } from "react"
import { redirect } from "next/navigation"
import { RefreshCw, HelpCircle } from "lucide-react"

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth()
  const [resetting, setResetting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const resetAllTutorials = async () => {
    if (!user) return
    
    setResetting(true)
    setMessage(null)
    
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          dashboard_tutorial_completed: false,
          create_trip_tutorial_completed: false,
          trip_management_tutorial_completed: false,
          ai_tutorial_completed: false,
          collaboration_tutorial_completed: false,
        })
        .eq("id", user.id)

      if (error) throw error
      
      setMessage("✅ Todos los tutoriales han sido reiniciados. Verás los tutoriales la próxima vez que visites cada sección.")
    } catch (error) {
      console.error("Error resetting tutorials:", error)
      setMessage("❌ Error al reiniciar los tutoriales. Intenta de nuevo.")
    } finally {
      setResetting(false)
    }
  }

  const resetSpecificTutorial = async (tutorialType: string) => {
    if (!user) return
    
    try {
      const fieldName = `${tutorialType}_tutorial_completed`
      const { error } = await supabase
        .from("profiles")
        .update({ [fieldName]: false })
        .eq("id", user.id)

      if (error) throw error
      
      setMessage(`✅ Tutorial de ${getTutorialName(tutorialType)} reiniciado.`)
    } catch (error) {
      console.error("Error resetting tutorial:", error)
      setMessage("❌ Error al reiniciar el tutorial.")
    }
  }

  const getTutorialName = (type: string) => {
    const names = {
      dashboard: "Dashboard",
      create_trip: "Creación de Viaje",
      trip_management: "Gestión de Viaje",
      ai: "Recomendaciones IA",
      collaboration: "Colaboración"
    }
    return names[type as keyof typeof names] || type
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex flex-col items-center justify-center py-20">
          <p>Cargando...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    redirect("/auth/login")
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Profile Form */}
          <div>
            <ProfileForm user={user} />
          </div>

          {/* Tutorial Controls */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5" />
                  Tutoriales
                </CardTitle>
                <p className="text-sm text-gray-600">
                  Gestiona tus tutoriales y vuelve a verlos cuando quieras.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {message && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                    {message}
                  </div>
                )}

                <div className="space-y-2">
                  <h4 className="font-medium">Reiniciar tutoriales individuales:</h4>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { key: "dashboard", name: "Dashboard" },
                      { key: "create_trip", name: "Crear Viaje" },
                      { key: "trip_management", name: "Gestión de Viaje" },
                      { key: "ai", name: "Recomendaciones IA" },
                      { key: "collaboration", name: "Colaboración" },
                    ].map((tutorial) => (
                      <div key={tutorial.key} className="flex items-center justify-between p-2 border rounded">
                        <span className="text-sm">{tutorial.name}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => resetSpecificTutorial(tutorial.key)}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Reiniciar
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <Button
                    onClick={resetAllTutorials}
                    disabled={resetting}
                    variant="outline"
                    className="w-full"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${resetting ? "animate-spin" : ""}`} />
                    {resetting ? "Reiniciando..." : "Reiniciar Todos los Tutoriales"}
                  </Button>
                </div>

                <div className="text-xs text-gray-500">
                  💡 Los tutoriales aparecerán automáticamente la próxima vez que visites cada sección.
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
