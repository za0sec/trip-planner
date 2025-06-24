"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function DebugPage() {
  const [results, setResults] = useState<string[]>([])

  const addResult = (message: string) => {
    setResults((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${message}`])
  }

  const testSupabaseConnection = async () => {
    addResult("🔄 Testing Supabase connection...")
    try {
      const { data, error } = await supabase.from("profiles").select("count").limit(1)
      if (error) {
        addResult(`❌ Connection error: ${error.message}`)
      } else {
        addResult("✅ Supabase connection successful")
      }
    } catch (error: any) {
      addResult(`❌ Connection failed: ${error.message}`)
    }
  }

  const testAuth = async () => {
    addResult("🔄 Testing auth...")
    try {
      const { data, error } = await supabase.auth.getSession()
      if (error) {
        addResult(`❌ Auth error: ${error.message}`)
      } else {
        addResult(`✅ Auth working: ${data.session ? `User: ${data.session.user?.email}` : "No session"}`)
      }
    } catch (error: any) {
      addResult(`❌ Auth failed: ${error.message}`)
    }
  }

  const testEnvironment = () => {
    addResult("🔧 Checking environment variables...")
    addResult(`SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? "✅ Set" : "❌ Missing"}`)
    addResult(`SUPABASE_ANON_KEY: ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "✅ Set" : "❌ Missing"}`)
  }

  const clearResults = () => {
    setResults([])
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>🔧 Debug Panel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Button onClick={testEnvironment}>Test Environment</Button>
              <Button onClick={testSupabaseConnection}>Test Connection</Button>
              <Button onClick={testAuth}>Test Auth</Button>
              <Button onClick={clearResults} variant="outline">
                Clear
              </Button>
            </div>

            <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm max-h-96 overflow-y-auto">
              {results.length === 0 ? (
                <div className="text-gray-500">Click a test button to see results...</div>
              ) : (
                results.map((result, index) => <div key={index}>{result}</div>)
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
