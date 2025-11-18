import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Columns, Lock, Unlock, Plus, Trash2 } from 'lucide-react';
import { PRECONFIGURED_COLUMNS, Column } from './plannerConstants';

type ColumnsPanelProps = {
  columns: Column[];
  selectedColumnId: string | null;
  columnWidth: number;
  columnHeight: number;
  columnDepth: number;
  columnPositionX: number;
  columnPositionY: number;
  columnPositionZ: number;
  columnIsLocked: boolean;
  setColumnWidth: (width: number) => void;
  setColumnHeight: (height: number) => void;
  setColumnDepth: (depth: number) => void;
  setColumnPositionX: (x: number) => void;
  setColumnPositionY: (y: number) => void;
  setColumnPositionZ: (z: number) => void;
  setColumnIsLocked: (locked: boolean) => void;
  updateSelectedColumn: () => void;
  handleColumnClick: (id: string) => void;
  removeColumn: (id: string) => void;
  toggleColumnLock: () => void;
  addColumn: () => void;
  addSmartColumn: () => void;
};

const ColumnsPanel = ({
  columns,
  selectedColumnId,
  columnWidth,
  columnHeight,
  columnDepth,
  columnPositionX,
  columnPositionY,
  columnPositionZ,
  columnIsLocked,
  setColumnWidth,
  setColumnHeight,
  setColumnDepth,
  setColumnPositionX,
  setColumnPositionY,
  setColumnPositionZ,
  setColumnIsLocked,
  updateSelectedColumn,
  handleColumnClick,
  removeColumn,
  toggleColumnLock,
  addColumn,
  addSmartColumn
}: ColumnsPanelProps) => {
  return (
    <Card className="border border-gray-200">
      <CardHeader className="bg-gray-50 border-b border-gray-200">
        <CardTitle className="flex items-center text-gray-800">
          <Columns className="mr-2 text-primary" />
          تحكمات العمود
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-gray-700">العمود المعد مسبقًا</Label>
          <Select onValueChange={(value) => {
            const columnConfig = PRECONFIGURED_COLUMNS.find(c => c.id === value);
            if (columnConfig) {
              setColumnWidth(columnConfig.width);
              setColumnHeight(columnConfig.height);
              setColumnDepth(columnConfig.depth);
            }
          }}>
            <SelectTrigger className="border-gray-300 focus:ring-primary focus:border-primary">
              <SelectValue placeholder="اختر نوع العمود" />
            </SelectTrigger>
            <SelectContent>
              {PRECONFIGURED_COLUMNS.map((column) => (
                <SelectItem key={column.id} value={column.id}>
                  {column.name} ({column.width}×{column.height}×{column.depth} سم)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label className="text-gray-700">أبعاد العمود</Label>
          <div className="grid grid-cols-3 gap-3 mt-2">
            <div>
              <Label className="text-xs text-gray-600">العرض (سم)</Label>
              <Input 
                type="number" 
                value={columnWidth} 
                onChange={(e) => setColumnWidth(Number(e.target.value))} 
                onBlur={updateSelectedColumn}
                className="border-gray-300 focus:ring-primary focus:border-primary mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-600">الارتفاع (سم)</Label>
              <Input 
                type="number" 
                value={columnHeight} 
                onChange={(e) => setColumnHeight(Number(e.target.value))} 
                onBlur={updateSelectedColumn}
                className="border-gray-300 focus:ring-primary focus:border-primary mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-600">العمق (سم)</Label>
              <Input 
                type="number" 
                value={columnDepth} 
                onChange={(e) => setColumnDepth(Number(e.target.value))} 
                onBlur={updateSelectedColumn}
                className="border-gray-300 focus:ring-primary focus:border-primary mt-1"
              />
            </div>
          </div>
        </div>
        
        {selectedColumnId && (
          <>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="lock-column" 
                checked={columnIsLocked}
                onCheckedChange={(checked) => {
                  setColumnIsLocked(checked as boolean);
                  updateSelectedColumn();
                }}
                className="border-gray-300 focus:ring-blue-500"
              />
              <Label htmlFor="lock-column" className="text-gray-700">
                {columnIsLocked ? "مقفل" : "غير مقفل"}
              </Label>
              <Button 
                variant="outline" 
                size="sm" 
                className="border-gray-300 hover:bg-gray-100 text-gray-700"
                onClick={toggleColumnLock}
              >
                {columnIsLocked ? <Lock size={16} /> : <Unlock size={16} />}
              </Button>
            </div>
            
            {!columnIsLocked && (
              <>
                <div>
                  <Label className="text-gray-700">الموضع س (سم)</Label>
                  <Slider 
                    min={-1000} 
                    max={1000} 
                    step={5} 
                    value={[columnPositionX]} 
                    onValueChange={(value) => setColumnPositionX(value[0])} 
                    disabled={columnIsLocked}
                    className="my-2"
                  />
                  <Input 
                    type="number" 
                    value={columnPositionX} 
                    onChange={(e) => setColumnPositionX(Number(e.target.value))} 
                    onBlur={updateSelectedColumn}
                    disabled={columnIsLocked}
                    className="border-gray-300 focus:ring-primary focus:border-primary"
                  />
                </div>
                
                <div>
                  <Label className="text-gray-700">الموضع ص (سم)</Label>
                  <Slider 
                    min={0} 
                    max={250} 
                    step={5} 
                    value={[columnPositionY]} 
                    onValueChange={(value) => setColumnPositionY(value[0])} 
                    disabled={columnIsLocked}
                    className="my-2"
                  />
                  <Input 
                    type="number" 
                    value={columnPositionY} 
                    onChange={(e) => setColumnPositionY(Number(e.target.value))} 
                    onBlur={updateSelectedColumn}
                    disabled={columnIsLocked}
                    className="border-gray-300 focus:ring-primary focus:border-primary"
                  />
                </div>
                
                <div>
                  <Label className="text-gray-700">الموضع ع (سم)</Label>
                  <Slider 
                    min={-1000} 
                    max={1000} 
                    step={5} 
                    value={[columnPositionZ]} 
                    onValueChange={(value) => setColumnPositionZ(value[0])} 
                    disabled={columnIsLocked}
                    className="my-2"
                  />
                  <Input 
                    type="number" 
                    value={columnPositionZ} 
                    onChange={(e) => setColumnPositionZ(Number(e.target.value))} 
                    onBlur={updateSelectedColumn}
                    disabled={columnIsLocked}
                    className="border-gray-300 focus:ring-primary focus:border-primary"
                  />
                </div>
              </>
            )}
          </>
        )}
        
        <div className="grid grid-cols-2 gap-3">
          <Button onClick={addColumn} className="w-full bg-primary hover:bg-primary text-white py-2 rounded-lg border border-primary/30 transition-all duration-200 flex items-center justify-center font-medium">
            <Plus className="mr-2 h-4 w-4" /> إضافة عمود
          </Button>
          <Button onClick={addSmartColumn} className="w-full bg-gray-500 hover:bg-gray-600 text-white py-2 rounded-lg border border-gray-300 transition-all duration-200 flex items-center justify-center font-medium">
            <Plus className="mr-2 h-4 w-4" /> إضافة ذكية
          </Button>
        </div>
        
        <div className="mt-4">
          <Label className="text-gray-700">الأعمدة في الغرفة</Label>
          <div className="space-y-2 max-h-60 overflow-y-auto mt-2">
            {columns.length === 0 ? (
              <p className="text-gray-500">لم يتم وضع أي أعمدة بعد</p>
            ) : (
              columns.map((column) => (
                <div 
                  key={column.id} 
                  className={`flex justify-between items-center p-3 rounded cursor-pointer border ${
                    selectedColumnId === column.id 
                      ? 'bg-primary/10 border-primary/30' 
                      : 'bg-white hover:bg-gray-50 border-gray-200'
                  }`}
                  onClick={() => handleColumnClick(column.id)}
                >
                  <div>
                    <p className="font-medium text-gray-800">{column.name}</p>
                    <p className="text-sm text-gray-600">
                      {column.width}×{column.height}×{column.depth} سم
                    </p>
                  </div>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    className="bg-red-500 hover:bg-red-600 text-white rounded border border-red-300"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeColumn(column.id);
                    }}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ColumnsPanel;