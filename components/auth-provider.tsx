"use client"

import type React from "react"

import { createContext, useContext, useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"

interface AuthContextType {
  user: User | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const initializeAuth = async () => {
      try {
        console.log("🔄 Initializing auth...")

        // Get the current session
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession()

        if (error) {
          console.error("❌ Error getting session:", error)
        }

        console.log("📋 Session status:", session ? `Found user: ${session.user?.email}` : "No session")

        if (mounted) {
          setUser(session?.user ?? null)
          setLoading(false)
        }
      } catch (error) {
        console.error("❌ Error in initializeAuth:", error)
        if (mounted) {
          setUser(null)
          setLoading(false)
        }
      }
    }

    initializeAuth()

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      console.log("🔄 Auth state changed:", event, session?.user?.email || "no user")
      setUser(session?.user ?? null)
      setLoading(false)

      // Create profile in background when user signs in
      if (session?.user && event === "SIGNED_IN") {
        createProfileInBackground(session.user)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  // Create profile without blocking the UI
  const createProfileInBackground = async (user: User) => {
    try {
      console.log("👤 Creating/updating profile for:", user.email)

      const { error } = await supabase.from("profiles").upsert(
        {
          id: user.id,
          email: user.email!,
          full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Usuario",
          avatar_url: user.user_metadata?.avatar_url || null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "id",
        },
      )

      if (error) {
        console.error("❌ Error upserting profile:", error)
      } else {
        console.log("✅ Profile upserted successfully")
        console.log(`⏳ Intentando procesar invitaciones existentes para ${user.email} con ID ${user.id}`)

        // Procesar invitaciones pendientes para usuarios existentes
        try {
          await supabase.rpc("process_existing_invitations", {
            user_email: user.email!,
            user_id: user.id,
          })
          console.log("✅ Processed pending invitations")
        } catch (inviteError) {
          console.error(`❌ Error procesando invitaciones existentes para ${user.email}:`, inviteError)
        }
      }
    } catch (error) {
      console.error("❌ Error in createProfileInBackground:", error)
    }
  }

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>
}
