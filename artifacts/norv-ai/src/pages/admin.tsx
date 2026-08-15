import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Redirect } from "wouter";
import { 
  useGetAdminStats,
  useGetSubscriptionRequests,
  useApproveSubscription,
  useRejectSubscription,
  useGetAdminUsers,
  SubscriptionRequest
} from "@workspace/api-client-react";
import { 
  ShieldCheck, Users, Video, CreditCard, Clock, Check, X,
  ExternalLink, Search
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetSubscriptionRequestsQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  Body,
  Cell,
  Head,
  Header,
  HeaderCell,
  Row,
} from "@/components/ui/table";
// Note: We don't have a complex Table component exported in the generic list, I'll use standard HTML tables with tailwind inside a Card for simplicity and robustness since shadcn Table structure varies.

export default function AdminPanel() {
  const { user } = useAuth();
  
  if (!user || user.role !== "admin") {
    return <Redirect to="/dashboard" replace />;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex items-center gap-3 border-b pb-6">
        <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <ShieldCheck className="size-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Console</h1>
          <p className="text-muted-foreground">Manage users, content, and subscriptions.</p>
        </div>
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent mb-6">
          <TabsTrigger value="dashboard" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3">Overview</TabsTrigger>
          <TabsTrigger value="subscriptions" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3">Subscriptions</TabsTrigger>
          <TabsTrigger value="users" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3">Users</TabsTrigger>
        </TabsList>
        
        <TabsContent value="dashboard" className="mt-0">
          <AdminDashboardTab />
        </TabsContent>
        <TabsContent value="subscriptions" className="mt-0">
          <AdminSubscriptionsTab />
        </TabsContent>
        <TabsContent value="users" className="mt-0">
          <AdminUsersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AdminDashboardTab() {
  const { data: stats } = useGetAdminStats();

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-6 flex flex-col items-center justify-center text-center">
          <Users className="size-8 text-blue-500 mb-2" />
          <h3 className="text-3xl font-bold">{stats?.totalUsers || 0}</h3>
          <p className="text-sm text-muted-foreground">Total Users</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6 flex flex-col items-center justify-center text-center">
          <Video className="size-8 text-purple-500 mb-2" />
          <h3 className="text-3xl font-bold">{stats?.totalLectures || 0}</h3>
          <p className="text-sm text-muted-foreground">Lectures Hosted</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6 flex flex-col items-center justify-center text-center">
          <CreditCard className="size-8 text-green-500 mb-2" />
          <h3 className="text-3xl font-bold">{stats?.activeSubscriptions || 0}</h3>
          <p className="text-sm text-muted-foreground">Active Subs</p>
        </CardContent>
      </Card>
      <Card className={stats?.pendingSubscriptions ? "border-yellow-500 bg-yellow-500/5" : ""}>
        <CardContent className="p-6 flex flex-col items-center justify-center text-center">
          <Clock className="size-8 text-yellow-500 mb-2" />
          <h3 className="text-3xl font-bold">{stats?.pendingSubscriptions || 0}</h3>
          <p className="text-sm text-muted-foreground">Pending Requests</p>
        </CardContent>
      </Card>
    </div>
  );
}

function AdminSubscriptionsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: requests, isLoading } = useGetSubscriptionRequests({ status: "pending" });
  
  const approve = useApproveSubscription();
  const reject = useRejectSubscription();

  const handleApprove = (id: number) => {
    approve.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Approved" });
        queryClient.invalidateQueries({ queryKey: getGetSubscriptionRequestsQueryKey({ status: "pending" }) });
      }
    });
  };

  const handleReject = (id: number) => {
    const reason = prompt("Reason for rejection (optional):");
    if (reason === null) return; // cancelled
    
    reject.mutate({ id, data: { reason } }, {
      onSuccess: () => {
        toast({ title: "Rejected" });
        queryClient.invalidateQueries({ queryKey: getGetSubscriptionRequestsQueryKey({ status: "pending" }) });
      }
    });
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle>Pending Subscriptions</CardTitle>
        <CardDescription>Review and approve manual payment proofs.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-muted text-muted-foreground border-y border-border/50">
              <tr>
                <th className="px-6 py-3">User</th>
                <th className="px-6 py-3">Plan</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Receipt</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : requests?.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No pending requests.</td></tr>
              ) : requests?.map((req) => (
                <tr key={req.id} className="border-b border-border/50 hover:bg-muted/50">
                  <td className="px-6 py-4 font-medium">
                    {req.fullName} <span className="text-xs text-muted-foreground block">@{req.username}</span>
                  </td>
                  <td className="px-6 py-4 capitalize">{req.plan?.replace("months", " Months") ?? "-"}</td>
                  <td className="px-6 py-4">{new Date(req.createdAt).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    <a href={req.receiptUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                      View <ExternalLink className="size-3" />
                    </a>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" className="text-green-600 border-green-600 hover:bg-green-50" onClick={() => handleApprove(req.id)} disabled={approve.isPending}>
                        <Check className="size-4" />
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-600 border-red-600 hover:bg-red-50" onClick={() => handleReject(req.id)} disabled={reject.isPending}>
                        <X className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function AdminUsersTab() {
  const [search, setSearch] = useState("");
  const { data: users, isLoading } = useGetAdminUsers();

  const filteredUsers = users?.filter(u => 
    (u.username ?? "").toLowerCase().includes(search.toLowerCase()) || 
    (u.fullName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div>
          <CardTitle>User Directory</CardTitle>
          <CardDescription>View all registered students.</CardDescription>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input 
            placeholder="Search users..." 
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-muted text-muted-foreground border-y border-border/50">
              <tr>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3">Specialization</th>
                <th className="px-6 py-3">Level</th>
                <th className="px-6 py-3">Pro Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : filteredUsers?.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No users found.</td></tr>
              ) : filteredUsers?.map((u) => (
                <tr key={u.id} className="border-b border-border/50 hover:bg-muted/50">
                  <td className="px-6 py-4 font-medium">
                    {u.fullName} <span className="text-xs text-muted-foreground block">@{u.username}</span>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={u.role === 'admin' ? 'destructive' : 'secondary'} className="uppercase text-[10px]">
                      {u.role}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">{u.specialization || "-"}</td>
                  <td className="px-6 py-4 capitalize">{u.skillLevel || "-"}</td>
                  <td className="px-6 py-4">
                    {u.subscriptionActive ? (
                      <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">Free</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
