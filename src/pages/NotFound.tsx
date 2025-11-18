import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Home, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContactButtons } from "@/components/ui/ContactButtons";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="text-center max-w-md px-4">
        <div className="mb-8">
          <Search className="w-24 h-24 mx-auto text-slate-300 mb-4" />
          <h1 className="text-6xl font-bold mb-4 text-slate-900">404</h1>
          <p className="text-2xl text-gray-600 mb-2">عذراً! الصفحة غير موجودة</p>
          <p className="text-gray-500 mb-8">الصفحة التي تبحث عنها غير متوفرة أو تم نقلها</p>
        </div>

        <Button asChild size="lg" className="mb-6">
          <Link to="/">
            <Home className="w-5 h-5 ml-2" />
            العودة للرئيسية
          </Link>
        </Button>

        {/* Contact Help */}
        <ContactButtons 
          title="هل تحتاج مساعدة؟"
          description="لمعرفة السعر للمساعدة في العثور على ما تبحث عنه"
          className="mt-8"
        />
      </div>
    </div>
  );
};

export default NotFound;
