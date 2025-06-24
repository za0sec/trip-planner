"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { signIn, signUp, resetPassword } from "@/lib/auth"
import { Plane, MapPin, DollarSign, Mail, Lock, User, AlertCircle, CheckCircle } from "lucide-react"

export function AuthForm() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [activeTab, setActiveTab] = useState("signin")

  // Sign In Form
  const [signInData, setSignInData] = useState({
    email: "",
    password: "",
  })

  // Sign Up Form
  const [signUpData, setSignUpData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    fullName: "",
  })

  // Reset Password Form
  const [resetEmail, setResetEmail] = useState("")

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      await signIn(signInData.email, signInData.password)
      setMessage({ type: "success", text: "¡Bienvenido de vuelta!" })
      // The auth provider will handle the redirect
    } catch (error: any) {
      setMessage({
        type: "error",
        text:
          error.message === "Invalid login credentials"
            ? "Email o contraseña incorrectos"
            : "Error al iniciar sesión. Intenta de nuevo.",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    if (signUpData.password !== signUpData.confirmPassword) {
      setMessage({ type: "error", text: "Las contraseñas no coinciden" })
      setLoading(false)
      return
    }

    if (signUpData.password.length < 6) {
      setMessage({ type: "error", text: "La contraseña debe tener al menos 6 caracteres" })
      setLoading(false)
      return
    }

    try {
      await signUp(signUpData.email, signUpData.password, signUpData.fullName)
      setMessage({
        type: "success",
        text: "¡Cuenta creada! Revisa tu email para confirmar tu cuenta y luego podrás iniciar sesión.",
      })
      setSignUpData({ email: "", password: "", confirmPassword: "", fullName: "" })
      // Switch to sign in tab after successful registration
      setTimeout(() => setActiveTab("signin"), 3000)
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error.message.includes("already registered")
          ? "Este email ya está registrado"
          : "Error al crear la cuenta. Intenta de nuevo.",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      await resetPassword(resetEmail)
      setMessage({
        type: "success",
        text: "Te hemos enviado un email para restablecer tu contraseña. Revisa tu bandeja de entrada.",
      })
      setResetEmail("")
    } catch (error: any) {
      setMessage({ type: "error", text: "Error al enviar el email. Intenta de nuevo." })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-600 p-3 rounded-full">
              <Plane className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">TravelPlanner</h1>
          <p className="text-gray-600 mt-2">Organiza cualquier viaje, a cualquier destino</p>
        </div>

        <Card>
          <CardHeader className="text-center pb-4">
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="space-y-2">
                <MapPin className="h-8 w-8 text-blue-600 mx-auto" />
                <p className="text-sm text-gray-600">Planifica tu itinerario</p>
              </div>
              <div className="space-y-2">
                <DollarSign className="h-8 w-8 text-green-600 mx-auto" />
                <p className="text-sm text-gray-600">Controla tus gastos</p>
              </div>
              <div className="space-y-2">
                <Plane className="h-8 w-8 text-purple-600 mx-auto" />
                <p className="text-sm text-gray-600">Viaja en pareja</p>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Iniciar Sesión</TabsTrigger>
                <TabsTrigger value="signup">Registrarse</TabsTrigger>
              </TabsList>

              {message && (
                <Alert
                  className={`mt-4 ${message.type === "error" ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}`}
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

              <TabsContent value="signin" className="space-y-4 mt-6">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email" className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Email
                    </Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="tu@email.com"
                      value={signInData.email}
                      onChange={(e) => setSignInData({ ...signInData, email: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signin-password" className="flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      Contraseña
                    </Label>
                    <Input
                      id="signin-password"
                      type="password"
                      placeholder="••••••••"
                      value={signInData.password}
                      onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                      required
                    />
                  </div>

                  <Button type="submit" disabled={loading} className="w-full" size="lg">
                    {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
                  </Button>

                  <div className="text-center">
                    <Button
                      type="button"
                      variant="link"
                      className="text-sm text-blue-600"
                      onClick={() => setActiveTab("reset")}
                    >
                      ¿Olvidaste tu contraseña?
                    </Button>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="space-y-4 mt-6">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name" className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Nombre Completo
                    </Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="Tu nombre completo"
                      value={signUpData.fullName}
                      onChange={(e) => setSignUpData({ ...signUpData, fullName: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Email
                    </Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="tu@email.com"
                      value={signUpData.email}
                      onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      Contraseña
                    </Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      value={signUpData.password}
                      onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm-password" className="flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      Confirmar Contraseña
                    </Label>
                    <Input
                      id="signup-confirm-password"
                      type="password"
                      placeholder="••••••••"
                      value={signUpData.confirmPassword}
                      onChange={(e) => setSignUpData({ ...signUpData, confirmPassword: e.target.value })}
                      required
                    />
                  </div>

                  <Button type="submit" disabled={loading} className="w-full" size="lg">
                    {loading ? "Creando cuenta..." : "Crear Cuenta"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="reset" className="space-y-4 mt-6">
                <div className="text-center mb-4">
                  <h3 className="text-lg font-semibold">Restablecer Contraseña</h3>
                  <p className="text-sm text-gray-600">Te enviaremos un email para restablecer tu contraseña</p>
                </div>

                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reset-email" className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Email
                    </Label>
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="tu@email.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      required
                    />
                  </div>

                  <Button type="submit" disabled={loading} className="w-full" size="lg">
                    {loading ? "Enviando..." : "Enviar Email"}
                  </Button>

                  <div className="text-center">
                    <Button
                      type="button"
                      variant="link"
                      className="text-sm text-blue-600"
                      onClick={() => setActiveTab("signin")}
                    >
                      Volver al inicio de sesión
                    </Button>
                  </div>
                </form>
              </TabsContent>
            </Tabs>

            <p className="text-xs text-gray-500 text-center mt-6">
              Al continuar, aceptas nuestros términos de servicio y política de privacidad
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
