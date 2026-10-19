interface YoutubeComponentProps {
  youtubeURL: string;
}

export default function YoutubeComponent({ youtubeURL }: YoutubeComponentProps) {
  return (
    <iframe
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
      className="w-full aspect-video"
      referrerPolicy="strict-origin-when-cross-origin"
      src={youtubeURL}
      title="YouTube video player"
    />
  );
}
