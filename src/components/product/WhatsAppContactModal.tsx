import React, { useState, useEffect } from 'react';
import { MessageCircle, Send, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useDualAuth } from '@/hooks/useDualAuth';
import { apiGet } from '@/lib/api';
import { buildProductPath } from '@/lib/product-link';
import whatsappIcon from '@/assets/whatsapp.png';
import messengerIcon from '@/assets/messenger.png';

// WhatsApp Icon
const WhatsAppIcon = () => (
  <img src={whatsappIcon} alt="WhatsApp" className="w-4 h-4" />
);

// Messenger Icon
const MessengerIcon = () => (
  <img src={messengerIcon} alt="Messenger" className="w-4 h-4" />
);


interface WhatsAppContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  productId: string;
  productCode?: string;
  productImage?: string;
  defaultMessage?: string;
}

export const WhatsAppContactModal: React.FC<WhatsAppContactModalProps> = ({
  isOpen,
  onClose,
  productName,
  productId,
  productCode,
  productImage,
  defaultMessage = 'السلام عليكم، أود معرفة سعر المنتج',
}) => {
  const { user, isAuthenticated } = useDualAuth();
  const [message, setMessage] = useState(defaultMessage);
  const [userName, setUserName] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [userAddress, setUserAddress] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-fill user info if authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      setUserName(user.email?.split('@')[0] || '');
      setUserPhone(user.phone || '');
      setUserAddress(typeof user.address === 'string' ? user.address : '');
    } else {
      setUserName('');
      setUserPhone('');
      setUserAddress('');
    }
  }, [isAuthenticated, user, isOpen]);

  // Build product details link
  const productDetailsLink = `${window.location.origin}${buildProductPath(productId)}`;
  
  // Build full message with product code if available
  const fullMessage = `${message}\n\n👤 الاسم: ${userName}\n📱 الهاتف: ${userPhone}\n📍 العنوان: ${userAddress}\n\n📦 المنتج: ${productName}${productCode ? `\nالكود: ${productCode}` : ''}\n🔗 الرابط: ${productDetailsLink}`;
  
  // Debug logging
  useEffect(() => {


  }, [productCode, fullMessage]);

  const handleSend = async () => {
    try {
      setError(null);

      // Validate required fields
      if (!userName.trim()) {
        setError('يرجى إدخال اسمك');
        return;
      }
      if (!userPhone.trim()) {
        setError('يرجى إدخال رقم هاتفك');
        return;
      }
      if (!userAddress.trim()) {
        setError('يرجى إدخال عنوانك');
        return;
      }

      setIsSending(true);

      try {
        // Fetch WhatsApp URL from settings API
        const settingsRes = await apiGet('/api/settings') as any;
        const whatsappUrl = settingsRes?.item?.social?.whatsappUrl;
        
        if (!whatsappUrl) {
          setError('رقم الواتس غير متوفر. يرجى التواصل مع الدعم الفني.');
          setIsSending(false);
          return;
        }

        // Build message with image URL
        const messageWithImage = productImage 
          ? `${fullMessage}\n\n🔗 رابط الصورة: ${productImage}`
          : fullMessage;

        const encodedMessage = encodeURIComponent(messageWithImage);
        
        // Extract phone number from WhatsApp URL
        // Handle both formats: "https://wa.me/201001234567" or just phone number
        let phoneNumber = '';
        
        if (whatsappUrl) {
          if (whatsappUrl.includes('wa.me/')) {
            // Extract from full URL
            const phoneMatch = whatsappUrl.match(/wa\.me\/(\d+)/);
            phoneNumber = phoneMatch ? phoneMatch[1] : '';
          } else if (/^\d+$/.test(whatsappUrl)) {
            // It's just a phone number
            let phone = whatsappUrl.trim();
            // If it starts with 0, replace with 20 (Egypt country code)
            if (phone.startsWith('0')) {
              phone = '20' + phone.substring(1);
            }
            // If it doesn't start with country code, add 20
            if (!phone.startsWith('20') && phone.length === 10) {
              phone = '20' + phone;
            }
            phoneNumber = phone;
          }
        }
        
        // Close modal first
        onClose();
        setMessage(defaultMessage);
        setIsSending(false);
        
        // Open WhatsApp app first with pre-filled message, then fallback.
        setTimeout(() => {
          if (phoneNumber) {
            const appLink = `whatsapp://send?phone=${phoneNumber}&text=${encodedMessage}`;
            const fallbackLink = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;

            // Try native app deeplink first.
            window.location.href = appLink;

            // Fallback when app protocol isn't available.
            window.setTimeout(() => {
              try {
                const fallbackWindow = window.open(fallbackLink, '_blank', 'noopener,noreferrer');
                if (!fallbackWindow) {
                  window.location.href = fallbackLink;
                }
              } catch {
                window.location.href = fallbackLink;
              }
            }, 900);
          } else {
            console.error('Could not extract phone number from:', whatsappUrl);
          }
        }, 50);
      } catch (err) {
        setError('خطأ في جلب بيانات الواتس. يرجى المحاولة مرة أخرى.');
        console.error('Error fetching WhatsApp settings:', err);
        setIsSending(false);
        return;
      }
    } catch (err) {
      setError('حدث خطأ أثناء الإرسال. يرجى المحاولة مرة أخرى.');
      console.error('WhatsApp send error:', err);
      setIsSending(false);
    }
  };

  const handleSendMessenger = async () => {
    try {
      setError(null);

      // Validate required fields
      if (!userName.trim()) {
        setError('يرجى إدخال اسمك');
        return;
      }
      if (!userPhone.trim()) {
        setError('يرجى إدخال رقم هاتفك');
        return;
      }
      if (!userAddress.trim()) {
        setError('يرجى إدخال عنوانك');
        return;
      }

      setIsSending(true);

      try {
        // Fetch Messenger URL from settings API
        const settingsRes = await apiGet('/api/settings') as any;
        const messengerUrl = settingsRes?.item?.social?.messengerUrl;
        
        if (!messengerUrl) {
          setError('رابط الماسنجر غير متوفر. يرجى التواصل مع الدعم الفني.');
          setIsSending(false);
          return;
        }

        // Build message with image URL
        const messageWithImage = productImage 
          ? `${fullMessage}\n\n🔗 رابط الصورة: ${productImage}`
          : fullMessage;

        const encodedMessage = encodeURIComponent(messageWithImage);
        
        // Close modal first
        onClose();
        setMessage(defaultMessage);
        setIsSending(false);
        
        // Open Messenger with pre-filled message
        setTimeout(() => {
          let finalLink = '';
          
          // If it's already a Messenger link (https://m.me/...)
          if (messengerUrl.includes('m.me/')) {
            finalLink = `${messengerUrl}?text=${encodedMessage}`;
          }
          // If it's a Facebook page URL
          else if (messengerUrl.includes('facebook.com')) {
            const match = messengerUrl.match(/facebook\.com\/([^/?]+)/);
            if (match && match[1]) {
              const pageId = match[1];
              finalLink = `https://m.me/${pageId}?text=${encodedMessage}`;
            }
          }
          // If it's just a page ID or name
          else if (messengerUrl.trim()) {
            finalLink = `https://m.me/${messengerUrl}?text=${encodedMessage}`;
          }
          // Fallback
          else {
            finalLink = `https://m.me/?text=${encodedMessage}`;
          }
          
          window.open(finalLink, '_blank', 'noopener,noreferrer');
        }, 50);
      } catch (err) {
        setError('خطأ في جلب بيانات الماسنجر. يرجى المحاولة مرة أخرى.');
        console.error('Error fetching Messenger settings:', err);
        setIsSending(false);
        return;
      }
    } catch (err) {
      setError('حدث خطأ أثناء الإرسال. يرجى المحاولة مرة أخرى.');
      console.error('Messenger send error:', err);
      setIsSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-green-500" />
            لمعرفة السعر عبر الواتس
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Product Image and Info */}
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <div className="flex gap-3">
              {productImage && (
                <img
                  src={productImage}
                  alt={productName}
                  className="w-20 h-20 object-cover rounded-lg"
                />
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-sm text-slate-900 mb-1">{productName}</h3>
                <p className="text-xs text-slate-500">المعرف: {productId}</p>
              </div>
            </div>
          </div>

          {/* User Information */}
          <div className="space-y-3 bg-blue-50 rounded-lg p-4 border border-blue-200">
            <h3 className="font-semibold text-sm text-slate-900">معلوماتك</h3>
            
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">
                الاسم *
              </label>
              <Input
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="أدخل اسمك"
                disabled={isSending || isAuthenticated}
                className="text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">
                رقم الهاتف *
              </label>
              <Input
                value={userPhone}
                onChange={(e) => setUserPhone(e.target.value)}
                placeholder="أدخل رقم هاتفك"
                disabled={isSending || isAuthenticated}
                className="text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">
                العنوان *
              </label>
              <Input
                value={userAddress}
                onChange={(e) => setUserAddress(e.target.value)}
                placeholder="أدخل عنوانك"
                disabled={isSending || isAuthenticated}
                className="text-sm"
              />
            </div>

            {isAuthenticated && (
              <p className="text-xs text-blue-600 flex items-center gap-1">
                ✓ تم ملء البيانات من حسابك
              </p>
            )}
          </div>

          {/* Message Editor */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-900">
              رسالتك (اختياري)
            </label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="أضف رسالة إضافية..."
              className="min-h-20 resize-none text-sm"
              disabled={isSending}
            />
          </div>

          {/* Message Preview */}
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <h3 className="font-semibold text-sm text-slate-900 mb-2 flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-green-600" />
              معاينة الرسالة
            </h3>
            <div className="bg-white rounded p-3 text-xs text-slate-700 whitespace-pre-wrap break-words max-h-40 overflow-y-auto border border-green-100 font-mono space-y-2">
              <div>{fullMessage}</div>
              <div className="border-t border-green-100 pt-2 mt-2 space-y-1">
                <div className="font-semibold">📦 {productName}</div>
                {productCode && <div className="text-blue-600">🏷️ {productCode}</div>}
              </div>
              {productImage && (
                <div className="border-t border-green-100 pt-2 mt-2">
                  <div>🔗 رابط الصورة:</div>
                  <div className="text-blue-600 break-all">{productImage}</div>
                </div>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 rounded-lg p-3 border border-red-200 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2 sticky bottom-0 bg-white flex-wrap">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1 min-w-20"
              disabled={isSending}
            >
              إلغاء
            </Button>
            <Button
              onClick={handleSendMessenger}
              className="flex-1 min-w-20 bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2"
              disabled={isSending || !userName.trim() || !userPhone.trim() || !userAddress.trim()}
            >
              {isSending ? (
                <>
                  <span className="animate-spin">⏳</span>
                  جاري...
                </>
              ) : (
                <>
                  <MessengerIcon />
                  <span className="ml-2">ماسنجر</span>
                </>
              )}
            </Button>
            <Button
              onClick={handleSend}
              className="flex-1 min-w-20 bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2"
              disabled={isSending || !userName.trim() || !userPhone.trim() || !userAddress.trim()}
            >
              {isSending ? (
                <>
                  <span className="animate-spin">⏳</span>
                  جاري...
                </>
              ) : (
                <>
                  <WhatsAppIcon />
                  <span className="ml-2">واتس</span>
                </>
              )}
            </Button>
          </div>

          {/* Info */}
          <p className="text-xs text-slate-500 text-center pb-2">
            سيتم فتح الواتس تلقائياً برسالتك الجاهزة للإرسال
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
