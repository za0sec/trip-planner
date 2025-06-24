"use client"

import { useState, useEffect, type FormEvent, type ChangeEvent } from "react"
import { supabase } from "@/lib/supabase"
import type { User } from "@supabase/supabase-js"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface ProfileFormProps {
  user: User
}

export default function ProfileForm({ user }: ProfileFormProps) {
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [fullName, setFullName] = useState<string>("")
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [currentAvatarPreview, setCurrentAvatarPreview] = useState<string | null>(null)
  const [newAvatarFile, setNewAvatarFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  useEffect(() => {
    async function getProfile() {
      console.log("ProfileForm: Fetching profile for user:", user.id)
      setLoading(true)
      const { data, error } = await supabase.from("profiles").select("full_name, avatar_url").eq("id", user.id).single()

      if (error) {
        console.error("ProfileForm: Error fetching profile:", error)
        toast({ title: "Error", description: "No se pudo cargar el perfil.", variant: "destructive" })
      } else if (data) {
        console.log("ProfileForm: Profile data fetched:", data)
        setFullName(data.full_name || "")
        setAvatarUrl(data.avatar_url)
        setCurrentAvatarPreview(data.avatar_url)
      }
      setLoading(false)
    }
    if (user) {
      getProfile()
    }
  }, [user, toast])

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0]
      setNewAvatarFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setCurrentAvatarPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    } else {
      setNewAvatarFile(null)
      setCurrentAvatarPreview(avatarUrl)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user || !user.email) {
      // Asegurarse que user.email existe
      console.error("ProfileForm: No user or user email found on submit.")
      toast({ title: "Error", description: "No se pudo obtener la información del usuario.", variant: "destructive" })
      return
    }

    setLoading(true)
    setIsUploading(false)
    let newPublicAvatarUrl = avatarUrl

    console.log(
      "ProfileForm: handleSubmit initiated. Current fullName:",
      fullName,
      "New avatar file:",
      newAvatarFile?.name,
    )

    if (newAvatarFile) {
      setIsUploading(true)
      console.log("ProfileForm: Uploading new avatar...")
      const fileExt = newAvatarFile.name.split(".").pop()
      const fileName = `${user.id}.${fileExt}`
      const filePath = fileName

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, newAvatarFile, { upsert: true })

      if (uploadError) {
        console.error("ProfileForm: Error uploading avatar:", uploadError)
        toast({ title: "Error al subir avatar", description: uploadError.message, variant: "destructive" })
        setLoading(false)
        setIsUploading(false)
        return
      }

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath)
      newPublicAvatarUrl = urlData.publicUrl
      console.log("ProfileForm: New avatar URL:", newPublicAvatarUrl)
      setIsUploading(false)
    }

    const updates = {
      id: user.id,
      email: user.email, // <--- AÑADIR ESTA LÍNEA
      full_name: fullName,
      avatar_url: newPublicAvatarUrl,
    }
    console.log("ProfileForm: Attempting to upsert profile with data:", updates)

    const { error: profileError } = await supabase.from("profiles").upsert(updates)
    console.log("ProfileForm: Profile upsert result - error:", profileError)

    if (profileError) {
      toast({ title: "Error al actualizar perfil en DB", description: profileError.message, variant: "destructive" })
    } else {
      console.log("ProfileForm: Profile DB update successful. Attempting to update auth user metadata.")
      const { error: authUserError } = await supabase.auth.updateUser({
        data: {
          full_name: fullName,
          avatar_url: newPublicAvatarUrl,
        },
      })
      console.log("ProfileForm: Auth user update result - error:", authUserError)

      if (authUserError) {
        toast({
          title: "Advertencia",
          description: `Perfil en DB actualizado, pero error al actualizar metadatos de sesión: ${authUserError.message}`,
          variant: "default",
        })
      } else {
        toast({ title: "Éxito", description: "Perfil actualizado correctamente." })
      }
      setAvatarUrl(newPublicAvatarUrl)
      setNewAvatarFile(null)
    }
    setLoading(false)
  }

  const getInitials = (name: string) => {
    if (!name) return "?"
    const names = name.split(" ")
    if (names.length === 1) return names[0].substring(0, 2).toUpperCase()
    return (names[0][0] + names[names.length - 1][0]).toUpperCase()
  }

  if (loading && !currentAvatarPreview && !fullName && user?.email === undefined) {
    return <p>Cargando perfil...</p>
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Tu Perfil</CardTitle>
        <CardDescription>Actualiza tu información personal y foto de perfil.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center space-y-4">
            <Avatar className="h-24 w-24">
              <AvatarImage src={currentAvatarPreview || undefined} alt={fullName || user?.email || "Avatar"} />
              <AvatarFallback>{getInitials(fullName || user?.email || "")}</AvatarFallback>
            </Avatar>
            <Input
              id="avatar"
              type="file"
              accept="image/png, image/jpeg, image/gif"
              onChange={handleFileChange}
              disabled={loading}
              className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
            />
            {isUploading && <p className="text-sm text-blue-500">Subiendo avatar...</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={user?.email || ""} disabled />
            <p className="text-xs text-gray-500">El email no se puede cambiar.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="fullName">Nombre Completo</Label>
            <Input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={loading}
              required
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={loading || isUploading}>
            {loading ? "Guardando..." : "Guardar Cambios"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
