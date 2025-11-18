import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiGet, apiPutJson } from '@/lib/api';
import { Loader2, Palette } from 'lucide-react';

// Import texture constants
const WALL_TEXTURES = {
  painted_white: 'أبيض مطلي',
  painted_beige: 'بيج مطلي',
  painted_rough: 'خشن مطلي',
  wallpaper_damask: 'ورق جدران دمشقي',
  brick_red: 'طوب أحمر',
  brick_white: 'طوب أبيض',
  concrete_smooth: 'خرسانة ناعمة',
  concrete_panels: 'ألواح خرسانية',
  wood_planks: 'ألواح خشبية',
  wood_panels: 'لوحات خشبية',
  marble_white: 'رخام أبيض',
  tiles_white: 'بلاط أبيض',
  tiles_ceramic: 'بلاط سيراميك',
  stone_wall: 'جدار حجري',
  stone_blocks: 'كتل حجرية',
};

const FLOOR_TEXTURES = {
  tiles_white: 'بلاط أبيض',
  tiles_grey: 'بلاط رمادي',
  tiles_black: 'بلاط أسود',
  wood_light: 'خشب فاتح',
  wood_dark: 'خشب داكن',
  wood_parquet: 'باركيه خشبي',
  marble_white: 'رخام أبيض',
  marble_black: 'رخام أسود',
  vinyl_grey: 'فينيل رمادي',
  concrete: 'خرسانة',
};

interface ShopBuilderDefaultsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShopBuilderDefaultsModal: React.FC<ShopBuilderDefaultsModalProps> = ({ isOpen, onClose }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [floorTexture, setFloorTexture] = useState('tiles_white');
  const [wallTexture, setWallTexture] = useState('painted_white');
  const [wallColor, setWallColor] = useState('#ffffff');

  // Load current settings
  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await apiGet('/api/settings');
      const settings = (response as any).item || (response as any).settings || response;
      
      if (settings.shopBuilderDefaults) {
        setFloorTexture(settings.shopBuilderDefaults.floorTexture || 'tiles_white');
        setWallTexture(settings.shopBuilderDefaults.wallTexture || 'painted_white');
        setWallColor(settings.shopBuilderDefaults.wallColor || '#ffffff');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast({
        title: 'خطأ',
        description: 'فشل تحميل الإعدادات',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      await apiPutJson('/api/settings', {
        shopBuilderDefaults: {
          floorTexture,
          wallTexture,
          wallColor,
        },
      });

      toast({
        title: 'تم الحفظ',
        description: 'تم حفظ الإعدادات الافتراضية بنجاح',
      });

      onClose();
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: 'خطأ',
        description: 'فشل حفظ الإعدادات',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Palette className="w-6 h-6 text-primary" />
            الإعدادات الافتراضية لمنشئ المتجر
          </DialogTitle>
          <DialogDescription>
            اختر نسيج الأرضية والجدران واللون الافتراضي الذي سيظهر عند فتح منشئ المتجر
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Floor Texture */}
            <div className="space-y-3">
              <Label className="text-lg font-semibold">نسيج الأرضية</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.entries(FLOOR_TEXTURES).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setFloorTexture(key)}
                    className={`
                      relative p-4 rounded-lg border-2 transition-all
                      ${floorTexture === key 
                        ? 'border-primary bg-primary/10 shadow-md' 
                        : 'border-gray-200 hover:border-primary/50 hover:bg-gray-50'
                      }
                    `}
                  >
                    <div className="text-center">
                      <div className="text-sm font-medium">{label}</div>
                      {floorTexture === key && (
                        <div className="absolute top-2 right-2">
                          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Wall Texture */}
            <div className="space-y-3">
              <Label className="text-lg font-semibold">نسيج الجدران</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.entries(WALL_TEXTURES).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setWallTexture(key)}
                    className={`
                      relative p-4 rounded-lg border-2 transition-all
                      ${wallTexture === key 
                        ? 'border-primary bg-primary/10 shadow-md' 
                        : 'border-gray-200 hover:border-primary/50 hover:bg-gray-50'
                      }
                    `}
                  >
                    <div className="text-center">
                      <div className="text-sm font-medium">{label}</div>
                      {wallTexture === key && (
                        <div className="absolute top-2 right-2">
                          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Wall Color */}
            <div className="space-y-3">
              <Label className="text-lg font-semibold">لون الجدران الافتراضي</Label>
              <div className="flex items-center gap-4">
                <input
                  type="color"
                  value={wallColor}
                  onChange={(e) => setWallColor(e.target.value)}
                  className="w-20 h-20 rounded-lg border-2 border-gray-300 cursor-pointer"
                />
                <div className="flex-1">
                  <input
                    type="text"
                    value={wallColor}
                    onChange={(e) => setWallColor(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono"
                    placeholder="#ffffff"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    اختر اللون الافتراضي للجدران (يمكن تغييره لاحقاً في المنشئ)
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            إلغاء
          </Button>
          <Button onClick={handleSave} disabled={loading || saving}>
            {saving && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
            حفظ الإعدادات
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
