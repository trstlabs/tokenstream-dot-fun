import Image from "next/image";
import Link from "next/link";

function Footer() {
  return (
    <div className="relative flex flex-row items-center justify-center space-x-0 px-4 py-8  sm:py-12">
      <p className="px-4 text-sm text-white sm:text-base">Powered by</p>

      <Link
        href="https://skip.money/"
        target="_blank"
      >
        <div className="relative h-10 w-32">
          <Image
            src="/skip-logo.png"
            fill
            className="h-6 sm:h-10"
            alt={"skip logo"}
            style={{
              objectFit: "contain",
            }}
          />
        </div>
      </Link>
      <Link
        href="https://intento.zone"
        target="_blank"
      >
        <div className="relative h-12 w-36">
          <Image
            src="/intento_tiny.png"
            fill
            className="h-8 sm:h-32"
            alt={"intento logo"}
            style={{
              objectFit: "contain",
            }}
          />
        </div>
      </Link>
    </div>
  );
}

export default Footer;
