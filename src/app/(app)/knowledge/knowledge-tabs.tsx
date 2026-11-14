"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Database } from "@/lib/database.types";
import { GuidelinesTab } from "./guidelines-tab";
import { FactsTab } from "./facts-tab";
import { TermsTab } from "./terms-tab";
import { AssetsTab } from "./assets-tab";

type T = Database["public"]["Tables"];

export type ClauseRow = Pick<
  T["guideline_clauses"]["Row"],
  "id" | "code" | "category" | "text" | "examples_do" | "examples_dont" | "status" | "version" | "source_page"
>;
export type FactRow = Pick<
  T["approved_facts"]["Row"],
  "id" | "code" | "statement" | "valid_from" | "valid_until" | "visibility" | "owner_name" | "evidence_ref"
>;
export type TermRow = Pick<
  T["terminology"]["Row"],
  "id" | "code" | "term" | "kind" | "replacement" | "owner_name"
>;
export type AssetRow = Pick<
  T["brand_assets"]["Row"],
  "id" | "name" | "type" | "hex" | "font_name" | "rules"
>;

export function KnowledgeTabs({
  clauses,
  facts,
  terms,
  assets,
  orgId,
  isOwner,
}: {
  clauses: ClauseRow[];
  facts: FactRow[];
  terms: TermRow[];
  assets: AssetRow[];
  orgId: string;
  isOwner: boolean;
}) {
  const [tab, setTab] = useState("guidelines");

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="guidelines">Guidelines ({clauses.length})</TabsTrigger>
        <TabsTrigger value="facts">Facts ({facts.length})</TabsTrigger>
        <TabsTrigger value="terms">Terms ({terms.length})</TabsTrigger>
        <TabsTrigger value="assets">Brand assets ({assets.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="guidelines" className="mt-4">
        <GuidelinesTab clauses={clauses} orgId={orgId} isOwner={isOwner} />
      </TabsContent>
      <TabsContent value="facts" className="mt-4">
        <FactsTab facts={facts} orgId={orgId} isOwner={isOwner} />
      </TabsContent>
      <TabsContent value="terms" className="mt-4">
        <TermsTab terms={terms} orgId={orgId} isOwner={isOwner} />
      </TabsContent>
      <TabsContent value="assets" className="mt-4">
        <AssetsTab assets={assets} orgId={orgId} isOwner={isOwner} />
      </TabsContent>
    </Tabs>
  );
}

