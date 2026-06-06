"use client";

import { Check, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DiffChange } from "@/types";

type DiffViewerProps = {
  changes: DiffChange[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
};

const columns: Array<{
  category: DiffChange["category"];
  title: string;
  description: string;
  headerClassName: string;
}> = [
  {
    category: "planned",
    title: "Planned",
    description: "Changes that match intent",
    headerClassName: "border-emerald-200 bg-emerald-50 text-emerald-900",
  },
  {
    category: "unplanned",
    title: "Unplanned",
    description: "Changes agent added without being asked",
    headerClassName: "border-yellow-200 bg-yellow-50 text-yellow-900",
  },
  {
    category: "risky",
    title: "Risky",
    description: "Potential bugs or breaking changes",
    headerClassName: "border-red-200 bg-red-50 text-red-900",
  },
];

function ChangeCard({
  change,
  onApprove,
  onReject,
}: {
  change: DiffChange;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const isPending = change.status === "pending";
  const isApproved = change.status === "approved";
  const shouldPreferReject =
    change.category === "unplanned" || change.category === "risky";

  const approveButton = (
    <Button
      type="button"
      variant="secondary"
      className="h-9 min-w-0 bg-emerald-600 px-2 text-white hover:bg-emerald-700"
      onClick={() => onApprove(change.id)}
    >
      <Check />
      <span className="truncate">
        {shouldPreferReject ? "Approve anyway" : "Approve"}
      </span>
    </Button>
  );

  const rejectButton = (
    <Button
      type="button"
      variant="destructive"
      className="h-9 min-w-0 px-2"
      onClick={() => onReject(change.id)}
    >
      <X />
      <span className="truncate">Reject</span>
    </Button>
  );

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <Badge variant="secondary" className="max-w-full font-mono">
            {change.file}
          </Badge>
          <Badge
            variant={
              change.status === "rejected"
                ? "destructive"
                : change.status === "approved"
                  ? "secondary"
                  : "outline"
            }
          >
            {change.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Badge variant="outline" className="border-red-200 text-red-700">
            Before
          </Badge>
          <pre className="max-h-56 overflow-auto rounded-lg border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-950">
            <code>{change.before}</code>
          </pre>
        </div>
        <div className="space-y-1">
          <Badge
            variant="outline"
            className="border-emerald-200 text-emerald-700"
          >
            After
          </Badge>
          <pre className="max-h-56 overflow-auto rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-950">
            <code>{change.after}</code>
          </pre>
        </div>
        <p className="text-sm text-muted-foreground">{change.reason}</p>
      </CardContent>
      <CardFooter className="grid grid-cols-2 gap-2">
        {isPending ? (
          shouldPreferReject ? (
            <>
              {rejectButton}
              {approveButton}
            </>
          ) : (
            <>
              {approveButton}
              {rejectButton}
            </>
          )
        ) : (
          <>
            <div
              className={cn(
                "flex h-9 min-w-0 items-center justify-center gap-2 rounded-lg px-2 text-sm font-medium",
                isApproved
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-red-50 text-red-700"
              )}
            >
              {isApproved ? <Check /> : <X />}
              <span className="truncate">
                {isApproved ? "Approved" : "Rejected"}
              </span>
            </div>
            {isApproved ? rejectButton : approveButton}
          </>
        )}
      </CardFooter>
    </Card>
  );
}

export function DiffViewer({ changes, onApprove, onReject }: DiffViewerProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {columns.map((column) => {
        const columnChanges = changes.filter(
          (change) => change.category === column.category
        );

        return (
          <Card key={column.category} className="rounded-lg">
            <CardHeader className={`border ${column.headerClassName}`}>
              <CardTitle className="flex items-center justify-between gap-3">
                <span>{column.title}</span>
                <Badge variant="outline">{columnChanges.length}</Badge>
              </CardTitle>
              <p className="text-sm">{column.description}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {columnChanges.length > 0 ? (
                columnChanges.map((change) => (
                  <ChangeCard
                    key={change.id}
                    change={change}
                    onApprove={onApprove}
                    onReject={onReject}
                  />
                ))
              ) : (
                <Card className="rounded-lg border-dashed">
                  <CardContent className="py-8 text-center text-sm text-muted-foreground">
                    No changes in this category.
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
