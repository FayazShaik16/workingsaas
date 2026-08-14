export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          type: string
          template_key: string
          logo_url: string | null
          version: number
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          name: string
          type: string
          template_key?: string
          logo_url?: string | null
          version?: number
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          type?: string
          template_key?: string
          logo_url?: string | null
          version?: number
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }
      users: {
        Row: {
          id: string
          organization_id: string
          org_unit_id: string | null
          email: string
          name: string
          avatar_url: string | null
          employee_id: string | null
          designation: string | null
          employment_type: string
          progress_percentage: number
          quality_score: number
          marketplace_locked: boolean
          marketplace_lock_reason: string | null
          skills: Json
          capacity_hours_weekly: number | null
          status: string
          version: number
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id: string
          organization_id: string
          org_unit_id?: string | null
          email: string
          name: string
          avatar_url?: string | null
          employee_id?: string | null
          designation?: string | null
          employment_type?: string
          progress_percentage?: number
          quality_score?: number
          marketplace_locked?: boolean
          marketplace_lock_reason?: string | null
          skills?: Json
          capacity_hours_weekly?: number | null
          status?: string
          version?: number
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          org_unit_id?: string | null
          email?: string
          name?: string
          avatar_url?: string | null
          employee_id?: string | null
          designation?: string | null
          employment_type?: string
          progress_percentage?: number
          quality_score?: number
          marketplace_locked?: boolean
          marketplace_lock_reason?: string | null
          skills?: Json
          capacity_hours_weekly?: number | null
          status?: string
          version?: number
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }
    }
    Views: Record<string, unknown>
    Functions: Record<string, unknown>
    Enums: Record<string, unknown>
    CompositeTypes: Record<string, unknown>
  }
}
