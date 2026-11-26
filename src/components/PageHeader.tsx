import { cn } from "cn";

interface PageHeaderProps {
  children?: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
  subtitle?: React.ReactNode;
  title: React.ReactNode;
}

/** The dark green card that opens a page: its title is the page's only `h1`. */
export default function PageHeader({ children, className, icon, subtitle, title }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex w-full max-w-xl flex-col items-center gap-2 rounded-2xl bg-brand px-5 py-6 text-center text-brand-foreground shadow-sm sm:px-8",
        className,
      )}
    >
      {icon && (
        <span aria-hidden="true" className="[&_svg]:size-7">
          {icon}
        </span>
      )}
      <h1 className="font-display text-3xl text-balance sm:text-4xl">{title}</h1>
      {subtitle && <div className="text-lg font-medium text-balance">{subtitle}</div>}
      {children}
    </header>
  );
}
