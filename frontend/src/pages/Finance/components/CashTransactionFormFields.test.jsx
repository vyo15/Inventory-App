import { render, screen } from "@testing-library/react";
import { Form } from "antd";
import { describe, expect, it } from "vitest";
import CashTransactionFormFields from "./CashTransactionFormFields";

describe("CashTransactionFormFields", () => {
  it("merender field kas bersama tanpa mengambil alih handler transaksi", () => {
    render(
      <Form>
        <CashTransactionFormFields
          typeLabel="Tipe Pemasukan"
          typeRequiredMessage="Tipe wajib dipilih"
          typeOptions={["Penjualan", "Pendapatan Lain-lain"]}
          defaultType="Pendapatan Lain-lain"
        />
      </Form>,
    );

    expect(screen.getByText("Tipe Pemasukan")).toBeTruthy();
    expect(screen.getByText("Jumlah")).toBeTruthy();
    expect(screen.getByText("Deskripsi")).toBeTruthy();
    expect(screen.getByText("Tanggal")).toBeTruthy();
    expect(screen.getByText("Pendapatan Lain-lain")).toBeTruthy();
  });
});
