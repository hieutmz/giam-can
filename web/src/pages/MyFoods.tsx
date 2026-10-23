import { useEffect, useMemo, useState } from "react";
import CustomFoodForm from "../components/CustomFoodForm";
import FoodTable from "../components/FoodTable";
import Icon from "../components/Icon";
import Modal from "../components/Modal";
import { useT } from "../i18n";
import { addCustomFood, deleteCustomFood, listCustomFoods, updateCustomFood } from "../lib/api";
import { searchFoods } from "../lib/foods";
import type { CustomFood } from "../lib/types";

export default function MyFoods() {
  const t = useT();
  const [foods, setFoods] = useState<CustomFood[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<CustomFood | "new" | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const list = useMemo(() => searchFoods(foods, query, 1000), [foods, query]);

  const reload = () =>
    listCustomFoods()
      .then(setFoods)
      .catch((e) => setError(e.message))
      .finally(() => setLoaded(true));
  useEffect(() => {
    void reload();
  }, []);

  async function remove(f: CustomFood) {
    if (!confirm(t("my.confirmDelete", { name: f.name }))) return;
    await deleteCustomFood(f.id).catch((e) => setError(e.message));
    void reload();
  }

  return (
    <div className="page">
      <header className="page-head with-action">
        <div>
          <h1>{t("my.title")}</h1>
          <p className="muted">{t("my.desc")}</p>
        </div>
        <button className="btn primary" onClick={() => setEditing("new")}>
          <Icon name="plus" size={18} /> {t("my.add")}
        </button>
      </header>

      {error && <p className="alert err">{error}</p>}

      {!loaded ? (
        <p className="muted empty">{t("common.loading")}</p>
      ) : foods.length === 0 ? (
        <section className="card empty-state">
          <span className="empty-icon">
            <Icon name="star" size={28} />
          </span>
          <h2>{t("my.empty")}</h2>
          <p className="muted">{t("my.emptyHint")}</p>
          <button className="btn primary" onClick={() => setEditing("new")}>
            <Icon name="plus" size={18} /> {t("my.addFirst")}
          </button>
        </section>
      ) : (
        <>
          {foods.length > 8 && (
            <div className="search">
              <Icon name="search" size={18} />
              <input placeholder={t("my.searchPh")} value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          )}
          <section className="card flush">
            <FoodTable
              rows={list}
              actions={(f) => (
                <>
                  <button className="icon-btn sm" aria-label={t("common.edit", { name: f.name })} onClick={() => setEditing(f as CustomFood)}>
                    <Icon name="pencil" size={16} />
                  </button>
                  <button className="icon-btn sm danger" aria-label={t("common.delete", { name: f.name })} onClick={() => remove(f as CustomFood)}>
                    <Icon name="trash" size={16} />
                  </button>
                </>
              )}
            />
          </section>
          <p className="hint">{t("my.count", { n: foods.length })}</p>
        </>
      )}

      {editing && (
        <Modal title={editing === "new" ? t("my.addTitle") : t("my.editTitle")} onClose={() => setEditing(null)}>
          <CustomFoodForm
            initial={editing === "new" ? undefined : editing}
            submitLabel={editing === "new" ? t("my.saveNew") : t("my.saveEdit")}
            onCancel={() => setEditing(null)}
            onSubmit={async (input) => {
              if (editing === "new") await addCustomFood(input);
              else await updateCustomFood(editing.id, input);
              setEditing(null);
              void reload();
            }}
          />
        </Modal>
      )}
    </div>
  );
}
