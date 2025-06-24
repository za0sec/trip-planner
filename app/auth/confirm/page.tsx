"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function ConfirmPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const handleEmailConfirmation = async () => {
      try {
        const token_hash = searchParams.get("token_hash")
        const type = searchParams.get("type")

        if (token_hash && type) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash,
            type: type as "signup" | "invite" | "magiclink" | "recovery" | "email_change" | "email",
          })

          if (error) {
            console.error("Error confirming email:", error)
            router.push("/?error=confirmation_error")
            return
          }

          // Email confirmed successfully
          router.push("/dashboard?message=email_confirmed")
        } else {
          // No tokens, redirect to home
          router.push("/")
        }
      } catch (error) {
        console.error("Unexpected error during confirmation:", error)
        router.push("/?error=unexpected_error")
      }
    }

    handleEmailConfirmation()
  }, [router, searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Confirmando tu cuenta...</p>
      </div>
    </div>
  )
}
