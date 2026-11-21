import { Archive, CircleCheck, Hourglass, LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { EditionStatus } from "@/generated/prisma/enums";
import { EDITION_STATUS_LABELS } from "@/lib/utils";

const STATUS_BADGES: Record<EditionStatus, { icon: LucideIcon; variant: "default" | "outline" | "secondary" }> = {
  [EditionStatus.ACTIVE]: { icon: CircleCheck, variant: "default" },
  [EditionStatus.ARCHIVED]: { icon: Archive, variant: "secondary" },
  [EditionStatus.PREPARING]: { icon: Hourglass, variant: "outline" },
};

export default function EditionStatusBadge({ status }: { status: EditionStatus }) {
  const { icon: Icon, variant } = STATUS_BADGES[status];
  return (
    <Badge variant={variant}>
      <Icon aria-hidden="true" />
      {EDITION_STATUS_LABELS[status]}
    </Badge>
  );
}
