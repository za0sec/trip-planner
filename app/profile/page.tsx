"use client"

import ProfileForm from "@/components/profile-form"
import { useAuth } from "@/components/auth-provider"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { redirect } from "next/navigation"

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth()

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Navbar />
        <div className="flex flex-col items-center justify-center py-20 flex-1">
          <p>Cargando...</p>
        </div>
        <Footer />
      </div>
    )
  }

  if (!user) {
    redirect("/auth/login")
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-2xl flex-1">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Mi Perfil</h1>
          <p className="text-gray-600">
            Actualiza tu información personal y preferencias de cuenta
          </p>
        </div>
        
        <ProfileForm user={user} />
      </div>
      <Footer />
    </div>
  )
}
