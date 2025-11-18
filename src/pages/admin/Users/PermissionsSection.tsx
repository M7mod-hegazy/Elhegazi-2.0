import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiGet, apiPostJson } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { 
  Search, 
  Shield, 
  User, 
  Users, 
  Plus,
  Save,
  X,
  Check
} from 'lucide-react';

interface Permission {
  resource: string;
  actions: string[];
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
}

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
}

const PermissionsSection = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [newRole, setNewRole] = useState({ name: '', description: '' });
  const [isCreatingRole, setIsCreatingRole] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<Record<string, string[]>>({});
  const [availableResources, setAvailableResources] = useState<{ name: string; actions: string[] }[]>([]);
  const [loading, setLoading] = useState(false);

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersRes, rolesRes] = await Promise.all([
        apiGet<User>('/api/users'),
        apiGet<Role>('/api/roles')
      ]);

      if (usersRes.ok) setUsers(usersRes.items || []);
      if (rolesRes.ok) setRoles(rolesRes.items || []);

      // Load available resources for permissions
      const resourcesRes = await apiGet<{ name: string; actions: string[] }>('/api/rbac/resources');
      if (resourcesRes.ok) setAvailableResources(resourcesRes.items || []);
    } catch (error) {
      toast({
        title: "خطأ في تحميل البيانات",
        description: "فشل في تحميل المستخدمين أو الأدوار",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Toggle permission action
  const togglePermissionAction = (resource: string, action: string) => {
    setSelectedPermissions(prev => {
      const current = prev[resource] || [];
      const updated = current.includes(action)
        ? current.filter(a => a !== action)
        : [...current, action];
      
      return {
        ...prev,
        [resource]: updated
      };
    });
  };

  // Toggle all actions for a resource
  const toggleAllActions = (resource: string, actions: string[]) => {
    setSelectedPermissions(prev => {
      const current = prev[resource] || [];
      const isAllSelected = current.length === actions.length && resource.actions.length > 0;
      
      return {
        ...prev,
        [resource]: isAllSelected ? [] : [...actions]
      };
    });
  };

  // Create new role
  const handleCreateRole = async () => {
    if (!newRole.name.trim()) {
      toast({
        title: "اسم الدور مطلوب",
        description: "يرجى إدخال اسم للدور الجديد",
        variant: "destructive"
      });
      return;
    }

    try {
      const permissions = Object.entries(selectedPermissions)
        .filter(([_, actions]) => actions.length > 0)
        .map(([resource, actions]) => ({ resource, actions }));

      const response = await apiPostJson<{ role: Role }, { name: string; description: string; permissions: Permission[] }>(
        '/api/roles',
        {
          name: newRole.name,
          description: newRole.description,
          permissions
        }
      );

      if (response.ok) {
        toast({
          title: "تم إنشاء الدور",
          description: "تم إنشاء الدور بنجاح"
        });
        
        setRoles(prev => [...prev, response.role]);
        setNewRole({ name: '', description: '' });
        setIsCreatingRole(false);
        setSelectedPermissions({});
      }
    } catch (error) {
      toast({
        title: "خطأ في إنشاء الدور",
        description: "فشل في إنشاء الدور الجديد",
        variant: "destructive"
      });
    }
  };

  // Assign role to user
  const handleAssignRole = async (userId: string, roleId: string) => {
    try {
      const response = await apiPostJson<{ success: boolean }, { userId: string; roleId: string }>(
        '/api/user-role',
        { userId, roleId }
      );

      if (response.ok) {
        toast({
          title: "تم تعيين الدور",
          description: "تم تعيين الدور للمستخدم بنجاح"
        });
        
        // Update user role in state
        setUsers(prev => prev.map(user => 
          user.id === userId ? { ...user, role: roleId } : user
        ));
      }
    } catch (error) {
      toast({
        title: "خطأ في تعيين الدور",
        description: "فشل في تعيين الدور للمستخدم",
        variant: "destructive"
      });
    }
  };

  // Filter users based on search term
  const filteredUsers = users.filter(user => {
    const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
    const email = user.email.toLowerCase();
    return fullName.includes(searchTerm.toLowerCase()) || 
           email.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6 mt-8">
      <Separator />
      
      <div>
        <h2 className="text-2xl font-bold text-slate-900">إدارة الصلاحيات</h2>
        <p className="text-slate-600 mt-2">إنشاء الأدوار وإدارة صلاحيات المستخدمين</p>
      </div>

      {/* Create Role Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            إنشاء دور جديد
          </CardTitle>
          <CardDescription>
            قم بإنشاء أدوار جديدة وتعيين الصلاحيات المناسبة
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="roleName">اسم الدور</Label>
              <Input
                id="roleName"
                value={newRole.name}
                onChange={(e) => setNewRole(prev => ({ ...prev, name: e.target.value }))}
                placeholder="مدير المبيعات"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="roleDescription">وصف الدور</Label>
              <Input
                id="roleDescription"
                value={newRole.description}
                onChange={(e) => setNewRole(prev => ({ ...prev, description: e.target.value }))}
                placeholder="صلاحيات مدير المبيعات"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">الصلاحيات</h3>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setIsCreatingRole(!isCreatingRole)}
              >
                {isCreatingRole ? (
                  <>
                    <X className="w-4 h-4 ml-2" />
                    إلغاء
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 ml-2" />
                    إضافة دور
                  </>
                )}
              </Button>
            </div>

            {isCreatingRole && (
              <div className="border rounded-lg p-4 space-y-4">
                <div className="max-h-96 overflow-y-auto">
                  {availableResources.map((resource) => {
                    const selectedActions = selectedPermissions[resource.name] || [];
                    const allSelected = selectedActions.length === resource.actions.length && resource.actions.length > 0;
                    
                    return (
                      <div key={resource.name} className="border-b pb-4 last:border-b-0">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium">{resource.name}</h4>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`all-${resource.name}`}
                              checked={allSelected}
                              onCheckedChange={() => toggleAllActions(resource.name, resource.actions)}
                            />
                            <Label htmlFor={`all-${resource.name}`}>تحديد الكل</Label>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                          {resource.actions.map((action) => (
                            <div key={action} className="flex items-center space-x-2">
                              <Checkbox
                                id={`${resource.name}-${action}`}
                                checked={selectedActions.includes(action)}
                                onCheckedChange={() => togglePermissionAction(resource.name, action)}
                              />
                              <Label htmlFor={`${resource.name}-${action}`} className="text-sm">
                                {action}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <Button 
                  onClick={handleCreateRole}
                  className="w-full"
                >
                  <Save className="w-4 h-4 ml-2" />
                  حفظ الدور
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Roles List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            الأدوار المتاحة
          </CardTitle>
          <CardDescription>
            قائمة بجميع الأدوار المحددة في النظام
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles.map((role) => (
              <Card key={role.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center justify-between">
                    {role.name}
                    <Shield className="w-5 h-5 text-primary" />
                  </CardTitle>
                  <CardDescription>{role.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">الصلاحيات:</h4>
                    <div className="flex flex-wrap gap-1">
                      {role.permissions.slice(0, 5).map((perm, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {perm.resource}
                        </Badge>
                      ))}
                      {role.permissions.length > 5 && (
                        <Badge variant="outline" className="text-xs">
                          +{role.permissions.length - 5} أكثر
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Users and Role Assignment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            تعيين الأدوار للمستخدمين
          </CardTitle>
          <CardDescription>
            قم بتعيين الأدوار للمستخدمين في النظام
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="البحث عن مستخدم..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المستخدم</TableHead>
                    <TableHead>البريد الإلكتروني</TableHead>
                    <TableHead>الدور الحالي</TableHead>
                    <TableHead>تعيين دور جديد</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => {
                    const currentRole = roles.find(role => role.id === user.role);
                    
                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                              <div className="font-medium">{user.firstName} {user.lastName}</div>
                              <div className="text-sm text-slate-500">
                                {user.isActive ? (
                                  <span className="text-green-600">نشط</span>
                                ) : (
                                  <span className="text-red-600">غير نشط</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          {currentRole ? (
                            <Badge className="bg-primary/10 text-primary">
                              {currentRole.name}
                            </Badge>
                          ) : (
                            <Badge variant="outline">لا يوجد دور</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={user.role}
                            onValueChange={(value) => handleAssignRole(user.id, value)}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue placeholder="اختر دور" />
                            </SelectTrigger>
                            <SelectContent>
                              {roles.map((role) => (
                                <SelectItem key={role.id} value={role.id}>
                                  {role.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PermissionsSection;