"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/components/auth-provider"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Settings, 
  User, 
  Bell, 
  Shield, 
  Palette, 
  HelpCircle,
  RotateCcw,
  Check,
  Upload,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { TutorialType, useTutorial } from "@/components/tutorial-system"
import { Footer } from "@/components/footer"

interface UserProfile {
  id: string
  full_name: string | null
  avatar_url: string | null
  bio: string | null
  location: string | null
  language: string
  timezone: string
  email_notifications: boolean
  push_notifications: boolean
  marketing_emails: boolean
  dashboard_tutorial_completed: boolean
  create_trip_tutorial_completed: boolean
  trip_management_tutorial_completed: boolean
  ai_tutorial_completed: boolean
  collaboration_tutorial_completed: boolean
  summary_tutorial_completed: boolean
  theme_preference: 'light' | 'dark' | 'system'
  currency_preference: string
  distance_unit: 'km' | 'miles'
  privacy_public_profile: boolean
  privacy_show_trips: boolean
  privacy_show_stats: boolean
}

export default function SettingsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const { resetTutorial, resetAllTutorials } = useTutorial()
  
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState("profile")

  useEffect(() => {
    if (user) {
      fetchProfile()
    }
  }, [user])

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single()

      if (error) throw error
      setProfile(data)
    } catch (error) {
      console.error('Error fetching profile:', error)
      toast({
        title: "Error",
        description: "No se pudo cargar la configuración",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!profile) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user?.id)

      if (error) throw error

      setProfile({ ...profile, ...updates })
      toast({
        title: "Guardado",
        description: "Configuración actualizada correctamente"
      })
    } catch (error) {
      console.error('Error updating profile:', error)
      toast({
        title: "Error",
        description: "No se pudo actualizar la configuración",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const handleResetTutorial = async (tutorialType: TutorialType) => {
    try {
      await resetTutorial(tutorialType as TutorialType)
      toast({
        title: "Tutorial reiniciado",
        description: `El tutorial de ${tutorialType} se mostrará en tu próxima visita`
      })
      // Actualizar el estado local
      const updateKey = `${tutorialType}_tutorial_completed` as keyof UserProfile
      await updateProfile({ [updateKey]: false })
    } catch {
      toast({
        title: "Error",
        description: "No se pudo reiniciar el tutorial",
        variant: "destructive"
      })
    }
  }

  const handleResetAllTutorials = async () => {
    try {
      await resetAllTutorials()
      toast({
        title: "Todos los tutoriales reiniciados",
        description: "Los tutoriales se mostrarán en tus próximas visitas"
      })
      // Actualizar el estado local
      await updateProfile({
        dashboard_tutorial_completed: false,
        create_trip_tutorial_completed: false,
        trip_management_tutorial_completed: false,
        ai_tutorial_completed: false,
        collaboration_tutorial_completed: false,
        summary_tutorial_completed: false
      })
    } catch {
      toast({
        title: "Error",
        description: "No se pudo reiniciar los tutoriales",
        variant: "destructive"
      })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Settings className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Cargando configuración...</p>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Settings className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Error al cargar configuración</h2>
          <p className="text-gray-600 dark:text-gray-400">No se pudo acceder a tu perfil</p>
        </div>
      </div>
    )
  }

  const tutorialStatus = [
    { key: 'dashboard', name: 'Panel Principal', completed: profile.dashboard_tutorial_completed },
    { key: 'create_trip', name: 'Crear Viaje', completed: profile.create_trip_tutorial_completed },
    { key: 'trip_management', name: 'Gestión de Viajes', completed: profile.trip_management_tutorial_completed },
    { key: 'ai', name: 'Recomendaciones IA', completed: profile.ai_tutorial_completed },
    { key: 'collaboration', name: 'Colaboración', completed: profile.collaboration_tutorial_completed },
    { key: 'summary', name: 'Resúmenes', completed: profile.summary_tutorial_completed }
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <div className="flex-1">
        <div className="max-w-4xl mx-auto p-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Configuración
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Personaliza tu experiencia en Trip Planner
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="profile" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Perfil
              </TabsTrigger>
              <TabsTrigger value="notifications" className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Notificaciones
              </TabsTrigger>
              <TabsTrigger value="tutorials" className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4" />
                Tutoriales
              </TabsTrigger>
              <TabsTrigger value="preferences" className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Preferencias
              </TabsTrigger>
              <TabsTrigger value="privacy" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Privacidad
              </TabsTrigger>
            </TabsList>

            {/* Perfil */}
            <TabsContent value="profile" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Información Personal
                  </CardTitle>
                  <CardDescription>
                    Actualiza tu información de perfil y foto
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Avatar */}
                  <div className="flex items-center gap-4">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src={profile.avatar_url || undefined} />
                      <AvatarFallback className="text-lg">
                        {profile.full_name?.charAt(0) || user?.email?.charAt(0) || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-2">
                      <Button variant="outline" size="sm">
                        <Upload className="h-4 w-4 mr-2" />
                        Cambiar foto
                      </Button>
                      <p className="text-xs text-gray-500">
                        JPG, PNG o GIF. Máximo 2MB.
                      </p>
                    </div>
                  </div>

                  <Separator />

                  {/* Información básica */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="full_name">Nombre completo</Label>
                      <Input
                        id="full_name"
                        value={profile.full_name || ''}
                        onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                        placeholder="Tu nombre completo"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        value={user?.email || ''}
                        disabled
                        className="bg-gray-50 dark:bg-gray-800"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bio">Biografía</Label>
                    <Textarea
                      id="bio"
                      value={profile.bio || ''}
                      onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                      placeholder="Cuéntanos sobre ti..."
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="location">Ubicación</Label>
                    <Input
                      id="location"
                      value={profile.location || ''}
                      onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                      placeholder="Ciudad, País"
                    />
                  </div>

                  <Button 
                    onClick={() => updateProfile({
                      full_name: profile.full_name,
                      bio: profile.bio,
                      location: profile.location
                    })}
                    disabled={saving}
                  >
                    {saving ? 'Guardando...' : 'Guardar cambios'}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tutoriales */}
            <TabsContent value="tutorials" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HelpCircle className="h-5 w-5" />
                    Gestión de Tutoriales
                  </CardTitle>
                  <CardDescription>
                    Controla qué tutoriales has completado y reinicia los que necesites
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    {tutorialStatus.map((tutorial) => (
                      <div key={tutorial.key} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-full ${tutorial.completed ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                            <Check className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium">{tutorial.name}</p>
                            <p className="text-sm text-gray-500">
                              {tutorial.completed ? 'Completado' : 'Pendiente'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={tutorial.completed ? 'default' : 'secondary'}>
                            {tutorial.completed ? 'Completado' : 'Pendiente'}
                          </Badge>
                          {tutorial.completed && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleResetTutorial(tutorial.key as TutorialType)}
                            >
                              <RotateCcw className="h-4 w-4 mr-1" />
                              Reiniciar
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div>
                      <p className="font-medium text-blue-900 dark:text-blue-100">
                        Reiniciar todos los tutoriales
                      </p>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        Esto marcará todos los tutoriales como no completados
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={handleResetAllTutorials}
                      className="border-blue-300 text-blue-700 hover:bg-blue-100"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Reiniciar todos
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Otras tabs básicas */}
            <TabsContent value="notifications" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Notificaciones
                  </CardTitle>
                  <CardDescription>
                    Próximamente: Configuración de notificaciones
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-500">Esta sección estará disponible pronto.</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="preferences" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="h-5 w-5" />
                    Preferencias
                  </CardTitle>
                  <CardDescription>
                    Próximamente: Personalización de la aplicación
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-500">Esta sección estará disponible pronto.</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="privacy" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Privacidad
                  </CardTitle>
                  <CardDescription>
                    Próximamente: Configuración de privacidad
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-500">Esta sección estará disponible pronto.</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <Footer />
    </div>
  )
} 