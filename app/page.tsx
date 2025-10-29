
"use client"

import { useAuth } from "@/components/auth-provider"
import { AuthForm } from "@/components/auth-form"
import { Footer } from "@/components/footer"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, AlertCircle } from "lucide-react"

export default function HomePage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const message = searchParams.get("message")
  const error = searchParams.get("error")

  useEffect(() => {
    // Only redirect if we're not loading and we have a user
    // BUT don't redirect if we're in the middle of a password reset
    if (!loading && user) {
      // Check if this is a password recovery session by looking at the URL hash
      const isPasswordReset = window.location.hash.includes('type=recovery')
      
      if (!isPasswordReset) {
        console.log("🏠 Redirecting authenticated user to dashboard")
        router.push("/dashboard")
      } else {
        console.log("🔐 Password recovery flow detected, not redirecting")
      }
    }
  }, [user, loading, router])

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando sesión...</p>
        </div>
      </div>
    )
  }

  // If user is authenticated, don't show the auth form (redirect will happen)
  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirigiendo...</p>
        </div>
      </div>
    )
  }

  // Show auth form for non-authenticated users
  return (
    <div className="min-h-screen flex flex-col">
      {message === "email_confirmed" && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              ¡Email confirmado exitosamente! Ya puedes iniciar sesión.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {error && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              {error === "confirmation_error"
                ? "Error al confirmar el email. El enlace puede haber expirado."
                : "Ocurrió un error inesperado."}
            </AlertDescription>
          </Alert>
        </div>
      )}

      <div className="flex-1">
        <AuthForm />
      </div>
      <Footer />
    </div>
  )
}

