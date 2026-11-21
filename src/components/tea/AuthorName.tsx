import { FaUser } from "react-icons/fa";

interface AuthorNameProps {
  name: null | string | undefined;
}

export default function AuthorName({ name }: AuthorNameProps) {
  if (!name) {
    return null;
  }

  return (
    <div className="flex gap-2 items-center">
      <FaUser />
      {name}
    </div>
  );
}
