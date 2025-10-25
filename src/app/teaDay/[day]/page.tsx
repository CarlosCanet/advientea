async function Page({ params }: { params: Promise<{ day: string }> }) {
  const { day } = await params;
  const dayNumber = parseInt(day);
  if (!dayNumber || dayNumber <= 0 || dayNumber >= 30) {
    return <div>NOPE</div>;
  }
  const releaseDay = new Date(`2025-10-${dayNumber}`);
  const isReleased = new Date() > releaseDay;
  const isReleasedPart1 = new Date().getUTCHours() > 8;
  const isReleasedPart2 = new Date().getUTCHours() > 13;
  const isReleasedPart3 = new Date().getUTCHours() > 18;
  const isReleasedName = new Date().getUTCHours() > 21;

  const teaName = "Mi té";
  const story1 = "Este es el comienzo de la historia";
  const story2 = "La historia sigue";
  const story3 = "FIN de la historia";
  // const videoId = "jfKfPfyJRdk";
  const videoId = "GFfn8L2saYI";

  if (!isReleased) {
    return <div>Vuelve pronto</div>;
  }

  return (
    <>
      <div>ONE DAY {day}</div>
      {isReleasedName && <div>{teaName}</div>}
      <div>
        <iframe
          width="560"
          height="315"
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&loop=1&playlist=${videoId}&iv_load_policy=3`}
          title="YouTube video player"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
      {isReleasedPart1 && <div>{story1}</div>}
      {isReleasedPart2 && <div>{story2}</div>}
      {isReleasedPart3 && <div>{story3}</div>}
    </>
  );
}
export default Page;
