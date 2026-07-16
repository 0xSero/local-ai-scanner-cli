/** AMD Strix Halo category page — Framework Desktop + Mini PCs. */
import { loadSnapshot } from "../../lib/data";
import { CategoryView } from "../components/category-view";

export const revalidate = 3600;

export default async function AmdPage() {
  const snapshot = await loadSnapshot();
  return <CategoryView category="amd" snapshot={snapshot} />;
}
