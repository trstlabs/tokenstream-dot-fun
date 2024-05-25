import Image from "next/image";
import Link from "next/link";

// import { IbcFunLogo } from "./IbcFunLogo";

function Header() {
  return (
    <nav className="relative flex items-center justify-center px-4 py-4 sm:py-4">
      <Link href="/">
        <Image
          src="/tokenstream.png"
          width={222}
          height={222}
          className="h-118 sm:h-32"
          alt={"tokenstream logo"}
          style={{
            objectFit: "contain",
          }}
        />
      </Link>
    </nav>
  );
}

export default Header;
