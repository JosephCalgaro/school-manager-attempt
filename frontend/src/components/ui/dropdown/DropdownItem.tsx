import { Link } from "react-router";

type Props = {
  children: React.ReactNode;
  onItemClick?: () => void;
  className?: string;
  tag?: string;
  to?: string;
};

export function DropdownItem({ children, onItemClick, className, to }: Props) {
  if (to) {
    return (
      <Link to={to} onClick={onItemClick} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onItemClick} className={`w-full text-left ${className ?? ""}`}>
      {children}
    </button>
  );
}
