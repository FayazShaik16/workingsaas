export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          type: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          type?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      org_units: {
        Row: {
          id: string
          organization_id: string
          name: string
          unit_type: string
          parent_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          unit_type?: string
          parent_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          unit_type?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          id: string
          organization_id: string | null
          org_unit_id: string | null
          email: string
          name: string
          avatar_url: string | null
          employee_id: string | null
          designation: string | null
          employment_type: string
          progress_percentage: number
          quality_score: number
          status: string
          must_reset_password?: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          organization_id?: string | null
          org_unit_id?: string | null
          email: string
          name: string
          avatar_url?: string | null
          employee_id?: string | null
          designation?: string | null
          employment_type?: string
          progress_percentage?: number
          quality_score?: number
          status?: string
          must_reset_password?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          organization_id?: string | null
          org_unit_id?: string | null
          email?: string
          name?: string
          avatar_url?: string | null
          employee_id?: string | null
          designation?: string | null
          employment_type?: string
          progress_percentage?: number
          quality_score?: number
          status?: string
          must_reset_password?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      roles: {
        Row: {
          id: string
          organization_id: string
          name: string
          scope_level: "SYSTEM_ADMIN" | "DIRECTOR" | "FINANCE_ADMIN" | "ORG_UNIT_LEAD" | "DEPT_ADMIN" | "MEMBER"
          is_system_role: boolean
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          scope_level: "SYSTEM_ADMIN" | "DIRECTOR" | "FINANCE_ADMIN" | "ORG_UNIT_LEAD" | "DEPT_ADMIN" | "MEMBER"
          is_system_role?: boolean
          created_at?: string
        }
        Update: {
          name?: string
          scope_level?: "SYSTEM_ADMIN" | "DIRECTOR" | "FINANCE_ADMIN" | "ORG_UNIT_LEAD" | "DEPT_ADMIN" | "MEMBER"
          is_system_role?: boolean
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          user_id: string
          role_id: string
        }
        Insert: {
          user_id: string
          role_id: string
        }
        Update: {
          user_id?: string
          role_id?: string
        }
        Relationships: []
      }
      work_cycles: {
        Row: {
          id: string
          organization_id: string
          name: string
          starts_on: string
          ends_on: string
          scheduled_weight_percentage: number
          salary_threshold_percentage: number
          salary_request_opens_day: number
          status: "DRAFT" | "ACTIVE" | "CLOSED"
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          starts_on: string
          ends_on: string
          scheduled_weight_percentage?: number
          salary_threshold_percentage?: number
          salary_request_opens_day?: number
          status?: "DRAFT" | "ACTIVE" | "CLOSED"
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          starts_on?: string
          ends_on?: string
          scheduled_weight_percentage?: number
          salary_threshold_percentage?: number
          salary_request_opens_day?: number
          status?: "DRAFT" | "ACTIVE" | "CLOSED"
          updated_at?: string
        }
        Relationships: []
      }
      scheduled_work_templates: {
        Row: {
          id: string
          organization_id: string
          org_unit_id: string | null
          assigned_to_id: string
          work_cycle_id: string
          title: string
          description: string | null
          weekly_day: "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT"
          start_time: string
          end_time: string
          credit_value: number
          active: boolean
          source: "MANUAL" | "XLSX_IMPORT"
          source_reference: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          org_unit_id?: string | null
          assigned_to_id: string
          work_cycle_id: string
          title: string
          description?: string | null
          weekly_day: "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT"
          start_time: string
          end_time: string
          credit_value: number
          active?: boolean
          source?: "MANUAL" | "XLSX_IMPORT"
          source_reference?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          description?: string | null
          weekly_day?: "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT"
          start_time?: string
          end_time?: string
          credit_value?: number
          active?: boolean
          source?: "MANUAL" | "XLSX_IMPORT"
          source_reference?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      scheduled_work_instances: {
        Row: {
          id: string
          organization_id: string
          template_id: string
          assigned_to_id: string
          work_cycle_id: string
          work_date: string
          scheduled_start: string
          scheduled_end: string
          credit_value: number
          status: "UPCOMING" | "AVAILABLE" | "SELF_COMPLETED" | "FLAGGED" | "CANCELLED"
          self_completed_at: string | null
          self_completed_by: string | null
          hod_review_status: "NOT_REVIEWED" | "ACKNOWLEDGED" | "FLAGGED"
          hod_reviewed_by: string | null
          hod_reviewed_at: string | null
          hod_review_note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          template_id: string
          assigned_to_id: string
          work_cycle_id: string
          work_date: string
          scheduled_start: string
          scheduled_end: string
          credit_value: number
          status?: "UPCOMING" | "AVAILABLE" | "SELF_COMPLETED" | "FLAGGED" | "CANCELLED"
          self_completed_at?: string | null
          self_completed_by?: string | null
          hod_review_status?: "NOT_REVIEWED" | "ACKNOWLEDGED" | "FLAGGED"
          hod_reviewed_by?: string | null
          hod_reviewed_at?: string | null
          hod_review_note?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          status?: "UPCOMING" | "AVAILABLE" | "SELF_COMPLETED" | "FLAGGED" | "CANCELLED"
          self_completed_at?: string | null
          self_completed_by?: string | null
          hod_review_status?: "NOT_REVIEWED" | "ACKNOWLEDGED" | "FLAGGED"
          hod_reviewed_by?: string | null
          hod_reviewed_at?: string | null
          hod_review_note?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      scheduled_work_completions: {
        Row: {
          id: string
          organization_id: string
          instance_id: string
          faculty_id: string
          confirmation_1_at: string
          confirmation_2_at: string
          credit_value: number
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          instance_id: string
          faculty_id: string
          confirmation_1_at?: string
          confirmation_2_at?: string
          credit_value: number
          created_at?: string
        }
        Update: {
          credit_value?: number
        }
        Relationships: []
      }
      credit_ledger_entries: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          work_cycle_id: string
          month_start: string
          credit_type: "STRUCTURED_SELF_COMPLETION" | "UNSTRUCTURED_APPROVAL" | "MANUAL_ADJUSTMENT" | "REVERSAL"
          amount: number
          source_entity_type: string
          source_entity_id: string
          idempotency_key: string
          created_by: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id: string
          work_cycle_id: string
          month_start: string
          credit_type: "STRUCTURED_SELF_COMPLETION" | "UNSTRUCTURED_APPROVAL" | "MANUAL_ADJUSTMENT" | "REVERSAL"
          amount: number
          source_entity_type: string
          source_entity_id: string
          idempotency_key: string
          created_by?: string | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          amount?: number
          metadata?: Json
        }
        Relationships: []
      }
      monthly_work_progress: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          work_cycle_id: string
          month_start: string
          scheduled_target_credits: number
          total_target_credits: number
          scheduled_earned_credits: number
          unscheduled_earned_credits: number
          raw_earned_credits: number
          display_progress_percentage: number
          salary_eligible: boolean
          salary_request_status: "NOT_OPEN" | "AVAILABLE" | "REQUESTED" | "HOD_APPROVED" | "REJECTED" | "ON_CHAIN_CONFIRMED"
          computed_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id: string
          work_cycle_id: string
          month_start: string
          scheduled_target_credits?: number
          total_target_credits?: number
          scheduled_earned_credits?: number
          unscheduled_earned_credits?: number
          raw_earned_credits?: number
          display_progress_percentage?: number
          salary_eligible?: boolean
          salary_request_status?: "NOT_OPEN" | "AVAILABLE" | "REQUESTED" | "HOD_APPROVED" | "REJECTED" | "ON_CHAIN_CONFIRMED"
          computed_at?: string
        }
        Update: {
          scheduled_target_credits?: number
          total_target_credits?: number
          scheduled_earned_credits?: number
          unscheduled_earned_credits?: number
          raw_earned_credits?: number
          display_progress_percentage?: number
          salary_eligible?: boolean
          salary_request_status?: "NOT_OPEN" | "AVAILABLE" | "REQUESTED" | "HOD_APPROVED" | "REJECTED" | "ON_CHAIN_CONFIRMED"
          computed_at?: string
        }
        Relationships: []
      }
      salary_requests: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          work_cycle_id: string
          month_start: string
          requested_at: string
          requested_raw_credits: number
          requested_target_credits: number
          threshold_percentage: number
          status: "PENDING_HOD" | "HOD_APPROVED" | "HOD_REJECTED" | "ON_CHAIN_SUBMITTED" | "ON_CHAIN_CONFIRMED" | "ON_CHAIN_FAILED"
          reviewed_by: string | null
          reviewed_at: string | null
          review_note: string | null
          blockchain_transaction_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id: string
          work_cycle_id: string
          month_start: string
          requested_at?: string
          requested_raw_credits?: number
          requested_target_credits?: number
          threshold_percentage?: number
          status?: "PENDING_HOD" | "HOD_APPROVED" | "HOD_REJECTED" | "ON_CHAIN_SUBMITTED" | "ON_CHAIN_CONFIRMED" | "ON_CHAIN_FAILED"
          reviewed_by?: string | null
          reviewed_at?: string | null
          review_note?: string | null
          blockchain_transaction_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          status?: "PENDING_HOD" | "HOD_APPROVED" | "HOD_REJECTED" | "ON_CHAIN_SUBMITTED" | "ON_CHAIN_CONFIRMED" | "ON_CHAIN_FAILED"
          reviewed_by?: string | null
          reviewed_at?: string | null
          review_note?: string | null
          blockchain_transaction_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          id: string
          organization_id: string
          org_unit_id: string | null
          category: "STRUCTURED" | "UNSTRUCTURED"
          title: string
          description: string | null
          credit_value: number
          creator_id: string | null
          assigned_to_id: string | null
          assigned_by_id: string | null
          deadline: string | null
          priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
          status: "DRAFT" | "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "VERIFICATION_PENDING" | "CLOSED" | "CANCELLED"
          visibility_scope: "ORGANIZATION" | "ORG_UNIT"
          verification_mode: "MANUAL_REPORT" | "FILE_SUBMISSION"
          allow_nomination: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          org_unit_id?: string | null
          category?: "STRUCTURED" | "UNSTRUCTURED"
          title: string
          description?: string | null
          credit_value?: number
          creator_id?: string | null
          assigned_to_id?: string | null
          assigned_by_id?: string | null
          deadline?: string | null
          priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
          status?: "DRAFT" | "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "VERIFICATION_PENDING" | "CLOSED" | "CANCELLED"
          visibility_scope?: "ORGANIZATION" | "ORG_UNIT"
          verification_mode?: "MANUAL_REPORT" | "FILE_SUBMISSION"
          allow_nomination?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          description?: string | null
          credit_value?: number
          assigned_to_id?: string | null
          assigned_by_id?: string | null
          deadline?: string | null
          priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
          status?: "DRAFT" | "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "VERIFICATION_PENDING" | "CLOSED" | "CANCELLED"
          visibility_scope?: "ORGANIZATION" | "ORG_UNIT"
          verification_mode?: "MANUAL_REPORT" | "FILE_SUBMISSION"
          allow_nomination?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      blockchain_wallets: {
        Row: {
          id: string
          organization_id: string
          user_id: string | null
          public_address: string
          encrypted_private_key: string
          purpose: "PERSONAL" | "SALARY_POOL" | "LOAN_POOL" | "GENESIS"
          network: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id?: string | null
          public_address: string
          encrypted_private_key: string
          purpose: "PERSONAL" | "SALARY_POOL" | "LOAN_POOL" | "GENESIS"
          network?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          public_address?: string
          encrypted_private_key?: string
          purpose?: "PERSONAL" | "SALARY_POOL" | "LOAN_POOL" | "GENESIS"
          updated_at?: string
        }
        Relationships: []
      }
      blockchain_transactions: {
        Row: {
          id: string
          organization_id: string
          from_address: string
          to_address: string
          amount: number
          tx_hash: string
          block_number: number | null
          network: string
          event_type: "MINT" | "TASK_REWARD" | "SALARY_SETTLEMENT" | "LOAN_DISBURSEMENT" | "BATCH_REVERSAL"
          status: "PENDING" | "CONFIRMED" | "FAILED"
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          from_address: string
          to_address: string
          amount?: number
          tx_hash: string
          block_number?: number | null
          network?: string
          event_type: "MINT" | "TASK_REWARD" | "SALARY_SETTLEMENT" | "LOAN_DISBURSEMENT" | "BATCH_REVERSAL"
          status?: "PENDING" | "CONFIRMED" | "FAILED"
          metadata?: Json
          created_at?: string
        }
        Update: {
          status?: "PENDING" | "CONFIRMED" | "FAILED"
          block_number?: number | null
          metadata?: Json
        }
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          organization_id: string
          recipient_id: string | null
          title: string
          message: string
          type: string
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          recipient_id?: string | null
          title: string
          message: string
          type?: string
          is_read?: boolean
          created_at?: string
        }
        Update: {
          is_read?: boolean
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      recompute_monthly_work_progress: {
        Args: {
          p_user_id: string
          p_work_cycle_id: string
          p_month_start: string
        }
        Returns: Json
      }
      confirm_scheduled_work_instance: {
        Args: {
          p_instance_id: string
          p_faculty_id: string
        }
        Returns: Json
      }
      approve_adhoc_task_and_award_credit: {
        Args: {
          p_task_id: string
          p_reviewer_id: string
        }
        Returns: Json
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
