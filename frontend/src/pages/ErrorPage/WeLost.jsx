import React from "react";
import { Button, Result } from "antd";
import { Link } from "react-router-dom";
import "./WeLost.css";

const WeLost = () => {
  return (
    <div className="page-container not-found">
      <Result
        status="error"
        title="404 - Halaman Tidak Ditemukan"
        subTitle="Halaman yang kamu buka tidak tersedia atau alamatnya sudah berubah."
        extra={[
          <Link key="dashboard" to="/dashboard">
            <Button type="primary">Kembali ke Dashboard</Button>
          </Link>,
        ]}
      />
    </div>
  );
};

export default WeLost;
