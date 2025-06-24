"use client"

import ProfileForm from "@/components/profile-form"
import { useAuth } from "@/components/auth-provider"
import { redirect } from "next/navigation"

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth()

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <p>Cargando...</p>
      </div>
    )
  }

  if (!user) {
    // Esto no debería suceder si la ruta está protegida por AuthProvider o middleware
    // Pero es una buena práctica tenerlo.
    redirect("/auth/login") // O a tu página de login
    return null // redirect() no detiene la ejecución inmediatamente
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] p-4 bg-gradient-to-br from-slate-50 to-stone-100 dark:from-slate-900 dark:to-stone-950">
      <ProfileForm user={user} />
    </div>
  )
}
