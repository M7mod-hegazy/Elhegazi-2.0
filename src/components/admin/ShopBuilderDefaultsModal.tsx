import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiGet, apiPutJson } from '@/lib/api';
import { Loader2, Palette } from 'lucide-react';

const WALL_TEXTURES_LABELS: Record<string, string> = {
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

const FLOOR_TEXTURES_LABELS: Record<string, string> = {
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

const WALL_PREVIEWS: Record<string, string> = {
  painted_white: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgZmlsbD0iI2ZmZiIvPjwvc3ZnPg==',
  painted_beige: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgZmlsbD0iI0Y1RjBFMCIvPjwvc3ZnPg==',
  painted_rough: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgZmlsbD0iI0UwRTBFMCIvPjwvc3ZnPg==',
  wallpaper_damask: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgZmlsbD0iI0ZGRkJGMCIvPjwvc3ZnPg==',
  brick_red: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iYnJpY2siIHdpZHRoPSI2MCIgaGVpZ2h0PSIzMCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjMwIiBmaWxsPSIjQjI0QTNEIi8+PHJlY3QgeD0iMCIgeT0iMCIgd2lkdGg9IjI4IiBoZWlnaHQ9IjE0IiBmaWxsPSIjQzk1QTRCIiBzdHJva2U9IiM4QTMzMjgiIHN0cm9rZS13aWR0aD0iMSIvPjxyZWN0IHg9IjMyIiB5PSIwIiB3aWR0aD0iMjgiIGhlaWdodD0iMTQiIGZpbGw9IiNDOTVBNEIiIHN0cm9rZT0iIzhBMzMyOCIgc3Ryb2tlLXdpZHRoPSIxIi8+PHJlY3QgeD0iLTE0IiB5PSIxNiIgd2lkdGg9IjI4IiBoZWlnaHQ9IjE0IiBmaWxsPSIjQzk1QTRCIiBzdHJva2U9IiM4QTMzMjgiIHN0cm9rZS13aWR0aD0iMSIvPjxyZWN0IHg9IjE4IiB5PSIxNiIgd2lkdGg9IjI4IiBoZWlnaHQ9IjE0IiBmaWxsPSIjQzk1QTRCIiBzdHJva2U9IiM4QTMzMjgiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjUxMiIgaGVpZ2h0PSI1MTIiIGZpbGw9InVybCgjYnJpY2spIi8+PC9zdmc+',
  brick_white: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgZmlsbD0iI0Y4RjhGOCIvPjwvc3ZnPg==',
  concrete_smooth: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iY29uY3JldGUiIHdpZHRoPSI1MCIgaGVpZ2h0PSI1MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHJlY3Qgd2lkdGg9IjUwIiBoZWlnaHQ9IjUwIiBmaWxsPSIjQTBBMEEwIi8+PGNpcmNsZSBjeD0iMTAiIGN5PSIxMCIgcj0iMiIgZmlsbD0iIzg4ODg4OCIvPjxjaXJjbGUgY3g9IjMwIiBjeT0iMjAiIHI9IjEuNSIgZmlsbD0iIzk1OTU5NSIvPjxjaXJjbGUgY3g9IjQwIiBjeT0iNDAiIHI9IjIiIGZpbGw9IiM4ODg4ODgiLz48Y2lyY2xlIGN4PSIyMCIgY3k9IjM1IiByPSIxIiBmaWxsPSIjOTU5NTk1Ii8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgZmlsbD0idXJsKCNjb25jcmV0ZSkiLz48L3N2Zz4=',
  concrete_panels: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgZmlsbD0iIzk1OTU5NSIvPjwvc3ZnPg==',
  wood_planks: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0id29vZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIGZpbGw9IiM4QjczNTIiLz48cmVjdCB4PSIwIiB5PSIwIiB3aWR0aD0iMiIgaGVpZ2h0PSI0MCIgZmlsbD0iIzZBNTQzRCIvPjxyZWN0IHg9IjEwIiB5PSIwIiB3aWR0aD0iMSIgaGVpZ2h0PSI0MCIgZmlsbD0iIzc1NUI0NCIvPjxyZWN0IHg9IjIwIiB5PSIwIiB3aWR0aD0iMiIgaGVpZ2h0PSI0MCIgZmlsbD0iIzZBNTQzRCIvPjxyZWN0IHg9IjMwIiB5PSIwIiB3aWR0aD0iMSIgaGVpZ2h0PSI0MCIgZmlsbD0iIzc1NUI0NCIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjUxMiIgaGVpZ2h0PSI1MTIiIGZpbGw9InVybCgjd29vZCkiLz48L3N2Zz4=',
  wood_panels: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgZmlsbD0iIzk2N0I1QSIvPjwvc3ZnPg==',
  marble_white: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0ibWFyYmxlIiB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNGNUY1RjUiLz48cGF0aCBkPSJNMCw1MCBRMjUsMzAgNTAsNTAgVDEwMCw1MCIgc3Ryb2tlPSIjREREIiBzdHJva2Utd2lkdGg9IjIiIGZpbGw9bm9uZSIvPjxwYXRoIGQ9Ik0wLDcwIEMzMCw2MCA2MCw3MCAxMDAsNzAiIHN0cm9rZT0iI0UwRTBFMCIgc3Ryb2tlLXdpZHRoPSIxIiBmaWxsPSJub25lIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgZmlsbD0idXJsKCNtYXJibGUpIi8+PC9zdmc+',
  tiles_white: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgZmlsbD0iI0ZGRkZGRiIvPjwvc3ZnPg==',
  tiles_ceramic: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgZmlsbD0iI0YwRjBGMCIvPjwvc3ZnPg==',
  stone_wall: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgZmlsbD0iI0FBQUFBQSIvPjwvc3ZnPg==',
  stone_blocks: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgZmlsbD0iIzk4OTg5OCIvPjwvc3ZnPg==',
};

const FLOOR_PREVIEWS: Record<string, string> = {
  tiles_white: 'https://cdn.pixabay.com/photo/2017/08/30/01/05/milky-way-2695569_960_720.jpg',
  tiles_grey: 'https://threejs.org/examples/textures/hardwood2_diffuse.jpg',
  tiles_black: 'https://threejs.org/examples/textures/hardwood2_roughness.jpg',
  wood_light: 'https://threejs.org/examples/textures/hardwood2_diffuse.jpg',
  wood_dark: 'https://threejs.org/examples/textures/hardwood2_roughness.jpg',
  wood_parquet: 'https://threejs.org/examples/textures/hardwood2_diffuse.jpg',
  marble_white: 'https://threejs.org/examples/textures/terrain/grasslight-big.jpg',
  marble_black: 'https://threejs.org/examples/textures/brick_diffuse.jpg',
  vinyl_grey: 'https://threejs.org/examples/textures/waterdudv.jpg',
  concrete: 'https://threejs.org/examples/textures/brick_diffuse.jpg',
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
                {Object.entries(FLOOR_TEXTURES_LABELS).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setFloorTexture(key)}
                    className={`
                      relative p-3 rounded-lg border-2 transition-all flex items-center gap-3
                      ${floorTexture === key
                        ? 'border-primary bg-primary/10 shadow-md'
                        : 'border-gray-200 hover:border-primary/50 hover:bg-gray-50'
                      }
                    `}
                  >
                    <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-300 flex-shrink-0">
                      <img src={FLOOR_PREVIEWS[key]} alt={label} className="w-full h-full object-cover" />
                    </div>
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
                  </button>
                ))}
              </div>
            </div>

            {/* Wall Texture */}
            <div className="space-y-3">
              <Label className="text-lg font-semibold">نسيج الجدران</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.entries(WALL_TEXTURES_LABELS).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setWallTexture(key)}
                    className={`
                      relative p-3 rounded-lg border-2 transition-all flex items-center gap-3
                      ${wallTexture === key
                        ? 'border-primary bg-primary/10 shadow-md'
                        : 'border-gray-200 hover:border-primary/50 hover:bg-gray-50'
                      }
                    `}
                  >
                    <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-300 flex-shrink-0">
                      <img src={WALL_PREVIEWS[key]} alt={label} className="w-full h-full object-cover" />
                    </div>
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
