import AppLayout from "@cloudscape-design/components/app-layout";
import SideNavigation from "@cloudscape-design/components/side-navigation";
import { useState } from "react";
import type { FrankClient } from "./frank/client";
import Overview from "./pages/Overview";
import Tools from "./pages/Tools";

export type PageId = "overview" | "tools";

export interface AppProps {
  client: FrankClient;
  initialPage?: PageId;
}

const PAGES: Record<PageId, string> = {
  overview: "Overview",
  tools: "Tools",
};

// Two pages don't earn a router: page state lives here (ADR-003).
export default function App({ client, initialPage = "overview" }: AppProps) {
  const [page, setPage] = useState<PageId>(initialPage);

  return (
    <AppLayout
      toolsHide
      navigation={
        <SideNavigation
          header={{ text: "Frank", href: "#overview" }}
          activeHref={`#${page}`}
          items={(Object.keys(PAGES) as PageId[]).map((id) => ({
            type: "link",
            text: PAGES[id],
            href: `#${id}`,
          }))}
          onFollow={(event) => {
            event.preventDefault();
            setPage(event.detail.href.slice(1) as PageId);
          }}
        />
      }
      content={page === "overview" ? <Overview client={client} /> : <Tools client={client} />}
    />
  );
}
