import Link from "next/link";

/** Empty state for every page that needs an active edition: says what is going on and when to come back. */
export default function NoActiveEdition() {
  return (
    <div className="flex flex-col justify-center items-center mx-5 mt-5 gap-3">
      <div className="card w-full max-w-xl bg-neutral text-neutral-content card-xl shadow-sm">
        <div className="card-body items-center text-center gap-4">
          <h2 className="card-title text-3xl">
            <span>
              Advien<span className="italic">té</span> está en preparación
            </span>
          </h2>
          <p className="font-[Griffy] text-2xl">Estamos infusionando la próxima edición.</p>
          <p className="font-[Griffy] text-xl">El calendario vuelve a abrirse el 1 de diciembre.</p>
          <Link className="btn btn-ghost text-neutral-content mt-2" href="/">
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
