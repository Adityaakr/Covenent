import { SiteLayout } from "../components/SiteLayout";
import { ContactMain } from "../sections/contact/ContactMain";
import { ContactPromises } from "../sections/contact/ContactPromises";
import { ContactFAQ } from "../sections/contact/ContactFAQ";

/** /contact (Framer page q0GecTnYS): Contact Main, Contact Promises, Contact FAQ. */
export function ContactPage() {
  return (
    <SiteLayout current="/contact">
      <ContactMain />
      <ContactPromises />
      <ContactFAQ />
    </SiteLayout>
  );
}
