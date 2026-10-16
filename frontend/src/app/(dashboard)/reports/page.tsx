"use client";

import { useQuery } from "@tanstack/react-query";
import { Download, BarChart3, PieChart as PieChartIcon, Calendar } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { reportsApi, projectApi } from "@/lib/api-client";
import { useState } from "react";

const PIE_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
];

export default function ReportsPage() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [projectId, setProjectId] = useState<string>("");

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: projectApi.list,
  });

  const { data: projectHours = [], isLoading: hoursLoading } = useQuery({
    queryKey: ["reports", "project-hours", { startDate, endDate }],
    queryFn: () => reportsApi.projectHours({ startDate, endDate }),
  });

  const { data: memberWorkload = [], isLoading: workloadLoading } = useQuery({
    queryKey: ["reports", "member-workload", { projectId, startDate, endDate }],
    queryFn: () =>
      reportsApi.memberWorkload({
        projectId: projectId || undefined,
        startDate,
        endDate,
      }),
  });

  const totalHours = projectHours.reduce((sum, p) => sum + p.hours, 0);
  const totalMembers = memberWorkload.length;

  // Simple CSV export
  const exportCSV = (filename: string, rows: Record<string, unknown>[]) => {
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","),
      ...rows.map((r) =>
        headers
          .map((h) => {
            const val = r[h];
            return typeof val === "string" && val.includes(",")
              ? `"${val}"`
              : String(val);
          })
          .join(","),
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Analytics and insights across projects and team members.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="space-y-1">
            <Label className="text-xs">Start Date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-[160px]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">End Date</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-[160px]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Project (workload)</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All projects</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-sky-500/10">
              <BarChart3 className="h-5 w-5 text-sky-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalHours.toFixed(1)}h</p>
              <p className="text-xs text-muted-foreground">Total Hours</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-500/10">
              <PieChartIcon className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalMembers}</p>
              <p className="text-xs text-muted-foreground">Active Members</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-violet-500/10">
              <Calendar className="h-5 w-5 text-violet-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{projectHours.length}</p>
              <p className="text-xs text-muted-foreground">Projects Tracked</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Bar chart - project hours */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Work Hours by Project</CardTitle>
              <CardDescription>
                Distribution of logged hours across projects
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportCSV("project-hours.csv", projectHours)
              }
              disabled={projectHours.length === 0}
            >
              <Download className="mr-1 h-4 w-4" />
              CSV
            </Button>
          </CardHeader>
          <CardContent>
            {hoursLoading ? (
              <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">
                Loading…
              </div>
            ) : projectHours.length === 0 ? (
              <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                No data for the selected period.
              </div>
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={projectHours}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid hsl(var(--border))",
                      }}
                    />
                    <Bar
                      dataKey="hours"
                      fill="#3b82f6"
                      radius={[6, 6, 0, 0]}
                      name="Hours"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pie chart - member workload */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Member Workload</CardTitle>
              <CardDescription>
                Share of hours logged by each team member
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportCSV("member-workload.csv", memberWorkload)
              }
              disabled={memberWorkload.length === 0}
            >
              <Download className="mr-1 h-4 w-4" />
              CSV
            </Button>
          </CardHeader>
          <CardContent>
            {workloadLoading ? (
              <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">
                Loading…
              </div>
            ) : memberWorkload.length === 0 ? (
              <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                No data for the selected period.
              </div>
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={memberWorkload}
                      dataKey="hours"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={(entry) => entry.name}
                    >
                      {memberWorkload.map((_, i) => (
                        <Cell
                          key={i}
                          fill={PIE_COLORS[i % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid hsl(var(--border))",
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Data tables */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Project Hours Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {projectHours.map((p) => (
                <div
                  key={p.name}
                  className="flex items-center justify-between rounded-md border p-2 text-sm"
                >
                  <span>{p.name}</span>
                  <span className="font-medium">{p.hours}h</span>
                </div>
              ))}
              {projectHours.length === 0 && (
                <p className="text-sm text-muted-foreground">No data.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Member Workload Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {memberWorkload.map((m) => (
                <div
                  key={m.name}
                  className="flex items-center justify-between rounded-md border p-2 text-sm"
                >
                  <span>{m.name}</span>
                  <span className="font-medium">{m.hours}h</span>
                </div>
              ))}
              {memberWorkload.length === 0 && (
                <p className="text-sm text-muted-foreground">No data.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
