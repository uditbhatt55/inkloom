"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/browser";

export type CommentRow = {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  finding_id: string | null;
  version_id: string | null;
};

export function CommentsBox({
  itemId,
  orgId,
  versionId,
  comments,
  canComment,
  currentUserId,
  itemAuthorId,
}: {
  itemId: string;
  orgId: string;
  versionId: string;
  comments: CommentRow[];
  canComment: boolean;
  currentUserId: string;
  itemAuthorId: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;

    const supabase = createClient();
    if (!supabase) {
      setErrorMsg("Supabase client is not available.");
      return;
    }

    setBusy(true);
    setErrorMsg(null);

    const { error } = await supabase.from("comments").insert({
      org_id: orgId,
      item_id: itemId,
      version_id: versionId,
      author_id: currentUserId,
      body: body.trim(),
    });

    setBusy(false);
    if (error) {
      setErrorMsg(error.message);
    } else {
      setBody("");
      router.refresh();
    }
  }

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Review comments</h2>
          <Badge variant="secondary">{comments.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-4 text-sm">
        {comments.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            No comments yet. Authors and reviewers can leave comments and notes here.
          </p>
        ) : (
          <div className="space-y-3">
            {comments.map((c) => {
              const isMe = c.author_id === currentUserId;
              // fixed locale and time zone so server and browser render the same text (no hydration mismatch)
              const dateStr = new Date(c.created_at).toLocaleString("en-IN", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "Asia/Kolkata",
              });
              return (
                <div key={c.id} className="rounded-lg border bg-muted/40 p-3 text-xs space-y-1.5">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {isMe ? "You" : c.author_id === itemAuthorId ? "Author" : "Team member"}
                    </span>
                    <time dateTime={c.created_at}>{dateStr}</time>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-foreground">{c.body}</p>
                </div>
              );
            })}
          </div>
        )}

        {canComment ? (
          <form onSubmit={handlePost} className="space-y-2 pt-2">
            <label htmlFor="new-comment" className="sr-only">
              Add a comment
            </label>
            <Textarea
              id="new-comment"
              placeholder="Leave a comment or question about this review..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={busy}
              rows={3}
            />
            {errorMsg && (
              <Alert variant="destructive">
                <AlertDescription>{errorMsg}</AlertDescription>
              </Alert>
            )}
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={busy || !body.trim()}>
                Post comment
              </Button>
            </div>
          </form>
        ) : (
          <p className="text-xs text-muted-foreground">Viewers have read-only access and cannot comment.</p>
        )}
      </CardContent>
    </Card>
  );
}

