import Image from "next/image"

function notFound() {
  return (
    <div className="flex flex-col items-center justify-center p-6 gap-6 mt-16 bg-accent mx-10 rounded-2xl">
      <Image src="/notFound.gif" alt="Not found image" width={300} height={80} />
      <div className="text-base-100 font-bold text-center">Error 404</div>
      <div className="text-base-100 font-bold text-center">Parece que no  <span className="italic">Té</span> encuentras</div>
    </div>
  )
}
export default notFound