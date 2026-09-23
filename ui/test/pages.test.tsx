import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "../src/App";
import { fakeClient, STATUS } from "./fake-client";

describe("Overview", () => {
  it("shows Frank's get_status output", async () => {
    const client = fakeClient();
    render(<App client={client} />);
    expect(await screen.findByText(STATUS.summary)).toBeInTheDocument();
    expect(screen.getByText("1.2.3")).toBeInTheDocument();
    expect(screen.getByText("42s")).toBeInTheDocument();
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(client.callTool).toHaveBeenCalledWith("get_status");
  });

  it("says Frank did not answer when the call fails", async () => {
    const client = fakeClient({
      callTool: async () => {
        throw new Error("fetch failed");
      },
    });
    render(<App client={client} />);
    expect(await screen.findByText("Frank did not answer")).toBeInTheDocument();
    expect(screen.getByText("fetch failed")).toBeInTheDocument();
    expect(screen.getByText("Unreachable")).toBeInTheDocument();
  });

  it("treats an isError result as a failure too", async () => {
    const client = fakeClient({
      callTool: async () => ({ isError: true, text: "get_status could not complete: boom" }),
    });
    render(<App client={client} />);
    expect(await screen.findByText("get_status could not complete: boom")).toBeInTheDocument();
  });
});

describe("Tools", () => {
  it("lists the tools Frank discovers over MCP", async () => {
    render(<App client={fakeClient()} initialPage="tools" />);
    expect(await screen.findByText("search_things")).toBeInTheDocument();
    expect(screen.getByText("get_status")).toBeInTheDocument();
  });

  it("renders a form from the selected tool's schema and shows the result", async () => {
    const user = userEvent.setup();
    const client = fakeClient();
    render(<App client={client} initialPage="tools" />);

    await user.click(await screen.findByRole("radio", { name: "search_things" }));
    await user.type(screen.getByRole("textbox", { name: "query" }), "frank");
    await user.click(screen.getByRole("button", { name: "Run" }));

    expect(await screen.findByText("Searched for frank.")).toBeInTheDocument();
    expect(client.callTool).toHaveBeenCalledWith("search_things", { query: "frank" });
    expect(within(screen.getByTestId("result-json")).getByText(/"matches": 0/)).toBeInTheDocument();
  });

  it("refuses to call a tool with a missing required field", async () => {
    const user = userEvent.setup();
    const client = fakeClient();
    render(<App client={client} initialPage="tools" />);

    await user.click(await screen.findByRole("radio", { name: "search_things" }));
    await user.click(screen.getByRole("button", { name: "Run" }));

    expect(await screen.findByText("Required.")).toBeInTheDocument();
    expect(client.callTool).not.toHaveBeenCalledWith("search_things", expect.anything());
  });

  it("says Frank did not answer when discovery fails", async () => {
    const client = fakeClient({
      listTools: async () => {
        throw new Error("connection refused");
      },
    });
    render(<App client={client} initialPage="tools" />);
    expect(await screen.findByText("Frank did not answer")).toBeInTheDocument();
    expect(screen.getByText("connection refused")).toBeInTheDocument();
  });
});

describe("navigation", () => {
  it("switches pages from the side navigation", async () => {
    const user = userEvent.setup();
    render(<App client={fakeClient()} />);
    await screen.findByText(STATUS.summary);
    await user.click(screen.getByRole("link", { name: "Tools" }));
    await waitFor(() => expect(screen.getByText("search_things")).toBeInTheDocument());
  });
});
