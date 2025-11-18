import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, Search } from 'lucide-react';

interface AddressSuggestion {
  id: string;
  description: string;
  placeId?: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (suggestion: AddressSuggestion) => void;
  placeholder?: string;
  className?: string;
}

const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  value,
  onChange,
  onSelect,
  placeholder = "ابحث عن العنوان...",
  className = ""
}) => {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Mock address suggestions for demonstration
  // In a real implementation, this would connect to a geocoding API
  const mockSuggestions = [
    "الرياض، المملكة العربية السعودية",
    "جدة، المملكة العربية السعودية",
    "مكة المكرمة، المملكة العربية السعودية",
    "الدمام، المملكة العربية السعودية",
    "المدينة المنورة، المملكة العربية السعودية",
    "الخبر، المملكة العربية السعودية",
    "أبها، المملكة العربية السعودية",
    "تبوك، المملكة العربية السعودية",
    "حائل، المملكة العربية السعودية",
    "نجران، المملكة العربية السعودية"
  ];

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Simulate fetching address suggestions
  useEffect(() => {
    if (value.trim() && showSuggestions) {
      setIsLoading(true);
      
      // Simulate API delay
      const timer = setTimeout(() => {
        const filtered = mockSuggestions
          .filter(suggestion => 
            suggestion.toLowerCase().includes(value.toLowerCase())
          )
          .map((description, index) => ({
            id: `suggestion-${index}`,
            description
          }));
        
        setSuggestions(filtered);
        setIsLoading(false);
      }, 300);

      return () => clearTimeout(timer);
    } else {
      setSuggestions([]);
    }
  }, [value, showSuggestions]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setShowSuggestions(true);
  };

  const handleSuggestionClick = (suggestion: AddressSuggestion) => {
    onChange(suggestion.description);
    setShowSuggestions(false);
    onSelect?.(suggestion);
  };

  const handleFocus = () => {
    setShowSuggestions(true);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder={placeholder}
          className={`pl-10 ${className}`}
        />
      </div>
      
      {showSuggestions && (value.trim() || suggestions.length > 0) && (
        <Card className="absolute top-full left-0 right-0 mt-1 z-50 shadow-lg max-h-60 overflow-y-auto">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 text-center text-gray-500">
                جاري البحث...
              </div>
            ) : suggestions.length > 0 ? (
              <ul>
                {suggestions.map((suggestion) => (
                  <li
                    key={suggestion.id}
                    className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 flex items-center gap-2"
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">{suggestion.description}</span>
                  </li>
                ))}
              </ul>
            ) : value.trim() ? (
              <div className="p-4 text-center text-gray-500">
                لم يتم العثور على نتائج
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AddressAutocomplete;