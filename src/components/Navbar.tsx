import { auth } from "@/lib/auth";
import { cookies, headers } from "next/headers";
import Link from "next/link";
import { RxHamburgerMenu } from "react-icons/rx";

async function Navbar() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const cookieStore = await cookies();
  const myCookie = cookieStore.get("advientea.session_token");
  return (
    <nav className="navbar bg-neutral shadow-sm">
      <div className="navbar-start" />
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
              <div></div>
            ) : (
              <RxHamburgerMenu />
            )}
          </div>
          <ul tabIndex={-1} className="menu menu-sm dropdown-content bg-base-100 rounded-box z-1 mt-3 w-30 p-2 shadow">
            {session ? (
              <>
                <li></li>
              </>
            ) : (
              <>
                <li><Link href="/sign-in">Login</Link></li>
                <li><Link href="/sign-up">Registro</Link></li>
                <li><Link href="/teaDay">Té del día</Link></li>
                <li><Link href="/profile">Perfil</Link></li>
              </>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
}
export default Navbar;
