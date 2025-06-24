"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/components/auth-provider"
import { supabase } from "@/lib/supabase"
import { TutorialType } from "@/components/tutorial-system"

interface AutoTutorialState {
  shouldShowTutorial: boolean
  tutorialType: TutorialType | null
  isFirstVisit: boolean
}

export function useAutoTutorial(pageType: TutorialType): AutoTutorialState {
  const { user } = useAuth()
  const [state, setState] = useState<AutoTutorialState>({
    shouldShowTutorial: false,
    tutorialType: null,
    isFirstVisit: false
  })

  useEffect(() => {
    const checkAndShowTutorial = async () => {
      if (!user) return

      try {
        const fieldName = `${pageType}_tutorial_completed`
        const { data, error } = await supabase
          .from("profiles")
          .select(fieldName)
          .eq("id", user.id)
          .single()

        if (error) {
          console.error(`Error checking ${pageType} tutorial status:`, error)
          return
        }

        const completed = (data as unknown as Record<string, unknown>)?.[fieldName] as boolean ?? false
        const isFirstVisit = !completed

        setState({
          shouldShowTutorial: isFirstVisit,
          tutorialType: isFirstVisit ? pageType : null,
          isFirstVisit
        })

      } catch (error) {
        console.error(`Error in useAutoTutorial for ${pageType}:`, error)
      }
    }

    checkAndShowTutorial()
  }, [user, pageType])

  return state
} 