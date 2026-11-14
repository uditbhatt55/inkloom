// Generated from the Supabase schema (Supabase MCP generate_typescript_types). Regenerate after each migration.
// Migrations 20261112000300 (rule_code, source, label, requested_by, warnings, save_audit) and 20261114000000
// (guideline_clause_history) and 20261114100000 (approved_facts.updated_at) were added by hand; regenerate to confirm.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

type Rel = { foreignKeyName: string; columns: string[]; isOneToOne: boolean; referencedRelation: string; referencedColumns: string[] }
type E = Database["public"]["Enums"]

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.18" }
  public: {
    Tables: {
      activity_log: {
        Row: { action: string; actor_id: string | null; at: string; id: number; org_id: string; target_id: string | null; target_table: string }
        Insert: { action: string; actor_id?: string | null; at?: string; id?: never; org_id: string; target_id?: string | null; target_table: string }
        Update: { action?: string; actor_id?: string | null; at?: string; id?: never; org_id?: string; target_id?: string | null; target_table?: string }
        Relationships: Rel[]
      }
      approved_facts: {
        Row: { code: string; created_at: string; evidence_ref: string | null; id: string; org_id: string; owner_name: string | null; statement: string; updated_at: string; valid_from: string | null; valid_until: string | null; visibility: E["visibility"] }
        Insert: { code: string; created_at?: string; evidence_ref?: string | null; id?: string; org_id: string; owner_name?: string | null; statement: string; updated_at?: string; valid_from?: string | null; valid_until?: string | null; visibility?: E["visibility"] }
        Update: { code?: string; created_at?: string; evidence_ref?: string | null; id?: string; org_id?: string; owner_name?: string | null; statement?: string; updated_at?: string; valid_from?: string | null; valid_until?: string | null; visibility?: E["visibility"] }
        Relationships: Rel[]
      }
      audit_runs: {
        Row: { ai_available: boolean; created_at: string; id: string; mode: string; model: string | null; org_id: string; prompt_ver: string | null; requested_by: string | null; score: number | null; version_id: string; warnings: string[] }
        Insert: { ai_available?: boolean; created_at?: string; id?: string; mode: string; model?: string | null; org_id: string; prompt_ver?: string | null; requested_by?: string | null; score?: number | null; version_id: string; warnings?: string[] }
        Update: { ai_available?: boolean; created_at?: string; id?: string; mode?: string; model?: string | null; org_id?: string; prompt_ver?: string | null; requested_by?: string | null; score?: number | null; version_id?: string; warnings?: string[] }
        Relationships: Rel[]
      }
      brand_assets: {
        Row: { file_path: string | null; font_name: string | null; hex: string | null; id: string; name: string; org_id: string; rules: string | null; type: string }
        Insert: { file_path?: string | null; font_name?: string | null; hex?: string | null; id?: string; name: string; org_id: string; rules?: string | null; type: string }
        Update: { file_path?: string | null; font_name?: string | null; hex?: string | null; id?: string; name?: string; org_id?: string; rules?: string | null; type?: string }
        Relationships: Rel[]
      }
      claim_links: {
        Row: { fact_id: string; id: string; matched_at: string; org_id: string; quote: string; version_id: string }
        Insert: { fact_id: string; id?: string; matched_at?: string; org_id: string; quote: string; version_id: string }
        Update: { fact_id?: string; id?: string; matched_at?: string; org_id?: string; quote?: string; version_id?: string }
        Relationships: Rel[]
      }
      comments: {
        Row: { author_id: string; body: string; created_at: string; finding_id: string | null; id: string; item_id: string; org_id: string; version_id: string | null }
        Insert: { author_id: string; body: string; created_at?: string; finding_id?: string | null; id?: string; item_id: string; org_id: string; version_id?: string | null }
        Update: { author_id?: string; body?: string; created_at?: string; finding_id?: string | null; id?: string; item_id?: string; org_id?: string; version_id?: string | null }
        Relationships: Rel[]
      }
      content_items: {
        Row: { audience: E["visibility"]; channel: string | null; created_at: string; id: string; org_id: string; owner_id: string; reviewer_id: string | null; status: E["item_status"]; title: string }
        Insert: { audience?: E["visibility"]; channel?: string | null; created_at?: string; id?: string; org_id: string; owner_id: string; reviewer_id?: string | null; status?: E["item_status"]; title: string }
        Update: { audience?: E["visibility"]; channel?: string | null; created_at?: string; id?: string; org_id?: string; owner_id?: string; reviewer_id?: string | null; status?: E["item_status"]; title?: string }
        Relationships: Rel[]
      }
      content_versions: {
        Row: { created_at: string; created_by: string; file_path: string | null; id: string; item_id: string; n: number; org_id: string; sha256: string; text: string | null }
        Insert: { created_at?: string; created_by: string; file_path?: string | null; id?: string; item_id: string; n: number; org_id: string; sha256: string; text?: string | null }
        Update: { created_at?: string; created_by?: string; file_path?: string | null; id?: string; item_id?: string; n?: number; org_id?: string; sha256?: string; text?: string | null }
        Relationships: Rel[]
      }
      decisions: {
        Row: { author_id: string; created_at: string; decision: E["decision_kind"]; finding_id: string | null; id: string; item_id: string; org_id: string; reason: string | null; version_id: string }
        Insert: { author_id: string; created_at?: string; decision: E["decision_kind"]; finding_id?: string | null; id?: string; item_id: string; org_id: string; reason?: string | null; version_id: string }
        Update: { author_id?: string; created_at?: string; decision?: E["decision_kind"]; finding_id?: string | null; id?: string; item_id?: string; org_id?: string; reason?: string | null; version_id?: string }
        Relationships: Rel[]
      }
      findings: {
        Row: { category: E["finding_category"]; clause_id: string | null; confidence: E["confidence"]; decided_by: string | null; end_offset: number | null; explanation: string; fact_id: string | null; id: string; label: string | null; org_id: string; quote: string; reason: string | null; rule_code: string | null; run_id: string; source: string; severity: E["severity"]; start_offset: number | null; status: E["finding_status"]; suggestion: string | null; term_id: string | null }
        Insert: { category: E["finding_category"]; clause_id?: string | null; confidence: E["confidence"]; decided_by?: string | null; end_offset?: number | null; explanation: string; fact_id?: string | null; id?: string; label?: string | null; org_id: string; quote: string; reason?: string | null; rule_code?: string | null; run_id: string; source?: string; severity: E["severity"]; start_offset?: number | null; status?: E["finding_status"]; suggestion?: string | null; term_id?: string | null }
        Update: { category?: E["finding_category"]; clause_id?: string | null; confidence?: E["confidence"]; decided_by?: string | null; end_offset?: number | null; explanation?: string; fact_id?: string | null; id?: string; label?: string | null; org_id?: string; quote?: string; reason?: string | null; rule_code?: string | null; run_id?: string; source?: string; severity?: E["severity"]; start_offset?: number | null; status?: E["finding_status"]; suggestion?: string | null; term_id?: string | null }
        Relationships: Rel[]
      }
      guideline_clause_history: {
        Row: { changed_at: string; changed_by: string | null; clause_id: string; id: string; org_id: string; text: string; version: number }
        Insert: { changed_at?: string; changed_by?: string | null; clause_id: string; id?: string; org_id: string; text: string; version: number }
        Update: { changed_at?: string; changed_by?: string | null; clause_id?: string; id?: string; org_id?: string; text?: string; version?: number }
        Relationships: Rel[]
      }
      guideline_clauses: {
        Row: { category: E["finding_category"]; code: string; created_at: string; examples_do: string[]; examples_dont: string[]; fts: unknown; id: string; org_id: string; source_page: number | null; status: string; text: string; version: number }
        Insert: { category: E["finding_category"]; code: string; created_at?: string; examples_do?: string[]; examples_dont?: string[]; fts?: unknown; id?: string; org_id: string; source_page?: number | null; status?: string; text: string; version?: number }
        Update: { category?: E["finding_category"]; code?: string; created_at?: string; examples_do?: string[]; examples_dont?: string[]; fts?: unknown; id?: string; org_id?: string; source_page?: number | null; status?: string; text?: string; version?: number }
        Relationships: Rel[]
      }
      memberships: {
        Row: { org_id: string; role: E["member_role"]; user_id: string }
        Insert: { org_id: string; role: E["member_role"]; user_id: string }
        Update: { org_id?: string; role?: E["member_role"]; user_id?: string }
        Relationships: Rel[]
      }
      organizations: {
        Row: { created_at: string; demo: boolean; id: string; name: string }
        Insert: { created_at?: string; demo?: boolean; id?: string; name: string }
        Update: { created_at?: string; demo?: boolean; id?: string; name?: string }
        Relationships: Rel[]
      }
      terminology: {
        Row: { code: string; id: string; kind: E["term_kind"]; org_id: string; owner_name: string | null; replacement: string | null; term: string }
        Insert: { code: string; id?: string; kind: E["term_kind"]; org_id: string; owner_name?: string | null; replacement?: string | null; term: string }
        Update: { code?: string; id?: string; kind?: E["term_kind"]; org_id?: string; owner_name?: string | null; replacement?: string | null; term?: string }
        Relationships: Rel[]
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      save_audit: { Args: { p: Json }; Returns: string }
    }
    Enums: {
      confidence: "high" | "medium" | "low"
      decision_kind: "approve" | "reject" | "request_changes" | "waive"
      finding_category: "tone" | "terminology" | "factual" | "claim" | "messaging" | "visual" | "accessibility" | "confidentiality"
      finding_status: "open" | "accepted" | "rejected" | "dismissed" | "waived" | "resolved"
      item_status: "draft" | "ai_audited" | "in_review" | "changes_requested" | "rejected" | "approved"
      member_role: "owner" | "reviewer" | "creator" | "agency" | "viewer"
      severity: "critical" | "major" | "minor" | "info"
      term_kind: "preferred" | "banned" | "internal"
      visibility: "public" | "internal"
    }
    CompositeTypes: { [_ in never]: never }
  }
}

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"]
export type TablesInsert<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"]
export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T]
