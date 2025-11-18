export interface SampleModel {
  id: string;
  name: string;
  description: string;
  url: string;
  scale?: number;
}

export const SAMPLE_MODELS: SampleModel[] = [
  {
    id: 'shelf-modern',
    name: 'رف حديث',
    description: 'رف عرض بارتفاع متوسط مناسب للمنتجات الخفيفة.',
    url: 'https://models.readyplayer.me/64f37c1970d2f7f9da1b7a6e.glb',
    scale: 1,
  },
  {
    id: 'fridge-vertical',
    name: 'ثلاجة رأسية',
    description: 'ثلاجة عرض للمشروبات والألبان.',
    url: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/WaterBottle/glTF-Binary/WaterBottle.glb',
    scale: 4,
  },
  {
    id: 'counter-modern',
    name: 'كاونتر حديث',
    description: 'كاونتر استقبال أو دفع أنيق.',
    url: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/Cube/glTF-Binary/Cube.glb',
    scale: 2,
  },
];
