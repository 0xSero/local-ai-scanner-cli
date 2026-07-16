/** GPU category page — RTX 4090, 3090, 5090, RTX Pro 6000, DGX Spark. */
import { loadSnapshot } from "../../lib/data";
import { CategoryView } from "../components/category-view";

export const revalidate = 3600;

export default async function GpuPage() {
  const snapshot = await loadSnapshot();
  return <CategoryView category="gpu" snapshot={snapshot} />;
}
