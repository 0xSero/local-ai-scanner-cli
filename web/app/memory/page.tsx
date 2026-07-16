/** Memory category page — DDR4, DDR5, ECC RDIMMs. */
import { loadSnapshot } from "../../lib/data";
import { CategoryView } from "../components/category-view";

export const revalidate = 3600;

export default async function MemoryPage() {
  const snapshot = await loadSnapshot();
  return <CategoryView category="memory" snapshot={snapshot} />;
}
