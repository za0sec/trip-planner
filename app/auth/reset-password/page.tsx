"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Lock, CheckCircle, AlertCircle, Loader2 } from "lucide-react"

export default function ResetPasswordPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [isValidSession, setIsValidSession] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  useEffect(() => {
    // Check if user has a valid recovery session
    const checkRecoverySession = async () => {
      try {
        console.log('🔍 Checking for recovery session...')
        
        // Get the current session
        const { data: { session }, error } = await supabase.auth.getSession()
        
        console.log('Session:', session)
        console.log('Error:', error)

        if (error) {
          console.error('❌ Error getting session:', error)
          setMessage({
            type: "error",
            text: "Error al verificar la sesión. Por favor, solicita un nuevo enlace de restablecimiento.",
          })
          setIsValidSession(false)
        } else if (session) {
          console.log('✅ Valid recovery session found')
          setIsValidSession(true)
          setMessage(null)
        } else {
          console.log('⚠️ No session found')
          setMessage({
            type: "error",
            text: "Link inválido o expirado. Por favor, solicita un nuevo enlace de restablecimiento.",
          })
          setIsValidSession(false)
        }
      } catch (err) {
        console.error('❌ Exception checking session:', err)
        setMessage({
          type: "error",
          text: "Error al verificar la sesión.",
        })
        setIsValidSession(false)
      } finally {
        setCheckingAuth(false)
      }
    }

    checkRecoverySession()

    // Listen for hash changes (Supabase sends tokens in URL hash)
    const handleHashChange = () => {
      console.log('🔄 Hash changed, rechecking session...')
      checkRecoverySession()
    }

    window.addEventListener('hashchange', handleHashChange)

    // Also check immediately if there's a hash
    if (window.location.hash) {
      console.log('🔗 Hash detected:', window.location.hash)
      // Give Supabase a moment to process the hash
      setTimeout(checkRecoverySession, 500)
    }

    return () => {
      window.removeEventListener('hashchange', handleHashChange)
    }
  }, [])

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    if (password !== confirmPassword) {
      setMessage({ type: "error", text: "Las contraseñas no coinciden" })
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setMessage({ type: "error", text: "La contraseña debe tener al menos 6 caracteres" })
      setLoading(false)
      return
    }

    try {
      console.log('🔐 Updating password...')
      
      const { data, error } = await supabase.auth.updateUser({
        password: password,
      })

      if (error) {
        console.error('❌ Error updating password:', error)
        throw error
      }

      console.log('✅ Password updated successfully:', data)

      setMessage({
        type: "success",
        text: "¡Contraseña actualizada exitosamente! Redirigiendo...",
      })

      // Sign out and redirect to login
      setTimeout(async () => {
        await supabase.auth.signOut()
        router.push("/")
      }, 2000)
    } catch (error) {
      console.error('❌ Exception updating password:', error)
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Error al actualizar la contraseña. Intenta de nuevo.",
      })
    } finally {
      setLoading(false)
    }
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Verificando enlace de recuperación...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-3 mb-2">
              <Image src="/images/logo.png" alt="Trip Planner" width={24} height={24} className="h-6 w-6" />
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Restablecer Contraseña
              </CardTitle>
            </div>
            <CardDescription>
              {isValidSession 
                ? "Ingresa tu nueva contraseña" 
                : "Necesitas un enlace válido para restablecer tu contraseña"
              }
            </CardDescription>
          </CardHeader>

          <CardContent>
            {message && (
              <Alert
                className={`mb-4 ${message.type === "error" ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}`}
              >
                {message.type === "error" ? (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                ) : (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                )}
                <AlertDescription className={message.type === "error" ? "text-red-800" : "text-green-800"}>
                  {message.text}
                </AlertDescription>
              </Alert>
            )}

            {!isValidSession ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-600 text-center">
                  El enlace de restablecimiento ha expirado o es inválido.
                </p>
                <Button 
                  onClick={() => router.push("/")} 
                  className="w-full" 
                  variant="outline"
                >
                  Volver al inicio y solicitar nuevo enlace
                </Button>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Nueva Contraseña</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                  <p className="text-xs text-gray-500">Mínimo 6 caracteres</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar Nueva Contraseña</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>

                <Button 
                  type="submit" 
                  disabled={loading || !password || !confirmPassword} 
                  className="w-full" 
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Actualizando...
                    </>
                  ) : (
                    "Actualizar Contraseña"
                  )}
                </Button>
              </form>
            )}

            <div className="text-center mt-4">
              <Button variant="link" onClick={() => router.push("/")} className="text-sm text-blue-600">
                Volver al inicio
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
