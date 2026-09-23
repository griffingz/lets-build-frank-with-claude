import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import SpaceBetween from "@cloudscape-design/components/space-between";
import type { ToolCallOutcome } from "../frank/client";

// Plain <pre> via Box, from the allowed package. Not @cloudscape-design/code-view:
// ADR-003 allows only components + global-styles.
export default function ResultView({ result }: { result: ToolCallOutcome }) {
  const summary = typeof result.structured?.summary === "string" ? result.structured.summary : null;

  return (
    <SpaceBetween size="s">
      {result.isError ? (
        <Alert type="error" header="The tool reported an error">
          {result.text}
        </Alert>
      ) : (
        summary && <Box variant="p">{summary}</Box>
      )}
      <Box variant="pre" data-testid="result-json">
        {result.structured ? JSON.stringify(result.structured, null, 2) : result.text}
      </Box>
    </SpaceBetween>
  );
}
