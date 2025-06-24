import { ExternalLink } from "lucide-react"

export function Footer() {
  return (
    <footer className="mt-auto border-t border-gradient-to-r from-blue-200 via-purple-200 to-pink-200 dark:from-blue-800 dark:via-purple-800 dark:to-pink-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 text-sm">
          <span className="text-gray-600 dark:text-gray-300">
            Hecho por
          </span>
          <a
            href="https://www.linkedin.com/in/javier-peral-belmont-854052208/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 bg-gradient-to-r from-blue-500 to-blue-700 bg-clip-text text-transparent hover:from-blue-600 hover:to-blue-800 font-semibold transition-all duration-300 transform hover:scale-105"
          >
            Javier Peral Belmont
            <ExternalLink className="h-3 w-3 text-gray-500 dark:text-gray-400" />
          </a>
        </div>
        <div className="text-center mt-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            ✈️ Planifica • 🤖 Descubre • 👥 Colabora
          </span>
        </div>
      </div>
    </footer>
  )
} 