import { useI18n } from "@/i18n";
export function DispatchStatus() {
  const { locale } = useI18n();
  return (
    <p role="status" className="rounded-lg border border-border p-4 text-sm">
      {locale === "hi"
        ? "कोई कॉल या संदेश नहीं भेजा गया है। नीचे कॉल या संदेश का मसौदा खोलें। मदद आने की पुष्टि नहीं है।"
        : "No call or message has been sent. Choose a call or message draft below. Help has not been confirmed."}
    </p>
  );
}
