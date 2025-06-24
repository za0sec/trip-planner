import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
            dashboard_tutorial_completed: boolean
  create_trip_tutorial_completed: boolean
  trip_management_tutorial_completed: boolean
  ai_tutorial_completed: boolean
  collaboration_tutorial_completed: boolean
  summary_tutorial_completed: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          dashboard_tutorial_completed?: boolean
          create_trip_tutorial_completed?: boolean
          trip_management_tutorial_completed?: boolean
          ai_tutorial_completed?: boolean
          collaboration_tutorial_completed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          dashboard_tutorial_completed?: boolean
          create_trip_tutorial_completed?: boolean
          trip_management_tutorial_completed?: boolean
          ai_tutorial_completed?: boolean
          collaboration_tutorial_completed?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      trips: {
        Row: {
          id: string
          title: string
          description: string | null
          destination: string
          start_date: string | null
          end_date: string | null
          budget: number | null
          currency: string
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          destination: string
          start_date?: string | null
          end_date?: string | null
          budget?: number | null
          currency?: string
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          destination?: string
          start_date?: string | null
          end_date?: string | null
          budget?: number | null
          currency?: string
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      expenses: {
        Row: {
          id: string
          trip_id: string
          category_id: string | null
          activity_id: string | null
          title: string
          description: string | null
          amount: number
          currency: string
          date: string
          location: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          trip_id: string
          category_id?: string | null
          activity_id?: string | null
          title: string
          description?: string | null
          amount: number
          currency?: string
          date: string
          location?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          trip_id?: string
          category_id?: string | null
          activity_id?: string | null
          title?: string
          description?: string | null
          amount?: number
          currency?: string
          date?: string
          location?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      categories: {
        Row: {
          id: string
          name: string
          icon: string | null
          color: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          icon?: string | null
          color?: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          icon?: string | null
          color?: string
          created_at?: string
        }
      }
      activities: {
        Row: {
          id: string
          trip_id: string
          title: string
          description: string | null
          category: string
          location: string | null
          date: string
          start_time: string | null
          end_time: string | null
          estimated_cost: number | null
          actual_cost: number | null
          status: string
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          trip_id: string
          title: string
          description?: string | null
          category?: string
          location?: string | null
          date: string
          start_time?: string | null
          end_time?: string | null
          estimated_cost?: number | null
          actual_cost?: number | null
          status?: string
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          trip_id?: string
          title?: string
          description?: string | null
          category?: string
          location?: string | null
          date?: string
          start_time?: string | null
          end_time?: string | null
          estimated_cost?: number | null
          actual_cost?: number | null
          status?: string
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
