import { Zap, Megaphone, Gift, Info, Star } from 'lucide-react';

interface PromoStripProps {
  text: string;
  icon?: string; // e.g. 'zap' | 'megaphone' | 'gift' | 'info' | 'star'
}

const iconMap: Record<string, JSX.Element> = {
  zap: <Zap className="w-5 h-5" />,
  megaphone: <Megaphone className="w-5 h-5" />,
  gift: <Gift className="w-5 h-5" />,
  info: <Info className="w-5 h-5" />,
  star: <Star className="w-5 h-5" />,
};

export default function PromoStrip({ text, icon = 'zap' }: PromoStripProps) {
  const Icon = iconMap[icon?.toLowerCase?.()] || iconMap['zap'];
  return (
    <div className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-black py-2">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-center gap-2 font-semibold">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-black/10 text-black">
            {Icon}
          </span>
          <span className="text-sm sm:text-base">{text}</span>
        </div>
      </div>
    </div>
  );
}
