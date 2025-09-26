export default function Home() {
  return (
    <div className="flex flex-col min-h-dvh items-center justify-center p-4">
      <header className="flex flex-col backdrop-blur-[2px] px-8 pt-8 pb-2 rounded-2xl mb-8">
        <h1 className="mb-4 text-4xl font-semibold text-center font-[Griffy] text-primary">Advienté</h1>
        <p className="mb-6 text-xl text-center font-[Griffy] text-base-content">
          Bienvenides a la página del advienté 2025. <br /> Proximamen<span className="italic">té</span> más información...
        </p>
      </header>

      <main className="flex flex-col gap-5 px-4 md:px-8">
        <section className="collapse collapse-arrow bg-base-100 border border-accent">
          <input type="radio" name="my-accordion-2" defaultChecked />
          <div className="collapse-title font-semibold">
            ¿Qué es Advienté? <span className="badge badge-xs badge-warning font-sans">Nuevo</span>
          </div>
          <div className="collapse-content text-sm">
            {" "}
            Advienté es una iniciativa de unes cuantes amantes del <i>té</i> que hacen un calendario de adviento de <i>té</i>. Si <i>te</i> interesa, contacta con
            nosotres.
          </div>
        </section>
        <section className="collapse collapse-arrow bg-base-100 border border-accent">
          <input type="radio" name="my-accordion-2" />
          <div className="collapse-title font-semilight">
            {" "}
            Advien<i>té</i> 2025: <span className="font-black italic">Caoslendario</span>
          </div>
          <div className="collapse-content text-sm">
            <p>Después de la maravillosa experiencia del año pasado este año será así:</p>
            <ul className="list-none">
              <li className="before:content-['🍵_']">
                Podrá haber tanta gente como quiera, se empieza el 1 de diciembre y se acaba cuando se acabe (en 2026, 2027 o lo que sea)
              </li>
              <li className="before:content-['🍵_']">
                Si decides participar se te asignará un número, y deberás buscar un té o infusión que te guste, comprarlo, dividirlo en tantas
                personas como seamos (con un mínimo de 24) e idear una forma de marcar su número en todas las porciones (sobrecitos y escrito a mano o
                pegatinas o lo que sea)
              </li>
              <li className="before:content-['🍵_']">
                Ir a Correos y comprar 2 sobres-bolsa prefranqueados. En uno de ellos escribir su dirección y dejarlo vacío. En el otro meter el
                primer sobre vacío y todas las bolsitas de té. Posteriormente, envíarselo a la persona responsable de esta edición
              </li>
              <li className="before:content-['🍵_']">
                La persona responsable de esta edición, hace la magia de la redistribución de bolsitas, y envía a cada participante su sobre
                (previamente vacío) con tantas bolsas como participantes, con mucho té, infusión y amor
              </li>
              <li className="before:content-['🍵_']">
                Podéis pensar en qué música, imágenes o historias os gustaría crear para ambientar vuestro día y contribuir al{" "}
                <span className="font-semibold">
                  ❝adivina<i>té</i>❞
                </span>
              </li>
            </ul>
          </div>
        </section>
        <section className="collapse collapse-arrow bg-base-100 border border-accent">
          <input type="radio" name="my-accordion-2" />
          <div className="collapse-title font-semilight">
            <span className="font-extrabold italic ">Caoslendario: </span>Fechas límite{" "}
            <span className="badge badge-xs badge-error font-sans">¡IMPORTANTE!</span>
          </div>
          <div className="collapse-content text-sm">
            <ul>
              <li className="before:content-['🫖']"><span className="font-bold">30/09/2025:</span> Cierre de participantes</li>
              <li className="before:content-['🫖']">
                <span className="font-bold">31/10/2025:</span> Fecha tope para haber recibido el sobre con las bolsitas individuales y sobre prefranqueado
              </li>
              <li className="before:content-['🫖']">
                <span className="font-bold">15/11/2025:</span> Fecha tope para enviar los detalles inspiradores sobre vuestro té o infusión de vuestro día
              </li>
            </ul>
          </div>
        </section>

        {/* <div className="card bg-base-100 w-96 shadow-sm">
          <div className="card-body">
            <h2 className="card-title justify-center font-[Griffy] font-semibold">
              ¿Qué es Advienté? <span className="badge badge-xs badge-warning font-sans">Nuevo</span>
            </h2>
            <p>
              Advienté es una iniciativa de unes cuantes amantes del <i>té</i> que hacen un calendario de adviento de té. Si te interesa, contacta con
              nosotres.
            </p>
          </div>
        </div>

        <div className="card bg-base-100 w-96 shadow-sm">
          <div className="card-body">
            <h2 className="card-title justify-center font-[Griffy] font-light">
              Advienté 2025: <span className="font-black italic">Caoslendario</span>
            </h2>
            <p>Después de la maravillosa experiencia del año pasado este año será así:</p>
            <ul className="list-none">
              <li className="before:content-['🍵']">
                Podrá haber tanta gente como quiera, se empieza el 1 de diciembre y se acaba cuando se acabe (en 2026, 2027 o lo que sea)
              </li>
              <li className="before:content-['🍵']">
                Si decides participar se te asignará un número, y deberás buscar un té o infusión que te guste, comprarlo, dividirlo en tantas
                personas como seamos (con un mínimo de 24) e idear una forma de marcar su número en todas las porciones (sobrecitos y escrito a mano o
                pegatinas o lo que sea)
              </li>
              <li className="before:content-['🍵']">
                Ir a Correos y comprar 2 sobres-bolsa prefranqueados. En uno de ellos escribir su dirección y dejarlo vacío. En el otro meter el
                primer sobre vacío y todas las bolsitas de té. Posteriormente, envíarselo a la persona responsable de esta edición
              </li>
              <li className="before:content-['🍵']">
                La persona responsable de esta edición, hace la magia de la redistribución de bolsitas, y envía a cada participante su sobre
                (previamente vacío) con tantas bolsas como participantes, con mucho té, infusión y amor
              </li>
              <li className="before:content-['🍵']">
                Podéis pensar en qué música, imágenes o historias os gustaría crear para ambientar vuestro día y contribuir al{" "}
                <span className="font-semibold">
                  ❝adivina<i>té</i>❞
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="card bg-base-100 w-96 shadow-sm">
          <div className="card-body">
            <h2 className="card-title justify-center font-[Griffy] font-light">
              <span className="font-extrabold italic ">Caoslendario:</span>Fechas límite{" "}
              <span className="badge badge-xs badge-error font-sans">¡IMPORTANTE!</span>
            </h2>
            <p className="flex-0">Fechas límite:</p>
            <ul>
              <li className="before:content-['🫖']">30/09/2025: Cierre de participantes</li>
              <li className="before:content-['🫖']">
                31/10/2025: Fecha tope para haber recibido el sobre con las bolsitas individuales y sobre prefranqueado
              </li>
              <li className="before:content-['🫖']">
                15/11/2025: Fecha tope para enviar los detalles inspiradores sobre vuestro té o infusión de vuestro día
              </li>
            </ul>
          </div>
        </div> */}
      </main>
    </div>
  );
}
