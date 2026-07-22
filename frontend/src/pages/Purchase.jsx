import Layout from "../components/Layout";

function Purchase() {
  return (
    <Layout>
      <div className="card">
        <h2>🛒 Purchase Entry</h2>

        <input placeholder="Supplier Name" />
        <input placeholder="Invoice Number" />
        <input placeholder="Purchase Amount" />
        <input placeholder="GST Amount" />

        <button>Save Purchase</button>
      </div>
    </Layout>
  );
}

export default Purchase;