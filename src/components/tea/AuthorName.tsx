import { User } from "lucide-react";

interface AuthorNameProps {
  name: null | string | undefined;
}

export default function AuthorName({ name }: AuthorNameProps) {
  if (!name) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <User aria-hidden="true" className="size-4" />
      {name}
    </div>
  );
}
