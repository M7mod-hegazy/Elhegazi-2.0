import { Facebook, MessageCircle, Phone, type LucideIcon } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';

const SocialLinks = () => {
  const { social } = useSettings();
  const links = [
    social.facebookUrl ? { icon: Facebook, href: social.facebookUrl, label: 'فيسبوك' } : null,
    social.messengerUrl ? { icon: MessageCircle, href: social.messengerUrl, label: 'ماسنجر' } : null,
    social.whatsappUrl ? { icon: MessageCircle, href: social.whatsappUrl, label: 'واتساب' } : null,
    social.phoneCallLink ? { icon: Phone, href: social.phoneCallLink, label: 'اتصال' } : null,
  ].filter(Boolean) as { icon: LucideIcon; href: string; label: string }[];

  return (
    <div className="flex space-x-3 space-x-reverse">
      {links.map((social) => (
        <a
          key={social.label}
          href={social.href}
          className="w-8 h-8 bg-primary-foreground/10 rounded-lg flex items-center justify-center hover:bg-primary-foreground/20 transition-all duration-200 group"
          aria-label={social.label}
          target={social.href.startsWith('http') ? '_blank' : undefined}
          rel={social.href.startsWith('http') ? 'noopener noreferrer' : undefined}
        >
          <social.icon className="w-4 h-4 text-primary-foreground/70 group-hover:text-primary-foreground transition-colors duration-200" />
        </a>
      ))}
    </div>
  );
};

export default SocialLinks;
