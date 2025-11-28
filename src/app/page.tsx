import { GiCoffeeCup, GiNightSleep } from "react-icons/gi";
import { MdOutlineHistoryEdu } from "react-icons/md";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center p-4 gap-6 mt-16">
      <header className="card bg-neutral image-full max-w-md shadow-lg overflow-hidden before:content-[''] before:absolute before:inset-0 before:bg-[url('/BackgroundSemiCircleLeaves.svg')] before:rotate-180 before:bg-no-repeat before:opacity-25 before:pointer-events-none">
        <div className="card-body">
          <h1 className="mb-4 text-4xl font-semibold text-center font-[Griffy] text-accent">Advien<i>té</i></h1>
          <p className="mb-6 text-lg text-center font-[Griffy] text-neutral-content">
            Bienvenides, bienvenidas, bienvenidos, a este lugar de té e infusiones, con la excusa del frío, del fin del otoño y de un diciembre acelerado.
          </p>
          <p className="mb-6 text-lg text-center font-[Griffy] text-neutral-content">
            Esta web nos va a servir para compartir las temperaturas y tiempos máximos de las infusiones que hemos decidido compartir con el resto del mundo, y también para que compartamos y disfrutemos de aquellos retazos de inspiración que nos acunan mientras cogemos la taza caliente con las manos frías. 
          </p>
        </div>
      </header>

      <main className="max-w-md">
        <div className="hero bg-base-100 rounded-2xl">
          <div className="hero-content text-center ">
            <div className="max-w-md">
              <p className="pt-6 font-[Griffy]">Día a día se irá publicando la información relevante a las distintas infusiones que hemos seleccionado, con este orden:</p>
              <ul className="list">
                <li className="list-row items-center">
                  <div><GiCoffeeCup className="size-10 rounded-box"/></div>
                  <div>
                    <div>Madrugón</div>
                    <div className="text-xs font-semibold opacity-60">Temperatura y tiempo de infusión, así como si hay o no cafeína presente.</div>
                  </div>
                </li>
                <li className="list-row items-center">
                  <div><MdOutlineHistoryEdu className="size-10 rounded-box"/></div>
                  <div>
                    <div>Media mañana</div>
                    <div className="text-xs font-semibold opacity-60">Un leve copo de nieve de inspiración.</div>
                  </div>
                </li>
                <li className="list-row items-center">
                  <div><GiNightSleep className="size-10 rounded-box"/></div>
                  <div>
                    <div>Noche nocturna</div>
                    <div className="text-xs font-semibold opacity-60">Infusión seleccionada y lugar de compra (por si a alguien se le antoja).</div>
                  </div>
                </li>
              </ul>
              <p className="py-6 font-[Griffy]">Mi idea es no desvelar quién ha elegido qué infusión hasta el último día.</p>
              <div className="flex gap-3 justify-center">
                <button className="btn btn-primary">Entra</button>
                <button className="btn btn-primary">Regístrate</button>
                <button className="btn btn-secondary">Añade tu té</button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
