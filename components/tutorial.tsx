// Legacy tutorial component - now using TutorialSystem
// This file is kept for backward compatibility
import { TutorialSystem } from "./tutorial-system"

export function Tutorial() {
  return <TutorialSystem type="dashboard" />
} 