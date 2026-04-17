'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { groupsApi } from '@/lib/api/groups';
import type { AuditLogEntry } from '@/lib/types';
import {
  Ban,
  Download,
  FileText,
  Clock,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  Pencil,
  Trash2,
  FileDown,
  Trophy,
  BarChart3,
  Filter,
  CalendarDays,
} from 'lucide-react';
import { InfoButton } from '@/components/shared/InfoButton';
import { reportsHelp } from '@/components/shared/pageHelp';
import {
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
  startOfDay,
  endOfDay,
  subDays,
  isAfter,
  isBefore,
} from 'date-fns';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-500/20 text-green-500',
  update: 'bg-blue-500/20 text-blue-500',
  delete: 'bg-red-500/20 text-red-500',
  cancel: 'bg-orange-500/20 text-orange-500',
  export: 'bg-purple-500/20 text-purple-500',
};

const ACTION_ICONS: Record<string, typeof PlusCircle> = {
  create: PlusCircle,
  update: Pencil,
  delete: Trash2,
  cancel: Ban,
  export: FileDown,
};

const PIE_COLORS = ['#22c55e', '#3b82f6', '#ef4444', '#f97316', '#a855f7'];
const PAGE_SIZE = 15;

// ---------------------------------------------------------------------------
// CSV Export
// ---------------------------------------------------------------------------
function exportCSV(entries: AuditLogEntry[], filename = 'diamond-audit-log.csv') {
  const header = 'Timestamp,Action,Entity Type,Entity ID,User,Details';
  const rows = entries.map((e) =>
    [
      format(parseISO(e.timestamp), 'yyyy-MM-dd HH:mm:ss'),
      e.action,
      e.entityType,
      e.entityId,
      `"${e.userName}"`,
      `"${e.details.replace(/"/g, '""')}"`,
    ].join(','),
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`Exported ${entries.length} entries`);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function ReportsPage() {
  const { t } = useTranslation();
  // All entries (unfiltered, for charts + summary)
  const [allEntries, setAllEntries] = useState<AuditLogEntry[]>([]);
  // Filtered + paginated entries (for table)
  const [tableEntries, setTableEntries] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'week' | 'month'>('all');

  // Detail dialog
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);

  // Compute date bounds from preset
  const dateBounds = useMemo(() => {
    const now = new Date();
    switch (dateRange) {
      case 'today':
        return { startDate: startOfDay(now).toISOString(), endDate: endOfDay(now).toISOString() };
      case 'week':
        return { startDate: startOfWeek(now, { weekStartsOn: 1 }).toISOString(), endDate: now.toISOString() };
      case 'month':
        return { startDate: startOfMonth(now).toISOString(), endDate: now.toISOString() };
      default:
        return {};
    }
  }, [dateRange]);

  // Sentinel values from Select "All X" items → treat as empty
  const effectiveAction = actionFilter.startsWith('all') ? '' : actionFilter;
  const effectiveEntity = entityFilter.startsWith('all') ? '' : entityFilter;
  const effectiveUser = userFilter.startsWith('all') ? '' : userFilter;

  // Fetch ALL entries once (no filters) for charts + summaries
  useEffect(() => {
    groupsApi
      .getAuditLog({ limit: 500 })
      .then((data) => setAllEntries(data.entries))
      .catch(() => {});
  }, []);

  // Fetch filtered + paginated entries for the table
  const fetchTable = useCallback(() => {
    setLoading(true);
    groupsApi
      .getAuditLog({
        page,
        limit: PAGE_SIZE,
        action: effectiveAction || undefined,
        entityType: effectiveEntity || undefined,
        userId: effectiveUser || undefined,
        search: search || undefined,
        ...dateBounds,
      })
      .then((data) => {
        setTableEntries(data.entries);
        setTotal(data.total);
      })
      .finally(() => setLoading(false));
  }, [page, effectiveAction, effectiveEntity, effectiveUser, search, dateBounds]);

  useEffect(() => {
    fetchTable();
  }, [fetchTable]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [actionFilter, entityFilter, userFilter, search, dateRange]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ── Computed stats from allEntries ──────────────────────────────
  const thisMonthCount = useMemo(() => {
    const ms = startOfMonth(new Date()).getTime();
    return allEntries.filter((e) => new Date(e.timestamp).getTime() >= ms).length;
  }, [allEntries]);

  const createCount = allEntries.filter((e) => e.action === 'create').length;
  const cancelCount = allEntries.filter((e) => e.action === 'cancel').length;

  // ── Chart data ────────────────────────────────────────────────
  const barData = useMemo(() => {
    const days: Record<string, number> = {};
    for (let i = 13; i >= 0; i--) {
      const d = subDays(new Date(), i);
      days[format(d, 'MMM d')] = 0;
    }
    for (const e of allEntries) {
      const key = format(parseISO(e.timestamp), 'MMM d');
      if (key in days) days[key]++;
    }
    return Object.entries(days).map(([date, count]) => ({ date, count }));
  }, [allEntries]);

  const pieData = useMemo(() => {
    const counts: Record<string, number> = { create: 0, update: 0, delete: 0, cancel: 0, export: 0 };
    for (const e of allEntries) counts[e.action] = (counts[e.action] || 0) + 1;
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));
  }, [allEntries]);

  // ── User leaderboard ──────────────────────────────────────────
  const leaderboard = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>();
    for (const e of allEntries) {
      const cur = map.get(e.userId) || { name: e.userName, count: 0 };
      cur.count++;
      map.set(e.userId, cur);
    }
    return Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [allEntries]);

  // ── Unique users for filter dropdown ──────────────────────────
  const uniqueUsers = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of allEntries) map.set(e.userId, e.userName);
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allEntries]);

  const clearFilters = () => {
    setActionFilter('');
    setEntityFilter('');
    setUserFilter('');
    setSearch('');
    setDateRange('all');
  };
  const hasFilters = !!(effectiveAction || effectiveEntity || effectiveUser || search || dateRange !== 'all');

  // ── Filter bar (shared between tabs) ──────────────────────────
  const filterBar = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('reports.searchLogs')}
          className="pl-9 pr-9"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <Select value={actionFilter} onValueChange={(v) => setActionFilter(v ?? '')}>
        <SelectTrigger className="w-[130px]">
          <SelectValue placeholder="Action" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all_actions">All Actions</SelectItem>
          <SelectItem value="create">Create</SelectItem>
          <SelectItem value="update">Update</SelectItem>
          <SelectItem value="delete">Delete</SelectItem>
          <SelectItem value="cancel">Cancel</SelectItem>
          <SelectItem value="export">Export</SelectItem>
        </SelectContent>
      </Select>

      <Select value={entityFilter} onValueChange={(v) => setEntityFilter(v ?? '')}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Entity" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all_entities">All Entities</SelectItem>
          <SelectItem value="booking">Booking</SelectItem>
          <SelectItem value="contact">Contact</SelectItem>
          <SelectItem value="user">User</SelectItem>
          <SelectItem value="group">Group</SelectItem>
          <SelectItem value="report">Report</SelectItem>
        </SelectContent>
      </Select>

      <Select value={userFilter} onValueChange={(v) => setUserFilter(v ?? '')}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="User" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all_users">All Users</SelectItem>
          {uniqueUsers.map((u) => (
            <SelectItem key={u.id} value={u.id}>
              {u.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={dateRange} onValueChange={(v) => setDateRange((v ?? 'all') as typeof dateRange)}>
        <SelectTrigger className="w-[130px]">
          <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Time</SelectItem>
          <SelectItem value="today">Today</SelectItem>
          <SelectItem value="week">This Week</SelectItem>
          <SelectItem value="month">This Month</SelectItem>
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5 text-xs">
          <X className="h-3.5 w-3.5" /> Clear
        </Button>
      )}
    </div>
  );

  // ── Audit table (shared between tabs) ─────────────────────────
  const auditTable = (
    <>
      {loading && tableEntries.length === 0 ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : tableEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Filter className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No log entries match your filters</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Try broadening your search or clearing filters</p>
          {hasFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters} className="mt-3 gap-1.5">
              <X className="h-3.5 w-3.5" /> Clear all filters
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">{t('reports.action')}</TableHead>
                  <TableHead className="w-[100px]">{t('reports.type')}</TableHead>
                  <TableHead>{t('reports.user')}</TableHead>
                  <TableHead>{t('reports.details')}</TableHead>
                  <TableHead className="w-[150px]">{t('reports.time')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableEntries.map((entry) => {
                  const Icon = ACTION_ICONS[entry.action] || FileText;
                  return (
                    <TableRow
                      key={entry.id}
                      className="cursor-pointer hover:bg-accent/60"
                      onClick={() => setSelectedEntry(entry)}
                    >
                      <TableCell>
                        <Badge className={cn(ACTION_COLORS[entry.action], 'gap-1')} variant="outline">
                          <Icon className="h-3 w-3" />
                          {entry.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="capitalize text-sm">{entry.entityType}</TableCell>
                      <TableCell className="text-sm">{entry.userName}</TableCell>
                      <TableCell className="max-w-[300px] truncate text-sm text-muted-foreground">
                        {entry.details}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                        {format(parseISO(entry.timestamp), 'MMM d, h:mm aaa')}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between pt-3">
            <p className="text-xs text-muted-foreground">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-2 text-xs text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );

  // ── Render ─────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{t('page.reports.title')}</h1>
            <InfoButton {...reportsHelp} />
          </div>
          <p className="text-sm text-muted-foreground">{t('reports.accessNote')}</p>
        </div>
        <Button
          onClick={() => exportCSV(allEntries)}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          {t('btn.exportCSV')}
        </Button>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList>
          <TabsTrigger value="dashboard" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" /> {t('reports.dashboard')}
          </TabsTrigger>
          <TabsTrigger value="changelog" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" /> {t('reports.changeLog')}
          </TabsTrigger>
        </TabsList>

        {/* ── Dashboard Tab ─────────────────────────────────────── */}
        <TabsContent value="dashboard" className="space-y-6 mt-0">
          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: t('reports.totalActions'), value: allEntries.length, icon: FileText, color: 'text-primary' },
              { label: t('reports.thisMonth'), value: thisMonthCount, icon: Clock, color: 'text-cyan-500' },
              { label: t('reports.creates'), value: createCount, icon: PlusCircle, color: 'text-green-500' },
              { label: t('reports.cancellations'), value: cancelCount, icon: Ban, color: 'text-orange-500' },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <Card>
                  <CardContent className="flex items-center gap-4 p-5">
                    <div className="rounded-xl bg-primary/10 p-3">
                      <stat.icon className={cn('h-5 w-5', stat.color)} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stat.value}</p>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Charts row */}
          <div className="grid gap-4 lg:grid-cols-5">
            {/* Activity bar chart */}
            <Card className="lg:col-span-3">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Activity — Last 14 Days
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: '#888' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#888' }}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{
                          background: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Pie chart + leaderboard */}
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Action Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="h-[160px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={35}
                          outerRadius={60}
                          paddingAngle={3}
                          dataKey="value"
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          label={(props: any) =>
                            `${props.name} ${((props.percent ?? 0) * 100).toFixed(0)}%`
                          }
                          labelLine={false}
                        >
                          {pieData.map((_, idx) => (
                            <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            background: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                    <Trophy className="h-4 w-4 text-amber-400" /> Top Contributors
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {leaderboard.map((user, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-5 text-right text-xs text-muted-foreground font-mono">
                          {i + 1}.
                        </span>
                        <span className="font-medium truncate">{user.name}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {user.count} actions
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Filter bar + table */}
          <div className="space-y-4">
            {filterBar}
            {auditTable}
          </div>
        </TabsContent>

        {/* ── Change Log Tab ────────────────────────────────────── */}
        <TabsContent value="changelog" className="space-y-4 mt-0">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Complete record of all changes — {total} entries
              {hasFilters ? ' (filtered)' : ''}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // Export only filtered results
                groupsApi
                  .getAuditLog({
                    limit: 9999,
                    action: effectiveAction || undefined,
                    entityType: effectiveEntity || undefined,
                    userId: effectiveUser || undefined,
                    search: search || undefined,
                    ...dateBounds,
                  })
                  .then((data) => exportCSV(data.entries, 'diamond-change-log.csv'));
              }}
              className="gap-1.5"
            >
              <Download className="h-3.5 w-3.5" /> Export filtered
            </Button>
          </div>
          {filterBar}
          {auditTable}
        </TabsContent>
      </Tabs>

      {/* ── Detail Dialog ───────────────────────────────────────── */}
      <Dialog
        open={!!selectedEntry}
        onOpenChange={(o) => !o && setSelectedEntry(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedEntry && (() => {
                const Icon = ACTION_ICONS[selectedEntry.action] || FileText;
                return <Icon className="h-5 w-5 text-primary" />;
              })()}
              {t('reports.auditEntry')}
            </DialogTitle>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Action</p>
                  <Badge className={cn(ACTION_COLORS[selectedEntry.action], 'gap-1')} variant="outline">
                    {selectedEntry.action}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Entity Type</p>
                  <p className="font-medium capitalize">{selectedEntry.entityType}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Entity ID</p>
                  <p className="font-mono text-xs">{selectedEntry.entityId}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">User</p>
                  <p className="font-medium">{selectedEntry.userName}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Details</p>
                <p className="text-sm">{selectedEntry.details}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Timestamp</p>
                <p className="text-sm">
                  {format(parseISO(selectedEntry.timestamp), 'EEEE, MMMM d, yyyy · h:mm:ss aaa')}
                </p>
              </div>
              <div className="flex justify-end pt-2">
                <Button variant="outline" size="sm" onClick={() => setSelectedEntry(null)}>
                  {t('btn.close')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
