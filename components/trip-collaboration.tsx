"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useAuth } from "@/components/auth-provider"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Users, UserPlus, Mail, Crown, Edit, Eye, Trash2, CheckCircle, Clock, X, AlertCircle } from "lucide-react"

interface TripMember {
  id: string
  user_id: string
  role: string
  status: string
  joined_at: string | null
  profiles: {
    // Esta es la estructura esperada
    email: string
    full_name: string | null
    avatar_url: string | null
  } | null // Puede ser null si el perfil no se encuentra, aunque con !inner no debería
}

interface TripInvitation {
  id: string
  email: string
  role: string
  status: string
  expires_at: string
  created_at: string
  email_status?: string
  sent_at?: string
}

interface TripCollaborationProps {
  tripId: string
  isOwner: boolean
}

interface TripInfo {
  id: string
  title: string
  destination: string
  description: string | null
  created_by: string
  profiles: {
    full_name: string | null
    email: string
  }
}

const roleIcons = {
  owner: Crown,
  editor: Edit,
  viewer: Eye,
}

const roleLabels = {
  owner: "Propietario",
  editor: "Editor",
  viewer: "Visualizador",
}

    // const roleDescriptions = {
  //   owner: "Control total del viaje",
  //   editor: "Puede agregar y editar elementos",
  //   viewer: "Solo puede ver el viaje",
  // }

export function TripCollaboration({ tripId, isOwner }: TripCollaborationProps) {
  const { user } = useAuth()
  const [members, setMembers] = useState<TripMember[]>([])
  const [invitations, setInvitations] = useState<TripInvitation[]>([])
  const [tripInfo, setTripInfo] = useState<TripInfo | null>(null)
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [loading, setLoading] = useState(true)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const [inviteForm, setInviteForm] = useState({
    email: "",
    role: "editor",
  })

  useEffect(() => {
    fetchCollaborationData()
    fetchTripInfo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId])

  const fetchTripInfo = async () => {
    try {
      const { data, error } = await supabase
        .from("trips")
        .select(`
          id,
          title,
          destination,
          description,
          created_by,
          profiles (
            full_name,
            email
          )
        `)
        .eq("id", tripId)
        .single()

      if (error) {
        console.error("Error fetching trip info:", error)
      } else {
        setTripInfo(data as unknown as TripInfo)
      }
    } catch (error) {
      console.error("Error fetching trip info:", error)
    }
  }

  const fetchCollaborationData = async () => {
    setLoading(true)
    try {
      // Fetch members
      const { data: membersData, error: membersError } = await supabase
        .from("trip_members")
        .select(`
          id,
          user_id,
          role,
          status,
          joined_at,
          profiles!user_id!inner ( 
            email,
            full_name,
            avatar_url
          )
        `)
        .eq("trip_id", tripId)
        .order("joined_at", { ascending: true })

      if (membersError) {
        console.error("Error fetching members:", membersError) // Este es el error que se está mostrando
        setMessage({ type: "error", text: `Error al cargar colaboradores: ${membersError.message}` })
        setMembers([]) // Limpiar miembros si hay error
      } else {
        // Asegurarse de que profiles no sea null antes de acceder a sus propiedades
        const validMembers = (membersData || []).map((member) => ({
          ...member,
          profiles: member.profiles || { email: "N/A", full_name: "Usuario Desconocido", avatar_url: null },
        })) as unknown as TripMember[]
        setMembers(validMembers)
      }

      // Fetch pending invitations
      const { data: invitationsData, error: invitationsError } = await supabase
        .from("trip_invitations")
        .select("*")
        .eq("trip_id", tripId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })

      if (invitationsError) {
        console.error("Error fetching invitations:", invitationsError)
        setMessage({ type: "error", text: `Error al cargar invitaciones: ${invitationsError.message}` })
      } else {
        setInvitations(invitationsData || [])
      }
    } catch (error: unknown) {
      console.error("Error fetching collaboration data:", error)
              setMessage({ type: "error", text: `Error general al cargar datos: ${(error as Error).message}` })
    } finally {
      setLoading(false)
    }
  }

  // Update the sendInvitation function to handle the API route properly
  const sendInvitation = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviteLoading(true)
    setMessage(null)

    try {
      // Verificar si el email invitado ya tiene un perfil
      const { data: invitedProfile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", inviteForm.email)
        .single()

      if (profileError && profileError.code !== "PGRST116") {
        // PGRST116: no rows returned
        console.error("Error fetching invited profile:", profileError)
        throw profileError
      }

      let invitationMessage = ""

      if (invitedProfile) {
        // El usuario ya existe. Usamos UPSERT para crear o actualizar la invitación.
        // Esto soluciona el problema de invitaciones "fantasma" o de re-invitar a alguien.
        console.log("Invited user profile exists:", invitedProfile.id, ". Using upsert.")
        const { error: memberError } = await supabase.from("trip_members").upsert(
          {
            trip_id: tripId,
            user_id: invitedProfile.id,
            role: inviteForm.role,
            invited_by: user?.id,
            status: "pending", // Forzamos el estado a 'pending' para que sea visible
            joined_at: null, // Reseteamos la fecha de unión
          },
          {
            onConflict: "trip_id,user_id", // La restricción única que causaba el error
          },
        )

        if (memberError) {
          console.error("Error upserting trip member invitation:", memberError)
          setMessage({ type: "error", text: "Error al procesar la invitación. Por favor, intenta de nuevo." })
          return
        }

        invitationMessage = "Invitación enviada. La persona podrá verla en su dashboard."
        setMessage({ type: "success", text: invitationMessage })
      } else {
        // El usuario no existe, crear una invitación por email en trip_invitations
        console.log("Invited user profile does NOT exist. Creating email invitation.")
        const { data: invitationRecord, error: inviteError } = await supabase
          .from("trip_invitations")
          .insert({
            trip_id: tripId,
            email: inviteForm.email,
            role: inviteForm.role,
            invited_by: user?.id,
            // token, expires_at, status son generados por defecto por la DB
          })
          .select()
          .single()

        if (inviteError) {
          if (inviteError.code === "23505") {
            setMessage({ type: "error", text: "Ya hay una invitación pendiente para este email." })
          } else {
            console.error("Error creating email invitation:", inviteError)
            throw inviteError
          }
          return
        }

        // Enviar email usando la API route
        if (tripInfo && invitationRecord) {
          try {
            const invitationUrl = `${window.location.origin}/invitations/${invitationRecord.token}`
            const emailResponse = await fetch("/api/send-invitation", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                to: inviteForm.email,
                tripTitle: tripInfo.title,
                tripDestination: tripInfo.destination,
                tripDescription: tripInfo.description || undefined,
                inviterName: tripInfo.profiles.full_name || tripInfo.profiles.email,
                inviterEmail: tripInfo.profiles.email,
                invitationUrl,
                role: inviteForm.role,
              }),
            })

            if (emailResponse.ok) {
              await supabase
                .from("trip_invitations")
                .update({ email_status: "sent", sent_at: new Date().toISOString() })
                .eq("id", invitationRecord.id)
              invitationMessage = "Invitación enviada por email. La persona recibirá un correo para unirse."
            } else {
              throw new Error("Failed to send email via API route")
            }
          } catch (emailError) {
            console.error("Error sending email via API route:", emailError)
            await supabase.from("trip_invitations").update({ email_status: "failed" }).eq("id", invitationRecord.id)
            invitationMessage =
              "Invitación creada, pero hubo un problema al enviar el email. El usuario podrá unirse si se registra con ese email."
          }
        }
        setMessage({ type: "success", text: invitationMessage })
      }

      setInviteForm({ email: "", role: "editor" })
      setShowInviteDialog(false)
      fetchCollaborationData()
    } catch (error: unknown) {
      console.error("Error general en sendInvitation:", error)
              setMessage({ type: "error", text: (error as Error).message || "Error al enviar la invitación." })
    } finally {
      setInviteLoading(false)
    }
  }

  // Update resendInvitation function too
  const resendInvitation = async (invitationId: string, email: string, token: string) => {
    if (!tripInfo) return

    try {
      const invitationUrl = `${window.location.origin}/invitations/${token}`

      const emailResponse = await fetch("/api/send-invitation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: email,
          tripTitle: tripInfo.title,
          tripDestination: tripInfo.destination,
          tripDescription: tripInfo.description || undefined,
          inviterName: tripInfo.profiles.full_name || tripInfo.profiles.email,
          inviterEmail: tripInfo.profiles.email,
          invitationUrl,
          role: invitations.find((inv) => inv.id === invitationId)?.role || "editor",
        }),
      })

      if (emailResponse.ok) {
        // Update invitation status
        await supabase
          .from("trip_invitations")
          .update({
            email_status: "sent",
            sent_at: new Date().toISOString(),
          })
          .eq("id", invitationId)

        setMessage({ type: "success", text: "Email reenviado exitosamente" })
      } else {
        throw new Error("Failed to resend email")
      }

      fetchCollaborationData()
    } catch (error) {
      console.error("Error resending email:", error)
      setMessage({ type: "error", text: "Error al reenviar el email" })
    }
  }

  const removeMember = async (memberId: string) => {
    if (!confirm("¿Estás seguro de que quieres remover a esta persona del viaje?")) return

    try {
      const { error } = await supabase.from("trip_members").delete().eq("id", memberId)

      if (error) throw error

      setMessage({ type: "success", text: "Persona removida del viaje" })
      fetchCollaborationData()
    } catch (error) {
      console.error("Error removing member:", error)
      setMessage({ type: "error", text: "Error al remover a la persona" })
    }
  }

  const cancelInvitation = async (invitationId: string) => {
    try {
      const { error } = await supabase.from("trip_invitations").delete().eq("id", invitationId)

      if (error) throw error

      setMessage({ type: "success", text: "Invitación cancelada" })
      fetchCollaborationData()
    } catch (error) {
      console.error("Error canceling invitation:", error)
      setMessage({ type: "error", text: "Error al cancelar la invitación" })
    }
  }

  const updateMemberRole = async (memberId: string, newRole: string) => {
    try {
      const { error } = await supabase.from("trip_members").update({ role: newRole }).eq("id", memberId)

      if (error) throw error

      setMessage({ type: "success", text: "Rol actualizado" })
      fetchCollaborationData()
    } catch (error) {
      console.error("Error updating role:", error)
      setMessage({ type: "error", text: "Error al actualizar el rol" })
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="space-y-2">
              <div className="h-12 bg-gray-200 rounded"></div>
              <div className="h-12 bg-gray-200 rounded"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {message && (
        <Alert className={`${message.type === "error" ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}`}>
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Colaboradores ({members.filter((m) => m.status === "accepted").length})
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">Personas que pueden ver y editar este viaje</p>
          </div>
          {isOwner && (
            <Button onClick={() => setShowInviteDialog(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Invitar Persona
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {members
              .filter((m) => m.status === "accepted")
              .map((member) => {
                const RoleIcon = roleIcons[member.role as keyof typeof roleIcons]
                // Asegurarse de que member.profiles no sea null
                const profile = member.profiles || { email: "N/A", full_name: "Usuario Desconocido", avatar_url: null }
                return (
                  <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={profile.avatar_url || undefined} />
                        <AvatarFallback>{profile.full_name?.charAt(0) || profile.email.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{profile.full_name || profile.email}</div>
                        <div className="text-sm text-gray-600">{profile.email}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="flex items-center gap-1">
                        <RoleIcon className="h-3 w-3" />
                        {roleLabels[member.role as keyof typeof roleLabels]}
                      </Badge>

                      {isOwner && member.role !== "owner" && (
                        <div className="flex items-center gap-1">
                          <Select value={member.role} onValueChange={(value) => updateMemberRole(member.id, value)}>
                            <SelectTrigger className="w-32 h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="editor">Editor</SelectItem>
                              <SelectItem value="viewer">Visualizador</SelectItem>
                            </SelectContent>
                          </Select>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeMember(member.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

            {members.filter((m) => m.status === "accepted").length === 0 && (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Solo tú tienes acceso a este viaje</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      {(invitations.length > 0 || members.filter((m) => m.status === "pending").length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Invitaciones Pendientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Email invitations */}
              {invitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between p-3 border rounded-lg bg-yellow-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-yellow-100 rounded-lg">
                      <Mail className="h-4 w-4 text-yellow-600" />
                    </div>
                    <div>
                      <div className="font-medium">{invitation.email}</div>
                      <div className="text-sm text-gray-600">
                        Invitado como {roleLabels[invitation.role as keyof typeof roleLabels]}
                        {invitation.email_status && (
                          <span
                            className={`ml-2 ${
                              invitation.email_status === "sent"
                                ? "text-green-600"
                                : invitation.email_status === "failed"
                                  ? "text-red-600"
                                  : "text-gray-600"
                            }`}
                          >
                            • Email{" "}
                            {invitation.email_status === "sent"
                              ? "enviado"
                              : invitation.email_status === "failed"
                                ? "falló"
                                : "pendiente"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-yellow-700 border-yellow-300">
                      Pendiente
                    </Badge>
                    {isOwner && (
                      <div className="flex items-center gap-1">
                        {invitation.email_status === "failed" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => resendInvitation(invitation.id, invitation.email, '')}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          >
                            Reenviar
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => cancelInvitation(invitation.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* User invitations */}
              {members
                .filter((m) => m.status === "pending")
                .map((member) => {
                  // Asegurarse de que member.profiles no sea null
                  const profile = member.profiles || {
                    email: "N/A",
                    full_name: "Usuario Desconocido",
                    avatar_url: null,
                  }
                  return (
                    <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg bg-blue-50">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={profile.avatar_url || undefined} />
                          <AvatarFallback>{profile.full_name?.charAt(0) || profile.email.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{profile.full_name || profile.email}</div>
                          <div className="text-sm text-gray-600">
                            Invitado como {roleLabels[member.role as keyof typeof roleLabels]}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-blue-700 border-blue-300">
                          Pendiente
                        </Badge>
                        {isOwner && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeMember(member.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invite Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invitar Persona al Viaje</DialogTitle>
          </DialogHeader>

          <form onSubmit={sendInvitation} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email de la persona</Label>
              <Input
                id="email"
                type="email"
                placeholder="persona@ejemplo.com"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Rol en el viaje</Label>
              <Select value={inviteForm.role} onValueChange={(value) => setInviteForm({ ...inviteForm, role: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="editor">
                    <div className="flex items-center gap-2">
                      <Edit className="h-4 w-4" />
                      <div>
                        <div>Editor</div>
                        <div className="text-xs text-gray-500">Puede agregar y editar elementos</div>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="viewer">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      <div>
                        <div>Visualizador</div>
                        <div className="text-xs text-gray-500">Solo puede ver el viaje</div>
                      </div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">📧 ¿Cómo funciona?</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• La persona recibirá un email con un enlace de invitación</li>
                <li>• Si no tiene cuenta, podrá crear una con el mismo email</li>
                <li>• El enlace expira en 7 días</li>
                <li>• Puedes cambiar los permisos más tarde</li>
              </ul>
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowInviteDialog(false)} className="flex-1">
                Cancelar
              </Button>
              <Button type="submit" disabled={inviteLoading || !inviteForm.email} className="flex-1">
                {inviteLoading ? "Enviando..." : "Enviar Invitación"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
