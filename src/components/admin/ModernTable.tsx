import { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, Plus, RefreshCw, Download, Upload } from 'lucide-react';

interface ModernTableProps {
  title: string;
  description?: string;
  children: ReactNode;
  searchPlaceholder?: string;
  onSearch?: (value: string) => void;
  onAdd?: () => void;
  onRefresh?: () => void;
  onExport?: () => void;
  onImport?: () => void;
  isLoading?: boolean;
  addButtonText?: string;
  showFilters?: boolean;
  actions?: ReactNode;
}

const ModernTable = ({
  title,
  description,
  children,
  searchPlaceholder = "البحث...",
  onSearch,
  onAdd,
  onRefresh,
  onExport,
  onImport,
  isLoading = false,
  addButtonText = "إضافة جديد",
  showFilters = true,
  actions
}: ModernTableProps) => {
  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-black text-slate-900 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            {title}
          </h1>
          {description && (
            <p className="text-lg text-slate-600 font-medium">{description}</p>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          {onRefresh && (
            <Button 
              onClick={onRefresh} 
              variant="outline" 
              size="sm"
              disabled={isLoading}
              className="bg-white/80 hover:bg-white border-primary/20 shadow-md"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'جارِ التحديث...' : 'تحديث'}
            </Button>
          )}
          
          {onExport && (
            <Button 
              onClick={onExport} 
              variant="outline" 
              size="sm"
              className="bg-white/80 hover:bg-white border-green-200 shadow-md text-green-700 hover:text-green-800"
            >
              <Download className="w-4 h-4 mr-2" />
              تصدير
            </Button>
          )}
          
          {onImport && (
            <Button 
              onClick={onImport} 
              variant="outline" 
              size="sm"
              className="bg-white/80 hover:bg-white border-purple-200 shadow-md text-purple-700 hover:text-purple-800"
            >
              <Upload className="w-4 h-4 mr-2" />
              استيراد
            </Button>
          )}
          
          {onAdd && (
            <Button 
              onClick={onAdd}
              className="bg-gradient-to-r from-primary to-secondary hover:from-primary hover:to-secondary text-white shadow-lg"
            >
              <Plus className="w-4 h-4 mr-2" />
              {addButtonText}
            </Button>
          )}
        </div>
      </div>

      {/* Filters and Search */}
      {showFilters && (
        <Card className="bg-white/80 backdrop-blur-sm border-primary/20 shadow-lg">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute right-3 top-3 h-5 w-5 text-slate-400" />
                  <Input
                    type="text"
                    placeholder={searchPlaceholder}
                    className="pr-10 h-12 bg-white/80 border-slate-200 focus:border-primary focus:ring-primary/20"
                    onChange={(e) => onSearch?.(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-12 px-4 bg-white/80 hover:bg-white border-slate-200">
                  <Filter className="w-4 h-4 mr-2" />
                  تصفية
                </Button>
                {actions}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table Content */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/50 shadow-xl">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            {children}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

interface ModernTableRowProps {
  children: ReactNode;
  isSelected?: boolean;
  onClick?: () => void;
  className?: string;
}

const ModernTableRow = ({ children, isSelected = false, onClick, className = '' }: ModernTableRowProps) => {
  return (
    <tr 
      className={`border-b border-slate-100 hover:bg-slate-50/80 transition-all duration-200 cursor-pointer ${
        isSelected ? 'bg-primary/5 border-primary/20' : ''
      } ${className}`}
      onClick={onClick}
    >
      {children}
    </tr>
  );
};

interface ModernTableHeaderProps {
  children: ReactNode;
  className?: string;
}

const ModernTableHeader = ({ children, className = '' }: ModernTableHeaderProps) => {
  return (
    <th className={`px-6 py-4 text-right text-sm font-semibold text-slate-700 bg-slate-50/80 ${className}`}>
      {children}
    </th>
  );
};

interface ModernTableCellProps {
  children: ReactNode;
  className?: string;
}

const ModernTableCell = ({ children, className = '' }: ModernTableCellProps) => {
  return (
    <td className={`px-6 py-4 text-sm text-slate-600 ${className}`}>
      {children}
    </td>
  );
};

export { ModernTable, ModernTableRow, ModernTableHeader, ModernTableCell };
