import { useMemo, useRef, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowUpDown } from "lucide-react";
import {
  sortNullableText,
  type TeamDailyReportRow,
} from "@/lib/team-daily-log";
import { memberAvatarStyle } from "@/lib/design-system";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import "@/styles/team-daily-log-grid.css";

const ROW_HEIGHT = 36;

function bodyCellClass(columnId: string): string {
  return cn(
    "team-daily-log-grid__body-cell",
    columnId === "member" && "team-daily-log-grid__body-cell--member",
    columnId === "tasks" && "team-daily-log-grid__body-cell--tasks"
  );
}

function headerCellClass(columnId: string): string {
  return cn(
    "team-daily-log-grid__header-cell",
    columnId === "member" && "team-daily-log-grid__header-cell--member",
    columnId === "tasks" && "team-daily-log-grid__header-cell--tasks"
  );
}

function SortableHeader({
  label,
  sorted,
  onClick,
}: {
  label: string;
  sorted: false | "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="inline-flex w-full min-w-0 items-center gap-1 text-left text-[11px] font-semibold text-slate-700 transition-opacity hover:opacity-80 dark:text-slate-200"
      onClick={onClick}
    >
      <span className="truncate">{label}</span>
      <ArrowUpDown className={cn("h-3 w-3 shrink-0", sorted ? "opacity-100" : "opacity-35")} />
    </button>
  );
}

function EmptyCell() {
  return <span className="team-daily-log-grid__empty">미입력</span>;
}

function EllipsisTooltipCell({
  value,
  className,
  tone = "muted",
}: {
  value: string | null;
  className?: string;
  tone?: "muted" | "foreground" | "danger";
}) {
  if (!value?.trim()) return <EmptyCell />;

  const toneClass =
    tone === "danger"
      ? "text-red-500 dark:text-red-400"
      : tone === "foreground"
        ? "text-slate-900 dark:text-slate-100"
        : "text-slate-600 dark:text-slate-300";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "block min-w-0 w-full cursor-default truncate text-left",
            toneClass,
            className
          )}
        >
          {value}
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-sm border-slate-200 bg-white px-2.5 py-1.5 text-[11px] leading-snug text-slate-800 shadow-md dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
      >
        {value}
      </TooltipContent>
    </Tooltip>
  );
}

function createColumns(): ColumnDef<TeamDailyReportRow>[] {
  return [
    {
      id: "member",
      accessorFn: (row) => row.member.name,
      header: ({ column }) => (
        <SortableHeader
          label="담당자"
          sorted={column.getIsSorted() || false}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }) => {
        const member = row.original.member;
        return (
          <div className="team-daily-log-grid__member flex min-w-0 w-full items-center gap-1.5">
            <div
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
              style={memberAvatarStyle(member.color)}
            >
              {member.avatar}
            </div>
            <span className="min-w-0 truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
              {member.name}
            </span>
          </div>
        );
      },
      sortingFn: (a, b) => sortNullableText(a.original.member.name, b.original.member.name),
    },
    {
      id: "tasks",
      accessorKey: "tasks",
      header: ({ column }) => (
        <SortableHeader
          label="타스크"
          sorted={column.getIsSorted() || false}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ getValue }) => (
        <EllipsisTooltipCell value={getValue() as string | null} tone="foreground" className="text-[11px]" />
      ),
      sortingFn: (a, b) => sortNullableText(a.original.tasks, b.original.tasks),
    },
    {
      id: "yesterday_achievement",
      accessorKey: "yesterday_achievement",
      header: ({ column }) => (
        <SortableHeader
          label="전일 성과"
          sorted={column.getIsSorted() || false}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ getValue }) => (
        <EllipsisTooltipCell value={getValue() as string | null} tone="muted" />
      ),
      sortingFn: (a, b) =>
        sortNullableText(a.original.yesterday_achievement, b.original.yesterday_achievement),
    },
    {
      id: "today_plan",
      accessorKey: "today_plan",
      header: ({ column }) => (
        <SortableHeader
          label="오늘 계획"
          sorted={column.getIsSorted() || false}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ getValue }) => (
        <EllipsisTooltipCell value={getValue() as string | null} tone="foreground" />
      ),
      sortingFn: (a, b) => sortNullableText(a.original.today_plan, b.original.today_plan),
    },
    {
      id: "bottleneck",
      accessorKey: "bottleneck",
      header: ({ column }) => (
        <SortableHeader
          label="병목"
          sorted={column.getIsSorted() || false}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }) => (
        <EllipsisTooltipCell value={row.original.bottleneck} tone="danger" />
      ),
      sortingFn: (a, b) => sortNullableText(a.original.bottleneck, b.original.bottleneck),
    },
  ];
}

export type TeamDailyLogGridProps = {
  data: TeamDailyReportRow[];
  emptyMessage?: string;
};

export function TeamDailyLogGrid({
  data,
  emptyMessage = "조건에 맞는 기록이 없습니다.",
}: TeamDailyLogGridProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const columns = useMemo(() => createColumns(), []);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const { rows } = table.getRowModel();
  const headerGroup = table.getHeaderGroups()[0];

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalHeight = rowVirtualizer.getTotalSize();

  if (rows.length === 0) {
    return (
      <div className="team-daily-log-grid flex min-h-[8rem] items-center justify-center px-4 py-10 text-xs text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={280}>
      <div className="team-daily-log-grid">
        <div ref={scrollRef} className="team-daily-log-grid__scroll">
          <div className="team-daily-log-grid__inner">
            {headerGroup ? (
              <div className="team-daily-log-grid__header-row" role="row">
                {headerGroup.headers.map((header) => (
                  <div
                    key={header.id}
                    className={headerCellClass(header.column.id)}
                    role="columnheader"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </div>
                ))}
              </div>
            ) : null}

            <div
              className="team-daily-log-grid__body"
              style={{ height: `${totalHeight}px` }}
            >
              {virtualRows.map((virtualRow) => {
                const row = rows[virtualRow.index]!;
                return (
                  <div
                    key={row.id}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    role="row"
                    className={cn(
                      "team-daily-log-grid__body-row",
                      !row.original.hasReport && "team-daily-log-grid__body-row--muted"
                    )}
                    style={{
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <div
                        key={cell.id}
                        className={bodyCellClass(cell.column.id)}
                        role="cell"
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
