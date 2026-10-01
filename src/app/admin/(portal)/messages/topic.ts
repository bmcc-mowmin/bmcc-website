import { CONTACT_TOPICS, isContactTopic } from "@/lib/contact/topics";
import { getDictionary } from "@/lib/i18n/dictionary";

// Admin is English: the topic's English title.
export const topicLabel = (topic: string | null) => (isContactTopic(topic) ? getDictionary("en")[CONTACT_TOPICS[topic]] : "General question");
