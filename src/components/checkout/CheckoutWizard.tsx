import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle, 
  Circle, 
  ArrowRight, 
  ArrowLeft,
  ShoppingCart,
  User,
  MapPin,
  CreditCard,
  Package
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface CheckoutStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  component: React.ReactNode;
}

interface CheckoutWizardProps {
  steps: CheckoutStep[];
  currentStep: number;
  onStepChange: (step: number) => void;
  onNext: () => void;
  onPrevious: () => void;
  canProceed: boolean;
  isLoading?: boolean;
}

const CheckoutWizard: React.FC<CheckoutWizardProps> = ({
  steps,
  currentStep,
  onStepChange,
  onNext,
  onPrevious,
  canProceed,
  isLoading = false
}) => {
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const handleStepClick = (stepIndex: number) => {
    if (stepIndex < currentStep || completedSteps.includes(stepIndex)) {
      onStepChange(stepIndex);
    }
  };

  const handleNext = () => {
    if (canProceed) {
      setCompletedSteps(prev => [...prev, currentStep]);
      onNext();
    }
  };

  const getStepStatus = (stepIndex: number) => {
    if (completedSteps.includes(stepIndex)) return 'completed';
    if (stepIndex === currentStep) return 'current';
    if (stepIndex < currentStep) return 'completed';
    return 'upcoming';
  };

  const getStepColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500 text-white border-green-500';
      case 'current':
        return 'bg-blue-500 text-white border-blue-500';
      default:
        return 'bg-gray-200 text-gray-500 border-gray-300';
    }
  };

  return (
    <div className="w-full">
      {/* Progress Steps */}
      <Card className="mb-8 border-0 shadow-lg bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between relative">
            {/* Progress Line */}
            <div className="absolute top-6 left-0 right-0 h-0.5 bg-gray-200 z-0">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500"
                initial={{ width: '0%' }}
                animate={{ 
                  width: `${(currentStep / (steps.length - 1)) * 100}%` 
                }}
                transition={{ duration: 0.5, ease: 'easeInOut' }}
              />
            </div>

            {steps.map((step, index) => {
              const status = getStepStatus(index);
              const isClickable = index < currentStep || completedSteps.includes(index);

              return (
                <motion.div
                  key={step.id}
                  className="flex flex-col items-center relative z-10"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <motion.button
                    className={`
                      w-12 h-12 rounded-full border-2 flex items-center justify-center
                      transition-all duration-300 mb-3 relative
                      ${getStepColor(status)}
                      ${isClickable ? 'cursor-pointer hover:scale-110' : 'cursor-default'}
                    `}
                    onClick={() => handleStepClick(index)}
                    whileHover={isClickable ? { scale: 1.1 } : {}}
                    whileTap={isClickable ? { scale: 0.95 } : {}}
                    disabled={!isClickable}
                  >
                    {status === 'completed' ? (
                      <CheckCircle className="w-6 h-6" />
                    ) : (
                      <span className="text-sm font-bold">{index + 1}</span>
                    )}
                  </motion.button>

                  <div className="text-center">
                    <h3 className={`
                      text-sm font-semibold mb-1 transition-colors duration-300
                      ${status === 'current' ? 'text-blue-600' : 
                        status === 'completed' ? 'text-green-600' : 'text-gray-500'}
                    `}>
                      {step.title}
                    </h3>
                    <p className="text-xs text-gray-500 max-w-20 leading-tight">
                      {step.description}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="min-h-[400px]"
        >
          {steps[currentStep]?.component}
        </motion.div>
      </AnimatePresence>

      {/* Navigation Buttons */}
      <Card className="mt-8 border-0 shadow-lg">
        <CardContent className="p-6">
          <div className="flex justify-between items-center">
            <Button
              variant="outline"
              onClick={onPrevious}
              disabled={currentStep === 0}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              السابق
            </Button>
            
            <div className="text-sm text-slate-600">
              خطوة {currentStep + 1} من {steps.length}
            </div>
            
            <Button
              onClick={handleNext}
              disabled={!canProceed || isLoading}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  جاري المعالجة...
                </>
              ) : (
                <>
                  التالي
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CheckoutWizard;
