interface YoutubeComponentProps {
  youtubeURL: string
}

export default function YoutubeComponent({ youtubeURL }: YoutubeComponentProps) {
  return (
    <iframe
      className="w-full aspect-video"
      src={youtubeURL}
      title="YouTube video player"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      referrerPolicy="strict-origin-when-cross-origin"
      allowFullScreen
    />
  );
}
