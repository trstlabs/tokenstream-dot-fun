import { Head, Html, Main, NextScript } from "next/document";

import { cn } from "@/utils/ui";

export default function Document() {
  return (
    <Html
      lang="en"
      className="bg-[#bce3f5]"
    >
      <Head>
        <meta charSet="UTF-8" />
        <meta
          content="ie=edge"
          httpEquiv="X-UA-Compatible"
        />
      </Head>
      <body
        className={cn(
          "font-sans subpixel-antialiased",
          "relative overflow-x-hidden overflow-y-scroll",
          "before:fixed before:inset-x-0 before:bottom-0 before:h-[100vh] before:content-['']",
          "before:bg-[url(/bullseye-gradient.svg)] before:bg-cover before:bg-[center_top] before:bg-no-repeat",
        )}
      >
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
