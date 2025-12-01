import StoryTeaComponent from "@/components/StoryTeaComponent";
import Timer from "@/components/Timer";
import TeaInfusionInfo from "@/components/ui/TeaInfusionInfo";
import WaitForDayToCome from "@/components/ui/WaitForDayToCome";
import { Role } from "@/generated/prisma/enums";
import { getAdvienteaDayState } from "@/lib/advientea-rules";
import { auth } from "@/lib/auth";
import { getDay, getUsernameAssignedToTea } from "@/lib/dal";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BsCupHotFill } from "react-icons/bs";
import { FaStore, FaUser } from "react-icons/fa";
import { MdComputer } from "react-icons/md";

interface TeaDayPageProps {
  params: Promise<{ dayId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function TeaDayPage({ params, searchParams }: TeaDayPageProps) {
  const { dayId } = await params;
  const day = await getDay(dayId);
  if (!day) {
    notFound();
  }
  const simulated = Boolean((await searchParams).simulated);
  const tea = day.tea;
  const userName = tea ? await getUsernameAssignedToTea(tea.id) : "";
  const session = await auth.api.getSession({ headers: await headers() });
  const advienteaDayState = getAdvienteaDayState(day.dayNumber, day.year, session?.user.role as Role, simulated);


  if (!advienteaDayState.isReleased) {
    return (<WaitForDayToCome dayNumber={day.dayNumber} />);
  }

  return (
    <div className="flex flex-col justify-center items-center mx-5 mt-5 gap-3">
      {/* Day + Tea name */}
      <div className="card w-full max-w-xl bg-neutral text-neutral-content card-xl shadow-sm">
        <div className="card-body items-center">
          <h2 className="card-title text-4xl">Día {day.dayNumber}</h2>
          {advienteaDayState.isTeaReleased ? (
            <div className="font-[Griffy] text-2xl">{tea?.name}</div>
          ) : (
            <div className="skeleton skeleton-text font-[Griffy] text-2xl">Té desconocido</div>
          )}
          {advienteaDayState.isPersonNameReleased && <div className="flex gap-2 items-center"><FaUser />{userName}</div>}
        </div>
      </div>

      {/* Tea info */}
      {!tea ? (
        <>
          <div className="bg-base-100 w-full max-w-xl p-5 rounded-2xl justify-center items-center text-center">
            <div>Falta el té de este día.</div>
            <div>Ten paciencia y vuelve pronto.</div>
          </div>
        </>
      ) : (
          <>
            <div className="collapse collapse-arrow bg-base-100 w-full max-w-xl">
              <input type="checkbox" defaultChecked={true} />
              <div className="collapse-title font-semibold text-4xl after:start-5 after:end-auto pe-4 ps-12">
                Informa<span className="italic">Té</span>
              </div>
              <div className="collapse-content text-sm">
                {advienteaDayState.isPart1Released ? ( 
                  <>
                    <div className="flex gap-2 items-center text-2xl mb-4">
                      <BsCupHotFill />
                      <div>¿Cómo infusionar?</div>
                    </div>
                    <TeaInfusionInfo tea={tea} />
                    <div className="mt-2">
                      <Timer minutes={tea?.infusionTime ?? 0} />
                    </div>
                    
                    {advienteaDayState.isTeaReleased && (tea?.storeName || tea?.url) && 
                      <div className="flex flex-col gap-2 mt-4">
                        <div className="flex gap-2 items-center text-2xl mb-4">
                          <FaStore />
                          <div>¿Dónde comprar?</div>
                        </div>                
                        {tea.storeName && <div className="flex items-center gap-2 ml-4"><FaStore />{tea.storeName}</div>}
                        {tea.url && <Link href={tea.url} className="flex items-center gap-2 ml-4"><MdComputer />{tea.url}</Link>}
                      </div>
                    }
                  </>
                ): ( 
                  <div className="skeleton skeleton-text font-[Griffy] text-center text-2xl">No es la hora todavía...</div>   
                )}
                </div>              
            </div>
            
            {tea?.story &&
              <StoryTeaComponent
                story={tea?.story}
                isPart1Released={advienteaDayState.isPart1Released}
                isPart2Released={advienteaDayState.isPart2Released}
                isPart3Released={advienteaDayState.isPart3Released}
              />
            }
        </>
      )}
    </div>
  );
}
