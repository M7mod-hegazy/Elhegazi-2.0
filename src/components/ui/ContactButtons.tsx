import { Phone, MessageCircle, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSettings } from '@/hooks/useSettings';

interface ContactButtonsProps {
  title?: string;
  description?: string;
  variant?: 'card' | 'buttons-only';
  className?: string;
}

export const ContactButtons = ({ 
  title = 'لمعرفة السعر', 
  description = 'نحن هنا لمساعدتك',
  variant = 'card',
  className = ''
}: ContactButtonsProps) => {
  const { social, storeInfo } = useSettings();

  // Don't render if no contact methods are configured
  if (!social.phoneCallLink && !storeInfo.phone && !social.whatsappUrl && !social.messengerUrl) {
    return null;
  }

  const buttons = (
    <div className="grid grid-cols-1 gap-3">
      {/* Phone Call */}
      {(social.phoneCallLink || storeInfo.phone) && (
        <Button
          asChild
          variant="outline"
          className="w-full justify-start gap-3 h-auto py-3"
        >
          <a href={social.phoneCallLink || `tel:${storeInfo.phone}`} target="_blank" rel="noopener noreferrer">
            <Phone className="w-5 h-5 text-primary" />
            <div className="text-right flex-1">
              <p className="font-semibold">اتصل بنا</p>
              <p className="text-sm text-gray-600">{storeInfo.phone}</p>
            </div>
          </a>
        </Button>
      )}

      {/* WhatsApp */}
      {social.whatsappUrl && (
        <Button
          asChild
          variant="outline"
          className="w-full justify-start gap-3 h-auto py-3"
        >
          <a href={social.whatsappUrl} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="w-5 h-5 text-green-600" />
            <div className="text-right flex-1">
              <p className="font-semibold">واتساب</p>
              <p className="text-sm text-gray-600">تواصل عبر واتساب</p>
            </div>
          </a>
        </Button>
      )}

      {/* Messenger */}
      {social.messengerUrl && (
        <Button
          asChild
          variant="outline"
          className="w-full justify-start gap-3 h-auto py-3"
        >
          <a href={social.messengerUrl} target="_blank" rel="noopener noreferrer">
            <Send className="w-5 h-5 text-primary" />
            <div className="text-right flex-1">
              <p className="font-semibold">ماسنجر</p>
              <p className="text-sm text-gray-600">تواصل عبر ماسنجر</p>
            </div>
          </a>
        </Button>
      )}
    </div>
  );

  if (variant === 'buttons-only') {
    return <div className={className}>{buttons}</div>;
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="w-5 h-5" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {buttons}
      </CardContent>
    </Card>
  );
};
