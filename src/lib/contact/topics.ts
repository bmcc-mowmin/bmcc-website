import type { MessageKey } from "@/lib/i18n/dictionary";

// What a contact message is about. Pages link to /about?topic=<id>#contact (contactHref), and the
// form preselects that topic so the office knows which service the visitor came from.
export const CONTACT_TOPICS = {
  dua: "svc_dua_title",
  counseling: "svc_counseling_title",
  imam: "svc_imam_title",
  immigration: "svc_immigration_title",
  nikah: "svc_nikah_title",
  divorce: "svc_divorce_title",
  facility: "svc_facility_title",
  pantry: "a_pantry_title",
  refugee: "a_refugee_title",
  clothing: "a_clothing_title",
  furniture: "a_furniture_title",
  vehicle: "a_vehicle_title",
  idea: "involved_idea_title",
} as const satisfies Record<string, MessageKey>;

export type ContactTopic = keyof typeof CONTACT_TOPICS;

export const isContactTopic = (v: unknown): v is ContactTopic => typeof v === "string" && Object.hasOwn(CONTACT_TOPICS, v);
