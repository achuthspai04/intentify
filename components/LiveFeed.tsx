"use client";

import { Terminal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type LiveFeedProps = {
  logs: string[];
  isLoading?: boolean;
};

export function LiveFeed({ logs, isLoading = false }: LiveFeedProps) {
  return (
    <Card className="rounded-lg bg-zinc-950 text-zinc-100 ring-zinc-800">
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2 text-sm text-zinc-100">
          <Terminal className="size-4" />
          Live Activity
        </CardTitle>
        <Badge
          variant="outline"
          className="border-zinc-700 text-zinc-300 hover:bg-zinc-900"
        >
          {isLoading ? "Streaming" : "Complete"}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="max-h-56 overflow-auto rounded-lg border border-zinc-800 bg-black p-3 font-mono text-xs leading-5 text-zinc-200">
          {logs.length > 0 ? (
            logs.map((log, index) => (
              <div key={`${log}-${index}`} className="flex gap-2">
                <span className="select-none text-zinc-500">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>{log}</span>
              </div>
            ))
          ) : (
            <div className="text-zinc-500">Waiting for execution events...</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
