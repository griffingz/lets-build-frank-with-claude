import Alert from "@cloudscape-design/components/alert";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import KeyValuePairs from "@cloudscape-design/components/key-value-pairs";
import SpaceBetween from "@cloudscape-design/components/space-between";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import { useCallback, useEffect, useState } from "react";
import type { FrankClient } from "../frank/client";

interface Status {
  summary: string;
  version: string;
  uptimeSeconds: number;
  greeting: string;
}

type State =
  | { kind: "loading" }
  | { kind: "ok"; status: Status }
  | { kind: "error"; message: string };

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export default function Overview({ client }: { client: FrankClient }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const result = await client.callTool("get_status");
      if (result.isError || !result.structured) {
        setState({ kind: "error", message: result.text || "get_status returned no status." });
        return;
      }
      setState({ kind: "ok", status: result.structured as unknown as Status });
    } catch (error) {
      setState({ kind: "error", message: describe(error) });
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  const connection =
    state.kind === "loading" ? (
      <StatusIndicator type="loading">Connecting</StatusIndicator>
    ) : state.kind === "ok" ? (
      <StatusIndicator type="success">Connected</StatusIndicator>
    ) : (
      <StatusIndicator type="error">Unreachable</StatusIndicator>
    );

  return (
    <ContentLayout
      header={
        <Header
          variant="h1"
          description="Frank's status, straight from his get_status tool."
          actions={
            <Button iconName="refresh" onClick={() => void load()} loading={state.kind === "loading"}>
              Refresh
            </Button>
          }
        >
          Overview
        </Header>
      }
    >
      <SpaceBetween size="l">
        {state.kind === "error" && (
          <Alert type="error" header="Frank did not answer">
            {state.message}
          </Alert>
        )}
        <Container header={<Header variant="h2">Status</Header>}>
          <KeyValuePairs
            columns={3}
            items={[
              { label: "Connection", value: connection },
              { label: "Version", value: state.kind === "ok" ? state.status.version : "-" },
              {
                label: "Uptime",
                value: state.kind === "ok" ? `${state.status.uptimeSeconds}s` : "-",
              },
              { label: "Summary", value: state.kind === "ok" ? state.status.summary : "-" },
              { label: "Greeting", value: state.kind === "ok" ? state.status.greeting : "-" },
            ]}
          />
        </Container>
      </SpaceBetween>
    </ContentLayout>
  );
}
