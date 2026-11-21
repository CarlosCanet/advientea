import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Spinner } from "@/components/ui/spinner";

interface YoutubeComponentProps {
  youtubeURL: string;
}

export default function YoutubeComponent({ youtubeURL }: YoutubeComponentProps) {
  return (
    <AspectRatio className="w-full overflow-hidden rounded-xl bg-brand" ratio={16 / 9}>
      {/* Sits under the iframe, which covers it once the player has painted; hidden from screen readers, which would hear "Cargando" forever. */}
      <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-brand-foreground">
        <Spinner className="size-8" />
      </div>
      <iframe
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="absolute inset-0 size-full"
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        src={youtubeURL}
        title="Vídeo de YouTube de la historia"
      />
    </AspectRatio>
  );
}
