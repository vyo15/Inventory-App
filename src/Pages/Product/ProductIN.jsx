import React, { useState } from "react";
import { Splitter, Typography, Table } from "antd";
import { DownOutlined } from "@ant-design/icons";
import "./ProductIN.css";
import {
  Dropdown,
  message,
  Space,
  Button,
  DatePicker,
  Form,
  Input,
  Select,
  InputNumber,
} from "antd";
const { Option } = Select;

const handleMenuClick = (e, setCategory) => {
  message.info(`You clicked on ${e.key}`);
  setCategory(e.key); // Update state kategori yang dipilih
};

const selectAfter = (
  <Select defaultValue="pcs" style={{ width: 100 }}>
    <Option value="pcs">Pcs</Option>
    <Option value="meter">Meter</Option>
    <Option value="roll">Roll</Option>
  </Select>
);

// Daftar item menu dropdown
const items = [
  {
    label: "Item 1",
    key: "Item 1",
  },
  {
    label: "Item 2",
    key: "Item 2",
  },
  {
    label: "Item 3",
    key: "Item 3",
  },
  {
    label: "Item 4",
    key: "Item 4",
  },
];

const columns = [
  {
    title: "Kode Product",
    dataIndex: "id",
    key: "id",
  },
  {
    title: "Nama Product",
    dataIndex: "nama",
    key: "nama",
    responsive: ["md"],
  },
  {
    title: "Jumlah Product",
    dataIndex: "jumlah",
    key: "jumlah",
    responsive: ["lg"],
  },
  {
    title: "Suplayer",
    dataIndex: "suplayer",
    key: "suplayer",
    responsive: ["lg"],
  },
];
const data = [
  {
    key: "1",
    id: "FL-PTH",
    nama: "Bunga Mawar Flanel Putih",
    jumlah: "10p pcs",
    suplayer: "link shopee",
  },
];

const { Title } = Typography;
const formItemLayout = {
  labelCol: {
    xs: { span: 24 },
    sm: { span: 6 },
  },
  wrapperCol: {
    xs: { span: 24 },
    sm: { span: 14 },
  },
};

const ProductIN = () => {
  // State untuk menyimpan kategori yang dipilih
  const [category, setCategory] = useState(null);

  // Update the menuProps to include setCategory
  const menuProps = {
    items,
    onClick: (e) => handleMenuClick(e, setCategory), // Pass setCategory here
  };

  const [form] = Form.useForm();
  return (
    <div>
      <Title level={3}>Form Input Barang Masuk</Title>

      <Splitter>
        <Splitter.Panel defaultSize="40%" min="20%" max="70%">
          <Form
            {...formItemLayout}
            form={form}
            variant="filled"
            style={{ maxWidth: 600 }}
            initialValues="filled"
          >
            <Form.Item
              label="Id Product"
              name="id"
              rules={[{ required: true, message: "Please input!" }]}
            >
              <Input />
            </Form.Item>

            <Form.Item
              label="Tanggal Masuk"
              name="DatePicker"
              rules={[{ required: true, message: "Please input!" }]}
            >
              <DatePicker />
            </Form.Item>

            <Form.Item
              label="Supplier"
              name="Supplier"
              rules={[{ required: true, message: "Please input!" }]}
            >
              <Input addonBefore="https://" defaultValue="web" />
            </Form.Item>

            <Form.Item
              label="Kategori"
              name="Kategori"
              rules={[{ required: true, message: "Please select a category!" }]}
            >
              <Dropdown menu={menuProps}>
                <Button>
                  <Space>
                    {category ? category : "Pilih Kategori"}
                    <DownOutlined />
                  </Space>
                </Button>
              </Dropdown>
            </Form.Item>

            <Form.Item
              label="Jumlah Barang"
              name="jumlah"
              rules={[{ required: true, message: "Please input!" }]}
            >
              <InputNumber addonAfter={selectAfter} defaultValue={100} />
            </Form.Item>

            <Form.Item
              label="Harga Beli / Satuan"
              name="satuan"
              rules={[{ required: true, message: "Please input!" }]}
            >
              <InputNumber />
            </Form.Item>

            <Form.Item
              label="Total Harga"
              name="total"
              rules={[{ required: true, message: "Please input!" }]}
            >
              <InputNumber />
            </Form.Item>

            <Form.Item
              label="Keterangan"
              name="keterangan"
              rules={[{ required: true, message: "Please input!" }]}
            >
              <Input />
            </Form.Item>
          </Form>
        </Splitter.Panel>
        <Splitter.Panel>
          <Title align="center" level={3}>
            Table Stock Barang Menipis
          </Title>
          <Table columns={columns} dataSource={data} />
        </Splitter.Panel>
      </Splitter>
    </div>
  );
};

export default ProductIN;
