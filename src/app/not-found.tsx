import Image from "next/image";

function notFound() {
  return (
    <div className="w-auto max-w-xl place-self-center flex flex-col items-center justify-center p-6 gap-6 mt-16 bg-accent rounded-2xl">
      <Image alt="Not found image" height={80} src="/notFound.gif" width={300} />
      <div className="text-base-100 font-bold text-center">Error 404</div>
      <div className="text-base-100 font-bold text-center">
        Parece que no <span className="italic">Té</span> encuentras
      </div>
    </div>
  );
}
export default notFound;
