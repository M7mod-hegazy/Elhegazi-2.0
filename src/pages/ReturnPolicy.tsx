import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/hooks/useSettings';
import { 
  FileText, 
  Clock, 
  CreditCard, 
  Truck,
  Shield,
  ArrowLeft
} from 'lucide-react';

const ReturnPolicy = () => {
  const { storeInfo } = useSettings();
  const storeName = (storeInfo?.name || '').trim() || 'المتجر';
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-primary/5 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Ø³ÙŠØ§Ø³Ø© Ø§Ù„Ø¥Ø±Ø¬Ø§Ø¹</h1>
            <p className="text-slate-600">ØªØ¹Ø±Ù Ø¹Ù„Ù‰ Ø³ÙŠØ§Ø³Ø© Ø§Ù„Ø¥Ø±Ø¬Ø§Ø¹ ÙˆØ§Ù„Ø§Ø³ØªØ¨Ø¯Ø§Ù„ Ù„Ø¯ÙŠÙ†Ø§</p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/support">
              <ArrowLeft className="w-4 h-4 ml-2" />
              Ø§Ù„Ø¹ÙˆØ¯Ø© Ø¥Ù„Ù‰ Ø§Ù„Ø¯Ø¹Ù…
            </Link>
          </Button>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Ø³ÙŠØ§Ø³Ø© Ø§Ù„Ø¥Ø±Ø¬Ø§Ø¹ ÙˆØ§Ù„Ø§Ø³ØªØ¨Ø¯Ø§Ù„
            </CardTitle>
            <CardDescription>
              ØªØ¹Ø±Ù Ø¹Ù„Ù‰ Ø§Ù„Ø´Ø±ÙˆØ· ÙˆØ§Ù„Ø£Ø­ÙƒØ§Ù… Ø§Ù„Ø®Ø§ØµØ© Ø¨Ø¥Ø±Ø¬Ø§Ø¹ Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="prose max-w-none">
              <h2 className="text-xl font-bold text-slate-900 mb-4">Ø§Ù„Ø´Ø±ÙˆØ· Ø§Ù„Ø¹Ø§Ù…Ø© Ù„Ù„Ø¥Ø±Ø¬Ø§Ø¹</h2>
              <ul className="space-y-2 mb-6">
                <li className="flex items-start">
                  <span className="text-primary ml-2">â€¢</span>
                  <span>ÙŠÙ…ÙƒÙ† Ø¥Ø±Ø¬Ø§Ø¹ Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª Ø®Ù„Ø§Ù„ 14 ÙŠÙˆÙ…Ø§Ù‹ Ù…Ù† ØªØ§Ø±ÙŠØ® Ø§Ù„Ø§Ø³ØªÙ„Ø§Ù…</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary ml-2">â€¢</span>
                  <span>ÙŠØ¬Ø¨ Ø£Ù† ÙŠÙƒÙˆÙ† Ø§Ù„Ù…Ù†ØªØ¬ ÙÙŠ Ø­Ø§Ù„ØªÙ‡ Ø§Ù„Ø£ØµÙ„ÙŠØ© Ù…Ø¹ Ø¬Ù…ÙŠØ¹ Ø§Ù„Ù…Ù„Ø­Ù‚Ø§Øª</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary ml-2">â€¢</span>
                  <span>Ù„Ø§ ÙŠÙ…ÙƒÙ† Ø¥Ø±Ø¬Ø§Ø¹ Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª Ø§Ù„Ù…Ø®ØµØµØ© Ø£Ùˆ Ø§Ù„Ù…ØµÙ†ÙˆØ¹Ø© Ø­Ø³Ø¨ Ø§Ù„Ø·Ù„Ø¨</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary ml-2">â€¢</span>
                  <span>ÙŠØ¬Ø¨ Ø¥Ø±ÙØ§Ù‚ Ø§Ù„ÙØ§ØªÙˆØ±Ø© Ø§Ù„Ø£ØµÙ„ÙŠØ© Ù…Ø¹ Ø§Ù„Ù…Ù†ØªØ¬ Ø§Ù„Ù…Ø±ØªØ¬Ø¹</span>
                </li>
              </ul>

              <h2 className="text-xl font-bold text-slate-900 mb-4">Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª ØºÙŠØ± Ø§Ù„Ù‚Ø§Ø¨Ù„Ø© Ù„Ù„Ø¥Ø±Ø¬Ø§Ø¹</h2>
              <ul className="space-y-2 mb-6">
                <li className="flex items-start">
                  <span className="text-primary ml-2">â€¢</span>
                  <span>Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª Ø§Ù„Ù…ÙØªÙˆØ­Ø© Ø£Ùˆ Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…Ø©</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary ml-2">â€¢</span>
                  <span>Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª Ø°Ø§Øª Ø·Ø¨ÙŠØ¹Ø© Ø®Ø§ØµØ© (Ù…Ù†ØªØ¬Ø§Øª Ø§Ù„Ø¹Ù†Ø§ÙŠØ© Ø§Ù„Ø´Ø®ØµÙŠØ©ØŒ Ø§Ù„Ø·Ø¹Ø§Ù…ØŒ Ø¥Ù„Ø®)</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary ml-2">â€¢</span>
                  <span>Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª Ø§Ù„Ù…Ø®ØµØµØ© Ø£Ùˆ Ø§Ù„Ù…Ø·Ø¨ÙˆØ¹Ø© Ø­Ø³Ø¨ Ø§Ù„Ø·Ù„Ø¨</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary ml-2">â€¢</span>
                  <span>Ø§Ù„Ø¨Ø·Ø§Ù‚Ø§Øª Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠØ© ÙˆØ§Ù„Ø±Ù…ÙˆØ² Ø§Ù„Ø±Ù‚Ù…ÙŠØ©</span>
                </li>
              </ul>

              <h2 className="text-xl font-bold text-slate-900 mb-4">Ø¥Ø¬Ø±Ø§Ø¡Ø§Øª Ø§Ù„Ø¥Ø±Ø¬Ø§Ø¹</h2>
              <ol className="space-y-2 mb-6">
                <li className="flex items-start">
                  <span className="text-primary ml-2">1.</span>
                  <span>Ù‚Ù… Ø¨ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„ Ø¥Ù„Ù‰ Ø­Ø³Ø§Ø¨Ùƒ ÙˆØ§Ù†ØªÙ‚Ù„ Ø¥Ù„Ù‰ ØµÙØ­Ø© "Ø·Ù„Ø¨Ø§ØªÙŠ"</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary ml-2">2.</span>
                  <span>Ø§Ø®ØªØ± Ø§Ù„Ø·Ù„Ø¨ Ø§Ù„Ø°ÙŠ ØªØ±ØºØ¨ ÙÙŠ Ø¥Ø±Ø¬Ø§Ø¹Ù‡ ÙˆØ§Ø¶ØºØ· Ø¹Ù„Ù‰ "Ø·Ù„Ø¨ Ø¥Ø±Ø¬Ø§Ø¹"</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary ml-2">3.</span>
                  <span>Ø­Ø¯Ø¯ Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª Ø§Ù„Ù…Ø±Ø§Ø¯ Ø¥Ø±Ø¬Ø§Ø¹Ù‡Ø§ ÙˆØ³Ø¨Ø¨ Ø§Ù„Ø¥Ø±Ø¬Ø§Ø¹</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary ml-2">4.</span>
                  <span>Ø§Ø®ØªØ± Ø·Ø±ÙŠÙ‚Ø© Ø§Ù„Ø§Ø³ØªØ±Ø¯Ø§Ø¯ (Ø§Ø³ØªØ±Ø¯Ø§Ø¯ Ù†Ù‚Ø¯ÙŠ Ø£Ùˆ Ø±ØµÙŠØ¯ ÙÙŠ Ø§Ù„Ù…ØªØ¬Ø±)</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary ml-2">5.</span>
                  <span>Ù‚Ù… Ø¨ØªØ¹Ø¨Ø¦Ø© Ù†Ù…ÙˆØ°Ø¬ Ø§Ù„Ø¥Ø±Ø¬Ø§Ø¹ ÙˆØ·Ø¨Ø§Ø¹ØªÙ‡</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary ml-2">6.</span>
                  <span>Ù‚Ù… Ø¨Ø¥Ø¹Ø§Ø¯Ø© Ø§Ù„Ù…Ù†ØªØ¬ Ù…Ø¹ Ø§Ù„Ù†Ù…ÙˆØ°Ø¬ Ø¥Ù„Ù‰ Ø§Ù„Ø¹Ù†ÙˆØ§Ù† Ø§Ù„Ù…Ø­Ø¯Ø¯</span>
                </li>
              </ol>

              <h2 className="text-xl font-bold text-slate-900 mb-4">Ø£ÙˆÙ‚Ø§Øª Ø§Ù„Ø§Ø³ØªØ±Ø¯Ø§Ø¯</h2>
              <ul className="space-y-2 mb-6">
                <li className="flex items-start">
                  <span className="text-primary ml-2">â€¢</span>
                  <span>Ø§Ù„Ø§Ø³ØªØ±Ø¯Ø§Ø¯ Ø§Ù„Ù†Ù‚Ø¯ÙŠ: 5-7 Ø£ÙŠØ§Ù… Ø¹Ù…Ù„ Ø¨Ø¹Ø¯ Ø§Ø³ØªÙ„Ø§Ù… Ø§Ù„Ù…Ù†ØªØ¬</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary ml-2">â€¢</span>
                  <span>Ø§Ù„Ø±ØµÙŠØ¯ ÙÙŠ Ø§Ù„Ù…ØªØ¬Ø±: ÙÙˆØ±ÙŠ Ø¨Ø¹Ø¯ Ø§Ù„Ù…ÙˆØ§ÙÙ‚Ø© Ø¹Ù„Ù‰ Ø§Ù„Ø¥Ø±Ø¬Ø§Ø¹</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary ml-2">â€¢</span>
                  <span>Ø§Ù„Ø¨Ø·Ø§Ù‚Ø§Øª Ø§Ù„Ø¨Ù†ÙƒÙŠØ©: Ù‚Ø¯ ØªØ³ØªØºØ±Ù‚ Ø­ØªÙ‰ 14 ÙŠÙˆÙ… Ø¹Ù…Ù„</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-bold text-lg mb-2">ÙØªØ±Ø© Ø§Ù„Ø¥Ø±Ø¬Ø§Ø¹</h3>
              <p className="text-gray-600">14 ÙŠÙˆÙ…Ø§Ù‹ Ù…Ù† ØªØ§Ø±ÙŠØ® Ø§Ù„Ø§Ø³ØªÙ„Ø§Ù…</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CreditCard className="w-6 h-6 text-green-500" />
              </div>
              <h3 className="font-bold text-lg mb-2">Ø·Ø±Ù‚ Ø§Ù„Ø§Ø³ØªØ±Ø¯Ø§Ø¯</h3>
              <p className="text-gray-600">Ù†Ù‚Ø¯ÙŠ Ø£Ùˆ Ø±ØµÙŠØ¯ ÙÙŠ Ø§Ù„Ù…ØªØ¬Ø±</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-6 h-6 text-purple-500" />
              </div>
              <h3 className="font-bold text-lg mb-2">Ø§Ù„Ø¶Ù…Ø§Ù†</h3>
              <p className="text-gray-600">Ø§Ø³ØªØ±Ø¯Ø§Ø¯ ÙƒØ§Ù…Ù„ Ø£Ùˆ Ø§Ø³ØªØ¨Ø¯Ø§Ù„</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5" />
              Ø´Ø±ÙˆØ· Ø§Ù„Ø´Ø­Ù† ÙˆØ§Ù„Ø¥Ø±Ø¬Ø§Ø¹
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose max-w-none">
              <h3 className="font-bold text-slate-900 mb-3">ØªÙƒØ§Ù„ÙŠÙ Ø§Ù„Ø´Ø­Ù†</h3>
              <ul className="space-y-2 mb-4">
                <li className="flex items-start">
                  <span className="text-primary ml-2">â€¢</span>
                  <span>Ø§Ù„Ø¹Ù…ÙŠÙ„ ÙŠØªØ­Ù…Ù„ ØªÙƒÙ„ÙØ© Ø§Ù„Ø´Ø­Ù† ÙÙŠ Ø­Ø§Ù„Ø© Ø§Ù„Ø¥Ø±Ø¬Ø§Ø¹ Ù„Ø³Ø¨Ø¨ ØºÙŠØ± Ù…ØªØ¹Ù„Ù‚ Ø¨Ø§Ù„Ù…Ù†ØªØ¬</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary ml-2">â€¢</span>
                  <span>Ø§Ù„Ø´Ø±ÙƒØ© ØªØªØ­Ù…Ù„ ØªÙƒÙ„ÙØ© Ø§Ù„Ø´Ø­Ù† ÙÙŠ Ø­Ø§Ù„Ø© Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª Ø§Ù„ØªØ§Ù„ÙØ© Ø£Ùˆ ØºÙŠØ± Ø§Ù„Ù…Ø·Ø§Ø¨Ù‚Ø©</span>
                </li>
              </ul>

              <h3 className="font-bold text-slate-900 mb-3">Ø¹Ù†Ø§ÙˆÙŠÙ† Ø§Ù„Ø¥Ø±Ø¬Ø§Ø¹</h3>
              <p className="mb-4">
                ÙŠØ¬Ø¨ Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª Ø§Ù„Ù…Ø±ØªØ¬Ø¹Ø© Ø¥Ù„Ù‰ Ø§Ù„Ø¹Ù†ÙˆØ§Ù† Ø§Ù„ØªØ§Ù„ÙŠ:
              </p>
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <p className="font-medium">{storeName}</p>
                <p>Ù‚Ø³Ù… Ø§Ù„Ø¥Ø±Ø¬Ø§Ø¹Ø§Øª</p>
                <p>Ø´Ø§Ø±Ø¹ Ø§Ù„Ù…Ù„Ùƒ ÙÙ‡Ø¯ØŒ Ø§Ù„Ø±ÙŠØ§Ø¶ØŒ Ø§Ù„Ù…Ù…Ù„ÙƒØ© Ø§Ù„Ø¹Ø±Ø¨ÙŠØ© Ø§Ù„Ø³Ø¹ÙˆØ¯ÙŠØ©</p>
                <p>Ø§Ù„Ø±Ù…Ø² Ø§Ù„Ø¨Ø±ÙŠØ¯ÙŠ: 12345</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button asChild>
                  <Link to="/contact">Ø§ØªØµÙ„ Ø¨Ù†Ø§</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/support">Ø§Ù„Ø¯Ø¹Ù… Ø§Ù„ÙÙ†ÙŠ</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReturnPolicy;


