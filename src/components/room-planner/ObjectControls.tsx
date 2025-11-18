import React from 'react';
import { Button } from '@/components/ui/button';
import { Move3D, Pencil, Trash2, Copy, X } from 'lucide-react';
import { Html } from '@react-three/drei';

type Props = {
  position: [number, number, number];
  isVisible: boolean;
  onMove: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onClone: () => void;
  onQuit?: () => void;
};

const ObjectControls: React.FC<Props> = ({ position, isVisible, onMove, onEdit, onDelete, onClone, onQuit }) => {
  if (!isVisible) return null;
  return (
    <Html position={position} center>
      <div className="flex gap-1 bg-white/90 border border-gray-200 rounded-lg shadow-md p-1">
        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onQuit} title="إنهاء التحديد">
          <X size={16} />
        </Button>
        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onMove} title="تحريك">
          <Move3D size={16} />
        </Button>
        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onEdit} title="تعديل">
          <Pencil size={16} />
        </Button>
        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onClone} title="استنساخ">
          <Copy size={16} />
        </Button>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-red-600" onClick={onDelete} title="حذف">
          <Trash2 size={16} />
        </Button>
      </div>
    </Html>
  );
};

export default ObjectControls;
