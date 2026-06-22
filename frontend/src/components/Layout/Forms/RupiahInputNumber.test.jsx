import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Form } from "antd";
import { describe, expect, it, vi } from "vitest";
import RupiahInputNumber from "./RupiahInputNumber";

describe("RupiahInputNumber", () => {
  it("meneruskan nilai Form.Item ke InputNumber tanpa addonBefore deprecated", async () => {
    const onValuesChange = vi.fn();
    const user = userEvent.setup();

    render(
      <Form initialValues={{ amount: 2500 }} onValuesChange={onValuesChange}>
        <Form.Item name="amount" label="Jumlah">
          <RupiahInputNumber min={0} precision={0} />
        </Form.Item>
      </Form>,
    );

    expect(screen.getByLabelText("Mata uang Rupiah").value).toBe("Rp");
    const amountInput = screen.getByRole("spinbutton", { name: "Jumlah" });
    expect(amountInput.value).toBe("2500");

    await user.clear(amountInput);
    await user.type(amountInput, "12500");

    expect(onValuesChange).toHaveBeenCalled();
  });
});
