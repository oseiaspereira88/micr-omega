import { render, screen } from "@testing-library/react";

import TouchLayoutPreview from "../TouchLayoutPreview";

describe("TouchLayoutPreview", () => {
  it("gera snapshots distintos e nomes acessíveis para cada layout", () => {
    const { asFragment, rerender } = render(
      <TouchLayoutPreview layout="right" />
    );

    const rightPreview = screen.getByRole("img", {
      name: /prévia do layout com botões à direita/i,
    });
    expect(rightPreview).toHaveAttribute("data-layout", "right");
    expect(rightPreview).toHaveAccessibleName(
      /botões à direita/i
    );
    expect(asFragment()).toMatchSnapshot("touch-layout-preview-right");

    rerender(<TouchLayoutPreview layout="left" />);

    const leftPreview = screen.getByRole("img", {
      name: /prévia do layout com botões à esquerda/i,
    });
    expect(leftPreview).toHaveAttribute("data-layout", "left");
    expect(leftPreview).toHaveAccessibleName(/botões à esquerda/i);
    expect(asFragment()).toMatchSnapshot("touch-layout-preview-left");
  });
});
