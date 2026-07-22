import AppLayout from "./AppLayout";
import PageHeader from "./PageHeader";
export default function Layout({ children, title, subtitle }) {
  return <AppLayout>{title && <PageHeader title={title} subtitle={subtitle} />}{children}</AppLayout>;
}
