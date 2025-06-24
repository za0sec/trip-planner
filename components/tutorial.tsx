// Legacy tutorial component - now using TutorialSystem
// This file is kept for backward compatibility
import { TutorialSystem } from "./tutorial-system"

interface TutorialProps {
  onComplete?: () => void
}

export function Tutorial({ onComplete }: TutorialProps) {
  return <TutorialSystem type="dashboard" onComplete={onComplete} />
} 