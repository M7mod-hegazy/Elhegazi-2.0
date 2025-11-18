import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Plus, Package, List, Trash2 } from 'lucide-react';
import { PRECONFIGURED_SHELVES, Shelf } from './plannerConstants';

type ShelvesPanelProps = {
  shelfWidth: number;
  shelfHeight: number;
  shelfDepth: number;
  shelfPositionX: number;
  shelfPositionY: number;
  shelfPositionZ: number;
  selectedShelfType: string;
  shelves: Shelf[];
  selectedShelfId: string | null;
  setShelfWidth: (width: number) => void;
  setShelfHeight: (height: number) => void;
  setShelfDepth: (depth: number) => void;
  setShelfPositionX: (x: number) => void;
  setShelfPositionY: (y: number) => void;
  setShelfPositionZ: (z: number) => void;
  setSelectedShelfType: (type: string) => void;
  updateSelectedShelf: () => void;
  addShelf: () => void;
  handleShelfClick: (id: string) => void;
  removeShelf: (id: string) => void;
  calculateShelfQuantity: () => number;
};

const ShelvesPanel = ({
  shelfWidth,
  shelfHeight,
  shelfDepth,
  shelfPositionX,
  shelfPositionY,
  shelfPositionZ,
  selectedShelfType,
  shelves,
  selectedShelfId,
  setShelfWidth,
  setShelfHeight,
  setShelfDepth,
  setShelfPositionX,
  setShelfPositionY,
  setShelfPositionZ,
  setSelectedShelfType,
  updateSelectedShelf,
  addShelf,
  handleShelfClick,
  removeShelf,
  calculateShelfQuantity
}: ShelvesPanelProps) => {
  return (
    <>
      <Card className="border border-gray-200 hover:border-primary/30 transition-all duration-300 hover:shadow-lg rounded-xl">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 rounded-t-xl">
          <CardTitle className="flex items-center text-gray-800">
            <Package className="mr-2 text-primary" />
            وضع الرفوف
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-gray-700">الرف المعد مسبقًا</Label>
            <Select value={selectedShelfType} onValueChange={setSelectedShelfType}>
              <SelectTrigger className="border-gray-300 focus:ring-primary focus:border-primary rounded-lg transition-all duration-300 hover:border-primary">
                <SelectValue placeholder="اختر نوع الرف" />
              </SelectTrigger>
              <SelectContent>
                {PRECONFIGURED_SHELVES.map((shelf) => (
                  <SelectItem key={shelf.id} value={shelf.id}>
                    {shelf.name} ({shelf.width}×{shelf.height}×{shelf.depth} سم)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label className="text-gray-700">العرض (سم)</Label>
            <Slider 
              min={20} 
              max={200} 
              step={5} 
              value={[shelfWidth]} 
              onValueChange={(value) => setShelfWidth(value[0])} 
              className="my-2 transition-all duration-300 hover:opacity-90"
            />
            <Input 
              type="number" 
              value={shelfWidth} 
              onChange={(e) => setShelfWidth(Number(e.target.value))} 
              onBlur={updateSelectedShelf}
              className="border-gray-300 focus:ring-primary focus:border-primary rounded-lg transition-all duration-300 hover:border-primary"
            />
          </div>
          
          <div>
            <Label className="text-gray-700">الارتفاع (سم)</Label>
            <Slider 
              min={5} 
              max={100} 
              step={1} 
              value={[shelfHeight]} 
              onValueChange={(value) => setShelfHeight(value[0])} 
              className="my-2"
            />
            <Input 
              type="number" 
              value={shelfHeight} 
              onChange={(e) => setShelfHeight(Number(e.target.value))} 
              onBlur={updateSelectedShelf}
              className="border-gray-300 focus:ring-primary focus:border-primary"
            />
          </div>
          
          <div>
            <Label className="text-gray-700">العمق (سم)</Label>
            <Slider 
              min={10} 
              max={100} 
              step={1} 
              value={[shelfDepth]} 
              onValueChange={(value) => setShelfDepth(value[0])} 
              className="my-2"
            />
            <Input 
              type="number" 
              value={shelfDepth} 
              onChange={(e) => setShelfDepth(Number(e.target.value))} 
              onBlur={updateSelectedShelf}
              className="border-gray-300 focus:ring-primary focus:border-primary"
            />
          </div>
          
          <div>
            <Label className="text-gray-700">الموضع س (سم)</Label>
            <Slider 
              min={-1000} 
              max={1000} 
              step={5} 
              value={[shelfPositionX]} 
              onValueChange={(value) => setShelfPositionX(value[0])} 
              className="my-2"
            />
            <Input 
              type="number" 
              value={shelfPositionX} 
              onChange={(e) => setShelfPositionX(Number(e.target.value))} 
              onBlur={updateSelectedShelf}
              className="border-gray-300 focus:ring-primary focus:border-primary"
            />
          </div>
          
          <div>
            <Label className="text-gray-700">الموضع ص (سم)</Label>
            <Slider 
              min={0} 
              max={250} 
              step={5} 
              value={[shelfPositionY]} 
              onValueChange={(value) => setShelfPositionY(value[0])} 
              className="my-2"
            />
            <Input 
              type="number" 
              value={shelfPositionY} 
              onChange={(e) => setShelfPositionY(Number(e.target.value))} 
              onBlur={updateSelectedShelf}
              className="border-gray-300 focus:ring-primary focus:border-primary"
            />
          </div>
          
          <div>
            <Label className="text-gray-700">الموضع ع (سم)</Label>
            <Slider 
              min={-1000} 
              max={1000} 
              step={5} 
              value={[shelfPositionZ]} 
              onValueChange={(value) => setShelfPositionZ(value[0])} 
              className="my-2"
            />
            <Input 
              type="number" 
              value={shelfPositionZ} 
              onChange={(e) => setShelfPositionZ(Number(e.target.value))} 
              onBlur={updateSelectedShelf}
              className="border-gray-300 focus:ring-primary focus:border-primary"
            />
          </div>
          
          <div>
            <Label className="text-gray-700">حساب الكمية</Label>
            <div className="p-3 bg-primary/5 rounded border border-primary/20">
              <p className="text-primary">الرفوف التي تتناسب: {calculateShelfQuantity()}</p>
              <p className="text-primary">الإجمالي المطلوب: {calculateShelfQuantity()}</p>
            </div>
          </div>
          
          <Button onClick={addShelf} className="w-full bg-gradient-to-r from-primary to-secondary hover:from-primary hover:to-secondary text-white py-2 rounded-lg border border-primary/30 transition-all duration-300 flex items-center justify-center font-medium transform hover:scale-105 shadow-md hover:shadow-lg">
            <Plus className="mr-2 h-4 w-4" /> إضافة رف
          </Button>
        </CardContent>
      </Card>
      
      <Card className="mt-4 border border-gray-200">
        <CardHeader className="bg-gray-50 border-b border-gray-200">
          <CardTitle className="flex items-center text-gray-800">
            <List className="mr-2 text-primary" />
            الرفوف الموضوعة
          </CardTitle>
        </CardHeader>
        <CardContent>
          {shelves.length === 0 ? (
            <p className="text-gray-500">لم يتم وضع أي رفوف بعد</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {shelves.map((shelf) => (
                <div 
                  key={shelf.id} 
                  className={`flex justify-between items-center p-3 rounded cursor-pointer border ${
                    shelf.id === selectedShelfId 
                      ? 'bg-primary/10 border-primary/30' 
                      : 'bg-white hover:bg-gray-50 border-gray-200'
                  }`}
                  onClick={() => handleShelfClick(shelf.id)}
                >
                  <div>
                    <p className="font-medium text-gray-800">رف #{shelf.id.split('-')[1]}</p>
                    <p className="text-sm text-gray-600">
                      {shelf.width}×{shelf.height}×{shelf.depth} سم
                    </p>
                  </div>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    className="bg-red-500 hover:bg-red-600 text-white rounded border border-red-300"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeShelf(shelf.id);
                    }}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
};

export default ShelvesPanel;
