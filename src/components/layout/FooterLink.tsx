import { Link } from 'react-router-dom';

interface FooterLinkProps {
  to: string;
  children: React.ReactNode;
}

const FooterLink = ({ to, children }: FooterLinkProps) => {
  return (
    <Link
      to={to}
      className="text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors duration-200 block"
    >
      {children}
    </Link>
  );
};

export default FooterLink;