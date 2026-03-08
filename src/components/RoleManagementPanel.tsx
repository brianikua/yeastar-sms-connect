import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, ShieldCheck, UserCog, Eye, Crown } from "lucide-react";
import { useUsersWithRoles, useCurrentUserRole, useUpdateUserRole, ROLE_META, type AppRole } from "@/hooks/useRoles";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const ROLE_ICONS: Record<AppRole, React.ElementType> = {
  super_admin: Crown,
  admin: ShieldCheck,
  operator: UserCog,
  viewer: Eye,
};

const ROLE_ORDER: AppRole[] = ["super_admin", "admin", "operator", "viewer"];

export const RoleManagementPanel = () => {
  const { data: users, isLoading } = useUsersWithRoles();
  const { data: currentRole } = useCurrentUserRole();
  const updateRole = useUpdateUserRole();

  const isSuperAdmin = currentRole === "super_admin";

  return (
    <div className="space-y-6">
      {/* Role Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ROLE_ORDER.map((role) => {
          const Icon = ROLE_ICONS[role];
          const count = (users || []).filter((u) => u.role === role).length;
          return (
            <Card key={role}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  {ROLE_META.labels[role]}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{count}</div>
                <p className="text-xs text-muted-foreground mt-1">{ROLE_META.descriptions[role]}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Shield className="w-4 h-4" />
            User Roles
          </CardTitle>
          <CardDescription>
            {isSuperAdmin
              ? "As Super Admin, you can assign roles to all users"
              : "Only Super Admins can modify user roles"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[200px] rounded-lg" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Current Role</TableHead>
                  <TableHead>Permissions</TableHead>
                  {isSuperAdmin && <TableHead>Change Role</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(users || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">No users found</TableCell>
                  </TableRow>
                ) : (
                  (users || []).map((user) => {
                    const Icon = ROLE_ICONS[user.role];
                    const isCurrentSuperAdmin = user.role === "super_admin";
                    return (
                      <TableRow key={user.user_id}>
                        <TableCell>
                          <div className="font-medium">{user.email}</div>
                          <div className="text-xs text-muted-foreground">ID: {user.user_id.slice(0, 8)}...</div>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("gap-1", ROLE_META.colors[user.role])}>
                            <Icon className="w-3 h-3" />
                            {ROLE_META.labels[user.role]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs text-muted-foreground max-w-[200px]">
                            {ROLE_META.descriptions[user.role]}
                          </div>
                        </TableCell>
                        {isSuperAdmin && (
                          <TableCell>
                            {isCurrentSuperAdmin ? (
                              <span className="text-xs text-muted-foreground">Protected</span>
                            ) : (
                              <Select
                                value={user.role}
                                onValueChange={(value) =>
                                  updateRole.mutate({ userId: user.user_id, role: value as AppRole })
                                }
                              >
                                <SelectTrigger className="w-[140px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {ROLE_ORDER.filter((r) => r !== "super_admin").map((role) => (
                                    <SelectItem key={role} value={role}>
                                      {ROLE_META.labels[role]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Role Hierarchy */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Role Hierarchy</CardTitle>
          <CardDescription>Permissions cascade downward — higher roles include all lower permissions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {ROLE_ORDER.map((role, i) => {
              const Icon = ROLE_ICONS[role];
              return (
                <div key={role} className="flex items-start gap-3">
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", ROLE_META.colors[role])}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-medium text-sm">{ROLE_META.labels[role]}</div>
                    <div className="text-xs text-muted-foreground">{ROLE_META.descriptions[role]}</div>
                  </div>
                  {i < ROLE_ORDER.length - 1 && (
                    <div className="absolute left-[15px] mt-8 w-px h-4 bg-border" />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
