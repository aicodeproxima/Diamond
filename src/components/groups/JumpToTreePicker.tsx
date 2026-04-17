'use client';

import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { UserRole, ROLE_LABELS } from '@/lib/types';
import type { OrgNode } from '@/lib/types';
import { Users, Search } from 'lucide-react';

interface Candidate {
  id: string;
  name: string;
  role: UserRole;
  groupName?: string;
  ancestorIds: string[];
}

/** Walk the org tree and collect every Group Leader and Team Leader. */
function collectCandidates(roots: OrgNode[]): Candidate[] {
  const out: Candidate[] = [];
  const walk = (node: OrgNode, ancestors: string[]) => {
    if (node.role === UserRole.GROUP_LEADER || node.role === UserRole.TEAM_LEADER) {
      out.push({
        id: node.id,
        name: node.name,
        role: node.role,
        groupName: node.groupName,
        ancestorIds: [...ancestors],
      });
    }
    const nextAncestors = [...ancestors, node.id];
    node.children.forEach((c) => walk(c, nextAncestors));
  };
  roots.forEach((r) => walk(r, []));
  return out;
}

export interface JumpSelection {
  id: string;
  ancestorIds: string[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  roots: OrgNode[];
  onSelect: (sel: JumpSelection) => void;
}

export function JumpToTreePicker({ open, onClose, roots, onSelect }: Props) {
  const [query, setQuery] = useState('');

  const candidates = useMemo(() => collectCandidates(roots), [roots]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.groupName ?? '').toLowerCase().includes(q) ||
        ROLE_LABELS[c.role].toLowerCase().includes(q),
    );
  }, [candidates, query]);

  // Split into group leaders first, then team leaders — easier to scan
  const groupLeaders = filtered.filter((c) => c.role === UserRole.GROUP_LEADER);
  const teamLeaders = filtered.filter((c) => c.role === UserRole.TEAM_LEADER);

  const handlePick = (c: Candidate) => {
    onSelect({ id: c.id, ancestorIds: c.ancestorIds });
    setQuery('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : undefined)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Jump to Team
          </DialogTitle>
          <DialogDescription>
            Pick a group or team leader and their entire subtree (down to contacts) will expand and snap into focus.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Search by name, group, or role…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="max-h-[420px] overflow-y-auto space-y-4 pr-1">
          {groupLeaders.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Group Leaders
              </p>
              <div className="space-y-1">
                {groupLeaders.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handlePick(c)}
                    className="w-full rounded-md border border-border/50 bg-card/40 px-3 py-2 text-left transition hover:border-primary/50 hover:bg-accent"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-sm">{c.name}</div>
                      <Badge variant="outline" className="text-[10px]">
                        {c.groupName ?? ROLE_LABELS[c.role]}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {teamLeaders.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Team Leaders
              </p>
              <div className="space-y-1">
                {teamLeaders.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handlePick(c)}
                    className="w-full rounded-md border border-border/50 bg-card/40 px-3 py-2 text-left transition hover:border-primary/50 hover:bg-accent"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-sm">{c.name}</div>
                      <Badge variant="outline" className="text-[10px]">
                        {c.groupName ?? ROLE_LABELS[c.role]}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {filtered.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No matches for &ldquo;{query}&rdquo;
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
