import { ActionForm } from "@/components/admin/ActionForm";
import styles from "@/components/admin/admin.module.css";
import { saveListing } from "./actions";

type Listing = {
  id: string;
  name: string;
  listingType: string;
  parentCategory: string;
  category: string;
  tags: string[];
  description: string;
  author: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  googleMapUrl: string | null;
  status: string;
};

export function ListingForm({ listing, parents }: { listing?: Listing; parents: string[] }) {
  const input = (name: keyof Listing, label: string, opts: { required?: boolean; width?: number; placeholder?: string } = {}) => (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={`l-${name}`}>
        {label}
      </label>
      <input
        id={`l-${name}`}
        name={name}
        defaultValue={(listing?.[name] as string | null) ?? ""}
        required={opts.required}
        placeholder={opts.placeholder}
        className={styles.input}
        style={opts.width ? { width: opts.width } : undefined}
      />
    </div>
  );
  return (
    <ActionForm action={saveListing} submitLabel={listing ? "Save listing" : "Create listing"}>
      <input type="hidden" name="id" value={listing?.id ?? ""} />
      <section className={styles.card}>
        <div className={styles.grid2}>
          {input("name", "Name", { required: true })}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="l-listingType">
              Type
            </label>
            <select id="l-listingType" name="listingType" defaultValue={listing?.listingType ?? "BUSINESS"} className={styles.select}>
              <option value="BUSINESS">Business</option>
              <option value="INDIVIDUAL">Individual / service provider</option>
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="l-parentCategory">
              Main category
            </label>
            <input id="l-parentCategory" name="parentCategory" list="parent-categories" required defaultValue={listing?.parentCategory ?? ""} className={styles.input} />
            <datalist id="parent-categories">
              {parents.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
            <span className={styles.hint}>Pick an existing one to keep the filters tidy, or type a new one.</span>
          </div>
          {input("category", "Specific category", { required: true })}
          {input("tags", "Tags (comma-separated)")}
          {input("author", "Posted by / contact name", { required: true })}
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="l-description">
            Description
          </label>
          <textarea id="l-description" name="description" rows={4} required defaultValue={listing?.description ?? ""} className={styles.input} />
        </div>
      </section>
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Contact &amp; location</h2>
        <p className={styles.cardLead}>A listing with a street address or city gets a map in its details popup.</p>
        <div className={styles.grid2}>
          {input("phone", "Phone")}
          {input("email", "Public email")}
          {input("website", "Website", { placeholder: "example.com" })}
          {input("googleMapUrl", "Google Maps link (optional)", { placeholder: "https://maps.app.goo.gl/…" })}
          {input("address", "Street address")}
          {input("city", "City")}
          {input("state", "State", { width: 100 })}
          {input("zip", "ZIP", { width: 120 })}
        </div>
      </section>
      <section className={styles.card}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="l-status">
            Status
          </label>
          <select id="l-status" name="status" defaultValue={listing?.status ?? "APPROVED"} className={styles.select} style={{ width: 260 }}>
            <option value="APPROVED">Approved — shown in the public directory</option>
            <option value="PENDING">Pending — waiting for review</option>
            <option value="REJECTED">Rejected — not shown</option>
          </select>
        </div>
      </section>
    </ActionForm>
  );
}
