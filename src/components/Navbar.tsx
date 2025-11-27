import { signout } from "@/app/actions/authActions";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import Link from "next/link";
import { RxHamburgerMenu } from "react-icons/rx";
import ProfileImage from "./ui/ProfileImage";
import Image from "next/image";
import { Role } from "@/generated/prisma/enums";

async function Navbar() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return (
    <nav className="navbar bg-neutral shadow-sm fixed z-50 h-16">
      <div className="navbar-start ml-3" >
        <Image src="/LogoAdvientea.png" alt="Logo de advienté" width={40} height={40}/>
      </div>
      <div className="navbar-center">
        <Link href="/" className="btn btn-ghost text-xl text-neutral-content">
          <div>
            Advien<i>té</i> 2025
          </div>
        </Link>
      </div>
      <div className="navbar-end">
        <div className="dropdown dropdown-end">
          <div tabIndex={0} role="button" className="btn btn-ghost btn-circle text-neutral-content">
            {session ? (
              <div>
                {session.user.image ?
                  <ProfileImage name={session.user.name} image={session.user.image} />
                :
                  <></>}
              </div>
            ) : (
                <RxHamburgerMenu />
            )}
          </div>
          <ul tabIndex={-1} className="menu menu-sm dropdown-content bg-base-100 rounded-box z-1 mt-3 w-30 p-2 shadow">
            {!session && <li><Link href="/sign-in">Login</Link></li>}
            {!session && <li><Link href="/sign-up">Registro</Link></li>}
            {session && `¡Hola, ${session.user.username}!` }
            {/* {session && <li><Link href="/profile">Perfil</Link></li>} */}
            {/* <li><Link href="/teaDay">Té del día</Link></li> */}
            <li><Link href="/add-tea-info">Añadir tu té</Link></li>
            {session && session.user.role !== Role.USER && <li><Link href="/add-tea-info">Editar tu té</Link></li>}
            {session && <li><form action={signout}><button type="submit">Cerrar sesión</button></form></li>}
          </ul>
        </div>
      </div>
    </nav>
  );
}
export default Navbar;
