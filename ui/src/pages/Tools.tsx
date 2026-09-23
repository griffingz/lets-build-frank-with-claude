import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Container from "@cloudscape-design/components/container";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table from "@cloudscape-design/components/table";
import { useEffect, useState } from "react";
import ResultView from "../components/ResultView";
import SchemaForm from "../components/SchemaForm";
import type { FrankClient, ToolCallOutcome, ToolInfo } from "../frank/client";

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export default function Tools({ client }: { client: FrankClient }) {
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ToolInfo | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ToolCallOutcome | null>(null);
  const [callError, setCallError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    client
      .listTools()
      .then((list) => {
        if (!cancelled) setTools(list);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(describe(error));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  const select = (tool: ToolInfo | null) => {
    setSelected(tool);
    setResult(null);
    setCallError(null);
  };

  const run = async (args: Record<string, unknown>) => {
    if (!selected) return;
    setRunning(true);
    setCallError(null);
    try {
      setResult(await client.callTool(selected.name, args));
    } catch (error) {
      setResult(null);
      setCallError(describe(error));
    } finally {
      setRunning(false);
    }
  };

  return (
    <ContentLayout
      header={
        <Header variant="h1" description="Every tool Frank exposes, discovered over MCP. Pick one to call it.">
          Tools
        </Header>
      }
    >
      <SpaceBetween size="l">
        {loadError && (
          <Alert type="error" header="Frank did not answer">
            {loadError}
          </Alert>
        )}
        <Table
          header={<Header counter={loading ? undefined : `(${tools.length})`}>Tools</Header>}
          items={tools}
          loading={loading}
          loadingText="Asking Frank for his tools"
          trackBy="name"
          selectionType="single"
          selectedItems={selected ? [selected] : []}
          onSelectionChange={({ detail }) => select(detail.selectedItems[0] ?? null)}
          ariaLabels={{
            selectionGroupLabel: "Tool selection",
            itemSelectionLabel: (_data, item) => item.name,
          }}
          columnDefinitions={[
            { id: "name", header: "Name", cell: (tool) => <Box variant="code">{tool.name}</Box> },
            { id: "description", header: "Description", cell: (tool) => tool.description ?? "" },
          ]}
          empty={<Box textAlign="center">Frank has no tools.</Box>}
        />
        {selected && (
          <Container header={<Header variant="h2" description={selected.description}>{selected.name}</Header>}>
            <SpaceBetween size="l">
              <SchemaForm key={selected.name} schema={selected.inputSchema} submitting={running} onSubmit={run} />
              {callError && (
                <Alert type="error" header="Frank did not answer">
                  {callError}
                </Alert>
              )}
              {result && <ResultView result={result} />}
            </SpaceBetween>
          </Container>
        )}
      </SpaceBetween>
    </ContentLayout>
  );
}
