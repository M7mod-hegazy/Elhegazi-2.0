import { ReactNode } from 'react';

interface FooterSectionProps {
  title: string;
  children: ReactNode;
}

const FooterSection = ({ title, children }: FooterSectionProps) => {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-primary-foreground/90 uppercase tracking-wide">
        {title}
      </h3>
      <div className="space-y-2">
        {children}
      </div>
    </div>
  );
};

export default FooterSection;
