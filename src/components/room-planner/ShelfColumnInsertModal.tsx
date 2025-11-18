import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Package, Columns } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

type ShelfColumnInsertModalProps = {
  wall: {
    id: string;
    name: string;
    width: number;
    height: number;
    depth: number;
    position: {
      x: number;
      y: number;
      z: number;
    };
  };
  preconfiguredShelves: Array<{
    id: string;
    name: string;
    width: number;
    height: number;
    depth: number;
  }>;
  preconfiguredColumns: Array<{
    id: string;
    name: string;
    width: number;
    height: number;
    depth: number;
  }>;
  isOpen: boolean;
  onClose: () => void;
  onInsert: (config: {
    shelfType: string;
    columnType: string;
    shelvesPerColumn: number;
    shelfHeight: number;
    columnsCount: number | 'auto';
  }) => void;
};

const ShelfColumnInsertModal = ({ 
  wall, 
  preconfiguredShelves, 
  preconfiguredColumns,
  isOpen, 
  onClose, 
  onInsert 
}: ShelfColumnInsertModalProps) => {
  // Form state
  const [shelfType, setShelfType] = useState(preconfiguredShelves[0]?.id || '');
  const [columnType, setColumnType] = useState(preconfiguredColumns[0]?.id || '');
  const [shelvesPerColumn, setShelvesPerColumn] = useState(4);
  const [shelfHeightDifference, setShelfHeightDifference] = useState(50); // 0.5 meter in cm
  const [columnsCount, setColumnsCount] = useState<'auto' | number>('auto');
  const [autoColumns, setAutoColumns] = useState(true);

  // Selected shelf/column details
  const [selectedShelf, setSelectedShelf] = useState(preconfiguredShelves[0] || null);
  const [selectedColumn, setSelectedColumn] = useState(preconfiguredColumns[0] || null);
  
  // Validation errors
  const [errors, setErrors] = useState<string[]>([]);
  
  // Update selected shelf when shelfType changes
  useEffect(() => {
    const shelf = preconfiguredShelves.find(s => s.id === shelfType);
    setSelectedShelf(shelf || null);
  }, [shelfType, preconfiguredShelves]);
  
  // Update selected column when columnType changes
  useEffect(() => {
    const column = preconfiguredColumns.find(c => c.id === columnType);
    setSelectedColumn(column || null);
  }, [columnType, preconfiguredColumns]);
  
  // Validate form
  useEffect(() => {
    const newErrors: string[] = [];
    
    // Check if shelf type is selected
    if (!shelfType) {
      newErrors.push('يرجى اختيار نوع الرف');
    }
    
    // Check if column type is selected
    if (!columnType) {
      newErrors.push('يرجى اختيار نوع العمود');
    }
    
    // Validate shelves per column
    if (shelvesPerColumn < 1) {
      newErrors.push('عدد الرفوف لكل عمود يجب أن يكون 1 على الأقل');
    }
    
    // Validate shelf height difference
    if (shelfHeightDifference <= 0) {
      newErrors.push('فرق الارتفاع بين الرفوف يجب أن يكون أكبر من 0');
    }
    
    // Validate columns count
    if (columnsCount !== 'auto' && columnsCount < 1) {
      newErrors.push('عدد الأعمدة يجب أن يكون 1 على الأقل');
    }
    
    // Check if shelf dimensions are realistic for wall
    if (selectedShelf) {
      // Check shelf width
      if (selectedShelf.width > wall.width) {
        newErrors.push(`عرض الرف (${selectedShelf.width}سم) أكبر من عرض الجدار (${wall.width}سم)`);
      }
      
      // Check shelf height
      if (selectedShelf.height > wall.height) {
        newErrors.push(`ارتفاع الرف (${selectedShelf.height}سم) أكبر من ارتفاع الجدار (${wall.height}سم)`);
      }
      
      // Check total height needed for shelves
      const totalShelfHeight = shelvesPerColumn * selectedShelf.height + (shelvesPerColumn - 1) * shelfHeightDifference;
      if (totalShelfHeight > wall.height) {
        newErrors.push(`الارتفاع الإجمالي المطلوب لـ ${shelvesPerColumn} رف (${totalShelfHeight}سم) يتجاوز ارتفاع الجدار (${wall.height}سم)`);
      }
    }
    
    // Check if column dimensions are realistic for wall
    if (selectedColumn) {
      // Check column height
      if (selectedColumn.height > wall.height) {
        newErrors.push(`ارتفاع العمود (${selectedColumn.height}سم) أكبر من ارتفاع الجدار (${wall.height}سم)`);
      }
    }
    
    // Check columns count with shelf width
    if (columnsCount !== 'auto' && selectedShelf) {
      const totalWidth = columnsCount * selectedShelf.width + (columnsCount - 1) * 10; // 10cm spacing
      if (totalWidth > wall.width) {
        newErrors.push(`العرض الإجمالي المطلوب لـ ${columnsCount} رف (${totalWidth}سم) يتجاوز عرض الجدار (${wall.width}سم)`);
      }
    }
    
    setErrors(newErrors);
  }, [shelfType, columnType, shelvesPerColumn, shelfHeightDifference, columnsCount, selectedShelf, selectedColumn, wall]);
  
  // Calculate auto columns count
  const calculateAutoColumns = () => {
    if (!selectedShelf) return 0;
    
    // Calculate how many shelves can fit in the wall width with some spacing
    const spacing = 10; // 10cm spacing between shelves
    return Math.floor((wall.width + spacing) / (selectedShelf.width + spacing));
  };
  
  // Sync autoColumns checkbox with columnsCount
  useEffect(() => {
    setAutoColumns(columnsCount === 'auto');
  }, [columnsCount]);

  // Handle insert
  const handleInsert = () => {
    if (errors.length > 0) return;
    
    onInsert({
      shelfType,
      columnType,
      shelvesPerColumn,
      shelfHeight: shelfHeightDifference,
      columnsCount: columnsCount === 'auto' ? calculateAutoColumns() : columnsCount
    });
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-gray-900 text-white border-cyan-500/50">
        <DialogHeader>
          <DialogTitle className="text-cyan-400 flex items-center">
            <Package className="mr-2" />
            إدراج شبكة أرفف قياسية
          </DialogTitle>
        </DialogHeader>
        
        <Card className="bg-gray-800/50 border-cyan-500/30">
          <CardHeader className="bg-gray-800/80 border-b border-cyan-500/30">
            <CardTitle className="text-cyan-400">الجدار: {wall.name}</CardTitle>
            <p className="text-cyan-200 text-sm">
              العرض: {wall.width}سم، الارتفاع: {wall.height}سم
            </p>
          </CardHeader>
          <CardContent className="space-y-6 py-6">
            {errors.length > 0 && (
              <Alert variant="destructive" className="bg-red-900/50 border-red-500/50">
                <AlertDescription>
                  <ul className="list-disc pl-5 space-y-1">
                    {errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Shelf Configuration */}
              <Card className="bg-gray-800/30 border-amber-500/30">
                <CardHeader className="bg-amber-900/30 border-b border-amber-500/30">
                  <CardTitle className="text-amber-400 flex items-center">
                    <Package className="mr-2" />
                    إعدادات الرفوف
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div>
                    <Label className="text-amber-200">نوع الرف</Label>
                    <Select value={shelfType} onValueChange={setShelfType}>
                      <SelectTrigger className="bg-gray-700/50 border-amber-500/30 text-amber-100">
                        <SelectValue placeholder="اختر نوع الرف" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-amber-500/30">
                        {preconfiguredShelves.map((shelf) => (
                          <SelectItem 
                            key={shelf.id} 
                            value={shelf.id}
                            className="text-amber-100 hover:bg-amber-900/30"
                          >
                            {shelf.name} ({shelf.width}×{shelf.height}×{shelf.depth} سم)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label className="text-amber-200">عدد الرفوف لكل عمود</Label>
                    <Input
                      type="number"
                      min="1"
                      value={shelvesPerColumn}
                      onChange={(e) => setShelvesPerColumn(Math.max(1, parseInt(e.target.value) || 1))}
                      className="bg-gray-700/50 border-amber-500/30 text-amber-100"
                    />
                  </div>
                  
                  <div>
                    <Label className="text-amber-200">فرق الارتفاع بين الرفوف (سم)</Label>
                    <Input
                      type="number"
                      min="1"
                      value={shelfHeightDifference}
                      onChange={(e) => setShelfHeightDifference(Math.max(1, parseInt(e.target.value) || 1))}
                      className="bg-gray-700/50 border-amber-500/30 text-amber-100"
                    />
                  </div>
                </CardContent>
              </Card>
              
              {/* Column Configuration */}
              <Card className="bg-gray-800/30 border-purple-500/30">
                <CardHeader className="bg-purple-900/30 border-b border-purple-500/30">
                  <CardTitle className="text-purple-400 flex items-center">
                    <Columns className="mr-2" />
                    إعدادات الأعمدة
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div>
                    <Label className="text-purple-200">نوع العمود</Label>
                    <Select value={columnType} onValueChange={setColumnType}>
                      <SelectTrigger className="bg-gray-700/50 border-purple-500/30 text-purple-100">
                        <SelectValue placeholder="اختر نوع العمود" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-purple-500/30">
                        {preconfiguredColumns.map((column) => (
                          <SelectItem 
                            key={column.id} 
                            value={column.id}
                            className="text-purple-100 hover:bg-purple-900/30"
                          >
                            {column.name} ({column.width}×{column.height}×{column.depth} سم)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label className="text-purple-200">عدد الأعمدة</Label>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex items-center gap-2">
                        <Checkbox id="autoColumns" checked={autoColumns} onCheckedChange={(v) => setColumnsCount(v ? 'auto' : 1)} />
                        <label htmlFor="autoColumns" className="text-purple-100 text-sm cursor-pointer">تلقائي ({calculateAutoColumns()})</label>
                      </div>
                      <Input
                        type="number"
                        min="1"
                        value={columnsCount === 'auto' ? '' : columnsCount}
                        onChange={(e) => setColumnsCount(Math.max(1, parseInt(e.target.value) || 1))}
                        placeholder="يدوي"
                        className="w-36 bg-gray-700/50 border-purple-500/30 text-purple-100"
                        disabled={columnsCount === 'auto'}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Summary */}
            <Card className="bg-gray-800/30 border-cyan-500/30">
              <CardHeader className="bg-cyan-900/30 border-b border-cyan-500/30">
                <CardTitle className="text-cyan-400">ملخص الإدراج</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-cyan-200">أبعاد الجدار:</p>
                    <p className="text-white">{wall.width} × {wall.height} سم</p>
                  </div>
                  <div>
                    <p className="text-cyan-200">الرف المختار:</p>
                    <p className="text-white">
                      {selectedShelf ? `${selectedShelf.name} (${selectedShelf.width}×${selectedShelf.height} سم)` : 'لا يوجد'}
                    </p>
                  </div>
                  <div>
                    <p className="text-cyan-200">العمود المختار:</p>
                    <p className="text-white">
                      {selectedColumn ? `${selectedColumn.name} (${selectedColumn.width}×${selectedColumn.height} سم)` : 'لا يوجد'}
                    </p>
                  </div>
                  <div>
                    <p className="text-cyan-200">الإعداد:</p>
                    <p className="text-white">
                      {shelvesPerColumn} رف لكل عمود، {columnsCount === 'auto' ? calculateAutoColumns() : columnsCount} عمود
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <div className="flex justify-end gap-3 pt-4">
              <Button 
                variant="outline" 
                onClick={onClose}
                className="border-cyan-500/50 text-cyan-300 hover:bg-cyan-900/30"
              >
                إلغاء
              </Button>
              <Button 
                onClick={handleInsert}
                disabled={errors.length > 0}
                className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                إدراج الأرفف والأعمدة
              </Button>
            </div>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
};

export default ShelfColumnInsertModal;