import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import ConnectionStatusOverlay from "../ConnectionStatusOverlay";
import { gameStore } from "../../store/gameStore";

describe("ConnectionStatusOverlay", () => {
  beforeEach(() => {
    gameStore.actions.resetGameState();
  });

  it("displays latency when the last ping timestamp is zero", () => {
    gameStore.setPartial({
      connectionStatus: "connected",
      lastPingAt: 0,
      lastPongAt: 150,
      reconnectAttempts: 0,
      joinError: null,
    });

    render(<ConnectionStatusOverlay />);

    expect(screen.getByText("Latência")).toBeInTheDocument();
    expect(screen.getByText("150 ms")).toBeInTheDocument();
  });

  it("announces join errors with an alert role", () => {
    gameStore.setPartial({
      connectionStatus: "disconnected",
      lastPingAt: null,
      lastPongAt: null,
      reconnectAttempts: 0,
      joinError: "Unable to join game.",
    });

    render(<ConnectionStatusOverlay />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Unable to join game.");
  });
});
